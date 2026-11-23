const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const WORLD = { width: 1800, height: 720, ground: 630 };
const MAX_PLAYERS = 8;

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}
function makeRoom(code, isPublic) {
  const room = { code, isPublic, players: new Map(), bullets: [], nextBullet: 1 };
  rooms.set(code, room);
  return room;
}
function spawn(index) {
  return { x: 180 + (index % 4) * 110, y: WORLD.ground - 48, vx: 0, vy: 0, hp: 100, score: 0, angle: 0 };
}
function cleanPlayer(p) {
  return { id: p.id, name: p.name, x: p.x, y: p.y, hp: p.hp, score: p.score, angle: p.angle, color: p.color };
}
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (room) {
    room.players.delete(socket.id);
    io.to(code).emit("notice", `${socket.data.playerName || "A player"} left the battle.`);
    if (room.players.size === 0) rooms.delete(code);
    else io.to(code).emit("state", snapshot(room));
  }
  socket.leave(code);
  socket.data.roomCode = null;
}
function joinRoom(socket, room) {
  if (room.players.size >= MAX_PLAYERS) return socket.emit("errorMessage", "That room is full.");
  leaveRoom(socket);
  const index = room.players.size;
  const p = {
    id: socket.id,
    name: String(socket.data.playerName || "Pilot").slice(0, 16),
    color: ["#55d6be", "#ffca58", "#ff6b6b", "#8b9dff", "#d58cff", "#8de06f", "#ff9f6e", "#67c9ff"][index % 8],
    ...spawn(index),
    input: { left: false, right: false, jump: false, shoot: false, aimX: 1, aimY: 0 },
    lastShot: 0,
    jumpReady: true
  };
  room.players.set(socket.id, p);
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.emit("joined", { code: room.code, isPublic: room.isPublic, world: WORLD, selfId: socket.id });
  io.to(room.code).emit("notice", `${p.name} joined the battle.`);
  io.to(room.code).emit("state", snapshot(room));
}
function snapshot(room) {
  return {
    code: room.code,
    players: [...room.players.values()].map(cleanPlayer),
    bullets: room.bullets.map(b => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, owner: b.owner }))
  };
}

io.on("connection", socket => {
  socket.on("setName", name => {
    socket.data.playerName = String(name || "Pilot").trim().slice(0, 16) || "Pilot";
  });

  socket.on("publicJoin", name => {
    socket.data.playerName = String(name || "Pilot").trim().slice(0, 16) || "Pilot";
    let room = rooms.get("PUBLIC-1");
    if (!room) room = makeRoom("PUBLIC-1", true);
    if (room.players.size >= MAX_PLAYERS) {
      // Start another public room when the first one is full.
      let n = 2;
      while (rooms.has(`PUBLIC-${n}`) && rooms.get(`PUBLIC-${n}`).players.size >= MAX_PLAYERS) n++;
      room = rooms.get(`PUBLIC-${n}`) || makeRoom(`PUBLIC-${n}`, true);
    }
    joinRoom(socket, room);
  });

  socket.on("createPrivate", name => {
    socket.data.playerName = String(name || "Pilot").trim().slice(0, 16) || "Pilot";
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    const room = makeRoom(code, false);
    joinRoom(socket, room);
  });

  socket.on("joinPrivate", ({ name, code } = {}) => {
    socket.data.playerName = String(name || "Pilot").trim().slice(0, 16) || "Pilot";
    const cleanCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room || room.isPublic) return socket.emit("errorMessage", "We couldn't find that private room. Check the code.");
    joinRoom(socket, room);
  });

  socket.on("input", input => {
    const room = rooms.get(socket.data.roomCode);
    const p = room && room.players.get(socket.id);
    if (!p || !input) return;
    p.input = {
      left: !!input.left, right: !!input.right, jump: !!input.jump, shoot: !!input.shoot,
      aimX: Math.max(-1, Math.min(1, Number(input.aimX) || 0)),
      aimY: Math.max(-1, Math.min(1, Number(input.aimY) || 0))
    };
  });

  socket.on("disconnect", () => leaveRoom(socket));
});

function tick() {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const p of room.players.values()) {
      const i = p.input;
      const accel = 0.85;
      if (i.left) p.vx -= accel;
      if (i.right) p.vx += accel;
      p.vx *= 0.82;
      p.vx = Math.max(-6, Math.min(6, p.vx));
      p.x += p.vx;
      p.x = Math.max(28, Math.min(WORLD.width - 28, p.x));
      p.vy += 0.58;
      p.y += p.vy;
      if (p.y >= WORLD.ground - 44) {
        p.y = WORLD.ground - 44;
        p.vy = 0;
        p.jumpReady = true;
      }
      if (i.jump && p.jumpReady) {
        p.vy = -11.5;
        p.jumpReady = false;
      }
      p.angle = Math.atan2(i.aimY, i.aimX || 0.001);
      if (i.shoot && now - p.lastShot > 330) {
        p.lastShot = now;
        const len = Math.hypot(i.aimX, i.aimY) || 1;
        const dx = i.aimX / len, dy = i.aimY / len;
        room.bullets.push({
          id: room.nextBullet++, owner: p.id,
          x: p.x + dx * 25, y: p.y - 8 + dy * 8,
          vx: dx * 13, vy: dy * 13, life: 75
        });
      }
    }
    for (const b of room.bullets) {
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) b.dead = true;
      for (const p of room.players.values()) {
        if (p.id === b.owner || p.hp <= 0) continue;
        if (Math.hypot(p.x - b.x, (p.y - 8) - b.y) < 25) {
          p.hp -= 25;
          b.dead = true;
          if (p.hp <= 0) {
            const attacker = room.players.get(b.owner);
            if (attacker) attacker.score += 1;
            setTimeout(() => {
              const currentRoom = rooms.get(room.code);
              const current = currentRoom && currentRoom.players.get(p.id);
              if (current) { current.hp = 100; Object.assign(current, spawn(0)); }
            }, 1800);
          }
          break;
        }
      }
    }
    room.bullets = room.bullets.filter(b => !b.dead);
    io.to(room.code).emit("state", snapshot(room));
  }
}
setInterval(tick, 1000 / 30);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Project BattleWorld running on port ${PORT}`);
});
