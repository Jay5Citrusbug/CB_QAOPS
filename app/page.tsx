import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const role = (session.user as any).role;
    if (role === "TL" || role === "DEV") {
      redirect("/test-cases");
    } else {
      redirect("/dashboard");
    }
  } else {
    redirect("/login");
  }
}
