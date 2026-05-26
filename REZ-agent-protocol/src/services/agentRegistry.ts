import crypto from 'crypto';
import { Agent, AgentCapability, Task, Message } from '../types/index.js';
import { logger } from './utils/logger.js';

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private capabilities: Map<string, AgentCapability[]> = new Map();
  private messages: Message[] = [];
  private tasks: Map<string, Task> = new Map();

  registerAgent(agent: Agent): Agent {
    agent.status = 'available';
    this.agents.set(agent.id, agent);

    this.capabilities.set(agent.id, agent.capabilities);

    logger.info(`Agent registered: ${agent.name} (${agent.id}) with ${agent.capabilities.length} capabilities`);
    return agent;
  }

  deregisterAgent(agentId: string): boolean {
    const deleted = this.agents.delete(agentId);
    this.capabilities.delete(agentId);
    logger.info(`Agent deregistered: ${agentId}`);
    return deleted;
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByCapability(category: string): Agent[] {
    const results: Agent[] = [];

    for (const agent of this.agents.values()) {
      const caps = this.capabilities.get(agent.id);
      if (caps?.some(c => c.category === category)) {
        results.push(agent);
      }
    }

    return results;
  }

  findCapability(name: string): { agent: Agent; capability: AgentCapability }[] {
    const results: { agent: Agent; capability: AgentCapability }[] = [];

    for (const agent of this.agents.values()) {
      const caps = this.capabilities.get(agent.id);
      const matching = caps?.filter(c => c.name.toLowerCase().includes(name.toLowerCase()));
      if (matching) {
        for (const cap of matching) {
          results.push({ agent, capability: cap });
        }
      }
    }

    return results;
  }

  async sendTask(task: Task): Promise<string> {
    const taskId = crypto.randomUUID();
    const fullTask = { ...task, id: taskId };
    this.tasks.set(taskId, fullTask);

    const message: Message = {
      id: crypto.randomUUID(),
      type: 'request',
      from: task.fromAgent,
      to: task.toAgent,
      taskId,
      payload: task.payload,
      timestamp: new Date().toISOString()
    };
    this.messages.push(message);

    logger.info(`Task ${taskId} sent from ${task.fromAgent} to ${task.toAgent}`);
    return taskId;
  }

  async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const msg: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };
    this.messages.push(msg);

    logger.info(`Message ${msg.id}: ${msg.type} from ${msg.from} to ${msg.to}`);
    return msg;
  }

  getMessages(agentId: string): Message[] {
    return this.messages.filter(m => m.to === agentId || m.from === agentId);
  }

  getTasks(agentId: string): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.toAgent === agentId || t.fromAgent === agentId);
  }

  getStats(): {
    totalAgents: number;
    byStatus: Record<string, number>;
    byCapability: Record<string, number>;
    totalMessages: number;
    totalTasks: number;
  } {
    const byStatus: Record<string, number> = {};
    const byCapability: Record<string, number> = {};

    for (const agent of this.agents.values()) {
      byStatus[agent.status] = (byStatus[agent.status] || 0) + 1;

      for (const cap of agent.capabilities) {
        byCapability[cap.category] = (byCapability[cap.category] || 0) + 1;
      }
    }

    return {
      totalAgents: this.agents.size,
      byStatus,
      byCapability,
      totalMessages: this.messages.length,
      totalTasks: this.tasks.size
    };
  }

  discover(capability: string): { agent: Agent; capability: AgentCapability; matchScore: number }[] {
    const results: { agent: Agent; capability: AgentCapability; matchScore: number }[] = [];

    for (const agent of this.agents.values()) {
      const caps = this.capabilities.get(agent.id);
      if (!caps) continue;

      for (const cap of caps) {
        const nameMatch = cap.name.toLowerCase().includes(capability.toLowerCase()) ? 0.5 : 0;
        const descMatch = cap.description.toLowerCase().includes(capability.toLowerCase()) ? 0.3 : 0;
        const categoryMatch = cap.category.toLowerCase() === capability.toLowerCase() ? 0.2 : 0;

        const score = nameMatch + descMatch + categoryMatch;
        if (score > 0) {
          results.push({ agent, capability: cap, matchScore: score });
        }
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }
}

export const agentRegistry = new AgentRegistry();
