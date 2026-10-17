import { connection } from "next/server";
import { HeaderBar } from "@/components/HeaderBar";
import { getAccountNav } from "@/lib/account";

export function HeaderFallback() {
  return <HeaderBar account={null} />;
}

export async function Header() {
  await connection();

  try {
    const account = await getAccountNav();
    return <HeaderBar account={account} />;
  } catch {
    return <HeaderBar account={null} />;
  }
}
