import type { ReactNode } from "react";
import { OpsSegmentLayout } from "@/lib/admin/ops-layout";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <OpsSegmentLayout expected="admin">{children}</OpsSegmentLayout>;
}
