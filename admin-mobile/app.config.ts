import { readFileSync } from "node:fs";
import path from "node:path";
import type { ExpoConfig } from "expo/config";

function parentEnv(name: string) {
  if (process.env[name]) return process.env[name];
  try {
    const file = readFileSync(path.join(__dirname, "../.env.local"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match || match[1].trim() !== name) continue;
      return match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    return "";
  }
  return "";
}

const config: ExpoConfig = {
  name: "flexwork admin",
  slug: "flexwork-admin",
  scheme: "flexwork-admin",
  orientation: "portrait",
  userInterfaceStyle: "light",
  plugins: ["expo-router"],
  android: {
    package: "com.flexwork.admin",
  },
  extra: {
    supabaseUrl: parentEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: parentEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  },
};

export default config;
