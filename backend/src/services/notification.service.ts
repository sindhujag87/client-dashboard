import { prisma } from "../config/prisma";
import { getIO, roomForUser } from "../sockets";

export async function notifyUser(userId: string, message: string, type: string, taskId?: string) {
  const notification = await prisma.notification.create({
    data: { userId, message, type, taskId: taskId ?? null },
  });

  const unreadCount = await prisma.notification.count({ where: { userId, read: false } });

  getIO().to(roomForUser(userId)).emit("notification", {
    notification,
    unreadCount,
  });

  return notification;
}
