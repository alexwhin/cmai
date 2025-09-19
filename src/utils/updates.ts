import { promises as fs } from "node:fs";
import { join } from "node:path";
import { get } from "node:https";
import { IncomingMessage } from "node:http";
import { FILE_SYSTEM } from "../constants.js";
import { ensureConfigurationDirectory } from "./config.js";
import { isRecord, hasProperty, isString, isJSONString } from "./guards.js";
import { message } from "./ui-utils.js";
import { t } from "./i18n.js";

const CACHE_FILENAME = "updates.json";
const CACHE_FILE_PATH = join(FILE_SYSTEM.CONFIG_DIRECTORY, CACHE_FILENAME);
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const NPM_REGISTRY_URL = "https://registry.npmjs.org/cmai/latest";
const REQUEST_TIMEOUT_MS = 5000;

interface UpdateCache {
  lastChecked: number;
  latestVersion: string;
  notified: boolean;
}

async function fetchLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(null);
    }, REQUEST_TIMEOUT_MS);

    try {
      const request = get(NPM_REGISTRY_URL, (response: IncomingMessage) => {
        clearTimeout(timeoutId);

        if (response.statusCode !== 200) {
          resolve(null);
          return;
        }

        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          try {
            if (!isJSONString(data)) {
              resolve(null);
              return;
            }

            const parsed = JSON.parse(data);
            if (isRecord(parsed) && hasProperty(parsed, "version") && isString(parsed.version)) {
              resolve(parsed.version);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });

        response.on("error", () => {
          resolve(null);
        });
      });

      request.on("error", () => {
        clearTimeout(timeoutId);
        resolve(null);
      });

      request.end();
    } catch {
      clearTimeout(timeoutId);
      resolve(null);
    }
  });
}

async function loadCache(): Promise<UpdateCache | null> {
  try {
    const cacheData = await fs.readFile(CACHE_FILE_PATH, "utf-8");
    if (!isJSONString(cacheData)) {
      return null;
    }

    const parsed = JSON.parse(cacheData);
    if (
      isRecord(parsed) &&
      hasProperty(parsed, "lastChecked") &&
      hasProperty(parsed, "latestVersion") &&
      hasProperty(parsed, "notified") &&
      typeof parsed.lastChecked === "number" &&
      isString(parsed.latestVersion) &&
      typeof parsed.notified === "boolean"
    ) {
      return parsed as unknown as UpdateCache;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveCache(cache: UpdateCache): Promise<void> {
  try {
    await ensureConfigurationDirectory();
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    return;
  }
}

function compareVersions(current: string, latest: string): number {
  const currentParts = current.split(".").map(Number);
  const latestParts = latest.split(".").map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;

    if (currentPart < latestPart) {
      return -1;
    }
    if (currentPart > latestPart) {
      return 1;
    }
  }

  return 0;
}

export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    const cache = await loadCache();
    const now = Date.now();

    const shouldCheck = !cache || now - cache.lastChecked > CHECK_INTERVAL_MS;

    if (shouldCheck) {
      const latestVersion = await fetchLatestVersion();

      if (latestVersion) {
        const newCache: UpdateCache = {
          lastChecked: now,
          latestVersion,
          notified: false,
        };

        await saveCache(newCache);

        if (compareVersions(currentVersion, latestVersion) < 0) {
          showUpdateNotification(currentVersion, latestVersion);
          newCache.notified = true;
          await saveCache(newCache);
        }
      }
    } else if (
      cache &&
      !cache.notified &&
      compareVersions(currentVersion, cache.latestVersion) < 0
    ) {
      showUpdateNotification(currentVersion, cache.latestVersion);
      cache.notified = true;
      await saveCache(cache);
    }
  } catch {
    return;
  }
}

function detectPackageManager(): string {
  if (process.env.npm_config_user_agent) {
    const userAgent = process.env.npm_config_user_agent;
    if (userAgent.includes("yarn")) {
      return "yarn";
    }
    if (userAgent.includes("pnpm")) {
      return "pnpm";
    }
  }
  return "npm";
}

function getUpdateCommand(packageManager: string): string {
  switch (packageManager) {
    case "yarn":
      return "yarn global add cmai@latest";
    case "pnpm":
      return "pnpm add -g cmai@latest";
    default:
      return "npm install -g cmai@latest";
  }
}

function showUpdateNotification(currentVersion: string, latestVersion: string): void {
  const packageManager = detectPackageManager();
  const updateCommand = getUpdateCommand(packageManager);

  message(
    t("updates.available", {
      currentVersion,
      latestVersion,
      command: updateCommand,
    }),
    { type: "error", variant: "title" }
  );
}
