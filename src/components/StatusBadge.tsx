import { Check } from "lucide-react";
import type { ApplicationStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const applied = status === "Applied";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
        applied
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-gray-200 bg-white text-gray-800"
      }`}
    >
      {applied ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
      {applied ? "Applied" : "Under Review"}
    </span>
  );
}
