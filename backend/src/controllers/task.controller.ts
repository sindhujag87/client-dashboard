import { Request, Response } from "express";
import { z } from "zod";
import { Priority, TaskStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { loadProjectWithOwnershipCheck } from "./project.controller";
import { logActivity } from "../services/activity.service";
import { notifyUser } from "../services/notification.service";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
  priority: z.nativeEnum(Priority).optional(),
  dueDate: z.string().datetime().optional(),
});

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const project = await loadProjectWithOwnershipCheck(req.params.projectId, req.user!);
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("Invalid request body", 422, parsed.error.flatten());

  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      title: parsed.data.title,
      description: parsed.data.description,
      assignedToId: parsed.data.assignedToId,
      priority: parsed.data.priority ?? "MEDIUM",
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    },
  });

  await logActivity({
    projectId: project.id,
    taskId: task.id,
    userId: req.user!.sub,
    action: "created task",
    toStatus: task.status,
    pmOwnerId: project.createdById,
    assignedToId: task.assignedToId,
  });

  if (task.assignedToId) {
    await notifyUser(task.assignedToId, `You were assigned: "${task.title}"`, "TASK_ASSIGNED", task.id);
  }

  res.status(201).json({ task });
});

const listQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
  projectId: z.string().uuid().optional(),
});

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError("Invalid query parameters", 422, parsed.error.flatten());
  const { status, priority, dueFrom, dueTo, projectId } = parsed.data;

  // Filters are plain query params (not POST body) specifically so the
  // resulting list view is a shareable/bookmarkable URL, per spec.
  const where: Record<string, unknown> = {
    ...(status && { status }),
    ...(priority && { priority }),
    ...(projectId && { projectId }),
    ...((dueFrom || dueTo) && {
      dueDate: {
        ...(dueFrom && { gte: new Date(dueFrom) }),
        ...(dueTo && { lte: new Date(dueTo) }),
      },
    }),
  };

  if (user.role === "DEVELOPER") {
    where.assignedToId = user.sub;
  } else if (user.role === "PM") {
    where.project = { createdById: user.sub };
  }
  // ADMIN: no additional restriction — sees everything matching filters

  const tasks = await prisma.task.findMany({
    where,
    include: { assignedTo: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  res.json({ tasks });
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

export const updateTaskStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("Invalid request body", 422, parsed.error.flatten());

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { project: true },
  });
  if (!task) throw new AppError("Task not found", 404);

  // Server-side ownership enforcement — this is what stops a Developer
  // from updating someone else's task even by hitting the endpoint
  // directly with a modified token.
  if (user.role === "DEVELOPER" && task.assignedToId !== user.sub) {
    throw new AppError("Forbidden: not your task", 403);
  }
  if (user.role === "PM" && task.project.createdById !== user.sub) {
    throw new AppError("Forbidden: not your project", 403);
  }

  const fromStatus = task.status;
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      status: parsed.data.status,
      // Clear the overdue flag if it's moved to Done; the scheduled job
      // re-derives it going forward, this just avoids a stale true.
      isOverdue: parsed.data.status === "DONE" ? false : task.isOverdue,
    },
  });

  await logActivity({
    projectId: task.projectId,
    taskId: task.id,
    userId: user.sub,
    action: "moved task",
    fromStatus,
    toStatus: updated.status,
    pmOwnerId: task.project.createdById,
    assignedToId: task.assignedToId,
  });

  if (updated.status === "IN_REVIEW") {
    await notifyUser(
      task.project.createdById,
      `"${task.title}" was moved to In Review`,
      "TASK_IN_REVIEW",
      task.id
    );
  }

  res.json({ task: updated });
});

/**
 * Role-filtered recent activity, used both by the dashboard's initial load
 * and by clients reconnecting after being offline to fetch the last 20
 * events they missed. Always a DB read — never served from an in-memory
 * cache, since that wouldn't survive a server restart or reach a client
 * that was offline when events were emitted.
 */
export const getRecentActivity = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 100);

  const where =
    user.role === "ADMIN"
      ? {}
      : user.role === "PM"
      ? { project: { createdById: user.sub } }
      : { task: { assignedToId: user.sub } };

  const entries = await prisma.activityLog.findMany({
    where,
    include: { user: { select: { name: true } }, task: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  res.json({ entries });
});
