declare const atob: (data: string) => string;

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { setImmediate } from "node:timers";
import { CannotCopyEmptyTextError, ClipboardError, SystemError } from "./errors.js";
import { isString, isNonEmptyString, isRecord } from "./guards.js";
import { t } from "./i18n.js";
import { SYSTEM, SECURITY } from "../constants.js";

const executeCommand = promisify(exec);

const PLATFORM = SYSTEM.PLATFORM;

interface ClipboardCommand {
  command: string;
  args: string[];
}

function createMacOSCommand(text: string): ClipboardCommand {
  return {
    command: "printf",
    args: ["%s", JSON.stringify(text), "|", "pbcopy"],
  };
}

function createWindowsCommand(text: string): ClipboardCommand {
  const escapedText = text.replace(/'/g, "''");
  return {
    command: "powershell",
    args: ["-command", `"Set-Clipboard -Value '${escapedText}'"`],
  };
}

function createLinuxCommands(text: string): ClipboardCommand[] {
  const escapedText = JSON.stringify(text);

  return [
    {
      command: "printf",
      args: ["%s", escapedText, "|", "xclip", "-selection", "clipboard"],
    },
    {
      command: "printf",
      args: ["%s", escapedText, "|", "xsel", "--clipboard", "--input"],
    },
    {
      command: "printf",
      args: ["%s", escapedText, "|", "wl-copy"],
    },
  ];
}

async function executeClipboardCommand(command: ClipboardCommand): Promise<void> {
  const fullCommand = `${command.command} ${command.args.join(" ")}`;
  await executeCommand(fullCommand);
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

interface RedactionPattern {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: unknown[]) => string);
  order: number;
}

interface CompiledPattern extends Omit<RedactionPattern, "pattern"> {
  regex: RegExp;
}

function generateFingerprint(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
}

function isValidJWT(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  try {
    const headerPart = parts[0];
    const payloadPart = parts[1];
    if (!headerPart || !payloadPart) {
      return false;
    }

    const header = JSON.parse(atob(headerPart.replace(/-/g, "+").replace(/_/g, "/")));
    const payload = JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")));
    return isRecord(header) && isRecord(payload);
  } catch {
    return false;
  }
}

function isPublicIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::1") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return false;
  }
  return true;
}

function hasHighEntropy(str: string): boolean {
  if (str.length < SECURITY.MIN_STRING_LENGTH_FOR_ENTROPY) {
    return false;
  }

  const chars = new Set(str);
  const entropy = chars.size / str.length;
  return entropy > SECURITY.ENTROPY_THRESHOLD && /[A-Za-z]/.test(str) && /[0-9]/.test(str);
}

function createRedactionPatterns(): RedactionPattern[] {
  return [
    {
      pattern:
        /-----BEGIN (?:CERTIFICATE|PUBLIC KEY|RSA PRIVATE KEY|DSA PRIVATE KEY|EC PRIVATE KEY|OPENSSH PRIVATE KEY|PRIVATE KEY)-----[\s\S]*?-----END (?:CERTIFICATE|PUBLIC KEY|RSA PRIVATE KEY|DSA PRIVATE KEY|EC PRIVATE KEY|OPENSSH PRIVATE KEY|PRIVATE KEY)-----/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 1,
    },

    {
      pattern: /\b(sk-[A-Za-z0-9]{8,})\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 2,
    },

    {
      pattern: /\b(sk-ant-[A-Za-z0-9-]{20,})\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 2,
    },

    {
      pattern: /\b(AIza[A-Za-z0-9_-]{35})\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 2,
    },

    {
      pattern:
        /\b(ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|ghu_[A-Za-z0-9]{30,}|ghs_[A-Za-z0-9]{30,}|ghr_[A-Za-z0-9]{30,})\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 3,
    },

    {
      pattern:
        /(https?|ftp|ssh|git|mongodb|postgres|postgresql|mysql|redis|mssql|sqlite):\/\/([^:/\s]+):([^@/\s]+)@([^/\s]+)/gi,
      replacement: (_match, protocol, user, pass, host) => {
        const fingerprint = generateFingerprint(String(pass));
        return `${protocol}://${user}:[REDACTED:${fingerprint}]@${host}`;
      },
      order: 2,
    },

    {
      pattern: /\b(glpat-[A-Za-z0-9_-]{20})\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED_GITLAB_TOKEN:${fingerprint}]`;
      },
      order: 4,
    },

    {
      pattern: /\b(xox[bpars]-[A-Za-z0-9-]+)\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED_SLACK_TOKEN:${fingerprint}]`;
      },
      order: 4,
    },

    {
      pattern:
        /\b(sk_live_[A-Za-z0-9]{24}|sk_test_[A-Za-z0-9]{24}|pk_live_[A-Za-z0-9]{24}|pk_test_[A-Za-z0-9]{24})\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED_STRIPE_KEY:${fingerprint}]`;
      },
      order: 4,
    },

    {
      pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 4,
    },

    {
      pattern:
        /([?&])(token|api_key|apikey|secret|password|pwd|auth|access_token|refresh_token)=([^&\s]+)/gi,
      replacement: (_match, separator, key, value) => {
        const fingerprint = generateFingerprint(String(value));
        return `${separator}${key}=[REDACTED:${fingerprint}]`;
      },
      order: 5,
    },

    {
      pattern:
        /^(\s*)([\w_]+(?:_(?:key|token|secret|password|pwd|pass|auth|credentials|api_key|access_token))):\s*(.+)$/gim,
      replacement: (_match, indent, key, value) => {
        const fingerprint = generateFingerprint(String(value).trim());
        return `${indent}${key}: [REDACTED:${fingerprint}]`;
      },
      order: 6,
    },

    {
      pattern:
        /\b([A-Za-z_]+(?:_(?:key|token|secret|password|pwd|pass|auth|credentials|api_key|access_token)|KEY|TOKEN|SECRET|PASSWORD|PWD|PASS|AUTH|CREDENTIALS|API_KEY|ACCESS_TOKEN))\s*=\s*([^\s&]+)/gi,
      replacement: (_match, key, value) => {
        const fingerprint = generateFingerprint(String(value));
        if (hasHighEntropy(String(value)) && /secret|SECRET/.test(String(key))) {
          return `${key}=[REDACTED_SECRET:${fingerprint}]`;
        }
        return `${key}=[REDACTED:${fingerprint}]`;
      },
      order: 7,
    },

    {
      pattern:
        /\b(api[_-]?key|apikey|api[_-]?token|token|secret[_-]?key|secret|password|pwd|passwd|pass|auth[_-]?token|access[_-]?token|refresh[_-]?token|bearer[_-]?token)\s*[:=]\s*["']?(?!(?:ghp_|gho_|ghu_|ghs_|ghr_|glpat-|xox[bpars]-|sk_live_|sk_test_|pk_live_|pk_test_|AKIA|eyJ))([A-Za-z0-9_\-./+=]{8,})["']?/gi,
      replacement: (_match, key, value) => {
        const fingerprint = generateFingerprint(String(value));
        const sep = _match.includes(":") ? ": " : "=";
        return `${key}${sep}[REDACTED:${fingerprint}]`;
      },
      order: 8,
    },

    {
      pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*\.?[A-Za-z0-9_-]*\b/g,
      replacement: (match) => {
        if (!isValidJWT(match)) {
          return match;
        }
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 9,
    },

    {
      pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED_UUID:${fingerprint}]`;
      },
      order: 10,
    },

    {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED_EMAIL:${fingerprint}]`;
      },
      order: 11,
    },

    {
      pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 12,
    },

    {
      pattern: /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 13,
    },

    {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 14,
    },

    {
      pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
      replacement: (match) => {
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 15,
    },

    {
      pattern:
        /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:)*:(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{0,4}\b|\b::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*\b|\b[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{0,4})*::\b|\b(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}\b|\b::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g,
      replacement: (match) => {
        if (!match.includes(":") || match.length < 3) {
          return match;
        }
        if (/:\d+$/.test(match)) {
          return match;
        }
        if (!isPublicIPv6(match)) {
          return match;
        }
        const fingerprint = generateFingerprint(match);
        return `[REDACTED_IPV6:${fingerprint}]`;
      },
      order: 16,
    },

    {
      pattern:
        /(?<!export\s+|=)\b(?:secret|key|pass|password|pwd|auth)(?:\d+|[A-Za-z0-9_-]{3,})\b(?!=)/gi,
      replacement: (match) => {
        if (
          /^(?:ghp_|gho_|ghu_|ghs_|ghr_|glpat-|xox[bpars]-|sk_live_|sk_test_|pk_live_|pk_test_|AKIA|eyJ)/i.test(
            match
          )
        ) {
          return match;
        }
        const fingerprint = generateFingerprint(match);
        return `[REDACTED:${fingerprint}]`;
      },
      order: 20,
    },

    {
      pattern: /\b[A-Za-z0-9+/=_-]{24,}\b/g,
      replacement: (match) => {
        if (match.startsWith("eyJ") || match.includes(":") || match.includes(".")) {
          return match;
        }
        if (match.includes("-") && match.length < 32) {
          return match;
        }
        if (!hasHighEntropy(match)) {
          return match;
        }
        const fingerprint = generateFingerprint(match);
        return `[REDACTED_SECRET:${fingerprint}]`;
      },
      order: 18,
    },
  ];
}

let compiledPatterns: CompiledPattern[] | null = null;

function getCompiledPatterns(): CompiledPattern[] {
  if (!compiledPatterns) {
    const rawPatterns = createRedactionPatterns();
    compiledPatterns = rawPatterns
      .sort((a, b) => a.order - b.order)
      .map((pattern) => ({
        regex: pattern.pattern,
        replacement: pattern.replacement,
        order: pattern.order,
      }));
  }
  return compiledPatterns;
}

export function redactSensitiveData(text: string): string {
  if (!text || !isString(text)) {
    return "";
  }

  let redactedText = text;
  const patterns = getCompiledPatterns();

  for (const { regex, replacement } of patterns) {
    try {
      if (typeof replacement === "function") {
        redactedText = redactedText.replace(
          regex,
          replacement as (substring: string, ...args: unknown[]) => string
        );
      } else {
        redactedText = redactedText.replace(regex, replacement);
      }
    } catch {
      continue;
    }
  }

  return redactedText;
}
