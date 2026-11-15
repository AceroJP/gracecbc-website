"use client";

import { Menu, X, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import type { LandingPageContent } from "@/lib/landing-page";
import type { PublicNavigation } from "@/lib/public-navigation";

type Props = {
  settings: LandingPageContent["header"];
  logoUrl: string | null;
  navigation: PublicNavigation;
};

function splitHref(href: string) {
  if (!href.startsWith("/")) return { path: null as string | null, hash: "" };
  if (href.startsWith("//")) return { path: null as string | null, hash: "" };
  const [path, hash] = href.split("#");
  return { path: path || "/", hash: hash ? `#${hash}` : "" };
}

export function PublicHeader({ settings, logoUrl, navigation }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [expandedMobileDropdowns, setExpandedMobileDropdowns] = useState<Record<string, boolean>>({});
  const [activeHash, setActiveHash] = useState<string>("");
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);

  const siteName = [settings.name, settings.subtitle].filter(Boolean).join(" ");

  useEffect(() => {
    const updateHash = () => setActiveHash(window.location.hash || "");
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useEffect(() => {
    if (!openDropdownId) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDropdownId(null);
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!navRef.current) return;
      if (event.target instanceof Node && navRef.current.contains(event.target)) return;
      setOpenDropdownId(null);
    }

    document.addEventListener("keydown", onKeyDown as unknown as EventListener);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown as unknown as EventListener);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openDropdownId]);

  useEffect(() => {
    setOpenDropdownId(null);
    setMenuOpen(false);
  }, [pathname]);

  const activeMatcher = useMemo(() => {
    return (href: string) => {
      const parts = splitHref(href);
      if (!parts.path) return false;
      if (parts.path !== pathname) return false;
      if (!parts.hash) return true;
      return parts.hash === activeHash;
    };
  }, [activeHash, pathname]);

  function handleMobileLoginClick(event: MouseEvent<HTMLAnchorElement>) {
    setMenuOpen(false);

    if (window.innerWidth < 640) {
      event.preventDefault();
      window.location.assign(new URL("/login", window.location.origin).toString());
    }
  }

  function toggleMobileDropdown(id: string) {
    setExpandedMobileDropdowns((current) => ({ ...current, [id]: !current[id] }));
  }

  function onDropdownTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpenDropdownId(null);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpenDropdownId((current) => (current === id ? null : id));
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6 sm:px-10 lg:px-12">
        <Link
          aria-label={`${siteName || "Church"} home`}
          className="flex items-center gap-3"
          href="/"
          onClick={() => {
            setMenuOpen(false);
            setOpenDropdownId(null);
          }}
        >
          <span
            className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand/15 bg-brand/5 text-[11px] font-bold tracking-wide text-brand"
            style={{ height: settings.logoSize, width: settings.logoSize }}
          >
            {logoUrl ? (
              <Image
                alt={settings.logo.alt}
                className="object-contain"
                fill
                sizes={`${settings.logoSize}px`}
                src={logoUrl}
                unoptimized
              />
            ) : (
              "GC"
            )}
          </span>
          <span className="max-w-40 text-sm leading-tight font-semibold tracking-tight sm:max-w-none">
            {settings.name}
            {settings.subtitle && (
              <span className="block font-normal text-muted-foreground">
                {settings.subtitle}
              </span>
            )}
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 md:flex"
          ref={(element) => {
            navRef.current = element;
          }}
        >
          {navigation.items.map((item) => {
            const active = activeMatcher(item.href);

            if (item.children.length === 0) {
              return (
                <Link
                  className={cn(
                    "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4",
                    active && "text-foreground",
                  )}
                  href={item.href}
                  key={item.id}
                  onClick={() => setOpenDropdownId(null)}
                >
                  {item.label}
                </Link>
              );
            }

            const panelId = `nav-dropdown-${item.id}`;
            const open = openDropdownId === item.id;

            return (
              <div className="relative" key={item.id}>
                <button
                  aria-controls={panelId}
                  aria-expanded={open}
                  className={cn(
                    "inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4",
                    active && "text-foreground",
                  )}
                  onClick={() => setOpenDropdownId((current) => (current === item.id ? null : item.id))}
                  onKeyDown={(event) => onDropdownTriggerKeyDown(event, item.id)}
                  type="button"
                >
                  {item.label}
                  <ChevronDown aria-hidden="true" className="size-4" />
                </button>

                {open && (
                  <div
                    className="absolute left-0 top-full z-50 mt-3 w-56 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-border bg-background shadow-lg"
                    id={panelId}
                    role="menu"
                  >
                    <div className="max-h-[calc(100vh-140px)] overflow-auto py-2">
                      {item.children.map((child) => (
                        <Link
                          className={cn(
                            "block px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
                            activeMatcher(child.href) && "text-foreground",
                          )}
                          href={child.href}
                          key={child.id}
                          onClick={() => setOpenDropdownId(null)}
                          role="menuitem"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {navigation.planVisit && (
            <Link
              className={cn(buttonVariants({ size: "sm" }), "ml-2")}
              href={navigation.planVisit.href}
            >
              {navigation.planVisit.label}
            </Link>
          )}

          <Link
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-2")}
            href="/login"
            prefetch={false}
          >
            Login
          </Link>
        </nav>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="flex size-10 items-center justify-center rounded-xl border border-border text-foreground md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {menuOpen ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>

      {menuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-border bg-background px-6 py-3 md:hidden"
          id="mobile-navigation"
        >
          {navigation.items.map((item) => {
            const active = activeMatcher(item.href);

            if (item.children.length === 0) {
              return (
                <Link
                  className={cn(
                    "block border-b border-border/70 py-3 text-sm font-medium last:border-0 focus-visible:outline-2 focus-visible:outline-offset-4",
                    active && "text-foreground",
                  )}
                  href={item.href}
                  key={item.id}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            }

            const expanded = Boolean(expandedMobileDropdowns[item.id]);

            return (
              <div className="border-b border-border/70 last:border-0" key={item.id}>
                <button
                  aria-expanded={expanded}
                  className={cn(
                    "flex w-full items-center justify-between py-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4",
                    active && "text-foreground",
                  )}
                  onClick={() => toggleMobileDropdown(item.id)}
                  type="button"
                >
                  <span>{item.label}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 transition-transform duration-200 motion-reduce:transition-none",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {expanded && (
                  <div className="pb-2 pl-3">
                    {item.children.map((child) => (
                      <Link
                        className={cn(
                          "block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4",
                          activeMatcher(child.href) && "text-foreground",
                        )}
                        href={child.href}
                        key={child.id}
                        onClick={() => setMenuOpen(false)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {navigation.planVisit && (
            <div className="mt-3">
              <Link
                className={cn(buttonVariants({ size: "sm" }), "w-full justify-center")}
                href={navigation.planVisit.href}
                onClick={() => setMenuOpen(false)}
              >
                {navigation.planVisit.label}
              </Link>
            </div>
          )}

          <Link
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 w-full justify-center")}
            href="/login"
            onClick={handleMobileLoginClick}
            prefetch={false}
          >
            Login
          </Link>
        </nav>
      )}
    </header>
  );
}
