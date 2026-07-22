import ProtectedShell from "@/components/dashboard/protected-shell";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
