import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

function loadParentEnv() {
  try {
    const file = readFileSync(path.join(__dirname, "../.env.local"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      if (process.env[key]) continue;
      process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // The admin app can also use its own .env.local.
  }
}

loadParentEnv();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["[::1]"],
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
