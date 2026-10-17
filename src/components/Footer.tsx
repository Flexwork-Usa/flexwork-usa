import { BrandLogo } from "@/components/BrandLogo";
import { pageFrame } from "@/lib/frame";
import { DISCORD_URL } from "@/lib/site";

const columns = [
  {
    title: "Platform",
    links: [
      { label: "Home", href: "/" },
      { label: "Opportunities", href: "/jobs" },
      { label: "Community", href: DISCORD_URL, external: true },
      { label: "How To Get Started", href: "/get-started" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Onboard Application", href: "/onboard" },
      { label: "Member Login", href: "/login" },
      { label: "Worker Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "AI Platform Guides", href: "/get-started#guides" },
      { label: "CV Preparation", href: "/get-started#cv" },
      { label: "KYC Instructions", href: "/get-started#kyc" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-gradient-to-b from-orange-50/40 to-white">
      <div className={`${pageFrame} grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <BrandLogo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">
            A structured marketplace for vetted remote annotators and freelancers.
          </p>
          <p className="mt-4 text-sm text-slate-500">© 2026 flexwork-usa</p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-semibold text-slate-900">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-600 hover:text-slate-900"
                    {...("external" in link && link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200">
        <div className={`${pageFrame} flex flex-col gap-3 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between`}>
          <p>flexwork-usa</p>
          <nav className="flex flex-wrap gap-4">
            <a href="/privacy" className="hover:text-slate-900">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-slate-900">
              Terms of Service
            </a>
            <a href="/contact" className="hover:text-slate-900">
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
