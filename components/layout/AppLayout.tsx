"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Menu, X } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isLoginPage = pathname === "/login";

  if (isLoginPage) return <>{children}</>;

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ed5c37] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse text-sm">Loading portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Mobile Header Overlays */}
      <div className={`fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)} />
      
      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform lg:translate-x-0 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile Navbar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#ed5c37] rounded-lg flex items-center justify-center text-white font-black text-sm">K</div>
              <span className="font-bold text-slate-900">CB QOps</span>
           </div>
           <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg">
              <Menu className="w-6 h-6" />
           </button>
        </div>

        <main className="main-container animate-in fade-in slide-in-from-bottom-2 duration-700">
           {children}
        </main>
      </div>
    </div>
  );
}

