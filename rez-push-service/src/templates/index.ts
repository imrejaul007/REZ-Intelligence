export interface PushPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

interface NotificationTemplates {
  order_created: (orderId: string) => PushPayload;
  order_ready: (orderId: string) => PushPayload;
  loyalty_milestone: (milestone: string, coins: number) => PushPayload;
  streak_at_risk: (streakDays: number) => PushPayload;
  tier_upgrade: (newTier: string, bonus: number) => PushPayload;
  staff_request: (room: string, type: string) => PushPayload;
  sla_warning: (requestId: string, minutesLeft: number) => PushPayload;
  campaign_reward: (coins: number) => PushPayload;
}

export const templates: NotificationTemplates = {
  order_created: (orderId) => ({
    title: 'Order Received',
    body: `Order #${orderId} has been placed`,
    data: { type: 'order', orderId },
  }),

  order_ready: (orderId) => ({
    title: 'Order Ready',
    body: `Order #${orderId} is ready for pickup/delivery`,
    data: { type: 'order', orderId },
  }),

  loyalty_milestone: (milestone, coins) => ({
    title: 'Milestone Reached!',
    body: `You unlocked "${milestone}" and earned ${coins} coins!`,
    data: { type: 'milestone', milestone },
  }),

  streak_at_risk: (days) => ({
    title: 'Streak at Risk!',
    body: `Your ${days}-day streak will reset tomorrow. Check in to save it!`,
    data: { type: 'streak' },
  }),

  tier_upgrade: (tier, bonus) => ({
    title: 'Tier Upgraded!',
    body: `Welcome to ${tier}! Bonus: ${bonus} coins`,
    data: { type: 'tier_upgrade' },
  }),

  staff_request: (room, type) => ({
    title: `New ${type} request`,
    body: `Room ${room} needs ${type}`,
    data: { type: 'staff_request' },
  }),

  sla_warning: (requestId, minutesLeft) => ({
    title: 'SLA Warning',
    body: `Request #${requestId} has ${minutesLeft}min left`,
    data: { type: 'sla_warning', requestId },
  }),

  campaign_reward: (coins) => ({
    title: 'Campaign Reward!',
    body: `You earned ${coins} REZ Coins!`,
    data: { type: 'campaign_reward' },
  }),
};
