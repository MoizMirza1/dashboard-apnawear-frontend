"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import type { SessionUser } from "@/types";

export default function Header({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [working, setWorking] = useState(false);

  async function handleLogout() {
    setWorking(true);
    await logout();
    router.replace("/login");
  }

  return (
    <header className="topbar">
      <div className="user-chip">
        <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{user.name}</strong>
          <span>{user.email} · {user.role}</span>
        </div>
      </div>

      <button className="button button-secondary" disabled={working} onClick={handleLogout} type="button">
        {working ? "Signing out..." : "Sign out"}
      </button>
    </header>
  );
}
