"use client";

import { useState } from "react";

export function BrandLogo({ imageClassName = "h-10 w-auto" }: { imageClassName?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <a href="/" className="flex items-center gap-2.5">
      {failed ? (
        <>
          <span className="h-2.5 w-2.5 rounded-full bg-[#C85A17]" aria-hidden />
          <span className="text-sm font-semibold tracking-tight text-slate-900">flexwork-usa</span>
        </>
      ) : (
        <img
          src="/logo.png"
          alt="flexwork-usa"
          className={imageClassName}
          onError={() => setFailed(true)}
        />
      )}
    </a>
  );
}
