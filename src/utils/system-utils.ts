import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setImmediate } from "node:timers";
import { redactum } from "redactum";
import {
  CannotCopyEmptyTextError,
  ClipboardError,
  SystemError,
  InvalidConfigurationError,
} from "./errors.js";
import { isString, isNonEmptyString, isRecord, hasProperty, isJSONString } from "./guards.js";
import { t } from "./i18n.js";
import { SYSTEM } from "../constants.js";

const { PLATFORM } = SYSTEM;

interface ClipboardCommand {
  command: string;
  args: string[];
}

function createMacOSCommand(text: string): ClipboardCommand {
  return {
    command: "/bin/sh",
    args: ["-c", `printf '%s' ${JSON.stringify(text)} | pbcopy`],
  };
}

function createWindowsCommand(text: string): ClipboardCommand {
  const base64Text = Buffer.from(text).toString("base64");
  return {
    command: "powershell",
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64Text}')) | Set-Clipboard`,
    ],
  };
}

function createLinuxCommands(text: string): ClipboardCommand[] {
  return [
    {
      command: "/bin/sh",
      args: ["-c", `printf '%s' ${JSON.stringify(text)} | xclip -selection clipboard`],
    },
    {
      command: "/bin/sh",
      args: ["-c", `printf '%s' ${JSON.stringify(text)} | xsel --clipboard --input`],
    },
    {
      command: "/bin/sh",
      args: ["-c", `printf '%s' ${JSON.stringify(text)} | wl-copy`],
    },
  ];
}

async function executeClipboardCommand(command: ClipboardCommand): Promise<void> {
  const { execFile } = await import("node:child_process");
  const execFilePromise = promisify(execFile);

  await execFilePromise(command.command, command.args, {
    shell: false,
    windowsHide: true,
  });
}

async function executeClipboardWithFallbacks(commands: ClipboardCommand[]): Promise<void> {
  const errors: Error[] = [];

  for (const command of commands) {
    try {
      await executeClipboardCommand(command);
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error : new ClipboardError(String(error)));
    }
  }

  throw new AggregateError(errors, t("clipboard.allCommandsFailed", { count: commands.length }));
}

function getClipboardErrorMessage(platform: string): string {
  const baseMessage = t("clipboard.failedToCopy");

  switch (platform) {
    case PLATFORM.LINUX:
    case PLATFORM.FREEBSD:
    case PLATFORM.OPENBSD:
      return t("clipboard.failedUnix", { baseMessage });
    case PLATFORM.WINDOWS:
      return t("clipboard.failedWindows", { baseMessage });
    case PLATFORM.DARWIN:
      return t("clipboard.failedMac", { baseMessage });
    default:
      return baseMessage;
  }
}

function createClipboardError(platform: string, originalError: unknown): ClipboardError {
  const errorMessage = getClipboardErrorMessage(platform);

  if (originalError instanceof AggregateError) {
    return new ClipboardError(
      `${errorMessage} ${t("clipboard.detailedErrors", { errors: originalError.message })}`,
      originalError
    );
  }

  return new ClipboardError(
    `${errorMessage} ${
      originalError instanceof Error ? originalError.message : String(originalError)
    }`,
    originalError instanceof Error ? originalError : undefined
  );
}

async function copyToClipboardInternal(text: string): Promise<void> {
  if (!isString(text)) {
    throw new ClipboardError(t("clipboard.textMustBeString"));
  }

  if (!isNonEmptyString(text)) {
    throw new CannotCopyEmptyTextError();
  }

  const currentPlatform = process.platform;

  try {
    switch (currentPlatform) {
      case PLATFORM.DARWIN: {
        const command = createMacOSCommand(text);
        await executeClipboardCommand(command);
        break;
      }

      case PLATFORM.WINDOWS: {
        const command = createWindowsCommand(text);
        await executeClipboardCommand(command);
        break;
      }

      case PLATFORM.LINUX:
      case PLATFORM.FREEBSD:
      case PLATFORM.OPENBSD: {
        const commands = createLinuxCommands(text);
        await executeClipboardWithFallbacks(commands);
        break;
      }

      default: {
        throw new ClipboardError(t("clipboard.unsupportedPlatform", { platform: currentPlatform }));
      }
    }
  } catch (error) {
    throw createClipboardError(currentPlatform, error);
  }
}

export const copyToClipboard = copyToClipboardInternal;

let exitScheduled = false;
let exitTimeout: ReturnType<typeof setTimeout> | null = null;

export function isExitScheduled(): boolean {
  return exitScheduled;
}

function scheduleExit(): void {
  exitScheduled = true;
}

export function resetExitSchedule(): void {
  exitScheduled = false;
  if (exitTimeout) {
    clearTimeout(exitTimeout);
    exitTimeout = null;
  }
}

function handleTestEnvironment(code: number): void {
  if (code !== 0) {
    throw new SystemError(t("errors.system.processWouldExit", { code }), "TEST_EXIT");
  }
}

function scheduleProcessExit(code: number, delay: number): void {
  if (typeof globalThis.process?.env?.VITEST !== "undefined") {
    return;
  }

  setImmediate(() => {
    exitTimeout = setTimeout(() => {
      process.exit(code);
    }, delay);
  });
}

function exitProcess(code: number = 0, delay: number = SYSTEM.EXIT_DELAY_MS): void {
  if (process.env.NODE_ENV === "test") {
    handleTestEnvironment(code);
    return;
  }

  if (isExitScheduled()) {
    return;
  }

  scheduleExit();
  scheduleProcessExit(code, delay);
}

export const exit = exitProcess;

function generateFingerprint(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
}

export function redactSensitiveData(text: string): string {
  if (!text || !isString(text)) {
    return "";
  }

  const result = redactum(text, {
    replacement: (match: string) => {
      const fingerprint = generateFingerprint(match);
      return `[REDACTED:${fingerprint}]`;
    },
  });

  let processedText = result.redactedText;

  processedText = processedText.replace(
    /(https?|ftp|ssh|git|mongodb|postgres|postgresql|mysql|redis|mssql|sqlite):\/\/([^:/\s]+):([^@/\s]+)@([^/\s]+)/gi,
    (_match, protocol, user, pass, host) => {
      const fingerprint = generateFingerprint(String(pass));
      return `${protocol}://${user}:[REDACTED:${fingerprint}]@${host}`;
    }
  );

  processedText = processedText.replace(/\b(sk-ant-[A-Za-z0-9-]{20,})\b/g, (match) => {
    const fingerprint = generateFingerprint(match);
    return `[REDACTED:${fingerprint}]`;
  });

  processedText = processedText.replace(
    /\b(ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|ghu_[A-Za-z0-9]{30,}|ghs_[A-Za-z0-9]{30,}|ghr_[A-Za-z0-9]{30,})\b/g,
    (match) => {
      const fingerprint = generateFingerprint(match);
      return `[REDACTED:${fingerprint}]`;
    }
  );

  processedText = processedText.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, (match) => {
    const fingerprint = generateFingerprint(match);
    return `[REDACTED:${fingerprint}]`;
  });

  processedText = processedText.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    (match) => {
      const fingerprint = generateFingerprint(match);
      return `[REDACTED_UUID:${fingerprint}]`;
    }
  );

  processedText = processedText.replace(
    /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{0,4}|::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*|[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{0,4})*::|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}/g,
    (match) => {
      if (!match.includes(":") || match.length < 3 || /:\d+$/.test(match)) {
        return match;
      }
      const normalized = match.toLowerCase();
      if (
        normalized.startsWith("fe80:") ||
        normalized.startsWith("::1") ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized === "::1"
      ) {
        return match;
      }
      const fingerprint = generateFingerprint(match);
      return `[REDACTED_IPV6:${fingerprint}]`;
    }
  );

  return processedText;
}

export function getPackageVersion(): string {
  try {
    const currentDirectory = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = join(currentDirectory, "..", "..", "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf-8");

    if (!isJSONString(packageJsonContent)) {
      throw new InvalidConfigurationError(["Invalid JSON in package.json"]);
    }

    const packageJson = JSON.parse(packageJsonContent);

    if (
      isRecord(packageJson) &&
      hasProperty(packageJson, "version") &&
      isString(packageJson.version)
    ) {
      return packageJson.version;
    }
  } catch {
    void 0;
  }

  try {
    const cwdPackagePath = join(process.cwd(), "package.json");
    const packageJsonContent = readFileSync(cwdPackagePath, "utf-8");

    if (isJSONString(packageJsonContent)) {
      const packageJson = JSON.parse(packageJsonContent);
      if (
        isRecord(packageJson) &&
        hasProperty(packageJson, "name") &&
        packageJson.name === "cmai" &&
        hasProperty(packageJson, "version") &&
        isString(packageJson.version)
      ) {
        return packageJson.version;
      }
    }
  } catch {
    void 0;
  }

  return "0.2.1";
}
