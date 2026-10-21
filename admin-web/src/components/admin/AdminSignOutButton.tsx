"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { secondaryButtonClass } from "@/lib/format";

export function AdminSignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <button
      type="button"
      className={secondaryButtonClass}
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        try {
          const supabase = createBrowserSupabaseClient();
          await supabase.auth.signOut();
        } catch {
          // Leave the console even if sign-out fails.
        }
        window.location.replace("/console/v1/login");
      }}
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
