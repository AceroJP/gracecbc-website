import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentUser } from "@/lib/auth/server";

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
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (user.app_metadata?.role !== "admin") {
    redirect("/auth/login?error=unauthorized");
  }

  return <AdminShell userEmail={user.email ?? ""}>{children}</AdminShell>;
}
