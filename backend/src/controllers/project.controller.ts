import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const createProjectSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid(),
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("Invalid request body", 422, parsed.error.flatten());

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      clientId: parsed.data.clientId,
      createdById: req.user!.sub,
    },
  });
  res.status(201).json({ project });
});

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.role === "ADMIN") {
    const projects = await prisma.project.findMany({ include: { client: true, tasks: true } });
    return res.json({ projects });
  }

  if (user.role === "PM") {
    // PM can only see/manage projects they created
    const projects = await prisma.project.findMany({
      where: { createdById: user.sub },
      include: { client: true, tasks: true },
    });
    return res.json({ projects });
  }

  // DEVELOPER: only projects that contain a task assigned to them
  const projects = await prisma.project.findMany({
    where: { tasks: { some: { assignedToId: user.sub } } },
    include: { client: true, tasks: { where: { assignedToId: user.sub } } },
  });
  res.json({ projects });
});

/**
 * Loads a project and enforces ownership: this is the actual server-side
 * gate that stops a PM (or a Developer with a tampered token) from reaching
 * another PM's project data, regardless of what the frontend shows.
 */
export async function loadProjectWithOwnershipCheck(projectId: string, user: { sub: string; role: string }) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("Project not found", 404);

  if (user.role === "PM" && project.createdById !== user.sub) {
    throw new AppError("Forbidden: not your project", 403);
  }
  if (user.role === "DEVELOPER") {
    const hasTask = await prisma.task.findFirst({
      where: { projectId, assignedToId: user.sub },
    });
    if (!hasTask) throw new AppError("Forbidden: no assigned tasks on this project", 403);
  }
  return project;
}

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await loadProjectWithOwnershipCheck(req.params.id, req.user!);
  res.json({ project });
});
