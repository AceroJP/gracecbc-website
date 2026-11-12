"use client";

import { useEffect } from "react";

const sessionIdKey = "gcbc:visitor-session-id";
const recordedSessionKey = "gcbc:visitor-session-recorded";

export function VisitorSessionTracker() {
  useEffect(() => {
    let sessionId: string;
    try {
      sessionId = sessionStorage.getItem(sessionIdKey) ?? crypto.randomUUID();
      sessionStorage.setItem(sessionIdKey, sessionId);
      if (sessionStorage.getItem(recordedSessionKey) === sessionId) return;
    } catch (error) {
      console.error("Unable to initialize visitor session tracking.", error);
      return;
    }

    void fetch("/api/visitor-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Visitor session request failed (${response.status}).`);
        }
        try {
          sessionStorage.setItem(recordedSessionKey, sessionId);
        } catch (error) {
          console.error("Unable to save visitor session tracking state.", error);
        }
      })
      .catch((error: unknown) => {
        console.error("Unable to record visitor session.", error);
      });
  }, []);

  return null;
}
