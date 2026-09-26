import React from "react";
import { ActivityEvent } from "../types";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function describe(event: ActivityEvent): string {
  if (event.action === "moved task" && event.fromStatus && event.toStatus) {
    return `${event.userName} moved a task from ${event.fromStatus} \u2192 ${event.toStatus}`;
  }
  if (event.action === "flagged overdue") {
    return `System flagged a task as overdue`;
  }
  if (event.action === "created task") {
    return `${event.userName} created a task`;
  }
  return `${event.userName} ${event.action}`;
}

export default function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <p style={{ color: "#888" }}>No activity yet.</p>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {events.map((event) => (
        <li
          key={event.id}
          style={{ padding: "8px 0", borderBottom: "1px solid #eee", fontSize: 14 }}
        >
          {describe(event)} &middot; <span style={{ color: "#888" }}>{timeAgo(event.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
