import { PAYMENT_ASSETS, WALLET_TYPES, type WalletType } from "@/lib/deposits";

export function TokenLogo({
  asset,
  className = "h-8 w-8",
}: {
  asset: WalletType;
  className?: string;
}) {
  const item = PAYMENT_ASSETS[asset];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.logo} alt={`${item.title} logo`} width={32} height={32} className={`shrink-0 ${className}`} />
  );
}

export function NetworkBadge({ network }: { network: WalletType }) {
  const item = PAYMENT_ASSETS[network];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <TokenLogo asset={network} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
        <p className="text-xs text-slate-600">{item.subtitle}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.chainLogo} alt="" width={24} height={24} className="h-6 w-6 shrink-0" />
    </div>
  );
}

export { WALLET_TYPES };
