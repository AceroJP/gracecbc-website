"use client";

import {
  Bell,
  BookOpenText,
  CalendarDays,
  ChevronRight,
  Church,
  FileImage,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MonitorPlay,
  PanelsTopLeft,
  Settings2,
  Waves,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Landing Page Builder", href: "/admin/landing-page", icon: PanelsTopLeft },
  { label: "Events", href: "/admin/events", icon: CalendarDays },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
  { label: "Schedules", href: "/admin/schedules", icon: CalendarDays },
  { label: "Baptism", href: "/admin/baptism", icon: Waves },
  { label: "Devotionals", href: "/admin/devotionals", icon: BookOpenText },
  { label: "Livestream", href: "/admin/livestream", icon: MonitorPlay },
  { label: "Media Library", href: "/admin/media", icon: FileImage },
  { label: "Website Settings", href: "/admin/settings", icon: Settings2 },
];

function AdminNavigation({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="space-y-1">
      {navigation.map(({ label, href, icon: Icon }) => {
        const active =
          pathname === href ||
          (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`));

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
            href={href}
            key={href}
            onClick={onNavigate}
          >
            <Icon aria-hidden="true" className="size-[17px] shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <Link
        aria-label="Admin dashboard home"
        className="flex items-center gap-3 px-2 py-1"
        href="/admin/dashboard"
        onClick={onNavigate}
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-white">
          <Church aria-hidden="true" className="size-5" />
        </span>
        <span className="text-sm leading-tight font-semibold">
          Church website
          <span className="mt-1 block text-xs font-normal text-sidebar-foreground/55">
            Admin workspace
          </span>
        </span>
      </Link>

      <div className="mt-10">
        <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.17em] text-sidebar-foreground/45 uppercase">
          Manage website
        </p>
        <AdminNavigation onNavigate={onNavigate} />
      </div>

      <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/65 p-4">
        <p className="text-xs font-semibold">Setup in progress</p>
        <p className="mt-1 text-xs leading-5 text-sidebar-foreground/60">
          Admin access is protected. Website management tools are still
          interface placeholders.
        </p>
      </div>
    </>
  );
}

export function AdminShell({
  children,
  userEmail,
}: Readonly<{ children: ReactNode; userEmail: string }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const currentPage =
    navigation.find(
      ({ href }) =>
        pathname === href ||
        (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`)),
    )?.label ?? "Workspace";

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside
            className="relative flex h-full w-[min(84vw,310px)] flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 shadow-2xl"
            id="mobile-admin-navigation"
          >
            <div className="mb-7 flex items-center justify-end">
              <button
                aria-label="Close navigation menu"
                className="flex size-9 items-center justify-center rounded-lg border border-sidebar-border"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open admin navigation"
              aria-controls="mobile-admin-navigation"
              aria-expanded={mobileOpen}
              className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu aria-hidden="true" className="size-4" />
            </button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden sm:inline">Admin</span>
              <ChevronRight aria-hidden="true" className="hidden size-3.5 sm:block" />
              <span className="font-medium text-foreground">{currentPage}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              aria-label="Notifications placeholder"
              className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Notifications placeholder"
              type="button"
            >
              <Bell aria-hidden="true" className="size-[18px]" />
            </button>
            <span aria-hidden="true" className="h-7 w-px bg-border" />
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                {userEmail.charAt(0).toUpperCase() || "A"}
              </span>
              <span className="hidden max-w-48 truncate text-xs leading-4 sm:block">
                <span className="block truncate font-medium">{userEmail}</span>
                <span className="text-muted-foreground">Administrator</span>
              </span>
            </div>
            <form action={signOutAction}>
              <Button
                aria-label="Sign out"
                className="size-9"
                size="icon"
                title="Sign out"
                type="submit"
                variant="ghost"
              >
                <LogOut aria-hidden="true" />
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-8 sm:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
