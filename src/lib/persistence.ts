/**
 * Best-effort durable persistence for live rooms.
 *
 * Design rules:
 *  - Auto-detect: if DATABASE_URL is absent, every function is a safe no-op and
 *    the game runs fully in-memory (with one loud warning). Provisioning Neon
 *    later makes persistence "just work" with no code change.
 *  - Never throw into the game loop: all DB errors are caught + logged; the
 *    in-memory RoomManager remains the source of truth at runtime.
 *  - Debounced write-through: rapid bot/turn mutations coalesce to at most one
 *    write per room per FLUSH_MS so Neon isn't hammered.
 *
 * Only the rooms table is used (single jsonb blob = whole GameState). No
 * drizzle-kit / migrations needed for M1 — schema is ensured idempotently.
 */
import { neon } from '@neondatabase/serverless';
import { GameState, Profile } from '../types/game';

const URL = process.env.DATABASE_URL;
export const persistenceEnabled = !!URL;

type SqlClient = ReturnType<typeof neon>;
let sql: SqlClient | null = null;
let disabled = !persistenceEnabled;

if (!persistenceEnabled) {
  console.warn(
    '[persistence] DATABASE_URL not set — running IN-MEMORY ONLY. ' +
    'Live games will NOT survive a server restart/redeploy. ' +
    'Set DATABASE_URL (Neon) to enable durability.',
  );
} else {
  try {
    sql = neon(URL!);
  } catch (e) {
    disabled = true;
    console.error('[persistence] failed to init Neon client; in-memory only:', e);
  }
}

const FLUSH_MS = 800;
const pending = new Map<string, GameState>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export async function ensureSchema(): Promise<void> {
  if (disabled || !sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id          TEXT PRIMARY KEY,
        host_id     TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'WAITING',
        game_state  JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL DEFAULT '',
        avatar      TEXT NOT NULL DEFAULT '',
        wins        INTEGER NOT NULL DEFAULT 0,
        games       INTEGER NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    console.log('[persistence] schema ready (durable mode ON)');
  } catch (e) {
    disabled = true;
    console.error('[persistence] ensureSchema failed; in-memory only:', e);
  }
}

async function flush(roomId: string): Promise<void> {
  timers.delete(roomId);
  const state = pending.get(roomId);
  pending.delete(roomId);
  if (disabled || !sql || !state) return;
  try {
    const hostId = state.players[0]?.id ?? '';
    await sql`
      INSERT INTO rooms (id, host_id, status, game_state, updated_at)
      VALUES (${state.roomId}, ${hostId}, ${state.status}, ${JSON.stringify(state)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        host_id    = EXCLUDED.host_id,
        status     = EXCLUDED.status,
        game_state = EXCLUDED.game_state,
        updated_at = now()
    `;
  } catch (e) {
    console.error(`[persistence] write failed for room ${roomId}:`, e);
  }
}

/** Debounced write-through. Safe no-op when persistence is disabled. */
export function persistRoom(state: GameState): void {
  if (disabled) return;
  pending.set(state.roomId, state);
  if (!timers.has(state.roomId)) {
    timers.set(state.roomId, setTimeout(() => { void flush(state.roomId); }, FLUSH_MS));
  }
}

export async function deleteRoomRow(roomId: string): Promise<void> {
  const t = timers.get(roomId);
  if (t) { clearTimeout(t); timers.delete(roomId); }
  pending.delete(roomId);
  if (disabled || !sql) return;
  try {
    await sql`DELETE FROM rooms WHERE id = ${roomId}`;
  } catch (e) {
    console.error(`[persistence] delete failed for room ${roomId}:`, e);
  }
}

/** Loaded on boot to restore in-progress games after a redeploy. */
export async function loadActiveRooms(): Promise<GameState[]> {
  if (disabled || !sql) return [];
  try {
    const rows = await sql`
      SELECT game_state FROM rooms
      WHERE status <> 'FINISHED'
        AND updated_at > now() - interval '6 hours'
    ` as { game_state: GameState }[];
    return rows.map(r => r.game_state);
  } catch (e) {
    console.error('[persistence] loadActiveRooms failed:', e);
    return [];
  }
}

// ─── User profiles + stats ────────────────────────────────────────────────────

export async function getUser(id: string): Promise<Profile | null> {
  if (disabled || !sql) return null;
  try {
    const rows = await sql`
      SELECT id, name, avatar, wins, games FROM users WHERE id = ${id}
    ` as Profile[];
    return rows[0] ?? null;
  } catch (e) {
    console.error('[persistence] getUser failed:', e);
    return null;
  }
}

/** Upsert name/avatar WITHOUT touching accumulated stats. Returns the row. */
export async function upsertUserProfile(
  id: string, name: string, avatar: string,
): Promise<Profile | null> {
  if (disabled || !sql) return null;
  try {
    const rows = await sql`
      INSERT INTO users (id, name, avatar, updated_at)
      VALUES (${id}, ${name}, ${avatar}, now())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        avatar = EXCLUDED.avatar,
        updated_at = now()
      RETURNING id, name, avatar, wins, games
    ` as Profile[];
    return rows[0] ?? null;
  } catch (e) {
    console.error('[persistence] upsertUserProfile failed:', e);
    return null;
  }
}

/** +1 game for every human player, +1 win for the winner. Idempotent rows. */
export async function recordGameResult(
  humanIds: string[], winnerId: string | null,
): Promise<void> {
  if (disabled || !sql) return;
  try {
    for (const id of humanIds) {
      await sql`
        INSERT INTO users (id, games) VALUES (${id}, 1)
        ON CONFLICT (id) DO UPDATE SET
          games = users.games + 1, updated_at = now()
      `;
    }
    if (winnerId) {
      await sql`
        INSERT INTO users (id, wins) VALUES (${winnerId}, 1)
        ON CONFLICT (id) DO UPDATE SET
          wins = users.wins + 1, updated_at = now()
      `;
    }
  } catch (e) {
    console.error('[persistence] recordGameResult failed:', e);
  }
}
