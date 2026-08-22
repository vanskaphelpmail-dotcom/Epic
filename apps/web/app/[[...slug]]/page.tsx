"use client";

import dynamic from "next/dynamic";

const StorefrontApp = dynamic(() => import("@/src/App"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50">
      <div className="flex flex-col items-center gap-3" role="status" aria-label="Loading">
        <img
          src="/epic-vanskap-logo.png?v=1"
          alt=""
          className="w-10 h-10 rounded-xl object-contain bg-black"
          width={40}
          height={40}
        />
        <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    </div>
  ),
});

/** Optional catch-all: /, /shop, /product/:id, /admin/:tab, etc. — same SPA shell. */
export default function SpaCatchAllPage() {
  return <StorefrontApp />;
}
