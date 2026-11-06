import type { ReactNode } from "react";
import { Suspense } from "react";
import { PublicStatusAlert } from "@/components/public/public-status-alert";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export default function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <PublicHeader />
      <Suspense fallback={null}>
        <PublicStatusAlert />
      </Suspense>
      {children}
      <PublicFooter />
    </>
  );
}
