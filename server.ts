
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import { ClientToServerEvents, ServerToClientEvents } from "./src/types/socket";
import { RoomManager } from "./src/lib/roomManager";
import { LudoEngine } from "./src/lib/engine";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  
  // Initialize Socket.io with types
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Map socket IDs to user IDs for reconnection
  const socketToUser = new Map<string, string>();
  const userToSocket = new Map<string, string>();

  // Helper to get userId from socket
  const getUserId = (socketId: string) => socketToUser.get(socketId);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Socket logic (Stage 8)
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    
    socket.on("room:auth", ({ userId }) => {
      socketToUser.set(socket.id, userId);
      userToSocket.set(userId, socket.id);
      
      const room = RoomManager.getRoomByPlayer(userId);
      if (room) {
        socket.join(room.roomId);
        const player = room.players.find(p => p.id === userId)!;
        socket.emit("room:joined", { player, roomState: room });
        console.log(`User ${userId} re-authenticated on socket ${socket.id}`);
      }
    });

    socket.on("room:create", ({ name, userId }) => {
      socketToUser.set(socket.id, userId);
      userToSocket.set(userId, socket.id);
      const room = RoomManager.createRoom(name, userId);
      socket.join(room.roomId);
      socket.emit("room:joined", { player: room.players[0], roomState: room });
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
        RoomManager.leaveRoom(userId);
        // Leave all rooms
        for (const room of socket.rooms) {
          if (room !== socket.id) {
            socket.leave(room);
          }
        }
        socket.emit("room:update", null);
      }
    });

    socket.on("room:fill-bots", () => {
      const userId = getUserId(socket.id);
      if (!userId) return;

      const room = RoomManager.getRoomByPlayer(userId);
      if (room && room.status === 'WAITING' && room.players.length < 4) {
        const colors: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
        const existingColors = room.players.map(p => p.color);
        const availableColors = colors.filter(c => !existingColors.includes(c));

        while (room.players.length < 4 && availableColors.length > 0) {
          const color = availableColors.shift()!;
          const botId = `bot-${Math.random().toString(36).substr(2, 5)}`;
          room.players.push({
            id: botId,
            name: `${color} Bot 🤖`,
            color,
            isReady: true,
            tokens: [],
            isAI: true
          });
        }
        io.to(room.roomId).emit("room:update", room);
      }
    });

    const processBotTurn = async (roomId: string) => {
      const room = RoomManager.getRoom(roomId);
      if (!room || room.status !== 'PLAYING') return;

      const currentPlayer = room.players[room.currentPlayerIndex];
      if (!currentPlayer.isAI) return;

      // Small delay for realism
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Roll dice
      if (room.diceValue === null) {
        const roll = Math.floor(Math.random() * 6) + 1;
        room.diceValue = roll;
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
          io.to(room.roomId).emit("room:update", room);
          // Check if next player is also a bot
          processBotTurn(roomId);
          return;
        }
        io.to(room.roomId).emit("room:update", room);
        
        // Wait before moving
        await new Promise(resolve => setTimeout(resolve, 1000));
        const botMoveId = LudoEngine.getBotMove(room, currentPlayer.tokens, roll);
        
        if (botMoveId) {
          const prevLogCount = room.logs.length;
          const updatedState = LudoEngine.moveToken(room, botMoveId, roll);
          
          const token = currentPlayer.tokens.find(t => t.id === botMoveId);
          if (token) {
            updatedState.moveHistory.push({
              player: currentPlayer.name,
              from: 0,
              to: token.position,
              roll,
              color: currentPlayer.color,
              captured: updatedState.logs.length > prevLogCount && updatedState.logs[updatedState.logs.length-1].includes('captured')
            });
            if (updatedState.moveHistory.length > 50) updatedState.moveHistory.shift();
          }

          RoomManager.updateRoom(room.roomId, updatedState);
          io.to(room.roomId).emit("room:update", updatedState);
          // Recursively call for possible extra turn or next bot turn
          processBotTurn(roomId);
        }
      }
    };

    socket.on("room:ready", () => {
      const userId = getUserId(socket.id);
      if (!userId) return;
      
      const room = RoomManager.getRoomByPlayer(userId);
      if (room && room.status === 'WAITING') {
        const player = room.players.find(p => p.id === userId);
        if (player) {
          player.isReady = !player.isReady;
          
          // Auto-start if all players are ready and at least 2 players
          if (room.players.length >= 2 && room.players.every(p => p.isReady)) {
            room.status = 'PLAYING';
            // Re-initialize tokens with correct base positions
            room.players.forEach(p => {
              p.tokens = Array.from({ length: 4 }).map((_, i) => ({
                id: `${p.id}-token-${i}`,
                color: p.color,
                position: -(i + 1),
                isFinished: false
              }));
            });
            room.logs.push("All players ready! Game started.");
          }
          
          io.to(room.roomId).emit("room:update", room);
          if (room.status === 'PLAYING') {
            processBotTurn(room.roomId);
          }
        }
      }
    });

    socket.on("game:roll-dice", () => {
      const userId = getUserId(socket.id);
      if (!userId) return;

      const room = RoomManager.getRoomByPlayer(userId);
      if (room && room.status === 'PLAYING') {
        const currentPlayer = room.players[room.currentPlayerIndex];
        if (currentPlayer.id === userId && room.diceValue === null) {
          const roll = Math.floor(Math.random() * 6) + 1;
          room.diceValue = roll;
          room.logs.push(`${currentPlayer.name} rolled a ${roll}!`);
          
          // Check if player has any valid moves
          const hasValidMove = currentPlayer.tokens.some(t => 
            LudoEngine.canMove(t, roll, currentPlayer.color)
          );
          
          if (!hasValidMove) {
            room.diceValue = null;
            if (roll !== 6) {
              room.currentPlayerIndex = LudoEngine.getNextPlayerIndex(room);
              room.logs.push(`${currentPlayer.name} has no moves. Passing turn.`);
              io.to(room.roomId).emit("room:update", room);
              processBotTurn(room.roomId);
            } else {
              room.logs.push(`${currentPlayer.name} has no moves but gets to roll again!`);
              io.to(room.roomId).emit("room:update", room);
            }
          } else {
            io.to(room.roomId).emit("room:update", room);
          }
        }
      }
    });

    socket.on("game:move-token", ({ tokenId }) => {
      const userId = getUserId(socket.id);
      if (!userId) return;

      const room = RoomManager.getRoomByPlayer(userId);
      if (room && room.status === 'PLAYING' && room.diceValue !== null) {
        const currentPlayer = room.players[room.currentPlayerIndex];
        if (currentPlayer.id === userId) {
          const prevLogCount = room.logs.length;
          const rollValue = room.diceValue;
          const updatedState = LudoEngine.moveToken(room, tokenId, room.diceValue);
          
          // Log to move history
          const token = currentPlayer.tokens.find(t => t.id === tokenId);
          if (token) {
            updatedState.moveHistory.push({
              player: currentPlayer.name,
              from: 0, // Not perfectly accurate but good enough for log
              to: token.position,
              roll: rollValue,
              color: currentPlayer.color,
              captured: updatedState.logs.length > prevLogCount && updatedState.logs[updatedState.logs.length-1].includes('captured')
            });
            if (updatedState.moveHistory.length > 50) updatedState.moveHistory.shift();
          }

          RoomManager.updateRoom(room.roomId, updatedState);
          io.to(room.roomId).emit("room:update", updatedState);
          processBotTurn(room.roomId);
        }
      }
    });
    
    socket.on("game:send-chat", ({ text }) => {
      const userId = getUserId(socket.id);
      if (!userId) return;

      const room = RoomManager.getRoomByPlayer(userId);
      if (room) {
        const player = room.players.find(p => p.id === userId);
        if (player) {
          room.messages.push({
            id: Math.random().toString(36).substr(2, 9),
            senderId: player.id,
            senderName: player.name,
            text,
            timestamp: Date.now()
          });
          // Keep last 50 messages
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
        if (player) {
          room.messages.push({
            id: Math.random().toString(36).substr(2, 9),
            senderId: player.id,
            senderName: player.name,
            emoji,
            timestamp: Date.now()
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
      if (room && room.status === 'FINISHED') {
        // Reset room state for new game
        room.status = 'WAITING';
        room.winner = null;
        room.diceValue = null;
        room.moveHistory = [];
        room.players.forEach(p => {
          p.isReady = false;
          p.tokens = [];
        });
        room.logs.push("Game was restarted by a player. Preparing for a new match!");
        io.to(room.roomId).emit("room:update", room);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      const userId = socketToUser.get(socket.id);
      if (userId) {
        socketToUser.delete(socket.id);
        userToSocket.delete(userId);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    console.log(`Starting in PRODUCTION mode. Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
