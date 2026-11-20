import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { verifyAuthToken } from '../middleware/auth.js';

let ioInstance: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const decoded = verifyAuthToken(token);
        socket.data.userId = decoded.userId;
      }
      next();
    } catch {
      // Allow unauthenticated connection for public features like Fav Lector
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('join:conversation', (conversationId: string) => {
      if (typeof conversationId === 'string' && conversationId.length > 0) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on('leave:conversation', (conversationId: string) => {
      if (typeof conversationId === 'string' && conversationId.length > 0) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    socket.on('typing', (payload: { conversationId: string; isTyping: boolean }) => {
      if (payload?.conversationId) {
        socket.to(`conversation:${payload.conversationId}`).emit('typing', {
          conversationId: payload.conversationId,
          userId,
          isTyping: Boolean(payload.isTyping),
        });
      }
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): Server | null {
  return ioInstance;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  ioInstance?.to(`user:${userId}`).emit(event, payload);
}

export function emitToConversation(conversationId: string, event: string, payload: unknown): void {
  ioInstance?.to(`conversation:${conversationId}`).emit(event, payload);
}

export function emitBattleUpdate(battleId: string, payload: unknown): void {
  ioInstance?.emit(`battle:${battleId}`, payload);
  ioInstance?.emit('battle:update', payload);
}
