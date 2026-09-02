"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

/**
 * Crisp live-chat widget, loaded site-wide. Mirrors this codebase's
 * mock-fallback convention for third-party integrations (Vanex, SendGrid,
 * Resala): absent NEXT_PUBLIC_CRISP_WEBSITE_ID, this renders nothing at
 * all rather than loading a broken widget — safe to ship before a real
 * Crisp account exists.
 */
export default function ChatWidget() {
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

  useEffect(() => {
    if (!websiteId || document.getElementById("crisp-chat-script")) return;

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = websiteId;

    const script = document.createElement("script");
    script.id = "crisp-chat-script";
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);
  }, [websiteId]);

  return null;
}
