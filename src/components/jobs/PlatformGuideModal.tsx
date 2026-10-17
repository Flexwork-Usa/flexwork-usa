"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ExternalPlatform } from "@/lib/jobs/directory";
import { platformLogos } from "@/lib/jobs/platform-logos";

const orangeButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#C85A17] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A84810]";

const quietButton =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50";

export function PlatformMark({
  logo,
  initials,
  color,
  className = "h-12 w-12",
}: {
  logo?: string;
  initials: string;
  color: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-xl text-sm font-semibold tracking-tight text-white ${className}`}
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {initials}
      </span>
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 ${className}`}>
      <img src={logo} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)} />
    </span>
  );
}

export function TrustpilotBadge({ platform }: { platform: ExternalPlatform }) {
  if (platform.trustpilot == null) return null;
  return (
    <p className="inline-flex flex-wrap items-center gap-2 text-sm text-slate-700">
      <img src="/platforms/trustpilot-logo.svg" alt="Trustpilot" className="h-5 w-auto" />
      <span className="font-medium text-slate-900">{platform.trustpilot.toFixed(1)} / 5.0</span>
    </p>
  );
}

export function PlatformGuideModal({
  platform,
  startOnSite = false,
  onClose,
}: {
  platform: ExternalPlatform;
  startOnSite?: boolean;
  onClose: () => void;
}) {
  const [viewingSite, setViewingSite] = useState(startOnSite && platform.embeds);

  useEffect(() => {
    setViewingSite(startOnSite && platform.embeds);
  }, [platform.id, startOnSite, platform.embeds]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const theme = platform.embeds ? platform.theme : undefined;
  const themeStyle = theme ? { backgroundColor: theme.accent, color: theme.ink } : undefined;
  const themedButton = `${orangeButton} border-0 hover:brightness-95`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-guide-title"
        className={`flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md ${
          viewingSite ? "h-[min(92vh,900px)] max-w-6xl" : "max-h-[min(92vh,860px)] max-w-2xl"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {theme ? <div className="h-1.5 shrink-0" style={{ background: theme.stripe }} /> : null}
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6" style={theme ? { backgroundColor: theme.wash } : undefined}>
          <div className="flex items-start gap-3">
            <PlatformMark logo={platformLogos[platform.id]} initials={platform.initials} color={platform.color} className="h-14 w-14 text-base" />
            <div className="min-w-0">
              <h2 id="platform-guide-title" className="text-xl font-semibold tracking-tight text-slate-900">
                {platform.name}
              </h2>
              <p className="mt-1 w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {platform.categoryLabel}
              </p>
              {platform.trustpilot != null && platform.trustpilotUrl ? (
                <div className="mt-2">
                  <TrustpilotBadge platform={platform} />
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {platform.reviewCount != null ? `${platform.reviewCount.toLocaleString("en-US")} reviews. ` : ""}
                    {platform.trustpilotNote ? `${platform.trustpilotNote}. ` : ""}
                    Public TrustScore.{" "}
                    <a
                      href={platform.trustpilotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[#C85A17] underline-offset-2 hover:underline"
                    >
                      View on Trustpilot
                    </a>
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {platform.embeds && viewingSite ? (
          <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
            <p className="truncate border-b border-slate-200 bg-white px-5 py-2 text-xs text-slate-500">{platform.url}</p>
            <iframe
              src={platform.url}
              title={`${platform.name} official site`}
              className="min-h-0 w-full flex-1 border-0 bg-white"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {platform.embeds ? null : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                This platform blocks other websites from displaying its pages. Visit Platform opens it in a new tab.
              </p>
            )}
            <GuideSection title="Plans & Costs" body={platform.plans} />
            <GuideSection title="Exact Requirements" body={platform.requirements} />
            <GuideSection title="Location & Eligibility" body={platform.eligibility} />
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Pro Tips to Maneuver & Succeed</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
                {platform.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" className={quietButton} onClick={onClose}>
            Close Modal
          </button>
          {platform.embeds && viewingSite ? (
            <button type="button" className={themedButton} style={themeStyle} onClick={() => setViewingSite(false)}>
              Back to Guide
            </button>
          ) : platform.embeds ? (
            <button type="button" className={themedButton} style={themeStyle} onClick={() => setViewingSite(true)}>
              View Platform
            </button>
          ) : (
            <a href={platform.url} target="_blank" rel="noreferrer" className={orangeButton}>
              Visit Platform
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function GuideSection({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </section>
  );
}
