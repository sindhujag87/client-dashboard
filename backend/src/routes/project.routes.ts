import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { createProject, listProjects, getProject } from "../controllers/project.controller";
import { projectScopedTaskRouter } from "./task.routes";

const router = Router();

router.use(requireAuth); // every route below requires a valid access token

router.post("/", requireRole("ADMIN", "PM"), createProject);
router.get("/", listProjects); // role-scoped inside the controller
router.get("/:id", getProject); // ownership-checked inside the controller

// Nested task creation: POST /projects/:projectId/tasks
router.use("/:projectId/tasks", projectScopedTaskRouter);

export default router;
