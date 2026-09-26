import cron from "node-cron";
import { prisma } from "../config/prisma";
import { logActivity } from "../services/activity.service";

// Chose node-cron over a Bull queue: this job has no need for retries,
// backoff, distributed workers, or persisted job state across processes —
// it's a single idempotent sweep. Bull would add a Redis dependency for a
// job that's just "SELECT ... WHERE dueDate < now, then UPDATE". If this
// app scaled to multiple backend instances, moving to Bull (or a Postgres
// advisory lock) would prevent the sweep from running redundantly on
// every instance — noted as a known limitation in the README.
export function startOverdueJob() {
  // Runs every minute. Tasks are flagged the moment they cross their due
  // date rather than only when a dashboard happens to load.
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const overdueTasks = await prisma.task.findMany({
      where: {
        dueDate: { lt: now },
        isOverdue: false,
        status: { not: "DONE" },
      },
      include: { project: true },
    });

    for (const task of overdueTasks) {
      await prisma.task.update({ where: { id: task.id }, data: { isOverdue: true } });
      await logActivity({
        projectId: task.projectId,
        taskId: task.id,
        userId: null,
        action: "flagged overdue",
        pmOwnerId: task.project.createdById,
        assignedToId: task.assignedToId,
      });
    }
  });
}
