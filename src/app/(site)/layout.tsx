import { Suspense, type ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header, HeaderFallback } from "@/components/Header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      {children}
      <Footer />
    </>
  );
}
