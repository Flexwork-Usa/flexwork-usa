"use client";

let host: HTMLDivElement | null = null;

function ensureHost() {
  if (typeof document === "undefined") return null;
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.className = "pointer-events-none fixed inset-x-0 top-4 z-[80] flex flex-col items-center gap-2 px-4";
  document.body.appendChild(host);
  return host;
}

export function showToast(message: string, variant: "success" | "error" = "success") {
  const root = ensureHost();
  if (!root) return;
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.className =
    variant === "success"
      ? "pointer-events-auto max-w-lg rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 shadow-lg"
      : "pointer-events-auto max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-950 shadow-lg";
  el.textContent = message;
  root.appendChild(el);
  window.setTimeout(() => {
    el.remove();
    if (root.childElementCount === 0) {
      root.remove();
      host = null;
    }
  }, 6000);
}
