"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { secondaryButtonClass } from "@/lib/format";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <button
      type="button"
      className={className ?? secondaryButtonClass}
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        const supabase = createBrowserSupabaseClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
