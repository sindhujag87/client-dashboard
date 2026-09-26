export type Role = "ADMIN" | "PM" | "DEVELOPER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  assignedTo?: { id: string; name: string } | null;
  assignedToId?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  isOverdue: boolean;
  project?: { id: string; name: string };
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  taskId?: string | null;
  userName: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}
