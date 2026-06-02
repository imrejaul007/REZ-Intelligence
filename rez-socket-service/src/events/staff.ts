import { Server, Socket } from 'socket.io';

interface ServiceRequest {
  id: string;
  hotelId: string;
  roomNumber: string;
  type: 'room_service' | 'housekeeping' | 'spa' | 'laundry';
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
}

export function setupStaffEvents(io: Server) {
  const staff = io.of('/staff');

  staff.on('connection', (socket: Socket) => {
    socket.on('join-hotel', (hotelId: string) => {
      socket.join(`hotel:${hotelId}`);
    });

    socket.on('request:created', (request: ServiceRequest) => {
      staff.to(`hotel:${request.hotelId}`).emit('request:new', request);
    });

    socket.on('request:assigned', (data: { requestId: string; hotelId: string; staffId: string }) => {
      staff.to(`hotel:${data.hotelId}`).emit('request:assigned', data);
    });

    socket.on('request:updated', (data: { requestId: string; hotelId: string; status: string }) => {
      staff.to(`hotel:${data.hotelId}`).emit('request:status', data);
    });

    socket.on('sla:warning', (data: { requestId: string; hotelId: string; minutesRemaining: number }) => {
      staff.to(`hotel:${data.hotelId}`).emit('sla:warning', data);
    });

    socket.on('sla:breach', (data: { requestId: string; hotelId: string }) => {
      staff.to(`hotel:${data.hotelId}`).emit('sla:breach', data);
    });
  });
}
