"use client";

import dynamic from "next/dynamic";

const StorefrontApp = dynamic(() => import("@/src/App"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50">
      <div className="flex flex-col items-center gap-3" role="status" aria-label="Loading">
        <svg viewBox="0 0 100 100" className="w-10 h-10" aria-hidden>
          <path d="M 8 44 L 26 44 L 17 60 Z" fill="#059669" />
          <path d="M 28 76 L 46 24" stroke="#059669" strokeWidth="12" strokeLinecap="round" />
          <path d="M 48 76 L 66 24" stroke="#10b981" strokeWidth="12" strokeLinecap="round" />
          <path d="M 74 56 L 92 56 L 83 40 Z" fill="#10b981" />
        </svg>
        <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    </div>
  ),
});

/** Optional catch-all: /, /shop, /product/:id, /admin/:tab, etc. — same SPA shell. */
export default function SpaCatchAllPage() {
  return <StorefrontApp />;
}
