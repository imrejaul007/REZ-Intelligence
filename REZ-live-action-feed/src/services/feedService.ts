/**
 * REZ Live Action Feed Service
 */
import { FeedItem, AgentStatus, IFeedItem } from '../models/index.js';
import { createLogger } from '../utils/logger.js';
import { Server as SocketServer, Socket } from 'socket.io';

const logger = createLogger('live-feed');

export class LiveFeedService {
  private io: SocketServer | null = null;

  setSocketIO(io: SocketServer) {
    this.io = io;
  }

  async addFeedItem(tenantId: string, data: {
    entity_type: string; entity_id: string; agent_id: string; agent_name: string;
    action_type: string; action: string; description: string;
    status?: string; result?: Record<string, unknown>; error?: string; duration_ms?: number; confidence?: number; metadata?: Record<string, unknown>;
  }): Promise<IFeedItem> {
    const item = await FeedItem.create({
      tenant_id: tenantId, ...data, timestamp: new Date(),
    });

    // Broadcast to connected clients
    if (this.io) {
      this.io.to(`tenant:${tenantId}`).emit('feed:item', item);
      if (data.entity_id) {
        this.io.to(`entity:${data.entity_id}`).emit('feed:item', item);
      }
    }

    // Update agent status
    await this.updateAgentStatus(tenantId, data.agent_id, data.agent_name, data.status === 'completed' ? 'success' : data.status === 'failed' ? 'failed' : 'running', data.action);

    logger.info('feed_item_added', { tenantId, agentId: data.agent_id, action: data.action });
    return item;
  }

  async updateFeedItem(tenantId: string, itemId: string, updates: {
    status?: string; result?: Record<string, unknown>; error?: string; duration_ms?: number;
  }): Promise<IFeedItem | null> {
    const item = await FeedItem.findOneAndUpdate(
      { _id: itemId, tenant_id: tenantId },
      updates,
      { new: true }
    );

    if (item && this.io) {
      this.io.to(`tenant:${tenantId}`).emit('feed:update', item);
      this.io.to(`entity:${item.entity_id}`).emit('feed:update', item);
    }

    return item;
  }

  async getFeed(tenantId: string, options: {
    entityId?: string; agentId?: string; actionType?: string; status?: string; limit?: number;
  } = {}): Promise<IFeedItem[]> {
    const query: Record<string, unknown> = { tenant_id: tenantId };
    if (options.entityId) query.entity_id = options.entityId;
    if (options.agentId) query.agent_id = options.agentId;
    if (options.actionType) query.action_type = options.actionType;
    if (options.status) query.status = options.status;

    return FeedItem.find(query).sort({ timestamp: -1 }).limit(options.limit || 50);
  }

  async getRunningActions(tenantId: string): Promise<IFeedItem[]> {
    return FeedItem.find({ tenant_id: tenantId, status: 'running' }).sort({ timestamp: -1 });
  }

  async getAgentStatuses(tenantId: string): Promise<IAgentStatus[]> {
    return AgentStatus.find({ tenant_id: tenantId });
  }

  async getAgentStatus(tenantId: string, agentId: string): Promise<IAgentStatus | null> {
    return AgentStatus.findOne({ tenant_id: tenantId, agent_id: agentId });
  }

  private async updateAgentStatus(tenantId: string, agentId: string, agentName: string, status: string, action?: string): Promise<void> {
    const update: Record<string, unknown> = {
      agent_id: agentId, name: agentName, status: status === 'success' ? 'idle' : status === 'failed' ? 'error' : 'running',
      current_action: action,
    };

    if (status === 'success') {
      update.actions_today = 1;
      update.actions_success = 1;
      update.last_action = new Date();
    } else if (status === 'failed') {
      update.actions_failed = 1;
    }

    await AgentStatus.findOneAndUpdate(
      { tenant_id: tenantId, agent_id: agentId },
      {
        tenant_id: tenantId,
        agent_id: agentId,
        name: agentName,
        ...update,
      },
      { upsert: true, new: true }
    );
  }

  async registerAgent(tenantId: string, agentId: string, agentName: string, agentType: string): Promise<IAgentStatus> {
    return AgentStatus.findOneAndUpdate(
      { tenant_id: tenantId, agent_id: agentId },
      { tenant_id: tenantId, agent_id: agentId, name: agentName, type: agentType, status: 'idle' },
      { upsert: true, new: true }
    );
  }

  async unregisterAgent(tenantId: string, agentId: string): Promise<void> {
    await AgentStatus.deleteOne({ tenant_id: tenantId, agent_id: agentId });
  }

  async getStats(tenantId: string, entityId?: string): Promise<{
    total_actions: number; completed: number; failed: number; running: number;
    actions_by_type: Record<string, number>; top_agents: Array<{ agent_id: string; count: number }>;
  }> {
    const query: Record<string, unknown> = { tenant_id: tenantId };
    if (entityId) query.entity_id = entityId;

    const items = await FeedItem.find(query);
    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let completed = 0, failed = 0, running = 0;

    items.forEach(item => {
      byType[item.action_type] = (byType[item.action_type] || 0) + 1;
      byAgent[item.agent_id] = (byAgent[item.agent_id] || 0) + 1;
      if (item.status === 'completed') completed++;
      else if (item.status === 'failed') failed++;
      else if (item.status === 'running') running++;
    });

    const topAgents = Object.entries(byAgent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agent_id, count]) => ({ agent_id, count }));

    return {
      total_actions: items.length,
      completed, failed, running,
      actions_by_type: byType,
      top_agents: topAgents,
    };
  }
}

let instance: LiveFeedService | null = null;
export function getFeedService(): LiveFeedService {
  if (!instance) instance = new LiveFeedService();
  return instance;
}
