"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/lib/format";

export function CredentialsModal({
  email,
  password,
  fullName,
  title = "Account credentials",
  onClose,
}: {
  email: string;
  password: string;
  fullName?: string;
  title?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"email" | "password" | "both" | "file" | null>(null);
  const body = [
    fullName ? `Name: ${fullName}` : null,
    `Email: ${email}`,
    `Temporary Password: ${password}`,
    "",
    "Keep these credentials safe. Change the password after first login.",
  ]
    .filter(Boolean)
    .join("\n");

  function downloadTxt() {
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Flexwork_Credentials.txt";
    anchor.click();
    URL.revokeObjectURL(url);
    setCopied("file");
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        Share these credentials securely. The temporary password is also stored as{" "}
        <code className="rounded bg-amber-100 px-1">temp_recovery_pass</code>.
      </div>
      <div className="mt-4 space-y-3">
        {fullName ? (
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-500">Name</p>
            <p className="mt-1 text-sm font-medium">{fullName}</p>
          </div>
        ) : null}
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">Email</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="break-all text-sm">{email}</p>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={async () => {
                await navigator.clipboard.writeText(email);
                setCopied("email");
              }}
            >
              {copied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">Temporary / recovery password</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="break-all font-mono text-sm">{password}</p>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={async () => {
                await navigator.clipboard.writeText(password);
                setCopied("password");
              }}
            >
              {copied === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <label className="block text-sm font-medium">
          Credentials file preview
          <textarea className={`${fieldClass} mt-1 h-28 py-2 font-mono text-xs`} readOnly value={body} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={async () => {
            await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
            setCopied("both");
          }}
        >
          {copied === "both" ? "Copied" : "Copy email & password"}
        </button>
        <button type="button" className={secondaryButtonClass} onClick={downloadTxt}>
          {copied === "file" ? "Downloaded" : "Download Flexwork_Credentials.txt"}
        </button>
      </div>
    </Modal>
  );
}
