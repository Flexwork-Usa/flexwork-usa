"use client";

import type { ReactNode } from "react";

export function AuthPage({
  title,
  subtitle,
  panelTitle,
  panelBody,
  badge = "Operations access",
  highlights,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  panelTitle: string;
  panelBody: string;
  badge?: string;
  highlights?: string[];
  footer?: ReactNode;
  children: ReactNode;
}) {
  const items = highlights ?? [
    "Review deposits, payouts, and worker applications",
    "Approve onboarding and manage worker admins",
    "Keep operations records in one console",
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#A34A12] via-[#8A3B0E] to-[#6E2E0B] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-black/20" />
        <div className="relative inline-flex items-center rounded-xl bg-white px-3 py-2">
          <img src="/logo.png" alt="Flexwork-USA" className="h-12 w-auto" />
        </div>
        <div className="relative max-w-md">
          <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium">
            {badge}
          </p>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight">{panelTitle}</h2>
          <p className="mt-4 text-sm leading-7 text-white/80">{panelBody}</p>
          <ul className="mt-8 space-y-3 text-sm text-white/90">
            {items.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[11px]">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Secure sign-in · operations console</p>
      </aside>
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_46%)] px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 inline-flex items-center">
            <img src="/logo.png" alt="Flexwork-USA" className="h-12 w-auto" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          {footer ? <div className="mt-5 text-center text-sm text-slate-600">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

export const authFieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#C85A17] focus:ring-2 focus:ring-[#C85A17]/30";

export const authButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#C85A17] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#A84810] disabled:cursor-not-allowed disabled:opacity-60";
