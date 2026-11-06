"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, type MouseEvent } from "react";

const navigation = [
  { label: "Events", href: "/#events" },
  { label: "Schedules", href: "/#schedules" },
  { label: "Livestream", href: "/#livestream" },
  { label: "Devotionals", href: "/#devotionals" },
  { label: "Contact", href: "/#contact" },
];

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  function handleMobileLoginClick(event: MouseEvent<HTMLAnchorElement>) {
    setMenuOpen(false);

    if (window.innerWidth < 640) {
      event.preventDefault();
      window.location.assign(new URL("/login", window.location.origin).toString());
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6 sm:px-10 lg:px-12">
        <Link
          aria-label="Grace Christian Baptist Church home"
          className="flex items-center gap-3"
          href="/"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex size-10 items-center justify-center rounded-xl border border-brand/15 bg-brand/5 text-[11px] font-bold tracking-wide text-brand">
            GC
          </span>
          <span className="max-w-40 text-sm leading-tight font-semibold tracking-tight sm:max-w-none">
            Grace Christian
            <span className="block font-normal text-muted-foreground">
              Baptist Church
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          {navigation.map((item) => (
            <Link
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
          <Link
            className="text-sm font-semibold text-brand transition-colors hover:text-foreground"
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
          className="flex size-10 items-center justify-center rounded-xl border border-border text-foreground lg:hidden"
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
          className="border-t border-border bg-background px-6 py-3 lg:hidden"
          id="mobile-navigation"
        >
          {navigation.map((item) => (
            <Link
              className="block border-b border-border/70 py-3 text-sm font-medium last:border-0"
              href={item.href}
              key={item.label}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            className="block border-b border-border/70 py-3 text-sm font-semibold text-brand"
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
