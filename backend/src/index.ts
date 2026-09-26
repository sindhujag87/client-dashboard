import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { initSockets, getOnlineCount } from "./sockets";
import { startOverdueJob } from "./jobs/overdueJob";

import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/project.routes";
import taskRoutes from "./routes/task.routes";
import notificationRoutes from "./routes/notification.routes";
import { requireAuth, requireRole } from "./middleware/auth";
import { prisma } from "./config/prisma";
import { asyncHandler } from "./middleware/errorHandler";

const app = express();
const httpServer = http.createServer(app);

app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);

// Admin dashboard summary endpoint (live online count comes from socket presence)
app.get(
  "/api/dashboard/admin",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const [totalProjects, tasksByStatus, overdueCount] = await Promise.all([
      prisma.project.count(),
      prisma.task.groupBy({ by: ["status"], _count: true }),
      prisma.task.count({ where: { isOverdue: true } }),
    ]);
    res.json({
      totalProjects,
      tasksByStatus,
      overdueCount,
      onlineCount: getOnlineCount(),
    });
  })
);

app.use(notFoundHandler);
app.use(errorHandler);

initSockets(httpServer);
startOverdueJob();

httpServer.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
