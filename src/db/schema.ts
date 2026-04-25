/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
  id: text('id').primaryKey(), // The room code (e.g. AB12CD)
  hostId: text('host_id').notNull(),
  status: text('status').notNull().default('WAITING'), // WAITING, PLAYING, FINISHED
  gameState: jsonb('game_state').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const players = pgTable('players', {
  id: text('id').primaryKey(), // Socket ID or Session Token
  roomId: text('room_id').references(() => rooms.id),
  name: text('name').notNull(),
  color: text('color').notNull(),
  isReady: boolean('is_ready').default(false),
});
