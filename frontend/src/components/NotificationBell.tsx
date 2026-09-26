import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { AppNotification } from "../types";

export default function NotificationBell() {
  const { unreadNotificationCount } = useSocket();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [count, setCount] = useState(0);

  async function load() {
    const res = await api.get("/notifications");
    setNotifications(res.data.notifications);
    setCount(res.data.unreadCount);
  }

  useEffect(() => {
    load();
  }, []);

  // Real-time unread count pushed over the socket, not polled
  useEffect(() => {
    if (unreadNotificationCount > 0) setCount(unreadNotificationCount);
  }, [unreadNotificationCount]);

  async function markOne(id: string) {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setCount((c) => Math.max(0, c - 1));
  }

  async function markAll() {
    await api.patch("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setCount(0);
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        Notifications
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "crimson",
              color: "white",
              borderRadius: "50%",
              fontSize: 10,
              padding: "2px 6px",
            }}
          >
            {count}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            background: "white",
            border: "1px solid #ddd",
            width: 300,
            maxHeight: 320,
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
            <strong>Notifications</strong>
            <button onClick={markAll}>Mark all read</button>
          </div>
          {notifications.length === 0 && <p style={{ padding: 8, color: "#888" }}>Nothing yet.</p>}
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && markOne(n.id)}
              style={{ padding: 8, borderBottom: "1px solid #f2f2f2", background: n.read ? "white" : "#f8f9ff", cursor: "pointer" }}
            >
              <div style={{ fontSize: 13 }}>{n.message}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
