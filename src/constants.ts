import { Language } from "./types/index.js";

export const API_TIMEOUT_MS = 60000;

export const UI = {
  SYMBOLS: {
    success: "✔",
    error: "✖",
    warning: "⚠",
    info: "≡",
    regenerate: "↻",
    edit: "✎",
    exit: "←",
    complete: "✶",
  },
  MAX_SETTINGS_ITERATIONS: 100,
} as const;

export const DEFAULTS = {
  MAX_COMMIT_LENGTH: 72,
  COMMIT_CHOICES_COUNT: 5,
  RECENT_COMMITS_COUNT: 10,
  REDACT_SENSITIVE_DATA: true,
  UI_LANGUAGE: Language.EN,
  COMMIT_LANGUAGE: Language.EN,
} as const;

export const VALIDATION_LIMITS = {
  MIN_COMMIT_LENGTH: 50,
  MAX_COMMIT_LENGTH: 100,
  MIN_COMMIT_CHOICES: 1,
  MAX_COMMIT_CHOICES: 10,
  MAX_CUSTOM_RULE_LENGTH: 100,
} as const;

export const FILE_SYSTEM = {
  CONFIG_DIRECTORY: ".cmai",
  CONFIG_FILENAME: "settings.json",
  SCHEMA_FILENAME: "settings.schema.json",
  SCHEMA_URL: "https://raw.githubusercontent.com/alexwhin/cmai/main/settings.schema.json",
  CONFIG_FILE_PERMISSIONS: 0o600,
} as const;

export const GIT = {
  DIFF_TRUNCATION_LIMIT: 3000,
  MAX_DIFF_LENGTH: 10000,
  AUTOMATED_PATTERNS: [
    /^(Auto|auto)/,
    /renovate/i,
    /dependabot/i,
    /greenkeeper/i,
    /snyk/i,
    /whitesource/i,
    /\[bot\]/,
    /\[skip ci\]/i,
    /\[ci skip\]/i,
  ],
  MERGE_PATTERNS: [
    /^Merge pull request #\d+ from .+/,
    /^.+ \(#\d+\)$/,
    /^Merge branch ".+" into ".+"/,
    /^Merge .+ into .+/,
  ],
} as const;

export const VALIDATION = {
  API_KEY_REQUIRED: (value: string) => value.length > 0 || "API key is required",
} as const;

export const CHOICE_VALUES = {
  CUSTOM: "custom",
  REGENERATE: "regenerate",
  EXIT: "exit",
  VIEW: "view",
} as const;

export const SECURITY = {
  MIN_STRING_LENGTH_FOR_ENTROPY: 16,
  ENTROPY_THRESHOLD: 0.6,
} as const;

export const SYSTEM = {
  EXIT_DELAY_MS: 100,
  PLATFORM: {
    DARWIN: "darwin" as const,
    WINDOWS: "win32" as const,
    LINUX: "linux" as const,
    FREEBSD: "freebsd" as const,
    OPENBSD: "openbsd" as const,
  },
} as const;

export const SETTINGS_ACTIONS = {
  PROVIDER: "provider",
  API_KEY: "apiKey",
  MODEL: "model",
  MAX_LENGTH: "maxLength",
  USAGE_MODE: "usageMode",
  COMMIT_CHOICES_COUNT: "commitChoicesCount",
  REDACT_SENSITIVE: "redactSensitive",
  CUSTOM_RULES: "customRules",
  UI_LANGUAGE: "uiLanguage",
  COMMIT_LANGUAGE: "commitLanguage",
} as const;

export const MODEL_DEFAULTS = {
  TEMPERATURE: 0.7,
  MAX_TOKENS: 2000,
  TOP_P: 0.8,
  TOP_K: 10,
} as const;
