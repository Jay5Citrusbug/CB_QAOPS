"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function Home() {
  const router = useRouter();
  const { status, data: session } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      const role = (session?.user as any)?.role;
      if (role === "TL" || role === "DEV") {
        router.push("/test-cases");
      } else {
        router.push("/dashboard");
      }
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, session, router]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#ed5c37] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse tracking-wide">Initializing CB QOps Portal...</p>
      </div>
    </div>
  );
}

