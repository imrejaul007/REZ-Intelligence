import { FLNode, FLNodeStatus, FederatedConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class NodeManager {
  private nodes: Map<string, FLNode> = new Map();
  private nodeHeartbeats: Map<string, NodeJS.Timeout> = new Map();

  registerNode(
    nodeId: string,
    nodeName: string,
    organizationId?: string,
    capabilities?: FLNode['capabilities']
  ): FLNode {
    const node: FLNode = {
      nodeId,
      nodeName,
      organizationId,
      status: 'registered',
      datasetsCount: 0,
      totalSamples: 0,
      lastActive: new Date(),
      capabilities: capabilities || {
        maxBatchSize: 1000,
        supportsSecureAggregation: false,
        supportsDifferentialPrivacy: true
      },
      performance: {
        avgRoundTime: 0,
        roundsCompleted: 0,
        successRate: 1.0
      }
    };

    this.nodes.set(nodeId, node);
    this.startHeartbeat(nodeId);

    logger.info(`Node registered: ${nodeName} (${nodeId})`);
    return node;
  }

  deregisterNode(nodeId: string): boolean {
    this.stopHeartbeat(nodeId);
    const deleted = this.nodes.delete(nodeId);
    if (deleted) {
      logger.info(`Node deregistered: ${nodeId}`);
    }
    return deleted;
  }

  getNode(nodeId: string): FLNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): FLNode[] {
    return Array.from(this.nodes.values());
  }

  getActiveNodes(): FLNode[] {
    return Array.from(this.nodes.values()).filter(n => n.status !== 'offline');
  }

  getNodesByStatus(status: FLNodeStatus): FLNode[] {
    return Array.from(this.nodes.values()).filter(n => n.status === status);
  }

  updateNodeStatus(nodeId: string, status: FLNodeStatus): boolean {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = status;
      node.lastActive = new Date();
      this.nodes.set(nodeId, node);
      return true;
    }
    return false;
  }

  updateNodeMetrics(
    nodeId: string,
    metrics: { samplesProcessed?: number; roundTime?: number; success?: boolean }
  ): boolean {
    const node = this.nodes.get(nodeId);
    if (node) {
      if (metrics.samplesProcessed) {
        node.totalSamples += metrics.samplesProcessed;
      }
      if (metrics.roundTime) {
        const totalRounds = node.performance.roundsCompleted;
        const currentAvg = node.performance.avgRoundTime;
        node.performance.avgRoundTime = (currentAvg * totalRounds + metrics.roundTime) / (totalRounds + 1);
        node.performance.roundsCompleted += 1;
      }
      if (metrics.success !== undefined) {
        const totalAttempts = node.performance.roundsCompleted;
        node.performance.successRate =
          (node.performance.successRate * (totalAttempts - 1) + (metrics.success ? 1 : 0)) / totalAttempts;
      }
      node.lastActive = new Date();
      this.nodes.set(nodeId, node);
      return true;
    }
    return false;
  }

  selectNodesForRound(config: FederatedConfig, requiredCount: number): FLNode[] {
    const activeNodes = this.getActiveNodes();

    if (activeNodes.length === 0) {
      logger.warn('No active nodes available for training round');
      return [];
    }

    const shuffled = this.shuffleArray(activeNodes);
    const selected = shuffled.slice(0, Math.min(requiredCount, config.maxNodesPerRound));

    for (const node of selected) {
      this.updateNodeStatus(node.nodeId, 'training');
    }

    logger.info(`Selected ${selected.length} nodes for training round`);
    return selected;
  }

  releaseNodesForRound(nodeIds: string[]): void {
    for (const nodeId of nodeIds) {
      this.updateNodeStatus(nodeId, 'idle');
    }
  }

  checkNodeHealth(): { healthy: string[]; unhealthy: string[] } {
    const healthy: string[] = [];
    const unhealthy: string[] = [];
    const now = Date.now();

    for (const [nodeId, node] of this.nodes.entries()) {
      const inactiveThreshold = 5 * 60 * 1000;
      if (node.lastActive && now - node.lastActive.getTime() > inactiveThreshold) {
        this.updateNodeStatus(nodeId, 'offline');
        unhealthy.push(nodeId);
      } else {
        healthy.push(nodeId);
      }
    }

    return { healthy, unhealthy };
  }

  private startHeartbeat(nodeId: string): void {
    this.stopHeartbeat(nodeId);

    const interval = setInterval(() => {
      const node = this.nodes.get(nodeId);
      if (node && node.status !== 'offline') {
        node.lastActive = new Date();
        this.nodes.set(nodeId, node);
      }
    }, 30000);

    this.nodeHeartbeats.set(nodeId, interval);
  }

  private stopHeartbeat(nodeId: string): void {
    const interval = this.nodeHeartbeats.get(nodeId);
    if (interval) {
      clearInterval(interval);
      this.nodeHeartbeats.delete(nodeId);
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getNodeStats(): {
    total: number;
    byStatus: Record<FLNodeStatus, number>;
    totalSamples: number;
    avgSuccessRate: number;
  } {
    const nodes = this.getAllNodes();
    const byStatus: Record<FLNodeStatus, number> = {
      registered: 0,
      training: 0,
      idle: 0,
      offline: 0,
      error: 0
    };

    let totalSamples = 0;
    let totalSuccess = 0;

    for (const node of nodes) {
      byStatus[node.status]++;
      totalSamples += node.totalSamples;
      totalSuccess += node.performance.successRate;
    }

    return {
      total: nodes.length,
      byStatus,
      totalSamples,
      avgSuccessRate: nodes.length > 0 ? totalSuccess / nodes.length : 0
    };
  }
}

export const nodeManager = new NodeManager();
