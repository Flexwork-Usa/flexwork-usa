"use client";

import { ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import type { PlatformId } from "@/lib/types";

type GuideStep = {
  title: string;
  body: string;
  keywords?: string[];
};

const GUIDES: Record<PlatformId | "generic", { intro: string; steps: GuideStep[] }> =
  {
    outlier: {
      intro:
        "You apply on Outlier. These steps prepare the résumé, the skills check, and the identity review.",
      steps: [
        {
          title: "CV Optimization Tip",
          body: "Lead with evaluation and writing quality. Replace generic soft-skill lines with the kind of work an automated résumé screen is built to find.",
          keywords: [
            "RLHF",
            "LLM evaluation",
            "instruction following",
            "prompt writing",
            "data annotation",
            "JSON",
            "Python",
            "technical writing",
          ],
        },
        {
          title: "Assessment Guidance",
          body: "Read the full rubric before you score the first item. Follow the guideline when it conflicts with personal taste. If the instructions say not to guess, flag the item. Calibration sets reward consistent accuracy more than speed.",
        },
        {
          title: "KYC / Identity Verification",
          body: "Have a government-issued photo ID ready: a passport or driver’s license. Use the same legal name as the ID. For the selfie, face the camera in even light, without sunglasses, a hat, or filters. In the document photo, keep all four corners visible and avoid glare.",
        },
      ],
    },
    handshake: {
      intro:
        "You apply on Handshake AI. These steps prepare the résumé, the practice quality check, and identity verification.",
      steps: [
        {
          title: "CV Optimization Tip",
          body: "Handshake matches fellows to projects from the résumé. Name the subject you can review at a high level, and include hands-on data work rather than a generic objective.",
          keywords: [
            "data annotation",
            "data quality",
            "LLM",
            "academic writing",
            "research methods",
            "spreadsheet QA",
            "subject-matter expertise",
          ],
        },
        {
          title: "Assessment Guidance",
          body: "Read the project brief once, straight through, before the practice set. Score similar items the same way, and treat the examples in the guide as the standard. Submit the practice tasks carefully — paid work follows a passing quality check.",
        },
        {
          title: "KYC / Identity Verification",
          body: "Paid Handshake AI work uses identity verification. Have a current passport or driver’s license, and make sure the name on the application matches it. Selfie checks expect a live photo in good light, looking at the camera, without filters. If a project asks for proof of address, a recent utility bill or bank statement is the usual document.",
        },
      ],
    },
    generic: {
      intro:
        "You apply on the partner site. Use this checklist before you leave flexwork-usa.",
      steps: [
        {
          title: "CV Optimization Tip",
          body: "Mirror the language of the posting: the tool, the task, and the domain. Put measurable review or research work near the top.",
          keywords: [
            "remote",
            "data quality",
            "annotation",
            "attention to detail",
            "written communication",
          ],
        },
        {
          title: "Assessment Guidance",
          body: "Follow the written rubric, keep similar answers consistent, and slow down on the sample set. Accuracy is what these checks are scoring.",
        },
        {
          title: "KYC / Identity Verification",
          body: "Keep a government photo ID nearby and use the legal name printed on it. Selfie steps usually require even lighting, a straight-on face, and no filters.",
        },
      ],
    },
  };

const ICONS = [FileText, ClipboardCheck, ShieldCheck];

export function ThirdPartyGuide({ platform }: { platform?: PlatformId }) {
  const guide = GUIDES[platform ?? "generic"];

  return (
    <div className="bg-slate-50 px-5 py-5 sm:px-6">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        CV, assessment, and KYC
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{guide.intro}</p>
      <ol className="mt-5 space-y-5">
        {guide.steps.map((step, index) => {
          const Icon = ICONS[index] ?? FileText;
          return (
            <li key={step.title} className="grid grid-cols-[auto_1fr] gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-[#C85A17]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  <span className="mr-2 font-mono text-xs text-slate-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {step.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.body}</p>
                {step.keywords ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {step.keywords.map((keyword) => (
                      <li
                        key={keyword}
                        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                      >
                        {keyword}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
