"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/Footer";
import { hidesSiteChrome } from "@/lib/app-shell";

export function SiteFooter() {
  const pathname = usePathname();
  if (hidesSiteChrome(pathname)) return null;
  return <Footer />;
}
