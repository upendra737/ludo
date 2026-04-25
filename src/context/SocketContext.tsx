/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import { useGameStore } from '../store/useGameStore';

// Get or create persistent userId
const getUserId = () => {
  let userId = localStorage.getItem('ludo_user_id');
  if (!userId) {
    userId = nanoid();
    localStorage.setItem('ludo_user_id', userId);
  }
  return userId;
};

interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => {
  const { socket } = useContext(SocketContext);
  const { setConnected, setGameState, setMe, setError } = useGameStore();

  const createRoom = (name: string) => {
    socket?.emit('room:create', { name, userId: getUserId() });
  };

  const joinRoom = (code: string, name: string) => {
    socket?.emit('room:join', { code, name, userId: getUserId() });
  };

  const setReady = () => {
    socket?.emit('room:ready');
  };

  const rollDice = () => {
    socket?.emit('game:roll-dice');
  };

  const moveToken = (tokenId: string) => {
    socket?.emit('game:move-token', { tokenId });
  };

  const sendChat = (text: string) => {
    socket?.emit('game:send-chat', { text });
  };

  const sendEmoji = (emoji: string) => {
    socket?.emit('game:send-emoji', { emoji });
  };

  const leaveRoom = () => {
    socket?.emit('room:leave');
    useGameStore.getState().reset();
  };

  const restartGame = () => {
    socket?.emit('game:restart');
  };

  const fillBots = () => {
    socket?.emit('room:fill-bots');
  };

  return {
    socket,
    createRoom,
    joinRoom,
    setReady,
    rollDice,
    moveToken,
    sendChat,
    sendEmoji,
    leaveRoom,
    restartGame,
    fillBots,
  };
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const { setConnected, setGameState, setMe, setError } = useGameStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (socketRef.current) return;

    const socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket server:', socket.id);
      setConnected(true);
      // Authenticate with persistent userId
      socket.emit('room:auth', { userId: getUserId() });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket Connection Error:', error);
      setError('Connection lost. Attempting to reconnect...');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
      setConnected(false);
    });

    socket.on('room:joined', ({ player, roomState }) => {
      setMe(player);
      setGameState(roomState);
      setError(null);
    });

    socket.on('room:update', (state) => {
      setGameState(state);
    });

    socket.on('room:error', (err) => {
      setError(err);
    });

    setIsInitialized(true);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
};
