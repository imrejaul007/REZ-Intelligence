/**
 * Session Manager for Agent OS
 *
 * Manages user sessions across Agent OS and Support Copilot
 */

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.CONTEXT_TTL = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get or create session
   */
  getOrCreate(userId, namespace = 'general') {
    const sessionId = `${userId}:${namespace}`;

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        userId,
        namespace,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messages: [],
        context: {
          userId,
          namespace,
          preferences: {},
          history: []
        },
        routing: null,
        handlers: {
          agentOS: [],
          support: []
        }
      });
    }

    const session = this.sessions.get(sessionId);
    session.lastActivity = new Date().toISOString();
    return session;
  }

  /**
   * Add message to session
   */
  addMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push({
      ...message,
      timestamp: new Date().toISOString()
    });

    // Track routing history
    if (message.routing) {
      session.routing = message.routing;
      if (message.routing.route === 'agent-os') {
        session.handlers.agentOS.push(message.timestamp);
      } else {
        session.handlers.support.push(message.timestamp);
      }
    }
  }

  /**
   * Update context
   */
  updateContext(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.context = {
      ...session.context,
      ...updates
    };
  }

  /**
   * Get routing stats for session
   */
  getRoutingStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const agentOSCount = session.handlers.agentOS.length;
    const supportCount = session.handlers.support.length;
    const total = agentOSCount + supportCount;

    return {
      agentOS: agentOSCount,
      support: supportCount,
      total,
      agentOSPercentage: total > 0 ? (agentOSCount / total * 100).toFixed(0) : 0,
      supportPercentage: total > 0 ? (supportCount / total * 100).toFixed(0) : 0
    };
  }

  /**
   * Clean up old sessions
   */
  cleanup() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (now - lastActivity > this.CONTEXT_TTL) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Cleanup every 5 minutes
setInterval(() => {
  // sessions cleanup would happen here
}, 5 * 60 * 1000);

module.exports = SessionManager;
