
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { readFileSync } from "fs";
import { createServer as createViteServer } from "vite";
import { ClientToServerEvents, ServerToClientEvents } from "./src/types/socket";
import { PlayerColor, GameState, Player, Profile } from "./src/types/game";
import { RoomManager } from "./src/lib/roomManager";
import { LudoEngine } from "./src/lib/engine";
import {
  ensureSchema, loadActiveRooms,
  getUser, upsertUserProfile, recordGameResult,
} from "./src/lib/persistence";

const PORT = Number(process.env.PORT) || 3000;

const TURN_MS  = 20000; // a human has 20s to act or it auto-plays for them
const GRACE_MS = 30000; // disconnect grace before AFK→bot / slot release
const SWEEP_MS = 5 * 60 * 1000;
const MAX_ROOMS = 500;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const rollDie = () => Math.floor(Math.random() * 6) + 1; // CSPRNG is a P2 hardening item

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  const socketToUser = new Map<string, string>();
  const userToSocket = new Map<string, string>();
  const getUserId = (socketId: string) => socketToUser.get(socketId);

  // ── Turn / timeout / bot scheduling ────────────────────────────────────────
  const turnTimers  = new Map<string, ReturnType<typeof setTimeout>>(); // key roomId
  const graceTimers = new Map<string, ReturnType<typeof setTimeout>>(); // key userId
  const botRunning  = new Set<string>();                                // key roomId
  const profiles      = new Map<string, { name: string; avatar: string }>(); // DB-less fallback cache
  const statsRecorded = new Set<string>();                                   // roomId → result counted

  const buildProfile = async (userId: string): Promise<Profile> => {
    const db = await getUser(userId);
    if (db) return db;
    const c = profiles.get(userId);
    return { id: userId, name: c?.name ?? '', avatar: c?.avatar ?? '', wins: 0, games: 0 };
  };
  const emitProfileTo = async (userId: string) => {
    const sid = userToSocket.get(userId);
    if (sid) io.to(sid).emit("profile:state", await buildProfile(userId));
  };

  const clearTurnTimer = (roomId: string) => {
    const t = turnTimers.get(roomId);
    if (t) { clearTimeout(t); turnTimers.delete(roomId); }
  };

  const emitOnly = (room: GameState) => {
    RoomManager.updateRoom(room.roomId, room); // persists (debounced) + touches activity
    io.to(room.roomId).emit("room:update", room);
  };

  /**
   * Single authoritative path after ANY state change. Arms the human turn
   * clock (so the emitted state carries turnDeadline for the client
   * countdown), persists, emits once, then either schedules the timeout or
   * kicks the bot loop. The game can never stall because every turn either
   * has a live human timer or an active bot loop.
   */
  const scheduleAfter = (room: GameState) => {
    clearTurnTimer(room.roomId);

    if (room.status !== "PLAYING") {
      room.turnDeadline = null;
      emitOnly(room);
      if (room.status === "FINISHED" && !statsRecorded.has(room.roomId)) {
        statsRecorded.add(room.roomId);
        const humans = room.players.filter(p => !p.isAI);
        const humanIds = humans.map(p => p.id);
        const winner = humans.find(p => p.name === room.winner) ?? null;
        void (async () => {
          await recordGameResult(humanIds, winner ? winner.id : null);
          for (const id of humanIds) await emitProfileTo(id);
        })();
      }
      return;
    }

    const cp = room.players[room.currentPlayerIndex];
    if (cp && !cp.isAI) {
      room.turnDeadline = Date.now() + TURN_MS;
      emitOnly(room);
      turnTimers.set(room.roomId, setTimeout(() => handleTurnTimeout(room.roomId), TURN_MS));
    } else {
      room.turnDeadline = null;
      emitOnly(room);
      void runBots(room.roomId);
    }
  };

  /** Auto-plays a stalled human's turn exactly like a bot, then continues. */
  const handleTurnTimeout = (roomId: string) => {
    const room = RoomManager.getRoom(roomId);
    if (!room || room.status !== "PLAYING") return;
    const cp = room.players[room.currentPlayerIndex];
    if (!cp || cp.isAI) return;

    if (room.diceValue === null) {
      const roll = rollDie();
      room.diceValue = roll;
      room.lastRollTimestamp = Date.now();
      room.logs.push(`${cp.name} timed out — auto-rolled a ${roll}.`);
      const hasMove = cp.tokens.some(t => LudoEngine.canMove(t, roll, cp.color));
      if (!hasMove) {
        room.diceValue = null;
        if (roll !== 6) {
          room.currentPlayerIndex = LudoEngine.getNextPlayerIndex(room);
          room.logs.push(`${cp.name} has no moves. Passing turn.`);
        } else {
          room.logs.push(`${cp.name} has no moves but rolls again!`);
        }
        scheduleAfter(room);
        return;
      }
      const moveId = LudoEngine.getBotMove(room, cp.tokens, roll);
      if (moveId) {
        const rollValue = room.diceValue!;
        const updated = LudoEngine.moveToken(room, moveId, room.diceValue!);
        recordHistory(updated, cp, moveId, rollValue);
        scheduleAfter(updated);
        return;
      }
    } else {
      const moveId = LudoEngine.getBotMove(room, cp.tokens, room.diceValue);
      if (moveId) {
        const rollValue = room.diceValue;
        const updated = LudoEngine.moveToken(room, moveId, room.diceValue);
        recordHistory(updated, cp, moveId, rollValue);
        scheduleAfter(updated);
        return;
      }
    }
    // Fallback: nothing playable — pass the turn so the game keeps moving.
    room.diceValue = null;
    room.currentPlayerIndex = LudoEngine.getNextPlayerIndex(room);
    scheduleAfter(room);
  };

  const recordHistory = (state: GameState, player: Player, tokenId: string, roll: number) => {
    const token = player.tokens.find(t => t.id === tokenId);
    if (!token) return;
    state.moveHistory.push({
      player: player.name,
      from: 0,
      to: token.position,
      roll,
      color: player.color,
      captured: state.logs.slice(-3).some(l => l.includes("captured")),
    });
    if (state.moveHistory.length > 50) state.moveHistory.shift();
  };

  /** Non-recursive bot loop (guarded so concurrent triggers can't double-run). */
  const runBots = async (roomId: string) => {
    if (botRunning.has(roomId)) return;
    botRunning.add(roomId);
    try {
      while (true) {
        const room = RoomManager.getRoom(roomId);
        if (!room || room.status !== "PLAYING") return;
        const cp = room.players[room.currentPlayerIndex];
        if (!cp || !cp.isAI) return; // hand control back to a human

        await sleep(1200);
        const r = RoomManager.getRoom(roomId);
        if (!r || r.status !== "PLAYING") return;
        const cur = r.players[r.currentPlayerIndex];
        if (!cur || !cur.isAI) return;

        if (r.diceValue === null) {
          const roll = rollDie();
          r.diceValue = roll;
          r.lastRollTimestamp = Date.now();
          r.logs.push(`${cur.name} rolled a ${roll}!`);
          const hasMove = cur.tokens.some(t => LudoEngine.canMove(t, roll, cur.color));
          if (!hasMove) {
            r.diceValue = null;
            if (roll !== 6) {
              r.currentPlayerIndex = LudoEngine.getNextPlayerIndex(r);
              r.logs.push(`${cur.name} has no moves. Passing turn.`);
            } else {
              r.logs.push(`${cur.name} has no moves but rolls again!`);
            }
            emitOnly(r);
            continue;
          }
          emitOnly(r);
          await sleep(900);
        }

        const r2 = RoomManager.getRoom(roomId);
        if (!r2 || r2.status !== "PLAYING") return;
        const cur2 = r2.players[r2.currentPlayerIndex];
        if (!cur2 || !cur2.isAI || r2.diceValue === null) continue;

        const moveId = LudoEngine.getBotMove(r2, cur2.tokens, r2.diceValue);
        if (moveId) {
          const rollValue = r2.diceValue;
          const updated = LudoEngine.moveToken(r2, moveId, r2.diceValue);
          recordHistory(updated, cur2, moveId, rollValue);
          emitOnly(updated);
        } else {
          r2.diceValue = null;
          r2.currentPlayerIndex = LudoEngine.getNextPlayerIndex(r2);
          emitOnly(r2);
        }
      }
    } finally {
      botRunning.delete(roomId);
      const room = RoomManager.getRoom(roomId);
      if (room && room.status === "PLAYING") {
        const cp = room.players[room.currentPlayerIndex];
        if (cp && !cp.isAI) scheduleAfter(room); // arm the human's clock
      }
    }
  };

  const purge = (roomId: string) => {
    clearTurnTimer(roomId);
    statsRecorded.delete(roomId);
    RoomManager.deleteRoom(roomId);
  };

  // ── Idle room garbage collection (prevents unbounded memory growth) ─────────
  setInterval(() => {
    const now = Date.now();
    for (const room of RoomManager.getAll()) {
      const idle = now - RoomManager.lastActivity(room.roomId);
      const anyConnected = room.players.some(p => !p.isAI && userToSocket.has(p.id));
      if (room.status === "FINISHED" && idle > 10 * 60 * 1000) {
        purge(room.roomId);
      } else if (!anyConnected && idle > 30 * 60 * 1000) {
        purge(room.roomId);
      } else if (idle > 6 * 60 * 60 * 1000) {
        purge(room.roomId);
      }
    }
    const all = RoomManager.getAll();
    if (all.length > MAX_ROOMS) {
      all
        .map(r => ({ id: r.roomId, a: RoomManager.lastActivity(r.roomId) }))
        .sort((x, y) => x.a - y.a)
        .slice(0, all.length - MAX_ROOMS)
        .forEach(({ id }) => purge(id));
    }
  }, SWEEP_MS);

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("room:auth", ({ userId }) => {
      socketToUser.set(socket.id, userId);
      userToSocket.set(userId, socket.id);

      const grace = graceTimers.get(userId);
      if (grace) { clearTimeout(grace); graceTimers.delete(userId); }

      void emitProfileTo(userId);

      const room = RoomManager.getRoomByPlayer(userId);
      if (room) {
        socket.join(room.roomId);
        const player = room.players.find(p => p.id === userId)!;
        socket.emit("room:joined", { player, roomState: room });
        // After a redeploy, timers are gone — re-arm / resume from DB-restored state.
        if (room.status === "PLAYING") scheduleAfter(room);
        console.log(`User ${userId} re-authenticated on socket ${socket.id}`);
      }
    });

    socket.on("profile:update", ({ name, avatar }) => {
      const userId = getUserId(socket.id);
      if (!userId) return;
      const cleanName   = (typeof name   === "string" ? name   : "").trim().slice(0, 24);
      const cleanAvatar = (typeof avatar === "string" ? avatar : "").slice(0, 8);
      profiles.set(userId, { name: cleanName, avatar: cleanAvatar });
      void (async () => {
        await upsertUserProfile(userId, cleanName, cleanAvatar);
        await emitProfileTo(userId);
      })();
    });

    socket.on("room:create", ({ name, userId, players, vsCpu }) => {
      socketToUser.set(socket.id, userId);
      userToSocket.set(userId, socket.id);
      const target = Math.min(4, Math.max(2, Math.floor(players ?? 4) || 4));
      const room = RoomManager.createRoom(name, userId, target);
      socket.join(room.roomId);

      if (vsCpu) {
        const allColors: PlayerColor[] = ["RED", "GREEN", "YELLOW", "BLUE"];
        const taken = room.players.map(p => p.color);
        const avail = allColors.filter(c => !taken.includes(c));
        const need = Math.max(0, room.targetPlayers - room.players.length);
        for (let i = 0; i < need && i < avail.length; i++) {
          const color = avail[i];
          room.players.push({
            id: `bot-${Math.random().toString(36).substr(2, 5)}`,
            name: `${color[0]}${color.slice(1).toLowerCase()} Bot 🤖`,
            color, isReady: true, tokens: [], isAI: true,
          });
        }
        room.players.forEach(p => { p.isReady = true; });
        room.status = "PLAYING";
        room.players.forEach(p => {
          p.tokens = Array.from({ length: 4 }).map((_, i) => ({
            id: `${p.id}-token-${i}`, color: p.color, position: -(i + 1), isFinished: false,
          }));
        });
        room.logs.push("Solo match vs computer started.");
        socket.emit("room:joined", { player: room.players[0], roomState: room });
        scheduleAfter(room);
      } else {
        socket.emit("room:joined", { player: room.players[0], roomState: room });
      }
    });

    socket.on("room:join", ({ code, name, userId }) => {
      socketToUser.set(socket.id, userId);
      userToSocket.set(userId, socket.id);
      const room = RoomManager.joinRoom(code.toUpperCase(), name, userId);
      if (room) {
        socket.join(room.roomId);
        const player = room.players.find(p => p.id === userId)!;
        socket.emit("room:joined", { player, roomState: room });
        io.to(room.roomId).emit("room:update", room);
      } else {
        socket.emit("room:error", "Room not found or full.");
      }
    });

    socket.on("room:leave", () => {
      const userId = getUserId(socket.id);
      if (userId) {
        const room = RoomManager.getRoomByPlayer(userId);
        const roomId = room?.roomId;
        RoomManager.leaveRoom(userId);
        for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
        socket.emit("room:update", null);
        if (roomId) {
          const after = RoomManager.getRoom(roomId);
          if (after) io.to(roomId).emit("room:update", after);
        }
      }
    });

    const addBotsToRoom = (userId: string, count: number) => {
      const room = RoomManager.getRoomByPlayer(userId);
      if (!room || room.status !== "WAITING" || room.players.length >= 4) return;
      const allColors: PlayerColor[] = ["RED", "GREEN", "YELLOW", "BLUE"];
      const taken = room.players.map(p => p.color);
      const available = allColors.filter(c => !taken.includes(c));
      const toAdd = Math.min(count, available.length, 4 - room.players.length);
      for (let i = 0; i < toAdd; i++) {
        const color = available[i];
        const botId = `bot-${Math.random().toString(36).substr(2, 5)}`;
        room.players.push({ id: botId, name: `${color[0]}${color.slice(1).toLowerCase()} Bot 🤖`, color, isReady: true, tokens: [], isAI: true });
      }
      emitOnly(room);
    };

    socket.on("room:add-bot", ({ count }) => {
      const userId = getUserId(socket.id);
      if (userId) addBotsToRoom(userId, count ?? 1);
    });

    socket.on("room:fill-bots", () => {
      const userId = getUserId(socket.id);
      if (userId) addBotsToRoom(userId, 3);
    });

    socket.on("room:pick-color", ({ color }) => {
      const userId = getUserId(socket.id);
      if (!userId) return;
      const room = RoomManager.getRoomByPlayer(userId);
      if (!room || room.status !== "WAITING") return;
      const player = room.players.find(p => p.id === userId);
      if (!player) return;
      const takenByHuman = room.players.find(p => p.id !== userId && p.color === color && !p.isAI);
      if (takenByHuman) return;
      const takenByBot = room.players.find(p => p.isAI && p.color === color);
      if (takenByBot) takenByBot.color = player.color;
      player.color = color;
      emitOnly(room);
    });

    socket.on("room:ready", () => {
      const userId = getUserId(socket.id);
      if (!userId) return;

      const room = RoomManager.getRoomByPlayer(userId);
      if (room && room.status === "WAITING") {
        const player = room.players.find(p => p.id === userId);
        if (player) {
          player.isReady = !player.isReady;

          if (room.players.length >= 2 && room.players.every(p => p.isReady)) {
            room.status = "PLAYING";
            room.players.forEach(p => {
              p.tokens = Array.from({ length: 4 }).map((_, i) => ({
                id: `${p.id}-token-${i}`,
                color: p.color,
                position: -(i + 1),
                isFinished: false,
              }));
            });
            room.logs.push("All players ready! Game started.");
            scheduleAfter(room); // arms first turn / kicks bots
          } else {
            emitOnly(room);
          }
        }
      }
    });

    socket.on("game:roll-dice", () => {
      const userId = getUserId(socket.id);
      if (!userId) return;

      const room = RoomManager.getRoomByPlayer(userId);
      if (room && room.status === "PLAYING") {
        const currentPlayer = room.players[room.currentPlayerIndex];
        if (currentPlayer.id === userId && room.diceValue === null) {
          const roll = rollDie();
          room.diceValue = roll;
          room.lastRollTimestamp = Date.now();
          room.logs.push(`${currentPlayer.name} rolled a ${roll}!`);

          const hasValidMove = currentPlayer.tokens.some(t =>
            LudoEngine.canMove(t, roll, currentPlayer.color)
          );

          if (!hasValidMove) {
            room.diceValue = null;
            if (roll !== 6) {
              room.currentPlayerIndex = LudoEngine.getNextPlayerIndex(room);
              room.logs.push(`${currentPlayer.name} has no moves. Passing turn.`);
            } else {
              room.logs.push(`${currentPlayer.name} has no moves but gets to roll again!`);
            }
          }
          scheduleAfter(room);
        }
      }
    });

    socket.on("game:move-token", ({ tokenId }) => {
      const userId = getUserId(socket.id);
      if (!userId) return;

      const room = RoomManager.getRoomByPlayer(userId);
      if (room && room.status === "PLAYING" && room.diceValue !== null) {
        const currentPlayer = room.players[room.currentPlayerIndex];
        if (currentPlayer.id === userId) {
          // Anti-cheat: re-validate the move server-side. moveToken() does NOT
          // check canMove(), so without this a client can move a base token on
          // a 3, overshoot the finish, etc.
          if (typeof tokenId !== "string") return;
          const moving = currentPlayer.tokens.find(t => t.id === tokenId);
          if (!moving || !LudoEngine.canMove(moving, room.diceValue, currentPlayer.color)) {
            return;
          }

          const rollValue = room.diceValue;
          const updatedState = LudoEngine.moveToken(room, tokenId, room.diceValue);
          recordHistory(updatedState, currentPlayer, tokenId, rollValue);
          scheduleAfter(updatedState);
        }
      }
    });

    socket.on("game:send-chat", ({ text }) => {
      const userId = getUserId(socket.id);
      if (!userId) return;
      const room = RoomManager.getRoomByPlayer(userId);
      if (room) {
        const player = room.players.find(p => p.id === userId);
        if (player && typeof text === "string" && text.trim()) {
          room.messages.push({
            id: Math.random().toString(36).substr(2, 9),
            senderId: player.id,
            senderName: player.name,
            text: text.slice(0, 300),
            timestamp: Date.now(),
          });
          if (room.messages.length > 50) room.messages.shift();
          io.to(room.roomId).emit("room:update", room);
        }
      }
    });

    socket.on("game:send-emoji", ({ emoji }) => {
      const userId = getUserId(socket.id);
      if (!userId) return;
      const room = RoomManager.getRoomByPlayer(userId);
      if (room) {
        const player = room.players.find(p => p.id === userId);
        if (player && typeof emoji === "string") {
          room.messages.push({
            id: Math.random().toString(36).substr(2, 9),
            senderId: player.id,
            senderName: player.name,
            emoji: emoji.slice(0, 16),
            timestamp: Date.now(),
          });
          if (room.messages.length > 50) room.messages.shift();
          io.to(room.roomId).emit("room:update", room);
        }
      }
    });

    socket.on("game:restart", () => {
      const userId = getUserId(socket.id);
      if (!userId) return;
      const room = RoomManager.getRoomByPlayer(userId);
      if (room && room.status === "FINISHED") {
        clearTurnTimer(room.roomId);
        statsRecorded.delete(room.roomId);
        room.status = "WAITING";
        room.winner = null;
        room.diceValue = null;
        room.turnDeadline = null;
        room.moveHistory = [];
        room.players.forEach(p => { p.isReady = false; p.tokens = []; });
        room.logs.push("Game was restarted by a player. Preparing for a new match!");
        emitOnly(room);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      const userId = socketToUser.get(socket.id);
      socketToUser.delete(socket.id);
      if (!userId) return;
      if (userToSocket.get(userId) === socket.id) userToSocket.delete(userId);

      if (graceTimers.has(userId)) return;
      graceTimers.set(userId, setTimeout(() => {
        graceTimers.delete(userId);
        if (userToSocket.has(userId)) return; // reconnected within grace

        const room = RoomManager.getRoomByPlayer(userId);
        if (!room) return;
        const player = room.players.find(p => p.id === userId);
        if (!player) return;

        if (room.status === "PLAYING") {
          player.isAI = true;
          if (!player.name.endsWith("🤖")) player.name = `${player.name} 🤖`;
          room.logs.push(`${player.name} disconnected — now played by AI.`);
          scheduleAfter(room); // bot takes over immediately if it's their turn
        } else {
          const roomId = room.roomId;
          RoomManager.leaveRoom(userId);
          const after = RoomManager.getRoom(roomId);
          if (after) io.to(roomId).emit("room:update", after);
        }
      }, GRACE_MS));
    });
  });

  // Restore in-progress games (survives Railway redeploy when DATABASE_URL set)
  await ensureSchema();
  RoomManager.hydrate(await loadActiveRooms());

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    console.log(`Starting in PRODUCTION mode. Serving static files from: ${distPath}`);
    app.use(express.static(distPath, { index: false }));

    let html = "";
    try { html = readFileSync(path.join(distPath, "index.html"), "utf8"); } catch {}

    app.get("*", (req, res) => {
      if (!html) { res.sendFile(path.join(distPath, "index.html")); return; }
      const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0];
      const host  = req.headers.host || "";
      const origin = `${proto}://${host}`;
      let out = html.replaceAll("https://ludo.example", origin);

      const code = typeof req.query.room === "string"
        ? req.query.room.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) : "";
      if (code) {
        out = out
          .replaceAll("Ludo Elite — Multiplayer Ludo", `Join room ${code} · Ludo Elite`)
          .replaceAll(
            "Play classic Ludo online with friends or bots. Fast 3D dice, real-time multiplayer, private rooms.",
            `Tap to join this Ludo Elite room and play now.`,
          )
          .replace(`content="${origin}/"`, `content="${origin}/?room=${code}"`);
      }
      res.set("Content-Type", "text/html").send(out);
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
