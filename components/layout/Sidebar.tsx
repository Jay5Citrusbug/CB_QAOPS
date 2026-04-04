"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, CheckSquare, Users, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Daily Status", href: "/daily-status", icon: Calendar },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Admin", href: "/admin/users", icon: Users, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-[#1E293B] text-white flex flex-col z-50">
      <div className="p-6 text-xl font-bold border-b border-slate-700 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#F97316] rounded-lg flex items-center justify-center text-white font-mono leading-none">
          K
        </div>
        CB QOps
      </div>
      
      <nav className="flex-1 mt-6 px-3">
        {menuItems.map((item) => {
          if (item.adminOnly && (session?.user as any)?.role !== "ADMIN") return null;
          
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 mb-1 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? "bg-[#273449] text-white shadow-sm" 
                  : "text-slate-400 hover:text-white hover:bg-[#273449]"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-[#F97316]" : "group-hover:text-[#F97316]"}`} />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
