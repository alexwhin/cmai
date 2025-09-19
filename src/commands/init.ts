import prompts from "prompts";
import { Config, UsageMode, Language } from "../types/index.js";
import { configurationExists, saveConfiguration } from "../utils/config.js";
import { exit } from "../utils/system-utils.js";
import { DEFAULTS } from "../constants.js";
import {
  message,
  promptProvider,
  promptApiKey,
  validateApiKey,
  validateAndSelectModel,
  promptUsageMode,
} from "../utils/ui-utils.js";
import { t } from "../utils/i18n.js";

type PromptResult<T> = {
  value: T | undefined;
  cancelled: boolean;
};

type CompleteConfig = Config & {
  usageMode: UsageMode;
};

function handleCancellation(messageText?: string): void {
  message(messageText || t("messages.setupCancelled"), { type: "warning", variant: "title" });
}

function extractResultValue<T>(result: PromptResult<T>): T | null {
  if (result.cancelled || result.value === undefined) {
    handleCancellation();
    return null;
  }
  return result.value;
}

async function promptConfigurationValues(): Promise<CompleteConfig | null> {
  const provider = extractResultValue(await promptProvider());
  if (provider === null) {
    return null;
  }

  const apiKey = extractResultValue(await promptApiKey(provider));
  if (apiKey === null) {
    return null;
  }

  const isApiKeyValid = await validateApiKey(provider, apiKey);
  if (!isApiKeyValid) {
    exit(1);
    return null;
  }

  const model = extractResultValue(await validateAndSelectModel(provider, apiKey));
  if (model === null) {
    return null;
  }

  const redactSensitiveData = DEFAULTS.REDACT_SENSITIVE_DATA;
  const maxCommitLength = DEFAULTS.MAX_COMMIT_LENGTH;
  const commitChoicesCount = DEFAULTS.COMMIT_CHOICES_COUNT;

  const usageMode = extractResultValue(await promptUsageMode());
  if (usageMode === null) {
    return null;
  }

  const uiLanguage = Language.EN;
  const commitLanguage = DEFAULTS.COMMIT_LANGUAGE;

  return {
    provider,
    apiKey,
    model,
    maxCommitLength,
    commitChoicesCount,
    usageMode,
    redactSensitiveData,
    uiLanguage,
    commitLanguage,
  };
}

async function handleExistingConfiguration(): Promise<boolean> {
  const configExists = await configurationExists();
  if (!configExists) {
    return true;
  }

  const { overwrite } = await prompts({
    type: "confirm",
    name: "overwrite",
    message: t("errors.configuration.alreadyExists"),
    initial: false,
  });

  if (!overwrite) {
    handleCancellation(t("messages.keepingExistingConfig"));
    return false;
  }

  return true;
}

export async function initCommand(): Promise<void> {
  const shouldProceed = await handleExistingConfiguration();
  if (!shouldProceed) {
    return;
  }

  const configuration = await promptConfigurationValues();
  if (configuration === null) {
    return;
  }

  await saveConfiguration(configuration);
  message(t("messages.configSaved"), { type: "success", variant: "title" });

  message(t("messages.setupComplete"), { type: "success", variant: "title" });
}
