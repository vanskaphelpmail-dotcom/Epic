"use client";

import { useEffect } from "react";
import Script from "next/script";

export const GA_MEASUREMENT_ID = "G-LZVS8S8PNH";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function sendPageView(path?: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const pagePath = path || `${window.location.pathname}${window.location.search}`;
  window.gtag("config", GA_MEASUREMENT_ID, { page_path: pagePath });
}

/** Call from SPA when the visible route / page changes. */
export function trackSpaPageView(page?: string) {
  if (typeof window === "undefined") return;
  const path =
    page && page !== "home"
      ? `${window.location.pathname}${window.location.search}`
      : `${window.location.pathname}${window.location.search}`;
  sendPageView(path);
}

export function GoogleAnalytics() {
  useEffect(() => {
    sendPageView();

    const onNav = () => sendPageView();
    window.addEventListener("popstate", onNav);

    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);
    history.pushState = (...args: Parameters<History["pushState"]>) => {
      const result = push(...args);
      queueMicrotask(onNav);
      return result;
    };
    history.replaceState = (...args: Parameters<History["replaceState"]>) => {
      const result = replace(...args);
      queueMicrotask(onNav);
      return result;
    };

    return () => {
      window.removeEventListener("popstate", onNav);
      history.pushState = push;
      history.replaceState = replace;
    };
  }, []);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}
