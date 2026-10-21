"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { pageFrame } from "@/lib/frame";
import { SignOutButton } from "@/components/SignOutButton";
import type { AccountNav } from "@/lib/account";
import { hidesSiteChrome } from "@/lib/app-shell";
import { PLATFORM_LINKS } from "@/lib/site";

const accentButton =
  "inline-flex items-center justify-center rounded-lg bg-[#C85A17] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#A84810]";

const quietButton =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50";

function NavLinks({ onNavigate, light }: { onNavigate?: () => void; light?: boolean }) {
  const itemClass = light ? "text-sm text-white/85 hover:text-white" : "text-sm text-slate-600 hover:text-slate-900";

  return (
    <>
      {PLATFORM_LINKS.map((item) =>
        "external" in item && item.external ? (
          <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className={itemClass} onClick={onNavigate}>
            {item.label}
          </a>
        ) : (
          <a key={item.label} href={item.href} className={itemClass} onClick={onNavigate}>
            {item.label}
          </a>
        ),
      )}
    </>
  );
}

function Actions({
  account,
  onNavigate,
  light,
}: {
  account: AccountNav | null;
  onNavigate?: () => void;
  light?: boolean;
}) {
  const quiet = light
    ? "inline-flex items-center justify-center rounded-lg border border-white/40 bg-transparent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
    : quietButton;
  const accent = light
    ? "inline-flex items-center justify-center rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-[#7A320C] transition-colors hover:bg-orange-50"
    : accentButton;
  const muted = light ? "px-2 text-sm text-white/85 hover:text-white" : "px-2 text-sm text-slate-600 hover:text-slate-900";

  if (!account) {
    return (
      <>
        <a href="/login" className={quiet} onClick={onNavigate}>
          Log In
        </a>
        <a href="/onboard" className={accent} onClick={onNavigate}>
          Apply to Join
        </a>
      </>
    );
  }

  return (
    <>
      {account.role === "admin" ? (
        <a href="/console/v1/x9q7" className={muted} onClick={onNavigate}>
          Records
        </a>
      ) : (
        <span className={`${muted} tabular-nums`}>{account.tokenBalance} tokens</span>
      )}
      <a href="/dashboard" className={quiet} onClick={onNavigate}>
        Dashboard
      </a>
      <SignOutButton className={light ? "bg-transparent px-2 text-white/85 hover:bg-transparent hover:text-white" : "bg-transparent px-2 text-slate-600 hover:bg-transparent hover:text-slate-900"} />
    </>
  );
}

export function HeaderBar({ account }: { account: AccountNav | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const onDashboard = hidesSiteChrome(pathname);
  const overHero = pathname === "/" && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (onDashboard) return null;

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        overHero ? "border-transparent bg-transparent" : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className={`${pageFrame} grid h-16 grid-cols-[1fr_auto] items-center gap-4 lg:grid-cols-[1fr_auto_1fr]`}>
        <BrandLogo />
        <nav className="hidden items-center justify-center gap-6 lg:flex">
          <NavLinks light={overHero} />
        </nav>
        <div className="hidden items-center justify-end gap-2 lg:flex">
          <Actions account={account} light={overHero} />
        </div>
        <button
          type="button"
          className={`inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-lg border lg:hidden ${
            overHero ? "border-white/40 text-white" : "border-slate-200 text-slate-900"
          }`}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <nav className={`${pageFrame} flex flex-col gap-3 py-4`}>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="flex flex-col gap-2 pt-2">
              <Actions account={account} onNavigate={() => setOpen(false)} />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
