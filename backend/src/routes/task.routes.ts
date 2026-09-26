import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { createTask, listTasks, updateTaskStatus, getRecentActivity } from "../controllers/task.controller";

const router = Router();
router.use(requireAuth);

router.get("/", listTasks);
router.patch("/:id/status", updateTaskStatus);
router.get("/activity/recent", getRecentActivity);

// Separate sub-router (not attached to the export above) mounted under
// /projects/:projectId/tasks in project.routes.ts, so task creation goes
// through the parent project's ownership check first.
export const projectScopedTaskRouter = Router({ mergeParams: true });
projectScopedTaskRouter.use(requireAuth);
projectScopedTaskRouter.post("/", requireRole("ADMIN", "PM"), createTask);

export default router;
