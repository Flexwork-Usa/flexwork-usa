"use client";

import { useState } from "react";

export function BrandLogo({ imageClassName = "h-12 w-auto" }: { imageClassName?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <a href="/" className="flex items-center gap-2.5">
      {failed ? (
        <>
          <img src="/favicon.png" alt="" className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-tight text-slate-900">Flexwork-USA</span>
        </>
      ) : (
        <img
          src="/logo.png"
          alt="Flexwork-USA"
          className={imageClassName}
          onError={() => setFailed(true)}
        />
      )}
    </a>
  );
}
