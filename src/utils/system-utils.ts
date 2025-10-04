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

  return result.redactedText;
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
