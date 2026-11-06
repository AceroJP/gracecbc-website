"use client";

import { Heart } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleDevotionalReaction } from "@/app/(public)/devotionals/reaction-actions";

const visitorStorageKey = "gcbc_devotional_visitor_id";

function getVisitorId() {
  const existing = window.localStorage.getItem(visitorStorageKey);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) {
    return existing;
  }

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const generated = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  window.localStorage.setItem(visitorStorageKey, generated);
  window.dispatchEvent(new Event("gcbc-visitor-id"));
  return generated;
}

function subscribeToVisitor(listener: () => void) {
  const notify = () => listener();
  if (!window.localStorage.getItem(visitorStorageKey)) {
    getVisitorId();
  }
  window.addEventListener("storage", notify);
  window.addEventListener("gcbc-visitor-id", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("gcbc-visitor-id", notify);
  };
}

function getVisitorSnapshot() {
  return window.localStorage.getItem(visitorStorageKey);
}

function getServerVisitorSnapshot() {
  return null;
}

function subscribeToLiked(
  devotionalId: string,
  listener: () => void,
) {
  const notify = () => listener();
  window.addEventListener("storage", notify);
  window.addEventListener(`gcbc-devotional-liked-${devotionalId}`, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(`gcbc-devotional-liked-${devotionalId}`, notify);
  };
}

function getLikedSnapshot(devotionalId: string) {
  return window.localStorage.getItem(`gcbc_devotional_liked_${devotionalId}`) === "1";
}

export function DevotionalReactionButton({
  devotionalId,
  initialCount,
}: {
  devotionalId: string;
  initialCount: number;
}) {
  const visitorId = useSyncExternalStore(
    subscribeToVisitor,
    getVisitorSnapshot,
    getServerVisitorSnapshot,
  );
  const liked = useSyncExternalStore(
    (listener) => subscribeToLiked(devotionalId, listener),
    () => getLikedSnapshot(devotionalId),
    () => false,
  );
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!visitorId) return;
    const action = liked ? "unlike" : "like";
    startTransition(async () => {
      const result = await toggleDevotionalReaction({
        action,
        devotionalId,
        visitorId,
      });
      if (result.status === "success" && result.liked !== undefined && result.reactionCount !== undefined) {
        setCount(result.reactionCount);
        if (result.liked) {
          window.localStorage.setItem(`gcbc_devotional_liked_${devotionalId}`, "1");
        } else {
          window.localStorage.removeItem(`gcbc_devotional_liked_${devotionalId}`);
        }
        window.dispatchEvent(new Event(`gcbc-devotional-liked-${devotionalId}`));
      }
    });
  }

  return (
    <Button
      aria-pressed={liked}
      disabled={!visitorId || pending}
      onClick={toggle}
      type="button"
      variant={liked ? "secondary" : "outline"}
    >
      <Heart aria-hidden="true" fill={liked ? "currentColor" : "none"} />
      {liked ? "Liked" : "Like"} · {count}
    </Button>
  );
}
