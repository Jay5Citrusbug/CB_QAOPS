"use client";

import { Bell, Search, User, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string | null;
}

export default function Header() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchNotifications();
      // Fetch every 60 seconds
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [session]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-8 flex items-center justify-between">
      <div className="relative w-96 group">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Search items..."
          className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#ed5c37]/20 transition-all outline-none"
        />
      </div>

      <div className="flex items-center gap-6">
        {/* Notifications Popover */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) {
                fetchNotifications(); // Refresh on open
              }
            }}
            className="relative text-slate-500 hover:text-[#ed5c37] transition-colors focus:outline-none p-1.5 rounded-full hover:bg-slate-100"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="font-bold text-slate-800 text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-semibold text-[#ed5c37] hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 border-b border-slate-50 text-xs transition-colors hover:bg-slate-50/50 ${
                        !n.read ? "bg-blue-50/20 font-medium" : ""
                      }`}
                    >
                      <div className="text-slate-700 leading-relaxed mb-1">{n.message}</div>
                      <div className="text-[10px] text-slate-400">{formatTime(n.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900 leading-none">
              {session?.user?.name || "User Name"}
            </p>
            <p className="text-xs text-slate-500 capitalize mt-1">
              {(() => {
                const role = (session?.user as any)?.role;
                const roleMap: Record<string, string> = { USER: "QA Engineer", ADMIN: "Admin", TL: "Team Lead", DEV: "Developer" };
                return roleMap[role] || role?.toLowerCase() || "guest";
              })()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#1E293B] text-white flex items-center justify-center font-bold text-sm border-2 border-slate-100 ring-2 ring-[#ed5c37]/10">
            <User className="w-5 h-5 p-0.5" />
          </div>
        </div>
      </div>
    </header>
  );
}
