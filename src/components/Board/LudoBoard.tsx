import React, { useMemo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getCellCoords, Point } from '../../lib/boardMap';
import { Player, Token, ChatMessage, PlayerColor } from '../../types/game';
import { useSounds } from '../../hooks/useSounds';
import { LudoEngine } from '../../lib/engine';
import { START_POSITIONS } from '../../lib/constants';

interface Props {
  players: Player[];
  onTokenClick: (tokenId: string) => void;
  canMoveToken: (tokenId: string) => boolean;
  messages: ChatMessage[];
  diceValue: number | null;
  activeColor: string; // currently active player's color
}

const COLOR_HEX: Record<string, string> = {
  RED: '#fa5252', GREEN: '#40c057', YELLOW: '#fcc419', BLUE: '#339af0',
};

// Bubble anchor positions (near each base corner, in SVG units)
const BUBBLE_ANCHOR: Record<string, { x: number; y: number }> = {
  RED:    { x: 10, y: 4  },
  GREEN:  { x: 90, y: 4  },
  YELLOW: { x: 90, y: 96 },
  BLUE:   { x: 10, y: 96 },
};

// Corner rect origins for each color (in SVG units, cellSize = 100/15)
const CORNER: Record<string, { x: number; y: number }> = {
  RED:    { x: 0,              y: 0              },
  GREEN:  { x: 100 * 9 / 15,  y: 0              },
  YELLOW: { x: 100 * 9 / 15,  y: 100 * 9 / 15  },
  BLUE:   { x: 0,              y: 100 * 9 / 15  },
};
const CORNER_SIZE = 100 * 6 / 15; // 6 cells wide/tall

export const LudoBoard: React.FC<Props> = ({
  players,
  onTokenClick,
  canMoveToken,
  messages,
  diceValue,
  activeColor,
}) => {
  const cellSize = 100 / 15;
  const prevTokensPosRef = useRef<Record<string, number>>({});
  const { playSound } = useSounds();
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [landEffects, setLandEffects] = useState<
    { id: string; x: number; y: number; color: string }[]
  >([]);
  const [particles, setParticles] = useState<
    { id: string; x: number; y: number; color: string; vx: number; vy: number; life: number }[]
  >([]);

  // Particle physics
  useEffect(() => {
    if (particles.length === 0) return;
    const id = setInterval(() => {
      setParticles(prev =>
        prev
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.08, life: p.life - 0.04 }))
          .filter(p => p.life > 0)
      );
    }, 16);
    return () => clearInterval(id);
  }, [particles.length]);

  const spawnParticles = (x: number, y: number, color: string, count = 16) => {
    setParticles(prev => [
      ...prev,
      ...Array.from({ length: count }, () => ({
        id: Math.random().toString(36).slice(2),
        x, y,
        vx: (Math.random() - 0.5) * 2.2,
        vy: (Math.random() - 1.1) * 2,
        color,
        life: 1,
      })),
    ]);
  };

  // Capture & finish VFX
  const prevTokensRef = useRef<Token[]>([]);
  useEffect(() => {
    const current = players.flatMap(p => p.tokens);
    current.forEach(token => {
      const prev = prevTokensRef.current.find(t => t.id === token.id);
      if (!prev) return;
      if (token.isFinished && !prev.isFinished) {
        const c = getCellCoords(token.position, token.color as PlayerColor);
        if (c) spawnParticles(c.x * cellSize + cellSize / 2, c.y * cellSize + cellSize / 2, 'gold', 32);
        playSound('WIN');
      }
      if (token.position < 0 && prev.position >= 0) {
        const c = getCellCoords(prev.position, token.color as PlayerColor);
        if (c) spawnParticles(c.x * cellSize + cellSize / 2, c.y * cellSize + cellSize / 2, '#ef4444', 20);
        playSound('CAPTURE');
      }
    });
    prevTokensRef.current = current;
  }, [players]);

  // Latest chat messages per sender (within 5s)
  const latestMessages = useMemo(() => {
    const map: Record<string, ChatMessage> = {};
    messages.forEach(m => {
      if (Date.now() - m.timestamp < 5000) map[m.senderId] = m;
    });
    return map;
  }, [messages]);

  // ─── Cell renderer ───────────────────────────────────────────────
  const renderCell = (r: number, c: number) => {
    const isCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
    const isPath = (r >= 6 && r <= 8) || (c >= 6 && c <= 8);
    if (isCenter || !isPath) return null;

    let fill = 'white';

    // Home straight tracks
    if (r === 7 && c > 0 && c < 6)   fill = 'url(#tr)';
    if (c === 7 && r > 0 && r < 6)   fill = 'url(#tg)';
    if (r === 7 && c > 8 && c < 14)  fill = 'url(#ty)';
    if (c === 7 && r > 8 && r < 14)  fill = 'url(#tb)';

    // Starting squares
    if (r === 6 && c === 1)  fill = '#fa5252';
    if (r === 1 && c === 8)  fill = '#40c057';
    if (r === 8 && c === 13) fill = '#fcc419';
    if (r === 13 && c === 6) fill = '#339af0';

    // Safe star squares
    const stars = [{ r:6,c:1},{r:1,c:8},{r:8,c:13},{r:13,c:6},{r:8,c:2},{r:2,c:6},{r:6,c:12},{r:12,c:8}];
    const isStar = stars.some(s => s.r === r && s.c === c);

    return (
      <g key={`${r}-${c}`}>
        <rect
          x={c * cellSize} y={r * cellSize}
          width={cellSize} height={cellSize}
          fill={fill}
          stroke="#e2e8f0" strokeWidth="0.12"
          className="dark:stroke-slate-700"
        />
        {isStar && (
          <text
            x={c * cellSize + cellSize / 2}
            y={r * cellSize + cellSize / 2}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={cellSize * 0.55}
            opacity="0.5"
          >
            ⭐
          </text>
        )}
      </g>
    );
  };

  // ─── Token layout helpers ────────────────────────────────────────
  const tokensByCell: Record<string, string[]> = {};
  players.forEach(p =>
    p.tokens.forEach(t => {
      const coord = getCellCoords(t.position, p.color);
      const key = `${coord.x},${coord.y}`;
      if (!tokensByCell[key]) tokensByCell[key] = [];
      tokensByCell[key].push(t.id);
    })
  );

  const getOffset = (tokenId: string, key: string) => {
    const list = tokensByCell[key] || [];
    if (list.length <= 1) return { x: 0, y: 0 };
    const idx = list.indexOf(tokenId);
    const angle = (idx / list.length) * 2 * Math.PI;
    const r = cellSize * 0.28;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  };

  const getPathPoints = (start: number, end: number, color: string): Point[] => {
    if (start < 0 && end >= 0) return [getCellCoords(end, color)];
    if (start >= 0 && end > start) {
      return Array.from({ length: end - start + 1 }, (_, i) => getCellCoords(start + i, color));
    }
    return [getCellCoords(end, color)];
  };

  return (
    <div className="relative w-full aspect-square rounded-[2.5rem] overflow-visible"
         style={{ filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.35))' }}>

      {/* Board border ring */}
      <div className="absolute inset-0 rounded-[2.5rem] ring-4 ring-white/20 dark:ring-white/5 pointer-events-none" />

      <svg
        viewBox="0 0 100 100"
        className="w-full h-full rounded-[2.5rem] overflow-visible"
        style={{ background: 'white' }}
      >
        <defs>
          {/* Home-track tints */}
          <linearGradient id="tr" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff1f2"/><stop offset="100%" stopColor="#fecaca"/>
          </linearGradient>
          <linearGradient id="tg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0fdf4"/><stop offset="100%" stopColor="#bbf7d0"/>
          </linearGradient>
          <linearGradient id="ty" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fefce8"/><stop offset="100%" stopColor="#fef08a"/>
          </linearGradient>
          <linearGradient id="tb" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0f9ff"/><stop offset="100%" stopColor="#bae6fd"/>
          </linearGradient>

          {/* Base fills */}
          <linearGradient id="gr" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff8787"/><stop offset="100%" stopColor="#fa5252"/>
          </linearGradient>
          <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#69db7c"/><stop offset="100%" stopColor="#40c057"/>
          </linearGradient>
          <linearGradient id="gy" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd43b"/><stop offset="100%" stopColor="#fcc419"/>
          </linearGradient>
          <linearGradient id="gb" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#74c0fc"/><stop offset="100%" stopColor="#339af0"/>
          </linearGradient>

          <filter id="tshadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/>
            <feOffset dx="0.5" dy="1.5"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Board background */}
        <rect width="100" height="100" fill="white"/>

        {/* Corner bases */}
        <rect x="0"            y="0"            width={cellSize*6} height={cellSize*6} fill="url(#gr)" rx="3"/>
        <rect x={cellSize*9}   y="0"            width={cellSize*6} height={cellSize*6} fill="url(#gg)" rx="3"/>
        <rect x={cellSize*9}   y={cellSize*9}   width={cellSize*6} height={cellSize*6} fill="url(#gy)" rx="3"/>
        <rect x="0"            y={cellSize*9}   width={cellSize*6} height={cellSize*6} fill="url(#gb)" rx="3"/>

        {/* Active player home glow — pulses on the active corner */}
        {activeColor && CORNER[activeColor] && (
          <motion.rect
            x={CORNER[activeColor].x}
            y={CORNER[activeColor].y}
            width={CORNER_SIZE}
            height={CORNER_SIZE}
            rx="3"
            fill={COLOR_HEX[activeColor] || '#6366f1'}
            animate={{ opacity: [0, 0.22, 0] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* White inner token slots */}
        {[0,1,2,3].map(i => (
          <rect key={i}
            x={(i===0||i===3 ? 1 : 10) * cellSize}
            y={(i<2 ? 1 : 10) * cellSize}
            width={cellSize*4} height={cellSize*4}
            fill="white" rx="2.5" opacity="0.92"
          />
        ))}

        {/* Slot circles */}
        {[0,1,2,3].map(i => (
          <React.Fragment key={i}>
            {[0,1,2,3].map(j => {
              const xBase = (i===0||i===3 ? 1.5 : 10.5);
              const yBase = (i<2 ? 1.5 : 10.5);
              const col = ['#fa5252','#40c057','#fcc419','#339af0'][i];
              return (
                <g key={j} transform={`translate(${(xBase+(j%2)*3)*cellSize},${(yBase+Math.floor(j/2)*3)*cellSize})`}>
                  <circle r={cellSize*0.72} fill={col} opacity="0.06"/>
                  <circle r={cellSize*0.52} fill="white" stroke={col} strokeWidth="0.18" opacity="0.65"/>
                </g>
              );
            })}
          </React.Fragment>
        ))}

        {/* Path grid */}
        {Array.from({length:15}).map((_,r)=>Array.from({length:15}).map((_,c)=>renderCell(r,c)))}

        {/* Center triangles */}
        <polygon points="40,40 60,40 50,50" fill="url(#gg)" stroke="white" strokeWidth="0.4"/>
        <polygon points="60,40 60,60 50,50" fill="url(#gy)" stroke="white" strokeWidth="0.4"/>
        <polygon points="60,60 40,60 50,50" fill="url(#gb)" stroke="white" strokeWidth="0.4"/>
        <polygon points="40,60 40,40 50,50" fill="url(#gr)" stroke="white" strokeWidth="0.4"/>

        {/* Path preview for hovered token */}
        <AnimatePresence>
          {hoveredToken && diceValue && (() => {
            const token = players.flatMap(p => p.tokens).find(t => t.id === hoveredToken);
            const player = players.find(p => p.tokens.some(t => t.id === hoveredToken));
            if (!token || !player) return null;
            const path = LudoEngine.getPreviewPath(token, diceValue, player.color);
            return (
              <g key="preview">
                {path.map((pos, i) => {
                  const c = getCellCoords(pos, player.color);
                  return (
                    <motion.circle key={`${pos}-${i}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.35 }}
                      exit={{ scale: 0, opacity: 0 }}
                      cx={c.x * cellSize + cellSize/2}
                      cy={c.y * cellSize + cellSize/2}
                      r={cellSize/4}
                      fill={COLOR_HEX[player.color] || '#6366f1'}
                    />
                  );
                })}
              </g>
            );
          })()}
        </AnimatePresence>

        {/* Tokens */}
        {players.map(player =>
          player.tokens.map(token => {
            const coords = getCellCoords(token.position, player.color);
            const offset = getOffset(token.id, `${coords.x},${coords.y}`);
            const pathPoints = getPathPoints(
              prevTokensPosRef.current[token.id] ?? token.position,
              token.position,
              player.color
            );
            const pathX = pathPoints.map(p => p.x * cellSize + cellSize / 2);
            const pathY = pathPoints.map(p => p.y * cellSize + cellSize / 2);
            const isClickable = canMoveToken(token.id);
            const color = COLOR_HEX[player.color] || '#6366f1';

            // eslint-disable-next-line react-hooks/rules-of-hooks
            useEffect(() => {
              prevTokensPosRef.current[token.id] = token.position;
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
                  duration: pathX.length > 1 ? pathX.length * 0.13 : 0.38,
                  ease: 'easeInOut',
                }}
                onAnimationComplete={() => {
                  if (pathX.length > 1 && !token.isFinished) {
                    playSound('MOVE');
                    const eff = {
                      id: Date.now().toString(),
                      x: coords.x * cellSize + cellSize / 2,
                      y: coords.y * cellSize + cellSize / 2,
                      color,
                    };
                    setLandEffects(prev => [...prev, eff]);
                    setTimeout(() => setLandEffects(prev => prev.slice(1)), 900);
                  }
                }}
                onMouseEnter={() => isClickable && setHoveredToken(token.id)}
                onMouseLeave={() => setHoveredToken(null)}
                onClick={() => isClickable && onTokenClick(token.id)}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
                filter="url(#tshadow)"
              >
                {/* Shadow blob */}
                <ellipse rx={cellSize*0.38} ry={cellSize*0.13} cy={cellSize*0.36} fill="rgba(0,0,0,0.18)"/>

                {/* Token body — 3-layer for depth */}
                <circle r={cellSize*0.38} fill={color} stroke="rgba(255,255,255,0.7)" strokeWidth="0.55"/>
                {/* inner rim */}
                <circle r={cellSize*0.28} fill="transparent" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4"/>
                {/* specular highlight */}
                <circle r={cellSize*0.16} cx={-cellSize*0.1} cy={-cellSize*0.12}
                        fill="white" opacity="0.35"/>

                {/* Finished crown */}
                {token.isFinished && (
                  <text textAnchor="middle" dominantBaseline="middle" fontSize={cellSize*0.36} y="1">
                    👑
                  </text>
                )}

                {/* Pulse ring for clickable tokens */}
                {isClickable && (
                  <motion.circle
                    r={cellSize * 0.58}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.55"
                    animate={{ scale: [1, 1.45, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                  />
                )}
              </motion.g>
            );
          })
        )}

        {/* Landing ripple effects */}
        {landEffects.map(eff => (
          <motion.g key={eff.id} transform={`translate(${eff.x},${eff.y})`}>
            <motion.circle
              initial={{ r: 0, opacity: 0.8 }}
              animate={{ r: cellSize * 1.2, opacity: 0 }}
              transition={{ duration: 0.8 }}
              fill="none" stroke={eff.color} strokeWidth="0.6"
            />
          </motion.g>
        ))}

        {/* Particle burst */}
        {particles.map(p => (
          <circle
            key={p.id}
            cx={p.x} cy={p.y}
            r={Math.max(0.1, cellSize * 0.1 * p.life)}
            fill={p.color === 'gold' ? '#fbbf24' : p.color}
            opacity={p.life}
          />
        ))}

        {/* Chat speech bubbles anchored near each base */}
        {players.map(player => {
          const msg = latestMessages[player.id];
          const anchor = BUBBLE_ANCHOR[player.color];
          if (!anchor) return null;
          return (
            <AnimatePresence key={`bubble-${player.id}`}>
              {msg && (
                <motion.g
                  initial={{ opacity: 0, scale: 0.6, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  key={msg.id}
                  transform={`translate(${anchor.x},${anchor.y})`}
                >
                  <rect x={-13} y={-4} width={26} height={8} rx={4}
                        fill="#1e293b" opacity="0.92"/>
                  <text textAnchor="middle" dominantBaseline="middle"
                        fontSize={cellSize*0.42} fill="white" fontWeight="bold" y="0.5">
                    {msg.emoji || (msg.text.length > 8 ? msg.text.slice(0,7)+'…' : msg.text)}
                  </text>
                </motion.g>
              )}
            </AnimatePresence>
          );
        })}
      </svg>
    </div>
  );
};
