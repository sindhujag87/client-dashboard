import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Task } from "../types";

export default function TaskList({ onStatusChange }: { onStatusChange?: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const status = searchParams.get("status") || "";
  const priority = searchParams.get("priority") || "";
  const dueFrom = searchParams.get("dueFrom") || "";
  const dueTo = searchParams.get("dueTo") || "";

  useEffect(() => {
    setLoading(true);
    api
      .get("/tasks", { params: { status, priority, dueFrom, dueTo } })
      .then((res) => setTasks(res.data.tasks))
      .finally(() => setLoading(false));
    // Filters live in the URL's query string, so this view is shareable/bookmarkable
    // and refetches whenever any filter param changes.
  }, [status, priority, dueFrom, dueTo]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  async function updateStatus(taskId: string, newStatus: string) {
    await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t)));
    onStatusChange?.();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={status} onChange={(e) => updateFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="DONE">Done</option>
        </select>
        <select value={priority} onChange={(e) => updateFilter("priority", e.target.value)}>
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <input type="date" value={dueFrom.slice(0, 10)} onChange={(e) => updateFilter("dueFrom", e.target.value ? new Date(e.target.value).toISOString() : "")} />
        <input type="date" value={dueTo.slice(0, 10)} onChange={(e) => updateFilter("dueTo", e.target.value ? new Date(e.target.value).toISOString() : "")} />
      </div>

      {loading ? (
        <p>Loading tasks...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>Title</th>
              <th>Project</th>
              <th>Assignee</th>
              <th>Priority</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} style={{ borderBottom: "1px solid #eee", background: task.isOverdue ? "#fff4f4" : undefined }}>
                <td>{task.title}</td>
                <td>{task.project?.name}</td>
                <td>{task.assignedTo?.name || "Unassigned"}</td>
                <td>{task.priority}</td>
                <td>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
                  {task.isOverdue && <span style={{ color: "crimson", marginLeft: 4 }}>Overdue</span>}
                </td>
                <td>
                  <select value={task.status} onChange={(e) => updateStatus(task.id, e.target.value)}>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
