import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import { env } from "../config/env";
import { Role } from "@prisma/client";

let io: Server | null = null;

// Chose Socket.io over native WebSocket for: automatic reconnection with
// backoff, room-based broadcasting (used heavily below for role-scoped
// fan-out), and a clean auth handshake hook — all of which we'd otherwise
// hand-roll on top of raw `ws`. Native WebSocket would be lighter, but this
// app's whole "different feed per role" requirement is essentially rooms,
// which is Socket.io's core primitive.

export const roomForAdmins = () => "admins";
export const roomForPM = (pmId: string) => `pm:${pmId}`;
export const roomForDeveloper = (devId: string) => `dev:${devId}`;
export const roomForUser = (userId: string) => `user:${userId}`;

// Presence: connected socket count per user id, used for the admin
// dashboard's "active users online right now" live count.
const onlineUsers = new Map<string, number>();

function broadcastPresence() {
  io?.to(roomForAdmins()).emit("presence", { onlineCount: onlineUsers.size });
}

export function initSockets(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as { sub: string; role: Role };

    socket.join(roomForUser(user.sub));
    if (user.role === "ADMIN") {
      socket.join(roomForAdmins());
    } else if (user.role === "PM") {
      socket.join(roomForPM(user.sub));
    } else if (user.role === "DEVELOPER") {
      socket.join(roomForDeveloper(user.sub));
    }

    onlineUsers.set(user.sub, (onlineUsers.get(user.sub) ?? 0) + 1);
    broadcastPresence();

    socket.on("disconnect", () => {
      const count = (onlineUsers.get(user.sub) ?? 1) - 1;
      if (count <= 0) onlineUsers.delete(user.sub);
      else onlineUsers.set(user.sub, count);
      broadcastPresence();
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized yet");
  return io;
}

export function getOnlineCount(): number {
  return onlineUsers.size;
}
