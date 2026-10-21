import { headers } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { Header, HeaderFallback } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { hidesSiteChrome } from "@/lib/app-shell";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <SiteChrome>{children}</SiteChrome>
    </Suspense>
  );
}

async function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (hidesSiteChrome(pathname)) return children;

  return (
    <>
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      {children}
      <SiteFooter />
    </>
  );
}
