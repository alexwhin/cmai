import i18next, { type TFunction } from "i18next";
import Backend from "i18next-fs-backend";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { UsageMode } from "../types/index.js";
import { VALIDATION_LIMITS } from "../constants.js";
import { isString } from "./guards.js";
import { SystemError } from "./errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let isInitialized = false;
let initPromise: Promise<TFunction> | null = null;

export async function initI18n(configuredLanguage?: string): Promise<TFunction> {
  if (isInitialized && !configuredLanguage) {
    return i18next.t.bind(i18next);
  }

  if (initPromise && !configuredLanguage) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const localesPath = join(__dirname, "..", "locales");
      const defaultLanguage =
        configuredLanguage ||
        process.env.LANG?.split("_")[0] ||
        process.env.LANGUAGE?.split("_")[0] ||
        "en";

      if (isInitialized) {
        await i18next.changeLanguage(defaultLanguage);
        return i18next.t.bind(i18next);
      }

      await i18next.use(Backend).init({
        lng: defaultLanguage,
        fallbackLng: "en",
        backend: {
          loadPath: join(localesPath, "{{lng}}", "{{ns}}.json"),
        },
        ns: ["translation"],
        defaultNS: "translation",
        interpolation: {
          escapeValue: false,
        },
        debug: false,
      });

      isInitialized = true;
      return i18next.t.bind(i18next);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SystemError(`Failed to initialize i18n: ${message}`);
    }
  })();

  return initPromise;
}

export function t(key: string, options?: Record<string, unknown>): string {
  if (!isInitialized) {
    return key;
  }
  return i18next.t(key, options) as string;
}

export async function ensureI18n(configuredLanguage?: string): Promise<void> {
  if (!isInitialized || configuredLanguage) {
    await initI18n(configuredLanguage);
  }
}

export function changeLanguage(lng: string): Promise<TFunction> {
  return i18next.changeLanguage(lng);
}

const PROMPT_KEYS = {
  SELECT_PROVIDER: "prompts.selectProvider",
  SELECT_NEW_PROVIDER: "prompts.selectProvider",
  ENTER_API_KEY: "prompts.enterApiKey",
  SELECT_MODEL: "prompts.selectModel",
  FETCHING_MODELS: "prompts.fetchingModels",
  MODELS_LOADED: "prompts.modelsLoaded",
  FAILED_TO_FETCH_MODELS: "messages.failedToLoadModels",
  SELECT_USAGE_MODE: "prompts.selectSetting",
  SELECT_COMMIT_MESSAGE: "messages.selectCommit",
  GENERATING_MESSAGES: "messages.generating",
  MESSAGES_GENERATED: "messages.generating",
  REGENERATING_MESSAGES: "messages.generating",
  MESSAGES_REGENERATED: "messages.generating",
  MAX_COMMIT_LENGTH: "labels.maxCommitLength",
} as const;

const HINT_KEYS = {
  SELECT: "hints.select",
  CUSTOM_RULES_HINT: "hints.customRule",
} as const;

const MESSAGE_KEYS = {
  CANCELLED: "messages.cancelled",
  ENTER_CUSTOM_COMMIT: "prompts.enterCustomMessage",
  RETRY_PROMPT: "prompts.tryAgain",
  FAILED_GENERATE: "errors.api.generationFailed",
} as const;

const USAGE_MODE_KEYS: Record<UsageMode, string> = {
  [UsageMode.TERMINAL]: "usageModes.terminal.name",
  [UsageMode.COMMIT]: "usageModes.interactive.name",
  [UsageMode.CLIPBOARD]: "usageModes.automatic.name",
};

const SETTINGS_ACTION_KEYS: Record<string, string> = {
  provider: "labels.provider",
  apiKey: "labels.apiKey",
  model: "labels.model",
  maxLength: "labels.maxCommitLength",
  usageMode: "labels.usageMode",
  commitChoicesCount: "labels.commitChoicesCount",
  redactSensitive: "labels.redactSensitiveData",
  customRules: "labels.customRules",
  view: "settings.view",
  exit: "actions.exit",
};

export function getPromptMessage(key: keyof typeof PROMPT_KEYS): string {
  const translationKey = PROMPT_KEYS[key];
  if (!translationKey) {
    return key;
  }

  if (key === "ENTER_API_KEY") {
    return t("prompts.enterApiKeyNoProvider");
  }

  return t(translationKey);
}

export function getPromptHint(
  key: keyof typeof HINT_KEYS | "RECOMMENDED_COMMIT_LENGTH" | "DEFAULT_COMMIT_CHOICES"
): string {
  if (key === "RECOMMENDED_COMMIT_LENGTH") {
    return "Recommended: 72 characters";
  }
  if (key === "DEFAULT_COMMIT_CHOICES") {
    return "Default: 5 options";
  }

  const translationKey = HINT_KEYS[key as keyof typeof HINT_KEYS];
  return translationKey ? t(translationKey) : key;
}

export function getUsageModeDisplayText(mode: UsageMode): string {
  return t(USAGE_MODE_KEYS[mode] || mode);
}

export function getValidationMessage(
  type: "apiKey" | "maxLength" | "choicesCount",
  value?: string | number
): string | boolean {
  if (type === "apiKey") {
    return (isString(value) && value.length > 0) || t("validation.apiKeyRequired");
  }

  if (type === "maxLength" || type === "choicesCount") {
    const limits = type === "maxLength" ? { min: VALIDATION_LIMITS.MIN_COMMIT_LENGTH, max: VALIDATION_LIMITS.MAX_COMMIT_LENGTH } : { min: VALIDATION_LIMITS.MIN_COMMIT_CHOICES, max: VALIDATION_LIMITS.MAX_COMMIT_CHOICES };

    const translationKey =
      type === "maxLength" ? "validation.maxCommitLengthRange" : "validation.commitChoicesRange";

    if (typeof value !== "number" || value < limits.min || value > limits.max) {
      return t(translationKey, limits);
    }
    return true;
  }

  return true;
}

export function getMessage(key: keyof typeof MESSAGE_KEYS): string {
  const translationKey = MESSAGE_KEYS[key];
  return translationKey ? t(translationKey) : key;
}

export function getChoiceValue(key: string): string {
  return key;
}

export function getSettingsActionLabel(action: string): string {
  const translationKey = SETTINGS_ACTION_KEYS[action];
  return translationKey ? t(translationKey) : action;
}
