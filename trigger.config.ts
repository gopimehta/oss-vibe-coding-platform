import type { TriggerConfig } from "@trigger.dev/sdk/v3";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });
dotenvConfig({ path: resolve(process.cwd(), ".env") });

export const config: TriggerConfig = {
  project: process.env.TRIGGER_PROJECT_ID || "proj_",
  logLevel: "log",
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
    },
  },
};
