"use client";

import { Bell, Search, User } from "lucide-react";
import { useSession } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

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
        <button className="relative text-slate-500 hover:text-[#ed5c37] transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

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

