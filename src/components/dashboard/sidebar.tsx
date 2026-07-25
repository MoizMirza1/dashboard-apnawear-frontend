"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types";

type NavigationLink = {
  href: string;
  label: string;
  roles: UserRole[];
};

const mainLinks: NavigationLink[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["ADMIN", "PARTNER"] },
  { href: "/orders", label: "Orders", roles: ["ADMIN", "PARTNER"] },
  { href: "/products", label: "Products", roles: ["ADMIN", "PARTNER"] },
  { href: "/purchases", label: "Stock Purchases", roles: ["ADMIN", "PARTNER"] },
  { href: "/inventory", label: "Current Stock", roles: ["ADMIN", "PARTNER"] },
  { href: "/expenses", label: "Expenses", roles: ["ADMIN", "PARTNER"] },
  { href: "/partners", label: "Partners", roles: ["ADMIN", "PARTNER"] },
  { href: "/reports", label: "Reports", roles: ["ADMIN", "PARTNER"] },
  { href: "/settings", label: "Settings", roles: ["ADMIN", "PARTNER"] },
  { href: "/users", label: "Users", roles: ["ADMIN"] },
];

const advancedLinks: NavigationLink[] = [
  { href: "/printing", label: "Printing Jobs", roles: ["ADMIN", "PARTNER"] },
  { href: "/courier", label: "Courier & COD", roles: ["ADMIN", "PARTNER"] },
  { href: "/returns", label: "Returns & RTO", roles: ["ADMIN", "PARTNER"] },
  { href: "/suppliers", label: "Suppliers", roles: ["ADMIN", "PARTNER"] },
  { href: "/inventory/movements", label: "Stock Movements", roles: ["ADMIN", "PARTNER"] },
  { href: "/ads", label: "Ad Campaigns", roles: ["ADMIN", "PARTNER"] },
  { href: "/audit-log", label: "Audit Log", roles: ["ADMIN"] },
];

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const visibleMainLinks = mainLinks.filter((link) => link.roles.includes(role));
  const visibleAdvancedLinks = advancedLinks.filter((link) => link.roles.includes(role));
  const advancedActive = visibleAdvancedLinks.some((link) => isLinkActive(pathname, link.href));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <strong>APNA WEAR</strong>
        <span>ERP LITE</span>
      </div>

      <nav className="nav-list" aria-label="Main navigation">
        {visibleMainLinks.map((link) => (
          <Link
            className={`nav-link ${isLinkActive(pathname, link.href) ? "nav-link-active" : ""}`}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}

       <details
  className="sidebar-advanced"
  open={advancedActive}
  key={pathname}
>
  <summary>Advanced tools</summary>

  <div className="sidebar-advanced-links">
    {visibleAdvancedLinks.map((link) => (
      <Link
        className={`nav-link nav-link-secondary ${
          isLinkActive(pathname, link.href) ? "nav-link-active" : ""
        }`}
        href={link.href}
        key={link.href}
      >
        {link.label}
      </Link>
    ))}
  </div>
</details>
      </nav>

      <div className="sidebar-footer">Daily work: purchase stock, add orders, update delivery, and review profit.</div>
    </aside>
  );
}
