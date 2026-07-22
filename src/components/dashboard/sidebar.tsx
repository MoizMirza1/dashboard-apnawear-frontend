"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types";

const links = [
  { href: "/dashboard", label: "Dashboard", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/orders", label: "Orders", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/printing", label: "Printing Jobs", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/courier", label: "Courier & COD", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/returns", label: "Returns & RTO", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/products", label: "Product Designs", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/inventory", label: "Blank Inventory", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/purchases", label: "Purchase Batches", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/inventory/movements", label: "Stock Movements", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/suppliers", label: "Suppliers", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/expenses", label: "Expenses", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/ads", label: "Ad Campaigns", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/partners", label: "Partners & Wallets", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/reports", label: "Reports", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/settings", label: "Business Settings", roles: ["ADMIN", "PARTNER"] as UserRole[] },
  { href: "/users", label: "Users & Roles", roles: ["ADMIN"] as UserRole[] },
  { href: "/audit-log", label: "Audit Log", roles: ["ADMIN"] as UserRole[] },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  return <aside className="sidebar">
    <div className="sidebar-brand"><strong>APNA WEAR</strong><span>COMPLETE ERP</span></div>
    <nav className="nav-list">{links.filter((link) => link.roles.includes(role)).map((link) => {
      const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
      return <Link className={`nav-link ${active ? "nav-link-active" : ""}`} href={link.href} key={link.href}>{link.label}</Link>;
    })}</nav>
    <div className="sidebar-footer">Order-to-cash, inventory, partner ledger and reports are active.</div>
  </aside>;
}
