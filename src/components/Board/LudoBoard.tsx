/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getCellCoords, Point } from '../../lib/boardMap';
import { Player, Token, ChatMessage, PlayerColor, GameMove } from '../../types/game';
import { useSounds } from '../../hooks/useSounds';
import { LudoEngine } from '../../lib/engine';
import { START_POSITIONS } from '../../lib/constants';

interface Props {
  players: Player[];
  onTokenClick: (tokenId: string) => void;
  canMoveToken: (tokenId: string) => boolean;
  messages: ChatMessage[];
  diceValue: number | null;
}

export const LudoBoard: React.FC<Props> = ({ players, onTokenClick, canMoveToken, messages, diceValue }) => {
  const cellSize = 100 / 15;
  const prevTokensPosRef = useRef<Record<string, number>>({});
  const { playSound } = useSounds();
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [landEffects, setLandEffects] = useState<{ id: string; x: number; y: number; color: string }[]>([]);
  const [particles, setParticles] = useState<{ id: string; x: number; y: number; color: string; vx: number; vy: number; life: number }[]>([]);

  // Particle System Update
  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.1, // Gravity
        life: p.life - 0.05
      })).filter(p => p.life > 0));
    }, 16);
    return () => clearInterval(interval);
  }, [particles.length]);

  const createParticles = (x: number, y: number, color: string, count = 15) => {
    const newParticles = Array.from({ length: count }).map((_, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 1) * 2,
      color,
      life: 1
    }));
    setParticles(prev => [...prev, ...newParticles]);
  };

  // Helper to get avatar coordinates (outside base)
  const getAvatarPos = (color: string) => {
    switch (color) {
      case 'RED': return { x: cellSize * 1, y: -cellSize * 1.2 };
      case 'GREEN': return { x: cellSize * 14, y: -cellSize * 1.2 };
      case 'YELLOW': return { x: cellSize * 14, y: cellSize * 15 + cellSize * 1.2 };
      case 'BLUE': return { x: cellSize * 1, y: cellSize * 15 + cellSize * 1.2 };
      default: return { x: 0, y: 0 };
    }
  };

  // Track captures/finishes for VFX
  const prevTokensRef = useRef<Token[]>([]);
  useEffect(() => {
    const currentTokens = players.flatMap(p => p.tokens);
    currentTokens.forEach(token => {
      const prev = prevTokensRef.current.find(t => t.id === token.id);
      if (!prev) return;

      // Finish VFX
      if (token.isFinished && !prev.isFinished) {
        const coords = getCellCoords(token.position, token.color as PlayerColor);
        if (coords) createParticles(coords.x, coords.y, 'gold', 30);
        playSound('WIN');
      }

      // Capture VFX (Home position is -1 or 0-3 based on color usually, but let's check move)
      if (token.position < 0 && prev.position >= 0) {
        const coords = getCellCoords(prev.position, token.color as PlayerColor);
        if (coords) createParticles(coords.x, coords.y, '#ef4444', 20);
        playSound('CAPTURE');
      }
    });
    prevTokensRef.current = currentTokens;
  }, [players]);

  const calculateProgress = (player: Player) => {
    const totalSteps = player.tokens.reduce((acc, t) => {
      if (t.isFinished) return acc + 57;
      if (t.position < 0) return acc;
      
      const startPos = START_POSITIONS[player.color as PlayerColor];
      let steps;
      if (t.position < 52) {
        if (t.position >= startPos) {
          steps = t.position - startPos;
        } else {
          steps = (52 - startPos) + t.position;
        }
      } else {
        steps = 51 + (t.position - 52 + 1);
      }
      return acc + steps;
    }, 0);
    // 4 tokens * 57 max steps (0 to 57)
    return Math.min(100, Math.round((totalSteps / (4 * 57)) * 100));
  };

  const latestMessages = useMemo(() => {
    const map: Record<string, ChatMessage> = {};
    messages.forEach(m => {
      if (Date.now() - m.timestamp < 5000) {
        map[m.senderId] = m;
      }
    });
    return map;
  }, [messages]);

  const getPathPoints = (start: number, end: number, color: string): Point[] => {
    const points: Point[] = [];
    if (start < 0 && end >= 0) {
      points.push(getCellCoords(end, color));
    } else if (start >= 0 && end > start) {
      for (let i = start; i <= end; i++) {
        points.push(getCellCoords(i, color));
      }
    } else {
      points.push(getCellCoords(end, color));
    }
    return points;
  };

  const renderCell = (r: number, c: number) => {
    const isCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
    const isPath = (r >= 6 && r <= 8) || (c >= 6 && c <= 8);
    
    if (isCenter || !isPath) return null;

    let fill = "white";
    let isStar = false;

    // Home tracks
    if (r === 7 && c > 0 && c < 6) fill = "url(#grad-red-light)";
    if (c === 7 && r > 0 && r < 6) fill = "url(#grad-green-light)";
    if (r === 7 && c > 8 && c < 14) fill = "url(#grad-yellow-light)";
    if (c === 7 && r > 8 && r < 14) fill = "url(#grad-blue-light)";

    const starPoints = [{r:6,c:1},{r:1,c:8},{r:8,c:13},{r:13,c:6},{r:8,c:2},{r:2,c:6},{r:6,c:12},{r:12,c:8}];
    isStar = starPoints.some(p => p.r === r && p.c === c);
    
    // Starting squares
    if (r === 6 && c === 1) fill = "var(--color-red-start)";
    if (r === 1 && c === 8) fill = "var(--color-green-start)";
    if (r === 8 && c === 13) fill = "var(--color-yellow-start)";
    if (r === 13 && c === 6) fill = "var(--color-blue-start)";

    return (
      <g key={`${r}-${c}`}>
          <rect
            x={c * cellSize}
            y={r * cellSize}
            width={cellSize}
            height={cellSize}
            fill={fill}
            stroke="#f1f5f9"
            className="dark:stroke-slate-800 transition-colors duration-500"
            strokeWidth="0.1"
          />
        {isStar && (
          <g transform={`translate(${c * cellSize + cellSize/2}, ${r * cellSize + cellSize/2})`}>
            <motion.path
              d="M 0,-10 L 2.36,-3.63 L 9.05,-3.63 L 3.53,0.37 L 5.67,7.26 L 0,3.26 L -5.67,7.26 L -3.53,0.37 L -9.05,-3.63 L -2.36,-3.63 Z"
              style={{ scale: 0.25 }}
              fill="#94a3b8"
              className="opacity-40"
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ repeat: Infinity, duration: 3 }}
            />
          </g>
        )}
      </g>
    );
  };

  const tokensByCell: Record<string, string[]> = {};
  players.forEach(p => {
    p.tokens.forEach(t => {
      const coords = getCellCoords(t.position, p.color);
      const key = `${coords.x},${coords.y}`;
      if (!tokensByCell[key]) tokensByCell[key] = [];
      tokensByCell[key].push(t.id);
    });
  });

  const getTokenOffset = (tokenId: string, cellKey: string) => {
    const tokensInCell = tokensByCell[cellKey] || [];
    if (tokensInCell.length <= 1) return { x: 0, y: 0 };
    const index = tokensInCell.indexOf(tokenId);
    const angle = (index / tokensInCell.length) * 2 * Math.PI;
    const radius = cellSize * 0.3; // Reduced radius for better containment
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  };

  return (
    <div className="relative w-full max-w-[600px] aspect-square bg-[#f8fafc] dark:bg-slate-800 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.3)] dark:shadow-none rounded-[3rem] p-4 border-[12px] border-white dark:border-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 transition-colors duration-500">
      <svg viewBox="0 -12 100 124" className="w-full h-full rounded-3xl overflow-visible shadow-inner relative z-10 bg-white dark:bg-slate-900 transition-colors duration-500">
        <defs>
          <pattern id="wood" width="50" height="50" patternUnits="userSpaceOnUse">
            <rect width="50" height="50" fill="white" className="dark:fill-slate-900 transition-colors duration-500" />
            <path d="M0 25h50M25 0v50" stroke="#f1f5f9" className="dark:stroke-slate-800 transition-colors duration-500" strokeWidth="0.5" />
          </pattern>
          
          {/* Gradients for Home Tracks */}
          <linearGradient id="grad-red-light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff1f2" /><stop offset="100%" stopColor="#fecaca" />
          </linearGradient>
          <linearGradient id="grad-green-light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0fdf4" /><stop offset="100%" stopColor="#bbf7d0" />
          </linearGradient>
          <linearGradient id="grad-yellow-light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fefce8" /><stop offset="100%" stopColor="#fef08a" />
          </linearGradient>
          <linearGradient id="grad-blue-light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0f9ff" /><stop offset="100%" stopColor="#bae6fd" />
          </linearGradient>

          {/* Premium Base Gradients */}
          <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff8787" /><stop offset="100%" stopColor="#fa5252" />
          </linearGradient>
          <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#69db7c" /><stop offset="100%" stopColor="#40c057" />
          </linearGradient>
          <linearGradient id="grad-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd43b" /><stop offset="100%" stopColor="#fcc419" />
          </linearGradient>
          <linearGradient id="grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#74c0fc" /><stop offset="100%" stopColor="#339af0" />
          </linearGradient>

          <filter id="token-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dx="1" dy="2" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width="100" height="100" fill="url(#wood)" />
        
        {/* Bases */}
        <rect x="0" y="0" width={cellSize*6} height={cellSize*6} fill="url(#grad-red)" rx="4" />
        <rect x={cellSize*9} y="0" width={cellSize*6} height={cellSize*6} fill="url(#grad-green)" rx="4" />
        <rect x={cellSize*9} y={cellSize*9} width={cellSize*6} height={cellSize*6} fill="url(#grad-yellow)" rx="4" />
        <rect x="0" y={cellSize*9} width={cellSize*6} height={cellSize*6} fill="url(#grad-blue)" rx="4" />
        
        {/* Inner white boxes */}
        {[0, 1, 2, 3].map(i => (
          <rect 
            key={i}
            x={i === 0 || i === 3 ? cellSize*1 : cellSize*10} 
            y={i < 2 ? cellSize*1 : cellSize*10} 
            width={cellSize*4} height={cellSize*4} fill="white" rx="3" opacity="0.9" 
          />
        ))}
        
        {/* Base slot indicators */}
        {[0, 1, 2, 3].map(i => (
          <React.Fragment key={i}>
            {[0, 1, 2, 3].map(j => {
              const xBase = i === 0 || i === 3 ? 1.5 : 10.5;
              const yBase = i < 2 ? 1.5 : 10.5;
              const color = i === 0 ? '#fa5252' : i === 1 ? '#40c057' : i === 2 ? '#fcc419' : '#339af0';
              return (
                <g key={j} transform={`translate(${(xBase + (j%2)*3)*cellSize}, ${(yBase + Math.floor(j/2)*3)*cellSize})`}>
                  <circle r={cellSize*0.75} fill={color} opacity="0.05" />
                  <circle r={cellSize*0.55} fill="white" stroke={color} strokeWidth="0.15" className="opacity-60" />
                </g>
              );
            })}
          </React.Fragment>
        ))}

        {/* Path Grid */}
        {Array.from({ length: 15 }).map((_, r) => Array.from({ length: 15 }).map((_, c) => renderCell(r, c)))}

        {/* Center Triangles */}
        <polygon points="40,40 60,40 50,50" fill="url(#grad-green)" stroke="white" strokeWidth="0.5" />
        <polygon points="60,40 60,60 50,50" fill="url(#grad-yellow)" stroke="white" strokeWidth="0.5" />
        <polygon points="60,60 40,60 50,50" fill="url(#grad-blue)" stroke="white" strokeWidth="0.5" />
        <polygon points="40,60 40,40 50,50" fill="url(#grad-red)" stroke="white" strokeWidth="0.5" />

        {/* Preview Path for hovered token */}
        <AnimatePresence>
          {hoveredToken && diceValue && (
            <g key="path-preview">
              {(() => {
                const token = players.flatMap(p => p.tokens).find(t => t.id === hoveredToken);
                const player = players.find(p => p.tokens.find(t => t.id === hoveredToken));
                if (!token || !player) return null;
                const path = LudoEngine.getPreviewPath(token, diceValue, player.color);
                return path.map((pos, i) => {
                  const c = getCellCoords(pos, player.color);
                  return (
                    <motion.circle 
                      key={`${pos}-${i}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.3 }}
                      exit={{ scale: 0, opacity: 0 }}
                      cx={c.x * cellSize + cellSize/2} cy={c.y * cellSize + cellSize/2} r={cellSize/4}
                      fill={player.color === 'RED' ? '#fa5252' : player.color === 'GREEN' ? '#40c057' : player.color === 'YELLOW' ? '#fcc419' : '#339af0'}
                    />
                  );
                });
              })()}
            </g>
          )}
        </AnimatePresence>

        {/* Tokens */}
        {players.map(player => 
          player.tokens.map(token => {
            const currentPos = token.position;
            const prevPos = prevTokensRef.current[token.id] ?? currentPos;
            const pathPoints = getPathPoints(prevPos, currentPos, player.color);
            const pathX = pathPoints.map(p => p.x * cellSize + cellSize / 2);
            const pathY = pathPoints.map(p => p.y * cellSize + cellSize / 2);
            const isClickable = canMoveToken(token.id);
            const coords = getCellCoords(token.position, player.color);
            const offset = getTokenOffset(token.id, `${coords.x},${coords.y}`);
            
            useEffect(() => {
              if (prevTokensRef.current[token.id] !== token.position) {
                prevTokensRef.current[token.id] = token.position;
              }
            }, [token.position]);

            return (
              <motion.g
                key={token.id}
                initial={false}
                animate={{
                  x: pathX.length > 1 ? pathX : coords.x * cellSize + cellSize / 2 + offset.x,
                  y: pathY.length > 1 ? pathY : coords.y * cellSize + cellSize / 2 + offset.y,
                }}
                transition={{ 
                  duration: pathX.length > 1 ? pathX.length * 0.15 : 0.4,
                  ease: "easeInOut"
                }}
                onAnimationComplete={() => {
                  if (pathX.length > 1 && !token.isFinished) {
                    playSound('ROLL_LAND');
                    setLandEffects(prev => [...prev, { id: Date.now().toString(), x: coords.x * cellSize + cellSize / 2, y: coords.y * cellSize + cellSize / 2, color: player.color }]);
                    setTimeout(() => setLandEffects(prev => prev.slice(1)), 1000);
                  }
                }}
                onMouseEnter={() => isClickable && setHoveredToken(token.id)}
                onMouseLeave={() => setHoveredToken(null)}
                onClick={() => isClickable && onTokenClick(token.id)}
                className="cursor-pointer"
                filter="url(#token-shadow)"
              >
                <circle r={cellSize*0.45} fill="rgba(0,0,0,0.15)" cy={cellSize*0.1} />
                
                {/* 3D-like Token Body */}
                <circle r={cellSize*0.4} fill={player.color === 'RED' ? '#fa5252' : player.color === 'GREEN' ? '#40c057' : player.color === 'YELLOW' ? '#fcc419' : '#339af0'} stroke="white" strokeWidth="0.5" />
                <circle r={cellSize*0.25} cy={-cellSize*0.1} fill="white" opacity="0.3" fillOpacity="0.5" filter="blur(1px)" />
                <path d={`M ${-cellSize*0.3} ${cellSize*0.1} Q 0 ${cellSize*0.3} ${cellSize*0.3} ${cellSize*0.1} L 0 ${-cellSize*0.3} Z`} fill="white" opacity="0.1" />

                {isClickable && (
                  <motion.circle
                    r={cellSize * 0.6}
                    fill="none"
                    stroke={player.color === 'RED' ? '#fa5252' : '#6366f1'}
                    strokeWidth="0.5"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                )}
              </motion.g>
            );
          })
        )}

        {/* Landing Effects */}
        {landEffects.map(eff => (
          <motion.g key={eff.id} transform={`translate(${eff.x}, ${eff.y})`}>
            <motion.circle 
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              r={cellSize/2} stroke={eff.color === 'RED' ? '#fa5252' : '#40c057'} strokeWidth="1" fill="none"
            />
          </motion.g>
        ))}

        {/* Particles */}
        {particles.map(p => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={cellSize * 0.1 * p.life}
            fill={p.color === 'gold' ? '#fbbf24' : p.color}
            opacity={p.life}
          />
        ))}

        {/* Player Progress & Avatars outside bases */}
        {players.map(player => {
          const pos = getAvatarPos(player.color);
          const msg = latestMessages[player.id];
          const progress = calculateProgress(player);
          const colorCode = player.color === 'RED' ? 'var(--color-red-start)' : player.color === 'GREEN' ? 'var(--color-green-start)' : player.color === 'YELLOW' ? 'var(--color-yellow-start)' : 'var(--color-blue-start)';
          
          return (
            <g key={`avatar-${player.id}`}>
              {/* Progress Bar Background */}
              <rect 
                x={pos.x - cellSize * 1.5} 
                y={pos.y - cellSize * 0.4} 
                width={cellSize * 3} 
                height={cellSize * 0.8} 
                rx={cellSize * 0.4} 
                fill="#f1f5f9"
                className="dark:fill-slate-800 transition-colors duration-500" 
              />
              {/* Progress Bar Fill */}
              <motion.rect 
                initial={{ width: 0 }}
                animate={{ width: (cellSize * 3 * progress) / 100 }}
                x={pos.x - cellSize * 1.5} 
                y={pos.y - cellSize * 0.4} 
                height={cellSize * 0.8} 
                rx={cellSize * 0.4} 
                fill={colorCode}
                opacity="0.3"
              />
              
              {/* Progress Text */}
              <text 
                x={player.color === 'RED' || player.color === 'BLUE' ? pos.x + cellSize * 1.7 : pos.x - cellSize * 1.7} 
                y={pos.y} 
                textAnchor={player.color === 'RED' || player.color === 'BLUE' ? "start" : "end"} 
                dominantBaseline="middle" 
                fontSize={cellSize * 0.5} 
                fontWeight="900" 
                fill="#64748b"
                className="dark:fill-slate-500 transition-colors duration-500"
              >
                {progress}%
              </text>

              {/* Avatar Circle */}
              <circle cx={pos.x} cy={pos.y} r={cellSize * 0.7} fill="white" className="dark:fill-slate-900 shadow-lg transition-colors duration-500" />
              <circle cx={pos.x} cy={pos.y} r={cellSize * 0.6} fill={colorCode} opacity="1" />
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" fontSize={cellSize * 0.6} fontWeight="900" fill="white">
                {player.name[0].toUpperCase()}
              </text>

              <AnimatePresence>
                {msg && (
                  <motion.g initial={{ opacity: 0, y: 10, scale: 0.5 }} animate={{ opacity: 1, y: -cellSize * 1.2, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} key={`msg-${msg.id}`} transform={`translate(${pos.x}, ${pos.y})`}>
                    <rect x={-cellSize * 2.5} y={-cellSize * 0.75} width={cellSize * 5} height={cellSize * 1.5} rx={cellSize / 2} fill="#1e293b" />
                    <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fontSize={cellSize * 0.5} fontWeight="bold" fill="white">
                      {msg.emoji || (msg.text.length > 10 ? msg.text.substring(0, 8) + '...' : msg.text)}
                    </text>
                  </motion.g>
                )}
              </AnimatePresence>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
