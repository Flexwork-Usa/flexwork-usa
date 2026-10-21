"use client";

import type { ReactNode } from "react";
import { AdminOperationsLayout } from "@/components/admin/AdminOperationsLayout";

/** Legacy wrapper — prefer segment layouts. Kept for console/v1 routes. */
export function AdminShell({
  mode,
  adminEmail,
  children,
  loadError,
}: {
  mode: "super_admin" | "admin";
  adminEmail: string;
  title?: string;
  subtitle?: string;
  activeKey?: string;
  children: ReactNode;
  loadError?: string;
}) {
  return (
    <AdminOperationsLayout mode={mode} adminEmail={adminEmail} loadError={loadError}>
      {children}
    </AdminOperationsLayout>
  );
}
