import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../api/client";
import { useAuth } from "./AuthContext";
import { ActivityEvent, AppNotification } from "../types";

interface SocketContextValue {
  activity: ActivityEvent[];
  onlineCount: number;
  unreadNotificationCount: number;
  latestNotification: AppNotification | null;
  prependHistoricalActivity: (events: ActivityEvent[]) => void;
  clearLatestNotification: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState<AppNotification | null>(null);

  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("activity", (event: ActivityEvent) => {
      setActivity((prev) => [event, ...prev].slice(0, 100));
    });

    socket.on("presence", ({ onlineCount }: { onlineCount: number }) => {
      setOnlineCount(onlineCount);
    });

    socket.on("notification", ({ notification, unreadCount }: { notification: AppNotification; unreadCount: number }) => {
      setUnreadNotificationCount(unreadCount);
      setLatestNotification(notification);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  function prependHistoricalActivity(events: ActivityEvent[]) {
    // Used once on load to backfill the last 20 events a user missed while
    // offline — fetched from the DB (see api/activity.recent), never
    // reconstructed from an in-memory cache.
    setActivity((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const merged = [...prev, ...events.filter((e) => !existingIds.has(e.id))];
      return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 100);
    });
  }

  return (
    <SocketContext.Provider
      value={{
        activity,
        onlineCount,
        unreadNotificationCount,
        latestNotification,
        prependHistoricalActivity,
        clearLatestNotification: () => setLatestNotification(null),
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
