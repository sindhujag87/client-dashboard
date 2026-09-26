import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import ActivityFeed from "../components/ActivityFeed";
import TaskList from "../components/TaskList";

interface Summary {
  totalProjects: number;
  tasksByStatus: { status: string; _count: number }[];
  overdueCount: number;
}

export default function AdminDashboard() {
  const { activity, onlineCount, prependHistoricalActivity } = useSocket();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api.get("/dashboard/admin").then((res) => setSummary(res.data));
    api.get("/tasks/activity/recent", { params: { limit: 20 } }).then((res) => prependHistoricalActivity(res.data.entries.map((e: any) => ({
      id: e.id, projectId: e.projectId, taskId: e.taskId, userName: e.user?.name ?? "System",
      action: e.action, fromStatus: e.fromStatus, toStatus: e.toStatus, createdAt: e.createdAt,
    }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
      <div>
        <h2>Admin Dashboard</h2>
        {summary && (
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <Stat label="Total projects" value={summary.totalProjects} />
            <Stat label="Overdue tasks" value={summary.overdueCount} />
            <Stat label="Online now" value={onlineCount} live />
            {summary.tasksByStatus.map((s) => (
              <Stat key={s.status} label={s.status} value={s._count} />
            ))}
          </div>
        )}
        <TaskList />
      </div>
      <div>
        <h3>Global Activity Feed</h3>
        <ActivityFeed events={activity} />
      </div>
    </div>
  );
}

function Stat({ label, value, live }: { label: string; value: number; live?: boolean }) {
  return (
    <div style={{ border: "1px solid #eee", padding: "8px 16px", borderRadius: 6 }}>
      <div style={{ fontSize: 20, fontWeight: 600 }}>
        {value} {live && <span style={{ color: "green", fontSize: 12 }}>&#9679; live</span>}
      </div>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
    </div>
  );
}
