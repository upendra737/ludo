export interface Point {
  x: number;
  y: number;
}

// Main path: 0–51, home stretches: 52–57 per colour, Base: negative positions
// Base slot centres (grid units) align exactly with the rendered circle centres.
//   Slot circles are placed at (xBase + col*3) × cellSize, (yBase + row*3) × cellSize
//   where xBase/yBase are the corner offsets (1.5 / 10.5) and col,row ∈ {0,1}.
//   Token centre = grid.x * cellSize + cellSize/2  →  grid.x = xBase + col*3 - 0.5
const BASE_GRID: Record<string, { x: number; y: number }> = {
  RED:    { x: 1.5, y: 1.5  },
  GREEN:  { x: 10.5, y: 1.5  },
  YELLOW: { x: 10.5, y: 10.5 },
  BLUE:   { x: 1.5, y: 10.5 },
};

export const getCellCoords = (pos: number, color: string): Point => {
  const cellSize = 100 / 15; // 6.666…%

  // ── Home base (negative positions) ────────────────────────────────
  if (pos < 0) {
    const base  = BASE_GRID[color as keyof typeof BASE_GRID];
    const idx   = Math.abs(pos) % 10 - 1; // 0..3
    const col   = idx % 2;
    const row   = Math.floor(idx / 2);
    return {
      x: base.x + col * 3 - 0.5,  // centres token inside the slot circle
      y: base.y + row * 3 - 0.5,
    };
  }

  // ── Main path (0–51) ───────────────────────────────────────────────
  const mainPath: Point[] = [
    { x:1,y:6 },{ x:2,y:6 },{ x:3,y:6 },{ x:4,y:6 },{ x:5,y:6 },
    { x:6,y:5 },{ x:6,y:4 },{ x:6,y:3 },{ x:6,y:2 },{ x:6,y:1 },{ x:6,y:0 },
    { x:7,y:0 },{ x:8,y:0 },
    { x:8,y:1 },{ x:8,y:2 },{ x:8,y:3 },{ x:8,y:4 },{ x:8,y:5 },
    { x:9,y:6 },{ x:10,y:6 },{ x:11,y:6 },{ x:12,y:6 },{ x:13,y:6 },{ x:14,y:6 },
    { x:14,y:7 },{ x:14,y:8 },
    { x:13,y:8 },{ x:12,y:8 },{ x:11,y:8 },{ x:10,y:8 },{ x:9,y:8 },
    { x:8,y:9 },{ x:8,y:10 },{ x:8,y:11 },{ x:8,y:12 },{ x:8,y:13 },{ x:8,y:14 },
    { x:7,y:14 },{ x:6,y:14 },
    { x:6,y:13 },{ x:6,y:12 },{ x:6,y:11 },{ x:6,y:10 },{ x:6,y:9 },
    { x:5,y:8 },{ x:4,y:8 },{ x:3,y:8 },{ x:2,y:8 },{ x:1,y:8 },{ x:0,y:8 },
    { x:0,y:7 },{ x:0,y:6 },
  ];

  if (pos < 52) return mainPath[pos];

  // ── Home stretches (52–57) ─────────────────────────────────────────
  const step = pos - 51; // 1..6, where 6 = finish
  if (color === 'RED')    return pos === 57 ? { x:6.8, y:7.5 } : { x:step, y:7 };
  if (color === 'GREEN')  return pos === 57 ? { x:7.5, y:6.8 } : { x:7, y:step };
  if (color === 'YELLOW') return pos === 57 ? { x:8.2, y:7.5 } : { x:14-step, y:7 };
  if (color === 'BLUE')   return pos === 57 ? { x:7.5, y:8.2 } : { x:7, y:14-step };

  return { x:7.5, y:7.5 };
};
