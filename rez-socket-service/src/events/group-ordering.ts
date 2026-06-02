import { Server, Socket } from 'socket.io';

interface GroupSession {
  code: string;
  storeId: string;
  members: string[];
}

export function setupGroupEvents(io: Server) {
  const groups = io.of('/groups');

  groups.on('connection', (socket: Socket) => {
    socket.on('join', (sessionCode: string) => {
      socket.join(`group:${sessionCode}`);
      socket.data.sessionCode = sessionCode;
    });

    socket.on('leave', (sessionCode: string) => {
      socket.leave(`group:${sessionCode}`);
    });

    socket.on('member:join', (data: { sessionCode: string; userId: string; name: string }) => {
      groups.to(`group:${data.sessionCode}`).emit('member:joined', data);
    });

    socket.on('item:add', (data: { sessionCode: string; item: unknown }) => {
      groups.to(`group:${data.sessionCode}`).emit('item:added', data);
    });

    socket.on('item:remove', (data: { sessionCode: string; itemId: string }) => {
      groups.to(`group:${data.sessionCode}`).emit('item:removed', data);
    });

    socket.on('order:placed', (data: { sessionCode: string; orderId: string }) => {
      groups.to(`group:${data.sessionCode}`).emit('order:ready', data);
    });

    socket.on('session:end', (sessionCode: string) => {
      groups.to(`group:${sessionCode}`).emit('session:ended', { sessionCode });
    });
  });
}
