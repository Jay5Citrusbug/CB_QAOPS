"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GripVertical, LayoutDashboard, Calendar, CheckSquare, Users, LogOut, Briefcase, X, FlaskConical, Settings, Folder, StickyNote, FileText, Star, HardDrive, BookOpen } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, allowedRoles: ["ADMIN", "USER"] },
  { name: "Daily Status", href: "/daily-status", icon: Calendar, allowedRoles: ["ADMIN", "USER"] },
  { name: "My Projects", href: "/my-projects", icon: Folder, allowedRoles: ["ADMIN", "TL", "USER"] },
  { name: "Project Docs", href: "/project-docs", icon: FileText, allowedRoles: ["ADMIN", "TL", "DEV", "USER"] },
  { name: "QA Docs", href: "/qa-docs", icon: BookOpen, allowedRoles: ["ADMIN", "TL", "DEV", "USER"] },
  { name: "Favorites", href: "/favorites", icon: Star, allowedRoles: ["ADMIN", "TL", "DEV", "USER"] },
  { name: "My Drive", href: "/my-drive", icon: HardDrive, allowedRoles: ["ADMIN", "TL", "DEV", "USER"] },
  { name: "Test Cases", href: "/test-cases", icon: FlaskConical, allowedRoles: ["ADMIN", "USER", "TL", "DEV"] },
  { name: "Task Board", href: "/task-board", icon: CheckSquare, allowedRoles: ["ADMIN", "USER", "TL", "DEV"] },
  { name: "Quick Notes", href: "/quick-notes", icon: StickyNote, allowedRoles: ["ADMIN", "USER", "TL", "DEV"] },
  { name: "Project Hub", href: "/admin/projects", icon: Briefcase, allowedRoles: ["ADMIN"] },
  { name: "Team Hub", href: "/admin/users", icon: Users, allowedRoles: ["ADMIN"] },
  { name: "Settings", href: "/settings", icon: Settings, allowedRoles: ["ADMIN", "TL", "DEV", "USER"] },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [items, setItems] = useState(menuItems);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem("cb_qops_sidebar_order");
      if (savedOrder) {
        const orderedHrefs = JSON.parse(savedOrder) as string[];
        const sortedItems = [...menuItems].sort((a, b) => {
          const indexA = orderedHrefs.indexOf(a.href);
          const indexB = orderedHrefs.indexOf(b.href);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        setItems(sortedItems);
      }
    } catch (e) {
      console.error("Failed to parse sidebar order from localStorage", e);
    }
  }, []);

  const userRole = (session?.user as any)?.role || "USER";
  const visibleItems = items.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, visibleIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === visibleIndex) return;

    const visibleItem = visibleItems[draggedIndex];
    const targetItem = visibleItems[visibleIndex];

    const fullIdxSource = items.findIndex((item) => item.href === visibleItem.href);
    const fullIdxTarget = items.findIndex((item) => item.href === targetItem.href);

    if (fullIdxSource !== -1 && fullIdxTarget !== -1) {
      const updated = [...items];
      const [removed] = updated.splice(fullIdxSource, 1);
      updated.splice(fullIdxTarget, 0, removed);

      setDraggedIndex(visibleIndex);
      setItems(updated);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    const order = items.map((item) => item.href);
    localStorage.setItem("cb_qops_sidebar_order", JSON.stringify(order));
  };

  return (
    <div className="h-full w-full bg-[#1e293b] text-white flex flex-col border-r border-slate-800 shadow-2xl lg:shadow-none">
      <div className="p-6 text-xl font-bold border-b border-slate-700 flex items-center justify-between">
        <Link href="/dashboard" prefetch={false} className="flex items-center gap-3 group">
          <img src="/logo.svg" alt="Citrusbug Logo" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" />
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#ed5c37] transition-colors">CB QOps</span>
        </Link>
        <button onClick={onClose} className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <nav className="flex-1 mt-6 px-3 space-y-1 select-none">
        {visibleItems.map((item, idx) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const isDragging = draggedIndex === idx;
          
          return (
            <div
              key={item.href}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`relative flex items-center group rounded-xl transition-all duration-200 ${
                isDragging 
                  ? "opacity-35 scale-[0.98] border border-dashed border-[#ed5c37] bg-[#273449]/20" 
                  : ""
              }`}
            >
              {/* Grip Handle */}
              <div className="absolute left-2.5 text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                <GripVertical className="w-4 h-4" />
              </div>

              <Link
                href={item.href}
                prefetch={false}
                draggable={false}
                onDragStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  if (draggedIndex !== null) {
                    e.preventDefault();
                    return;
                  }
                  if (onClose) onClose();
                }}
                className={`flex items-center gap-3 pl-9 pr-4 py-3 w-full rounded-xl transition-all duration-200 ${
                  isActive 
                    ? "bg-[#273449] text-white shadow-sm ring-1 ring-slate-700" 
                    : "text-slate-400 hover:text-white hover:bg-[#273449]/50"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-[#ed5c37]" : "group-hover:text-[#ed5c37]"} transition-colors`} />
                <span className="font-semibold text-sm">{item.name}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 font-semibold text-sm"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}


