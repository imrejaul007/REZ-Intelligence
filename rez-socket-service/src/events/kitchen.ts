import { Server, Socket } from 'socket.io';

interface KDSOrder {
  id: string;
  orderId: string;
  storeId: string;
  tableNumber?: string;
  items: KDSItem[];
  status: 'pending' | 'preparing' | 'ready' | 'served';
  createdAt: Date;
}

interface KDSItem {
  id: string;
  name: string;
  quantity: number;
  status: 'pending' | 'preparing' | 'ready';
  notes?: string;
}

export function setupKitchenEvents(io: Server) {
  const kitchen = io.of('/kitchen');

  kitchen.on('connection', (socket: Socket) => {
    socket.on('join-store', (storeId: string) => {
      socket.join(`store:${storeId}`);
      console.log(`Kitchen joined store: ${storeId}`);
    });

    socket.on('order:created', (order: KDSOrder) => {
      kitchen.to(`store:${order.storeId}`).emit('order:new', order);
    });

    socket.on('order:status', (data: { orderId: string; storeId: string; status: string }) => {
      kitchen.to(`store:${data.storeId}`).emit('order:updated', data);
    });

    socket.on('item:status', (data: { orderId: string; itemId: string; storeId: string; status: string }) => {
      kitchen.to(`store:${data.storeId}`).emit('item:updated', data);
    });
  });
}

export { KDSOrder, KDSItem };
