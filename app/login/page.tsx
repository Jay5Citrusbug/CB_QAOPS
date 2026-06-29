"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  // Load remembered email on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (rememberMe) {
      localStorage.setItem("rememberedEmail", email);
    } else {
      localStorage.removeItem("rememberedEmail");
    }

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      // Fetch session to determine role-based redirect
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role;
      if (role === "TL" || role === "DEV") {
        router.push("/test-cases");
      } else {
        router.push("/dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen w-full bg-[#f8fafc] relative flex flex-col lg:flex-row items-center justify-center p-6 md:p-10 lg:p-12 xl:p-16 2xl:p-24 overflow-y-auto lg:overflow-hidden">
      {/* Immersive mesh glow backgrounds */}
      <div className="absolute top-[-10%] left-[-15%] w-[65%] h-[65%] bg-gradient-to-br from-[#ed5c37]/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[65%] h-[65%] bg-gradient-to-tl from-[#3b82f6]/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)]" />

      {/* Centered Content Wrapper */}
      <div className="w-full max-w-[1500px] mx-auto flex flex-col lg:flex-row items-center justify-between lg:h-full lg:max-h-[85vh] lg:min-h-0 z-10 relative">
        {/* Left Column: Branding and Illustration */}
        <div className="hidden lg:flex lg:w-[46%] flex-col justify-between lg:h-full lg:min-h-0 text-slate-800 pr-6">
          {/* Top Header branding */}
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Citrusbug Logo" className="w-12 h-12 object-contain shrink-0" />
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900">CB QOps</span>
              <span className="text-[10px] block font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">QA Operations Portal</span>
            </div>
          </div>

          {/* Middle illustration / Custom Mockup */}
          <div className="flex flex-col items-start justify-center space-y-3 xl:space-y-4 2xl:space-y-6">
            {/* Tagline branding */}
            <div className="space-y-3 xl:space-y-4">
              <h2 className="text-2xl lg:text-3xl xl:text-3xl 2xl:text-4xl font-black tracking-tight leading-tight text-slate-900">
                Quality Assurance, <br />
                <span className="bg-gradient-to-r from-[#ed5c37] via-orange-500 to-amber-500 bg-clip-text text-transparent">Automated & Orchestrated</span>
              </h2>
              <p className="text-slate-500 text-xs xl:text-xs xl:max-w-md 2xl:text-sm 2xl:max-w-lg font-semibold leading-relaxed max-w-sm">
                Empowering testing teams with comprehensive test case management, real-time checklist execution, and collaborative task boards.
              </p>
            </div>

            {/* Interactive CSS Mockup (Glassmorphism Dashboard) */}
            <div className="w-full max-w-sm xl:max-w-sm 2xl:max-w-md bg-white/60 border border-slate-200/80 backdrop-blur-md rounded-2xl p-4 xl:p-4 2xl:p-5 shadow-xl space-y-2.5 xl:space-y-3 text-slate-800">
              {/* Mockup Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 xl:w-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] xl:text-xs font-bold text-slate-400 uppercase tracking-wider">Active Execution Board</span>
                </div>
                <span className="text-[9px] xl:text-[11px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 xl:px-3 xl:py-1 rounded-md">Run #402</span>
              </div>

              {/* KPI grid inside mockup */}
              <div className="grid grid-cols-3 gap-2 xl:gap-2.5">
                <div className="bg-slate-50/80 border border-slate-100 p-2 rounded-xl text-center">
                  <span className="text-[9px] xl:text-[10px] font-bold text-slate-400 block uppercase">Test Cases</span>
                  <span className="text-xs xl:text-sm font-black text-slate-800 block mt-0.5">1,245</span>
                </div>
                <div className="bg-slate-50/80 border border-slate-100 p-2 rounded-xl text-center">
                  <span className="text-[9px] xl:text-[10px] font-bold text-slate-400 block uppercase">Pass Rate</span>
                  <span className="text-xs xl:text-sm font-black text-green-600 block mt-0.5">98.2%</span>
                </div>
                <div className="bg-slate-50/80 border border-slate-100 p-2 rounded-xl text-center">
                  <span className="text-[9px] xl:text-[10px] font-bold text-slate-400 block uppercase">Blocked</span>
                  <span className="text-xs xl:text-sm font-black text-red-600 block mt-0.5">3</span>
                </div>
              </div>

              {/* Chart mockup */}
              <div className="space-y-1.5 bg-slate-50/80 border border-slate-100 p-3 rounded-xl">
                <div className="flex justify-between items-center text-[9px] xl:text-[11px] font-bold text-slate-400 uppercase">
                  <span>Coverage Stats</span>
                  <span className="text-green-600">92%</span>
                </div>
                <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#ed5c37] to-amber-500 rounded-full" style={{ width: '92%' }} />
                </div>
              </div>

              {/* Subtask runs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-slate-50/80 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="truncate">Sanity Tests Run</span>
                  </div>
                  <span className="text-[10px] xl:text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-md">Passed</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50/80 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="truncate">Regression Run #42</span>
                  </div>
                  <span className="text-[10px] xl:text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-md">Running</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[10px] xl:text-xs text-slate-400 font-semibold mt-8">
            <span>&copy; {new Date().getFullYear()} Citrusbug CB QOps</span>
          </div>
        </div>

        {/* Right Column: Floating Login Form Card */}
        <div className="w-full lg:w-[48%] flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-sm xl:max-w-md 2xl:max-w-lg p-5 lg:p-6 lg:py-5 xl:p-8 xl:py-6 2xl:p-10 2xl:py-8 bg-white/80 border border-slate-200/85 backdrop-blur-3xl rounded-2xl xl:rounded-3xl shadow-2xl animate-in fade-in scale-in duration-500 text-slate-800 flex flex-col justify-center">
            <div>
              <div className="text-center mb-4 xl:mb-5">
                <div className="inline-flex mb-4">
                  <img src="/logo.svg" alt="Citrusbug Logo" className="w-12 h-12 xl:w-14 xl:h-14 2xl:w-16 2xl:h-16 object-contain" />
                </div>
                <h1 className="text-xl lg:text-2xl xl:text-2xl 2xl:text-3xl font-black tracking-tight leading-tight text-slate-900">
                  <span className="bg-gradient-to-r from-[#ed5c37] via-orange-500 to-amber-500 bg-clip-text text-transparent">Welcome</span>
                </h1>
                <p className="text-slate-500 text-xs mt-1.5 font-semibold">Sign in to your CB QOps portal</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 xl:space-y-3.5 2xl:space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2.5 xl:px-4 xl:py-2.5 2xl:px-5 2xl:py-3 bg-slate-100/80 border border-slate-200/80 focus:border-[#ed5c37]/50 rounded-xl 2xl:rounded-2xl focus:ring-2 focus:ring-[#ed5c37]/10 transition-all outline-none text-xs xl:text-sm text-slate-900 placeholder-slate-450 focus:bg-white"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      className="w-full px-4 py-2.5 xl:px-4 xl:py-2.5 2xl:px-5 2xl:py-3 bg-slate-100/80 border border-slate-200/80 focus:border-[#ed5c37]/50 rounded-xl 2xl:rounded-2xl focus:ring-2 focus:ring-[#ed5c37]/10 transition-all outline-none pr-11 xl:pr-11 2xl:pr-12 text-xs xl:text-sm text-slate-900 placeholder-slate-450 focus:bg-white"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 xl:w-4.5 xl:h-4.5" /> : <Eye className="w-4 h-4 xl:w-4.5 xl:h-4.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold select-none">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#ed5c37] focus:ring-[#ed5c37] cursor-pointer"
                    />
                    <span>Remember Me</span>
                  </label>
                </div>

                {error && (
                  <div className="p-2.5 bg-red-50 border border-red-100 text-red-655 text-xs font-semibold rounded-xl animate-shake">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2.5 px-4 xl:py-2.5 xl:px-4 2xl:py-3 2xl:px-5 rounded-xl font-bold text-white shadow-xl flex items-center justify-center transition-all cursor-pointer text-xs xl:text-sm ${loading
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#ed5c37] to-[#ea580c] hover:shadow-orange-200/50 hover:-translate-y-0.5 active:translate-y-0"
                    }`}
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            </div>

            <div className="lg:hidden text-center text-[10px] text-slate-400 font-semibold mt-10">
              &copy; {new Date().getFullYear()} Citrusbug CB QOps
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
