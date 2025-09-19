import { vi } from "vitest";
// Import translations through a module to ensure Vitest watches the JSON file
import translations from "./tests/translations.js";

// Helper function to get nested translation value
function getNestedTranslation(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

// Helper function to handle template replacement
function applyTemplateParams(template: string, params?: Record<string, unknown>): string {
  let result = template;
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      result = result.replace(new RegExp(`{{${param}}}`, "g"), String(value));
    });
  }
  return result;
}

// Mock i18n module for all tests
vi.mock("./src/utils/i18n.js", () => {
  const mockT = vi.fn((key: string, params?: Record<string, unknown>) => {
    const translation = getNestedTranslation(translations, key);

    if (translation) {
      return applyTemplateParams(translation, params);
    }

    // Special cases for backwards compatibility
    if (key === "errors.unknown" && params?.message) {
      return `An unexpected error occurred: ${params.message}`;
    }
    if (key === "debug.stackTrace") {
      return "Stack trace:";
    }

    // Return key if translation not found
    return key;
  });

  return {
    t: mockT,
    initI18n: vi.fn().mockResolvedValue(undefined),
    ensureI18n: vi.fn().mockResolvedValue(undefined),
    resetI18n: vi.fn(),
    getLanguage: vi.fn().mockReturnValue("en"),
    changeLanguage: vi.fn().mockResolvedValue(vi.fn()),
    addResourceBundle: vi.fn(),
    // Add helper functions that were moved from i18n-helpers.js
    getPromptMessage: vi.fn((key: string) => {
      const keyMap: Record<string, string> = {
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
      };
      const translationKey = keyMap[key];
      if (!translationKey) {
        return key;
      }
      if (key === "ENTER_API_KEY") {
        return mockT("prompts.enterApiKeyNoProvider");
      }
      return mockT(translationKey);
    }),
    getPromptHint: vi.fn((key: string) => {
      if (key === "RECOMMENDED_COMMIT_LENGTH") {
        return "Recommended: 72 characters";
      }
      if (key === "DEFAULT_COMMIT_CHOICES") {
        return "Default: 5 options";
      }
      const hintMap: Record<string, string> = {
        SELECT: "hints.select",
        CUSTOM_RULES_HINT: "hints.customRule",
      };
      const translationKey = hintMap[key];
      return translationKey ? mockT(translationKey) : key;
    }),
    getChoiceValue: vi.fn((key: string) => key),
    getMessage: vi.fn((key: string) => {
      const messageMap: Record<string, string> = {
        CANCELLED: "messages.cancelled",
        ENTER_CUSTOM_COMMIT: "prompts.enterCustomMessage",
        RETRY_PROMPT: "prompts.tryAgain",
        FAILED_GENERATE: "errors.api.generationFailed",
      };
      const translationKey = messageMap[key];
      return translationKey ? mockT(translationKey) : key;
    }),
    getUsageModeDisplayText: vi.fn((mode: string) => {
      const usageModeMap: Record<string, string> = {
        TERMINAL: "usageModes.terminal.name",
        COMMIT: "usageModes.interactive.name",
        CLIPBOARD: "usageModes.automatic.name",
      };
      return mockT(usageModeMap[mode] || mode);
    }),
    getSettingsActionLabel: vi.fn((action: string) => {
      const actionMap: Record<string, string> = {
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
      const translationKey = actionMap[action];
      return translationKey ? mockT(translationKey) : action;
    }),
    getValidationMessage: vi.fn((type: string, value?: unknown) => {
      if (type === "apiKey") {
        if (typeof value === "string" && value.length > 0) {
          return true;
        }
        return mockT("validation.apiKeyRequired");
      }
      if (type === "maxLength") {
        if (typeof value === "number" && value >= 50 && value <= 100) {
          return true;
        }
        return mockT("validation.maxCommitLengthRange", { min: 50, max: 100 });
      }
      if (type === "choicesCount") {
        if (typeof value === "number" && value >= 1 && value <= 10) {
          return true;
        }
        return mockT("validation.commitChoicesRange", { min: 1, max: 10 });
      }
      return true;
    }),
  };
});

// Add console mock to suppress warnings during tests
globalThis.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};
