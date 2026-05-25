import { v4 as uuidv4 } from 'uuid';
import {
  ProcessedOrchestrationRequest,
  AgentCapability,
} from '../models/OrchestrationRequest';
import {
  CollaborationDetails,
  CollaborationConfig,
  CollaborationResult,
  CollaborationStrategy,
  CollaborationPhase,
  AgentParticipation,
  Task,
  CollaborationMessage,
  SynthesisResult,
} from '../models/CollaborationDetails';
import { AgentInfo } from './agentRegistry';
import { ProcessingContext } from './messageProcessor';
import { AgentSwitcher } from './agentSwitcher';
import { appConfig } from '../config';
import { logger } from '../utils/logger';

export class CollaborationManager {
  private agentRegistry;
  private agentSwitcher: AgentSwitcher;
  private defaultConfig: CollaborationConfig;

  constructor(agentSwitcher: AgentSwitcher) {
    this.agentSwitcher = agentSwitcher;
    this.defaultConfig = {
      maxAgents: appConfig.collaboration.maxAgents,
      strategy: appConfig.collaboration.strategy,
      timeoutMs: appConfig.collaboration.timeoutMs,
      allowDynamicParticipantAddition: true,
      conflictResolutionStrategy: 'coordinator_decides',
      synthesisMethod: 'merge',
      requireConsensus: false,
      consensusThreshold: 0.75,
    };
  }

  setAgentRegistry(registry): void {
    this.agentRegistry = registry;
  }

  async shouldCollaborate(request: ProcessedOrchestrationRequest): Promise<boolean> {
    const message = request.message.toLowerCase();
    const complexityIndicators = [
      'compare', 'analyze', 'evaluate', 'multiple',
      'both', 'all', 'various', 'different aspects',
      'comprehensive', 'thorough'
    ];

    const complexityScore = complexityIndicators.filter(
      indicator => message.includes(indicator)
    ).length;

    // Collaborate if message is complex or explicitly requested
    return complexityScore >= 2 ||
      request.routingHints?.collaborationMode === 'collaborative';
  }

  async orchestrate(
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext
  ): Promise<CollaborationResult> {
    const collaborationId = uuidv4();
    const config = this.defaultConfig;
    const startTime = Date.now();

    const collaboration: CollaborationDetails = {
      collaborationId,
      strategy: config.strategy,
      goal: request.message,
      participants: [],
      tasks: [],
      messages: [],
      phase: 'initiation',
      maxAgents: config.maxAgents,
      timeoutMs: config.timeoutMs,
      createdAt: new Date().toISOString(),
    };

    logger.info('Starting collaboration', {
      collaborationId,
      strategy: config.strategy,
      requestId: request.requestId,
    });

    try {
      // Phase 1: Planning - select and invite agents
      collaboration.phase = 'planning';
      const selectedAgents = await this.selectCollaborationAgents(request, config);

      for (const agent of selectedAgents) {
        collaboration.participants.push({
          agentId: agent.agentId,
          agentName: agent.name,
          role: 'contributor',
          capabilities: agent.capabilities,
          status: 'accepted',
        });
      }

      // Phase 2: Execution - run tasks based on strategy
      collaboration.phase = 'execution';
      collaboration.startedAt = new Date().toISOString();

      const tasks = await this.createTasks(request, collaboration);
      collaboration.tasks = tasks;

      const taskResults = await this.executeTasks(
        tasks,
        collaboration,
        config,
        request,
        context
      );

      // Phase 3: Synthesis - combine results
      collaboration.phase = 'synthesis';
      const synthesis = await this.synthesizeResults(
        taskResults,
        collaboration,
        config
      );
      collaboration.synthesis = synthesis;

      // Phase 4: Completion
      collaboration.phase = 'completion';
      collaboration.completedAt = new Date().toISOString();
      collaboration.totalProcessingTimeMs = Date.now() - startTime;

      const completedParticipants = collaboration.participants.map(p => ({
        ...p,
        status: 'completed' as const,
        endTime: new Date().toISOString(),
      }));

      const successRate = taskResults.filter(t => t.status === 'completed').length / taskResults.length;

      logger.info('Collaboration completed', {
        collaborationId,
        totalTimeMs: collaboration.totalProcessingTimeMs,
        successRate,
      });

      return {
        collaborationId,
        success: successRate >= 0.5,
        strategy: collaboration.strategy,
        participants: completedParticipants,
        synthesis,
        totalProcessingTimeMs: collaboration.totalProcessingTimeMs!,
        taskCompletionRate: successRate,
        conflictsResolved: 0,
      };
    } catch (error) {
      collaboration.phase = 'failed';
      logger.error('Collaboration failed', {
        collaborationId,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      throw error;
    }
  }

  private async selectCollaborationAgents(
    request: ProcessedOrchestrationRequest,
    config: CollaborationConfig
  ): Promise<AgentInfo[]> {
    const capabilities = this.inferRequiredCapabilities(request.message);
    const agents: AgentInfo[] = [];

    // Select agents for different capabilities
    for (const capability of capabilities) {
      if (agents.length >= config.maxAgents) break;

      const agent = await this.agentRegistry.findBestAgent(
        [capability],
        request.routingHints?.preferredAgents,
        request.routingHints?.excludedAgents
      );

      if (agent && !agents.find(a => a.agentId === agent.agentId)) {
        agents.push(agent);
      }
    }

    // If we need more agents, select general-purpose agents
    while (agents.length < Math.min(2, config.maxAgents)) {
      const generalAgent = await this.agentRegistry.findBestAgent(
        ['natural_language'],
        agents.map(a => a.agentId),
        request.routingHints?.excludedAgents
      );

      if (generalAgent && !agents.find(a => a.agentId === generalAgent.agentId)) {
        agents.push(generalAgent);
      } else {
        break;
      }
    }

    return agents;
  }

  private inferRequiredCapabilities(message: string): AgentCapability[] {
    const capabilities: AgentCapability[] = [];
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('code')) {
      capabilities.push('code_analysis', 'code_generation');
    }

    if (lowerMessage.includes('data') || lowerMessage.includes('analyze')) {
      capabilities.push('data_processing');
    }

    if (lowerMessage.includes('image') || lowerMessage.includes('visual')) {
      capabilities.push('image_analysis');
    }

    if (lowerMessage.includes('translate') || lowerMessage.includes('language')) {
      capabilities.push('translation');
    }

    if (capabilities.length === 0) {
      capabilities.push('natural_language');
    }

    return [...new Set(capabilities)];
  }

  private async createTasks(
    request: ProcessedOrchestrationRequest,
    collaboration: CollaborationDetails
  ): Promise<Task[]> {
    const tasks: Task[] = [];
    const subtasks = this.splitIntoSubtasks(request.message);

    for (let i = 0; i < subtasks.length && i < collaboration.maxAgents; i++) {
      const subtask = subtasks[i];
      const participant = collaboration.participants[i];

      if (participant) {
        tasks.push({
          taskId: uuidv4(),
          description: subtask,
          requiredCapabilities: this.inferRequiredCapabilities(subtask),
          assignedAgentId: participant.agentId,
          priority: 5,
          status: 'pending',
          dependencies: i > 0 ? [tasks[i - 1].taskId] : undefined,
        });
      }
    }

    return tasks;
  }

  private splitIntoSubtasks(message: string): string[] {
    // Simple splitting by common delimiters
    const sentences = message.split(/[.!?]+/).filter(s => s.trim());

    if (sentences.length <= 2) {
      return [
        `Analyze: ${message}`,
        `Provide insights: ${message}`,
      ];
    }

    // Group sentences into subtasks
    const mid = Math.ceil(sentences.length / 2);
    return [
      sentences.slice(0, mid).join('. ') + '.',
      sentences.slice(mid).join('. ') + '.',
    ];
  }

  private async executeTasks(
    tasks: Task[],
    collaboration: CollaborationDetails,
    config: CollaborationConfig,
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext
  ): Promise<Task[]> {
    const timeout = config.timeoutMs;

    switch (config.strategy) {
      case 'sequential':
        return this.executeSequential(tasks, collaboration, request, context, timeout);
      case 'parallel':
        return this.executeParallel(tasks, collaboration, request, context, timeout);
      case 'hierarchical':
        return this.executeHierarchical(tasks, collaboration, request, context, timeout);
      default:
        return this.executeSequential(tasks, collaboration, request, context, timeout);
    }
  }

  private async executeSequential(
    tasks: Task[],
    collaboration: CollaborationDetails,
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext,
    timeout: number
  ): Promise<Task[]> {
    const results: Task[] = [];

    for (const task of tasks) {
      try {
        task.status = 'in_progress';
        task.startTime = new Date().toISOString();

        const agent = collaboration.participants.find(
          p => p.agentId === task.assignedAgentId
        );

        if (!agent) {
          task.status = 'failed';
          continue;
        }

        const agentInfo = await this.agentRegistry.getAgent(agent.agentId);
        if (!agentInfo) {
          task.status = 'failed';
          continue;
        }

        // Add context from previous tasks
        const previousResults = results
          .filter(t => t.status === 'completed' && t.result)
          .map(t => t.result)
          .join('\n\n');

        const enhancedRequest: ProcessedOrchestrationRequest = {
          ...request,
          message: previousResults
            ? `${task.description}\n\nContext from other agents:\n${previousResults}`
            : task.description,
        };

        const taskContext: ProcessingContext = {
          ...context,
          requestId: uuidv4(),
          startTime: Date.now(),
        };

        const response = await this.agentSwitcher.routeToAgent(
          agentInfo,
          enhancedRequest,
          taskContext
        );

        task.result = response.content;
        task.status = 'completed';
        task.endTime = new Date().toISOString();
        task.processingTimeMs = Date.now() - new Date(task.startTime).getTime();

        agent.contribution = response.content;
        agent.endTime = task.endTime;
        agent.processingTimeMs = task.processingTimeMs;

        results.push(task);
      } catch (error) {
        task.status = 'failed';
        task.endTime = new Date().toISOString();

        logger.error('Task execution failed', {
          taskId: task.taskId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    return results;
  }

  private async executeParallel(
    tasks: Task[],
    collaboration: CollaborationDetails,
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext,
    timeout: number
  ): Promise<Task[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const taskPromises = tasks.map(async (task) => {
      try {
        task.status = 'in_progress';
        task.startTime = new Date().toISOString();

        const agent = collaboration.participants.find(
          p => p.agentId === task.assignedAgentId
        );

        if (!agent) {
          task.status = 'failed';
          return task;
        }

        const agentInfo = await this.agentRegistry.getAgent(agent.agentId);
        if (!agentInfo) {
          task.status = 'failed';
          return task;
        }

        const taskRequest: ProcessedOrchestrationRequest = {
          ...request,
          message: task.description,
        };

        const taskContext: ProcessingContext = {
          ...context,
          requestId: uuidv4(),
          startTime: Date.now(),
        };

        const response = await this.agentSwitcher.routeToAgent(
          agentInfo,
          taskRequest,
          taskContext
        );

        task.result = response.content;
        task.status = 'completed';
        task.endTime = new Date().toISOString();
        task.processingTimeMs = Date.now() - new Date(task.startTime).getTime();

        agent.contribution = response.content;
        agent.endTime = task.endTime;
        agent.processingTimeMs = task.processingTimeMs;

        return task;
      } catch (error) {
        task.status = 'failed';
        task.endTime = new Date().toISOString();
        return task;
      }
    });

    try {
      const results = await Promise.all(taskPromises);
      clearTimeout(timeoutId);
      return results;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async executeHierarchical(
    tasks: Task[],
    collaboration: CollaborationDetails,
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext,
    timeout: number
  ): Promise<Task[]> {
    // First, execute in parallel
    const results = await this.executeParallel(tasks, collaboration, request, context, timeout);

    // Then, have a coordinator synthesize
    const coordinator = collaboration.participants.find(p => p.role === 'coordinator');
    if (coordinator) {
      const synthesisTask: Task = {
        taskId: uuidv4(),
        description: 'Synthesize all results',
        requiredCapabilities: ['reasoning', 'natural_language'],
        assignedAgentId: coordinator.agentId,
        priority: 10,
        status: 'pending',
      };

      try {
        synthesisTask.status = 'in_progress';
        synthesisTask.startTime = new Date().toISOString();

        const coordinatorInfo = await this.agentRegistry.getAgent(coordinator.agentId);
        if (coordinatorInfo) {
          const combinedResults = results
            .filter(t => t.result)
            .map((t, i) => `Result ${i + 1}: ${t.result}`)
            .join('\n\n');

          const synthesisRequest: ProcessedOrchestrationRequest = {
            ...request,
            message: `Synthesize the following results into a coherent response:\n\n${combinedResults}`,
          };

          const synthesisContext: ProcessingContext = {
            ...context,
            requestId: uuidv4(),
            startTime: Date.now(),
          };

          const response = await this.agentSwitcher.routeToAgent(
            coordinatorInfo,
            synthesisRequest,
            synthesisContext
          );

          synthesisTask.result = response.content;
          synthesisTask.status = 'completed';
        }
      } catch (error) {
        synthesisTask.status = 'failed';
      }

      synthesisTask.endTime = new Date().toISOString();
      synthesisTask.processingTimeMs = synthesisTask.startTime
        ? Date.now() - new Date(synthesisTask.startTime).getTime()
        : 0;

      results.push(synthesisTask);
    }

    return results;
  }

  private async synthesizeResults(
    taskResults: Task[],
    collaboration: CollaborationDetails,
    config: CollaborationConfig
  ): Promise<SynthesisResult> {
    const startTime = Date.now();
    const completedTasks = taskResults.filter(t => t.status === 'completed');

    if (completedTasks.length === 0) {
      return {
        synthesizedContent: 'No results to synthesize',
        synthesisMethod: 'concatenation',
        agentContributions: [],
        confidence: 0,
        processingTimeMs: 0,
      };
    }

    let synthesizedContent: string;
    let method = config.synthesisMethod;

    switch (method) {
      case 'concatenation':
        synthesizedContent = completedTasks
          .map((t, i) => `Part ${i + 1}:\n${t.result}`)
          .join('\n\n---\n\n');
        break;

      case 'merge':
        synthesizedContent = this.mergeResults(completedTasks);
        break;

      case 'ai_summary':
        synthesizedContent = this.aiSummarizeResults(completedTasks);
        break;

      default:
        synthesizedContent = completedTasks.map(t => t.result).join('\n\n');
    }

    const contributions = completedTasks.map(task => {
      const participant = collaboration.participants.find(
        p => p.agentId === task.assignedAgentId
      );
      return {
        agentId: task.assignedAgentId || '',
        agentName: participant?.agentName || 'Unknown',
        contributionWeight: 1 / completedTasks.length,
        keyPoints: this.extractKeyPoints(task.result || ''),
      };
    });

    return {
      synthesizedContent,
      synthesisMethod: method,
      agentContributions: contributions,
      confidence: completedTasks.length / taskResults.length,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private mergeResults(tasks: Task[]): string {
    // Simple merge: interleave results based on their task order
    const paragraphs: string[] = [];

    for (const task of tasks) {
      if (task.result) {
        const lines = task.result.split('\n').filter(l => l.trim());
        paragraphs.push(...lines.slice(0, 3)); // Take first 3 lines per result
      }
    }

    return paragraphs.join('\n');
  }

  private aiSummarizeResults(tasks: Task[]): string {
    // Placeholder for AI-based summarization
    // In production, this would call a specialized agent
    const allContent = tasks.map(t => t.result).filter(Boolean).join('\n\n');
    return `Summary of ${tasks.length} contributions:\n\n${allContent.slice(0, 500)}${allContent.length > 500 ? '...' : ''}`;
  }

  private extractKeyPoints(text: string): string[] {
    // Simple key point extraction
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    return sentences.slice(0, 3).map(s => s.trim());
  }
}

export const createCollaborationManager = (
  agentSwitcher: AgentSwitcher
): CollaborationManager => {
  return new CollaborationManager(agentSwitcher);
};
