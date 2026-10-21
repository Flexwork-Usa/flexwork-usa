import type { ReactNode } from "react";
import { OpsSegmentLayout } from "@/lib/admin/ops-layout";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return <OpsSegmentLayout expected="super_admin">{children}</OpsSegmentLayout>;
}
