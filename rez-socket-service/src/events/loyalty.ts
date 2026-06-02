import { Server, Socket } from 'socket.io';

interface LoyaltyEvent {
  userId: string;
  type: 'points_earned' | 'points_redeemed' | 'tier_upgrade' | 'reward_unlocked';
  points?: number;
  tier?: string;
  reward?: string;
  timestamp: Date;
}

export function setupLoyaltyEvents(io: Server) {
  const loyalty = io.of('/loyalty');

  loyalty.on('connection', (socket: Socket) => {
    socket.on('join-user', (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`Loyalty user joined: ${userId}`);
    });

    socket.on('points:earned', (data: { userId: string; points: number; source: string }) => {
      loyalty.to(`user:${data.userId}`).emit('points:update', {
        points: data.points,
        source: data.source,
        timestamp: new Date(),
      });
    });

    socket.on('tier:upgrade', (data: { userId: string; newTier: string; previousTier: string }) => {
      loyalty.to(`user:${data.userId}`).emit('tier:updated', {
        newTier: data.newTier,
        previousTier: data.previousTier,
        timestamp: new Date(),
      });
    });

    socket.on('reward:unlocked', (data: { userId: string; reward: string; expiresAt?: Date }) => {
      loyalty.to(`user:${data.userId}`).emit('reward:new', {
        reward: data.reward,
        expiresAt: data.expiresAt,
        timestamp: new Date(),
      });
    });

    socket.on('points:redeemed', (data: { userId: string; points: number; reward: string }) => {
      loyalty.to(`user:${data.userId}`).emit('redeemption:confirmed', {
        points: data.points,
        reward: data.reward,
        timestamp: new Date(),
      });
    });
  });
}
