/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number;
  y: number;
}

// 0 to 51 main path
// 52 to 57 red home stretch
// 58 to 63 green home stretch
// 64 to 69 yellow home stretch
// 70 to 75 blue home stretch
// Bases: RED: -1 to -4, GREEN: -10 to -13, YELLOW: -20 to -23, BLUE: -30 to -33

export const getCellCoords = (pos: number, color: string): Point => {
  const cellSize = 100 / 15; // 6.66%

  // Basic 15x15 grid coordinate system
  if (pos < 0) {
    // Base positions (example)
    const baseOffsets = {
      RED: { x: 1.5, y: 1.5 },
      GREEN: { x: 10.5, y: 1.5 },
      YELLOW: { x: 10.5, y: 10.5 },
      BLUE: { x: 1.5, y: 10.5 },
    };
    const offset = baseOffsets[color as keyof typeof baseOffsets];
    const tokenIdx = Math.abs(pos) % 10 - 1;
    return {
      x: offset.x + (tokenIdx % 2) * 1.5,
      y: offset.y + Math.floor(tokenIdx / 2) * 1.5
    };
  }

  // Standard Ludo Path (52 squares) starting from Red's exit
  const mainPath: Point[] = [
    { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
    { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 },
    { x: 7, y: 0 }, { x: 8, y: 0 }, // Green top
    { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
    { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
    { x: 14, y: 7 }, { x: 14, y: 8 }, // Yellow right
    { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
    { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 8, y: 14 },
    { x: 7, y: 14 }, { x: 6, y: 14 }, // Blue bottom
    { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
    { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 },
    { x: 0, y: 7 }, { x: 0, y: 6 } // Red left
  ];
  
  if (pos >= 0 && pos < 52) {
    return mainPath[pos];
  }

  // Home stretch (52-57)
  if (pos >= 52 && pos <= 57) {
    const step = pos - 51;
    // For Red (enters from left), step 1-5 maps to x: 1-5, y: 7. step 6 is finish
    if (color === 'RED') {
      if (pos === 57) return { x: 6.8, y: 7.5 };
      return { x: step, y: 7 };
    }
    if (color === 'GREEN') {
      if (pos === 57) return { x: 7.5, y: 6.8 };
      return { x: 7, y: step };
    }
    if (color === 'YELLOW') {
      if (pos === 57) return { x: 8.2, y: 7.5 };
      return { x: 14 - step, y: 7 };
    }
    if (color === 'BLUE') {
      if (pos === 57) return { x: 7.5, y: 8.2 };
      return { x: 7, y: 14 - step };
    }
  }

  return { x: 7.5, y: 7.5 }; // Exactly middle of the board
};
