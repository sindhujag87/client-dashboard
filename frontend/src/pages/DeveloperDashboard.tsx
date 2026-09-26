import React, { useEffect } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import ActivityFeed from "../components/ActivityFeed";
import TaskList from "../components/TaskList";

export default function DeveloperDashboard() {
  const { activity, prependHistoricalActivity } = useSocket();

  useEffect(() => {
    api.get("/tasks/activity/recent", { params: { limit: 20 } }).then((res) =>
      prependHistoricalActivity(
        res.data.entries.map((e: any) => ({
          id: e.id, projectId: e.projectId, taskId: e.taskId, userName: e.user?.name ?? "System",
          action: e.action, fromStatus: e.fromStatus, toStatus: e.toStatus, createdAt: e.createdAt,
        }))
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
      <div>
        <h2>My Tasks</h2>
        <p style={{ color: "#666" }}>Tasks assigned to you, sorted by priority then due date.</p>
        <TaskList />
      </div>
      <div>
        <h3>Activity on Your Tasks</h3>
        <ActivityFeed events={activity} />
      </div>
    </div>
  );
}
