"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, CheckSquare, Users, LogOut, Briefcase, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Daily Status", href: "/daily-status", icon: Calendar },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Project Hub", href: "/admin/projects", icon: Briefcase, adminOnly: true },
  { name: "Team Hub", href: "/admin/users", icon: Users, adminOnly: true },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="h-full w-full bg-[#1e293b] text-white flex flex-col border-r border-slate-800 shadow-2xl lg:shadow-none">
      <div className="p-6 text-xl font-bold border-b border-slate-700 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
           <img src="/logo.png" alt="CB QOps Logo" className="w-10 h-10 rounded-xl object-contain shadow-lg group-hover:scale-105 transition-transform" />
           <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#ed5c37] transition-colors">CB QOps</span>
        </Link>
        <button onClick={onClose} className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white">
           <X className="w-6 h-6" />
        </button>
      </div>
      
      <nav className="flex-1 mt-6 px-3 space-y-1">
        {menuItems.map((item) => {
          if (item.adminOnly && (session?.user as any)?.role !== "ADMIN") return null;
          
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? "bg-[#273449] text-white shadow-sm ring-1 ring-slate-700" 
                  : "text-slate-400 hover:text-white hover:bg-[#273449]/50"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-[#ed5c37]" : "group-hover:text-[#ed5c37]"} transition-colors`} />
              <span className="font-semibold text-sm">{item.name}</span>
            </Link>
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

