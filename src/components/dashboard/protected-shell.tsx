"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import LoadingScreen from "@/components/common/loading-screen";
import Header from "./header";
import Sidebar from "./sidebar";

const adminOnlyPaths = ["/users", "/audit-log"];

export default function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "ADMIN" && adminOnlyPaths.some((path) => pathname.startsWith(path))) {
      router.replace("/dashboard");
    }
  }, [loading, pathname, router, user]);

  if (loading || !user) {
    return <LoadingScreen message="Checking your session..." />;
  }

  if (user.role !== "ADMIN" && adminOnlyPaths.some((path) => pathname.startsWith(path))) {
    return <LoadingScreen message="Redirecting..." />;
  }

  return (
    <div className="app-shell">
      <Sidebar role={user.role} />
      <div className="main-column">
        <Header user={user} />
        {children}
      </div>
    </div>
  );
}
