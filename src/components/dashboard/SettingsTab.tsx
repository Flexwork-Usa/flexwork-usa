"use client";

import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { savePayoutMethods } from "@/actions/payout-actions";
import { updateWorkerProfile } from "@/actions/profile-actions";
import { updateWorkerPassword } from "@/actions/security-actions";
import type { WorkerProfileView } from "@/components/dashboard/types";
import { showToast } from "@/components/dashboard/toast";
import { Card, Dialog, fieldClass, orangeButton, quietButton } from "@/components/dashboard/ui";
import type { PayoutMethod } from "@/lib/platform/types";

const readOnlyFieldClass =
  "mt-1.5 h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none";

function SettingsTab({ profile }: { profile: WorkerProfileView }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [country, setCountry] = useState(profile.country);
  const [savingProfile, setSavingProfile] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>(profile.payoutMethod || "crypto");
  const [usdtAddress, setUsdtAddress] = useState(profile.payoutUsdtAddress || "");
  const [airtmEmail, setAirtmEmail] = useState(profile.payoutAirtmEmail || "");
  const [paypalEmail, setPaypalEmail] = useState(profile.payoutPaypalEmail || "");
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
  const [savingPayout, setSavingPayout] = useState(false);

  useEffect(() => {
    setFullName(profile.fullName);
    setCountry(profile.country);
  }, [profile.fullName, profile.country]);

  async function applyPasswordChange() {
    setSavingSecurity(true);
    setSecurityMessage(null);
    const result = await updateWorkerPassword(password);
    setSavingSecurity(false);
    setConfirmOpen(false);
    if (!result.success) {
      setSecurityMessage(result.error);
      return;
    }
    setSecurityMessage("Password updated. You can change it again after 24 hours.");
    setPassword("");
    setConfirm("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold">Profile details</h2>
        <p className="mt-1 text-sm text-slate-600">
          Update your name and country. Email and token balance come from your account record.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setSavingProfile(true);
            const result = await updateWorkerProfile({ fullName, country });
            setSavingProfile(false);
            if (!result.success) {
              showToast(result.error, "error");
              return;
            }
            setFullName(result.fullName);
            setCountry(result.country);
            showToast("Profile saved.", "success");
            router.refresh();
          }}
        >
          <label className="block text-sm font-medium">
            Full name
            <input className={fieldClass} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input className={readOnlyFieldClass} type="email" value={profile.email} readOnly disabled />
          </label>
          <label className="block text-sm font-medium">
            Country
            <input className={fieldClass} value={country} onChange={(event) => setCountry(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">
            Token balance
            <input className={readOnlyFieldClass} value={`${profile.tokenBalance} tokens`} readOnly disabled />
          </label>
          <button type="submit" className={orangeButton} disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="mt-1 text-sm text-slate-600">Workers can update only their password.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSecurityMessage(null);
            if (!password) {
              setSecurityMessage("Enter a new password.");
              return;
            }
            if (password !== confirm) {
              setSecurityMessage("Passwords do not match.");
              return;
            }
            if (password.length < 8) {
              setSecurityMessage("Use at least 8 characters.");
              return;
            }
            setConfirmOpen(true);
          }}
        >
          <label className="block text-sm font-medium">
            New password
            <input
              className={fieldClass}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Confirm password
            <input
              className={fieldClass}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </label>
          {securityMessage ? <p className="text-sm text-slate-700">{securityMessage}</p> : null}
          <button type="submit" className={orangeButton} disabled={savingSecurity}>
            {savingSecurity ? "Saving…" : "Update password"}
          </button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <h2 className="text-lg font-semibold">Payout methods</h2>
        <p className="mt-1 text-sm text-slate-600">Save the channel used when you request a payout.</p>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setSavingPayout(true);
            setPayoutMessage(null);
            const result = await savePayoutMethods({
              method: payoutMethod,
              usdtAddress,
              airtmEmail,
              paypalEmail,
            });
            setSavingPayout(false);
            setPayoutMessage(result.success ? "Payout methods saved." : result.error);
          }}
        >
          <label className="block text-sm font-medium md:col-span-2">
            Preferred method
            <select
              className={fieldClass}
              value={payoutMethod}
              onChange={(event) => setPayoutMethod(event.target.value as PayoutMethod)}
            >
              <option value="crypto">Crypto wallet (USDT)</option>
              <option value="airtm">Airtm email</option>
              <option value="paypal">PayPal email</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Crypto wallet address (USDT)
            <input className={fieldClass} value={usdtAddress} onChange={(event) => setUsdtAddress(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Airtm email
            <input className={fieldClass} type="email" value={airtmEmail} onChange={(event) => setAirtmEmail(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            PayPal email
            <input className={fieldClass} type="email" value={paypalEmail} onChange={(event) => setPaypalEmail(event.target.value)} />
          </label>
          {payoutMessage ? <p className="text-sm text-slate-700 md:col-span-2">{payoutMessage}</p> : null}
          <button type="submit" className={orangeButton} disabled={savingPayout}>
            {savingPayout ? "Saving…" : "Save payout methods"}
          </button>
        </form>
      </Card>

      {confirmOpen ? (
        <Dialog title="Confirm password change" onClose={() => { if (!savingSecurity) setConfirmOpen(false); }}>
          <p className="text-sm text-slate-600">Are you sure you want to change your password?</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className={quietButton}
              disabled={savingSecurity}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className={orangeButton} disabled={savingSecurity} onClick={() => void applyPasswordChange()}>
              {savingSecurity ? "Updating…" : "Yes, change password"}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

export default memo(SettingsTab);
