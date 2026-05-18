import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import { PlayerColor } from '../types/game';
import { useGameStore } from '../store/useGameStore';
import { useProfileStore } from '../store/useProfileStore';

const getUserId = () => {
  let id = localStorage.getItem('ludo_user_id');
  if (!id) { id = nanoid(); localStorage.setItem('ludo_user_id', id); }
  return id;
};

interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => {
  const { socket } = useContext(SocketContext);
  const { setGameState, setMe, setError } = useGameStore();

  const createRoom  = (name: string)                      => socket?.emit('room:create', { name, userId: getUserId() });
  const joinRoom    = (code: string, name: string)         => socket?.emit('room:join', { code, name, userId: getUserId() });
  const updateProfile = (name: string, avatar: string)    => socket?.emit('profile:update', { name, avatar });
  const setReady    = ()                                   => socket?.emit('room:ready');
  const pickColor   = (color: PlayerColor)                 => socket?.emit('room:pick-color', { color });
  const addBot      = (count: number)                      => socket?.emit('room:add-bot', { count });
  const rollDice    = ()                                   => socket?.emit('game:roll-dice');
  const moveToken   = (tokenId: string)                    => socket?.emit('game:move-token', { tokenId });
  const sendChat    = (text: string)                       => socket?.emit('game:send-chat', { text });
  const sendEmoji   = (emoji: string)                      => socket?.emit('game:send-emoji', { emoji });
  const restartGame = ()                                   => socket?.emit('game:restart');
  const leaveRoom   = ()                                   => { socket?.emit('room:leave'); useGameStore.getState().reset(); };
  /** @deprecated use addBot */
  const fillBots    = ()                                   => socket?.emit('room:fill-bots');

  return { socket, createRoom, joinRoom, updateProfile, setReady, pickColor, addBot, fillBots, rollDice, moveToken, sendChat, sendEmoji, leaveRoom, restartGame };
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const { setConnected, setGameState, setMe, setError } = useGameStore();
  const [, setInitialized] = useState(false);

  useEffect(() => {
    if (socketRef.current) return;

    const socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:auth', { userId: getUserId() });
      const p = useProfileStore.getState();
      if (p.name) socket.emit('profile:update', { name: p.name, avatar: p.avatar });
    });
    socket.on('connect_error', ()    => setError('Connection lost. Reconnecting…'));
    socket.on('disconnect',    ()    => setConnected(false));
    socket.on('room:joined',   ({ player, roomState }) => { setMe(player); setGameState(roomState); setError(null); });
    socket.on('room:update',   state => setGameState(state));
    socket.on('room:error',    err   => setError(err));
    socket.on('profile:state', pf    => useProfileStore.getState().setStats(pf.wins, pf.games));

    setInitialized(true);
    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
};
