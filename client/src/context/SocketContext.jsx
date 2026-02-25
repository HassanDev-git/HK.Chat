import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('hkchat_token');
    if (!token) return;

    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('user:online', ({ userId, isOnline }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    socket.on('user:offline', ({ userId }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const emit = (event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  };

  const on = (event, callback) => {
    socketRef.current?.on(event, callback);
  };

  const off = (event, callback) => {
    socketRef.current?.off(event, callback);
  };

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      onlineUsers,
      emit, on, off
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
