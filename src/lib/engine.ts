/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameState, Player, Token, PlayerColor } from '../types/game';
import { BOARD_SIZE, SAFE_SQUARES, START_POSITIONS, WINNING_POSITION } from './constants';

export class LudoEngine {
  /**
   * Initializes a new game state
   */
  static createInitialState(roomId: string, players: Player[]): GameState {
    return {
      roomId,
      players: players.map(p => ({
        ...p,
        tokens: Array.from({ length: 4 }).map((_, i) => ({
          id: `${p.id}-token-${i}`,
          color: p.color,
          position: -(i + 1), // -1 to -4 are the "home base" positions
          isFinished: false
        }))
      })),
      status: 'WAITING',
      currentPlayerIndex: 0,
      targetPlayers: 4,
      diceValue: null,
      logs: ['Game created. Waiting for players...'],
      winner: null,
      lastRollTimestamp: null,
      turnDeadline: null,
      movesRemaining: 0,
      messages: [],
      moveHistory: []
    };
  }

  /**
   * Progress of a token measured from its OWN start square (0 = on the start
   * square). 0..50 = on the 51-cell main-track portion; 51..56 = the 6 home
   * cells (56 = centre / WINNING_POSITION 57). Single source of truth — every
   * other method derives movement from this so the home turn-in can't drift.
   */
  private static stepsOf(position: number, color: PlayerColor): number {
    if (position < 0) return -1;                       // in base
    if (position >= 52) return 50 + (position - 51);   // 52→51 … 57→56 (centre)
    const lapStart = START_POSITIONS[color];
    return (position - lapStart + 52) % 52;             // 0..50 on main track
  }

  /** Inverse of stepsOf: total progress P (0..56) → board position. */
  private static posFromSteps(color: PlayerColor, p: number): number {
    if (p > 50) return 51 + (p - 50);                  // 51→52 … 56→57 (win)
    const lapStart = START_POSITIONS[color];
    return (lapStart + p) % 52;                          // turn into home after 51 cells
  }

  /**
   * Validates if a token can move the given number of steps
   */
  static canMove(token: Token, steps: number, color: PlayerColor): boolean {
    if (token.isFinished) return false;

    // If in home base, need a 1 or 6 to start
    if (token.position < 0) {
      return steps === 1 || steps === 6;
    }

    // Must land exactly on the centre — can't overshoot past P = 56.
    return this.stepsOf(token.position, color) + steps <= 56;
  }

  /**
   * Returns a list of tokens that can move
   */
  static getPossibleMoves(tokens: Token[], steps: number): Token[] {
    return tokens.filter(t => this.canMove(t, steps, t.color));
  }

  /**
   * AI logic to choose the best move for a bot
   */
  static getBotMove(state: GameState, tokens: Token[], steps: number): string | null {
    const possibleMoves = this.getPossibleMoves(tokens, steps);
    if (possibleMoves.length === 0) return null;

    // 1. Priority: Winning moves
    const winningMove = possibleMoves.find(t => {
      const nextPos = this.simulateNextPos(t, steps);
      return nextPos === WINNING_POSITION;
    });
    if (winningMove) return winningMove.id;

    // 2. Priority: Captures
    const captureMove = possibleMoves.find(t => {
      const nextPos = this.simulateNextPos(t, steps);
      if (nextPos < 0 || nextPos >= 52 || SAFE_SQUARES.includes(nextPos)) return false;
      return state.players.some((p, i) => 
        i !== state.currentPlayerIndex && 
        p.tokens.some(other => other.position === nextPos && !other.isFinished)
      );
    });
    if (captureMove) return captureMove.id;

    // 3. Priority: Getting out of base
    const baseMove = possibleMoves.find(t => t.position < 0);
    if (baseMove) return baseMove.id;

    // 4. Default: Move the token furthest along the path
    return possibleMoves.sort((a, b) => {
      const distA = this.getStepsTaken(a);
      const distB = this.getStepsTaken(b);
      return distB - distA;
    })[0].id;
  }

  private static simulateNextPos(token: Token, steps: number): number {
    if (token.position < 0) return START_POSITIONS[token.color];
    return this.posFromSteps(token.color, this.stepsOf(token.position, token.color) + steps);
  }

  private static getStepsTaken(token: Token): number {
    return this.stepsOf(token.position, token.color);
  }

  /**
   * Calculates the next player's index, skipping finished players
   */
  static getNextPlayerIndex(state: GameState): number {
    let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const originalIndex = state.currentPlayerIndex;
    
    while (state.players[nextIndex].tokens.every(t => t.isFinished) && nextIndex !== originalIndex) {
      nextIndex = (nextIndex + 1) % state.players.length;
    }
    return nextIndex;
  }

  /**
   * Executes a move and returns the updated state
   * Handles captures and finish line entries
   */
  static moveToken(state: GameState, tokenId: string, steps: number): GameState {
    const newState = { ...state, logs: [...state.logs] };
    const currentPlayer = newState.players[newState.currentPlayerIndex];
    const token = currentPlayer.tokens.find(t => t.id === tokenId);

    if (!token) return state;

    let nextPosition = token.position;

    if (token.position < 0) {
      // Out of home base (Exit square)
      nextPosition = START_POSITIONS[token.color];
      newState.logs.push(`${currentPlayer.name} moved a token out of the base!`);
    } else {
      nextPosition = LudoEngine.posFromSteps(
        token.color,
        LudoEngine.stepsOf(token.position, token.color) + steps,
      );
      newState.logs.push(`${currentPlayer.name} moved a token ${steps} steps.`);
    }

    token.position = nextPosition;
    let extraTurn = steps === 6;

    if (nextPosition === WINNING_POSITION) {
      token.isFinished = true;
      newState.logs.push(`Hooray! ${currentPlayer.name} finished a token!`);
      extraTurn = true; // Bonus turn for finishing a token
      
      // Check if player finished all tokens
      if (currentPlayer.tokens.every(t => t.isFinished)) {
        newState.logs.push(`${currentPlayer.name} has finished all their tokens!`);
        
        // Count how many players are NOT finished
        const activePlayersCount = newState.players.filter(p => !p.tokens.every(t => t.isFinished)).length;
        
        if (activePlayersCount <= 1) {
          newState.status = 'FINISHED';
          // Find the overall winner (first one to finish)
          // If we want the winner to be the one who just finished, we set it.
          // But if others had finished before, they are already recorded in logs/history.
          // Usually, first to finish is the winner.
          if (!newState.winner) {
            newState.winner = currentPlayer.name;
          }
          newState.logs.push(`GAME OVER!`);
        } else {
          // Game continues for remaining players
          newState.logs.push(`The game continues for the remaining ${activePlayersCount} players.`);
          if (!newState.winner) {
            newState.winner = currentPlayer.name; // Recording the first winner
          }
        }
      }
    } else if (nextPosition >= 0 && nextPosition < 52) {
      // Check for captures (if not on a safe square)
      if (!SAFE_SQUARES.includes(nextPosition)) {
        newState.players.forEach((p, pIdx) => {
          if (pIdx === newState.currentPlayerIndex) return;
          p.tokens.forEach(t => {
            if (t.position === nextPosition && !t.isFinished) {
              const basePos = parseInt(t.id.split('-').pop() || '0') + 1;
              t.position = -basePos; // Send back to base
              newState.logs.push(`BOOM! ${currentPlayer.name} captured ${p.name}'s token!`);
              extraTurn = true; // Bonus turn for capture
            }
          });
        });
      }
    }

    // After move, reset dice and change turn
    newState.diceValue = null;
    
    // Check if current player just finished everything
    const currentFinished = currentPlayer.tokens.every(t => t.isFinished);
    
    if (!extraTurn || currentFinished) {
      newState.currentPlayerIndex = LudoEngine.getNextPlayerIndex(newState);
    } else {
      if (steps === 6) {
        newState.logs.push(`${currentPlayer.name} rolled a 6 and gets another turn!`);
      } else {
        newState.logs.push(`${currentPlayer.name} gets a bonus turn!`);
      }
    }

    return newState;
  }

  /**
   * Returns the points along the path for previewing a move
   */
  static getPreviewPath(token: Token, steps: number, color: PlayerColor): number[] {
    if (!this.canMove(token, steps, color)) return [];
    
    if (token.position < 0) return [START_POSITIONS[color]];

    const base = this.stepsOf(token.position, color);
    const path: number[] = [];
    for (let i = 1; i <= steps; i++) {
      path.push(this.posFromSteps(color, base + i));
    }
    return path;
  }
}
