"use client";

import { useState } from "react";
import { secondaryButtonClass } from "@/lib/format";
import { signOutToLogin } from "@/lib/auth/session";

export function SignOutButton({ className }: { className?: string }) {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <button
      type="button"
      className={className ?? secondaryButtonClass}
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        try {
          await signOutToLogin();
        } catch {
          setSigningOut(false);
        }
      }}
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
