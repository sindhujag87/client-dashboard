import { prisma } from "../config/prisma";
import { getIO, roomForAdmins, roomForPM, roomForDeveloper } from "../sockets";

interface LogActivityInput {
  projectId: string;
  taskId?: string | null;
  userId?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  pmOwnerId: string; // the project's createdById, used to route to the right PM room
  assignedToId?: string | null; // the task's assigned developer, used to route to their room
}

/**
 * Single choke point for "something happened" — persists the log row
 * (so catch-up after being offline is a DB read, never memory-only)
 * and fans it out over the socket rooms relevant to each role's scope.
 */
export async function logActivity(input: LogActivityInput) {
  const entry = await prisma.activityLog.create({
    data: {
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  const io = getIO();
  const payload = {
    id: entry.id,
    projectId: entry.projectId,
    taskId: entry.taskId,
    userName: entry.user?.name ?? "System",
    action: entry.action,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    createdAt: entry.createdAt,
  };

  // Admin sees every project's activity in one global feed
  io.to(roomForAdmins()).emit("activity", payload);
  // PM sees activity only for projects they created
  io.to(roomForPM(input.pmOwnerId)).emit("activity", payload);
  // Developer sees activity only on tasks assigned to them
  if (input.assignedToId) {
    io.to(roomForDeveloper(input.assignedToId)).emit("activity", payload);
  }

  return entry;
}
