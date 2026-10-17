export const DISCORD_URL = "https://discord.gg/...";

export const PLATFORM_LINKS = [
  { label: "Home", href: "/" },
  { label: "Opportunities", href: "/jobs" },
  { label: "Community", href: DISCORD_URL, external: true },
  { label: "How To Get Started", href: "/get-started" },
] as const;
