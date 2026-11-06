import { cn } from "@/lib/utils";
import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "GCBC Website",
  description: "Grace Christian Baptist Church website project.",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: ReactNode; modal?: ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, geistMono.variable)}>
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
