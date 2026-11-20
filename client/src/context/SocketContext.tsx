import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getStoredToken } from '../api/client';
import type { AppNotification, ChatMessage } from '../types';
import { useAuth } from './AuthContext';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, setCounts } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = getStoredToken();

    const client = io('/', {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
    });

    client.on('connect', () => setConnected(true));
    client.on('disconnect', () => setConnected(false));

    if (user) {
      client.on('notification:new', (_notification: AppNotification) => {
        setCounts((prev) => ({
          ...prev,
          unreadNotifications: prev.unreadNotifications + 1,
        }));
      });

      client.on('message:new', (msg: ChatMessage) => {
        if (msg.senderId !== user.id) {
          setCounts((prev) => ({
            ...prev,
            unreadMessages: prev.unreadMessages + 1,
          }));
        }
      });
    }

    setSocket(client);
    return () => {
      client.disconnect();
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
