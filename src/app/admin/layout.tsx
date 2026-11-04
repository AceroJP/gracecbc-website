import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminUser } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: {
    default: "Admin workspace | GCBC",
    template: "%s | GCBC Admin",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <AdminContent>{children}</AdminContent>;
}

async function AdminContent({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireAdminUser();

  return <AdminShell userEmail={user.email ?? ""}>{children}</AdminShell>;
}
