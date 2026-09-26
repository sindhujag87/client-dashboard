import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler, AppError } from "../middleware/errorHandler";

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.sub, read: false },
  });
  res.json({ notifications, unreadCount });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.user!.sub) {
    throw new AppError("Notification not found", 404);
  }
  await prisma.notification.update({ where: { id: notification.id }, data: { read: true } });
  res.status(204).send();
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, read: false },
    data: { read: true },
  });
  res.status(204).send();
});
