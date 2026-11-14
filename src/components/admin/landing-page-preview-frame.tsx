"use client";

import { useEffect, useRef, useState } from "react";
import type { LandingPageContent } from "@/lib/landing-page";

type Props = { content: LandingPageContent; imageUrls: Record<string, string | null>; device: "desktop" | "mobile"; expanded?: boolean };

export function LandingPagePreviewFrame({ content, imageUrls, device, expanded = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const width = device === "mobile" ? 375 : 1440;
  const scale = Math.min(1, (containerSize.width || width) / width);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    function sendDraft() {
      frameRef.current?.contentWindow?.postMessage({ type: "landing-preview-update", content, imageUrls }, window.location.origin);
    }
    function ready(event: MessageEvent) {
      if (event.origin === window.location.origin && event.source === frameRef.current?.contentWindow && event.data?.type === "landing-preview-ready") sendDraft();
    }
    window.addEventListener("message", ready);
    sendDraft();
    return () => window.removeEventListener("message", ready);
  }, [content, imageUrls]);

  return (
    <div ref={containerRef} className={expanded ? "relative min-h-0 overflow-hidden rounded-xl border border-border bg-background" : "relative h-[70vh] overflow-hidden rounded-xl border border-border bg-background"}>
      <iframe ref={frameRef} title={expanded ? "Enlarged landing page preview" : "Landing page preview"} src="/landing-page-preview" style={{ position: "absolute", left: "50%", top: 0, width, height: (containerSize.height || 600) / scale, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }} />
    </div>
  );
}
