import { secondaryButtonClass } from "@/lib/format";

export function SiteHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="/" className="flex items-center">
          <img src="/logo.png" alt="Flexwork-USA" className="h-12 w-auto" />
        </a>
        <nav className="flex items-center gap-2 text-sm">
          <a href="/jobs" className="px-2 py-1 text-gray-700 hover:text-gray-900">
            Jobs
          </a>
          <a href="/onboard" className="px-2 py-1 text-gray-700 hover:text-gray-900">
            Onboard
          </a>
          <a href="/login" className={`${secondaryButtonClass} px-3`}>
            Log in
          </a>
        </nav>
      </div>
    </header>
  );
}
