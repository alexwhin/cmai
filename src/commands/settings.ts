import prompts from "prompts";
import { Config, UsageMode, Language } from "../types/index.js";
import { SETTINGS_ACTIONS, DEFAULTS, UI } from "../constants.js";
import { getProviderDisplayName, getLanguageDisplayName } from "../utils/formatting.js";
import {
  getPromptMessage,
  getPromptHint,
  getChoiceValue,
  getUsageModeDisplayText,
} from "../utils/i18n.js";
import { configurationExists, loadConfiguration, saveConfiguration } from "../utils/config.js";
import { color } from "../utils/style.js";
import {
  message,
  promptProvider,
  promptApiKey,
  validateAndSelectModel,
  promptMaxCommitLength,
  promptCommitChoicesCount,
  promptRedactSensitiveData,
  promptUsageMode,
  manageCustomRules,
  formatBooleanAsYesNo,
  formatMenuOption,
  promptUILanguage,
  promptCommitLanguage,
} from "../utils/ui-utils.js";
import { initCommand } from "./init.js";
import { t, changeLanguage, ensureI18n } from "../utils/i18n.js";
import { isUrlBasedProvider, getProviderDefaultUrl } from "../providers/configuration.js";

function getRulesCountText(customRules?: string[]): string {
  if (!customRules?.length) {
    return t("settings.customRules.none");
  }
  const suffix = customRules.length === 1 ? "" : "s";
  return t("settings.customRules.count", { count: customRules.length, suffix });
}

interface SettingsChoice {
  title: string;
  value: string;
  description?: string;
}

function createSettingsMenu(config: Config): SettingsChoice[] {
  const maskApiKey = (apiKey: string) => {
    if (!apiKey) {
      return t("settings.apiKey.notSet");
    }
    if (isUrlBasedProvider(config.provider)) {
      return apiKey;
    }
    if (apiKey.length <= 8) {
      return "***";
    }
    return `${apiKey.substring(0, 4)}***${apiKey.substring(apiKey.length - 4)}`;
  };

  const getApiKeyLabel = () => {
    if (isUrlBasedProvider(config.provider)) {
      return t("prompts.enterProviderUrl", { provider: getProviderDisplayName(config.provider) });
    }
    return getPromptMessage("ENTER_API_KEY");
  };

  return [
    {
      title: `${getPromptMessage("SELECT_PROVIDER")} ${color(
        "gray",
        getProviderDisplayName(config.provider)
      )}`,
      value: "provider",
    },
    {
      title: `${getApiKeyLabel()} ${color("gray", maskApiKey(config.apiKey || ""))}`,
      value: "apiKey",
    },
    {
      title: `${getPromptMessage("SELECT_MODEL")} ${color(
        "gray",
        config.model || t("settings.model.notSet")
      )}`,
      value: "model",
    },
    {
      title: `${getPromptMessage("MAX_COMMIT_LENGTH")} ${color(
        "gray",
        String(config.maxCommitLength || DEFAULTS.MAX_COMMIT_LENGTH)
      )}`,
      value: "maxLength",
    },
    {
      title: `${t("settings.commitChoicesCount.title")} ${color(
        "gray",
        String(config.commitChoicesCount || 5)
      )}`,
      value: "commitChoicesCount",
    },
    {
      title: `${t("settings.redactSensitive.title")} ${color(
        "gray",
        config.redactSensitiveData !== false ? t("common.yes") : t("common.no")
      )}`,
      value: "redactSensitive",
    },
    {
      title: `${t("labels.usageMode")} ${color(
        "gray",
        getUsageModeDisplayText(config.usageMode || UsageMode.CLIPBOARD)
      )}`,
      value: "usageMode",
    },
    {
      title: `${t("settings.customRules.title")} ${color(
        "gray",
        getRulesCountText(config.customRules)
      )}`,
      value: SETTINGS_ACTIONS.CUSTOM_RULES,
    },
    {
      title: `${t("labels.uiLanguage")} ${color(
        "gray",
        getLanguageDisplayName(config.uiLanguage || Language.EN)
      )}`,
      value: SETTINGS_ACTIONS.UI_LANGUAGE,
    },
    {
      title: `${t("labels.commitLanguage")} ${color(
        "gray",
        getLanguageDisplayName(config.commitLanguage || Language.EN)
      )}`,
      value: SETTINGS_ACTIONS.COMMIT_LANGUAGE,
    },
    {
      title: formatMenuOption(t("actions.exit"), "exit"),
      value: getChoiceValue("EXIT"),
    },
  ];
}

export async function settingsCommand(): Promise<void> {
  const configExists = await configurationExists();
  if (!configExists) {
    message(t("settings.noConfigFound"), { type: "warning", variant: "title" });
    await initCommand();
    return;
  }

  const initialConfig = await loadConfiguration();
  if (initialConfig.uiLanguage) {
    await ensureI18n(initialConfig.uiLanguage);
  }

  let shouldContinue = true;
  let iterations = 0;
  const maxIterations = UI.MAX_SETTINGS_ITERATIONS;

  while (shouldContinue && iterations < maxIterations) {
    iterations++;
    let configuration = await loadConfiguration();
    const choices = createSettingsMenu(configuration);

    const result = await prompts({
      type: "select",
      name: "action",
      message: t("settings.selectSetting"),
      choices,
      hint: getPromptHint("SELECT"),
    });

    const { action } = result || {};

    if (!action || action === getChoiceValue("EXIT")) {
      shouldContinue = false;
      break;
    }

    switch (action) {
      case "provider": {
        const providerResult = await promptProvider(configuration.provider);
        if (!providerResult.cancelled && providerResult.value) {
          if (providerResult.value !== configuration.provider) {
            configuration.provider = providerResult.value;

            if (isUrlBasedProvider(providerResult.value)) {
              configuration.apiKey = getProviderDefaultUrl(providerResult.value) || "";
            } else {
              delete configuration.apiKey;
            }

            configuration.model = "";
            await saveConfiguration(configuration);
            message(t("settings.provider.updated"), { type: "success", variant: "title" });
            message(t("settings.provider.resetNotice"), { type: "info" });
          }
        }
        break;
      }

      case "apiKey": {
        const apiKeyResult = await promptApiKey();
        if (!apiKeyResult.cancelled && apiKeyResult.value) {
          configuration.apiKey = apiKeyResult.value;
          await saveConfiguration(configuration);
          const messageKey = isUrlBasedProvider(configuration.provider) ? "settings.apiKey.updatedUrl" : "settings.apiKey.updated";
          message(t(messageKey), { type: "success", variant: "title" });
        }
        break;
      }

      case "model": {
        const modelResult = await validateAndSelectModel(
          configuration.provider,
          configuration.apiKey || "",
          configuration.model
        );
        if (!modelResult.cancelled && modelResult.value) {
          configuration.model = modelResult.value;
          await saveConfiguration(configuration);
          message(t("settings.model.updated"), { type: "success", variant: "title" });
        }
        break;
      }

      case "maxLength": {
        const currentMaxLength = configuration.maxCommitLength || DEFAULTS.MAX_COMMIT_LENGTH;
        const maxLengthResult = await promptMaxCommitLength(currentMaxLength);

        if (
          !maxLengthResult.cancelled &&
          maxLengthResult.value &&
          maxLengthResult.value !== currentMaxLength
        ) {
          configuration.maxCommitLength = maxLengthResult.value;
          await saveConfiguration(configuration);
          message(t("settings.maxLength.updated", { value: maxLengthResult.value }), {
            type: "success",
            variant: "title",
          });
        }
        break;
      }

      case "commitChoicesCount": {
        const currentChoicesCount = configuration.commitChoicesCount || 5;
        const choicesCountResult = await promptCommitChoicesCount(currentChoicesCount);

        if (
          !choicesCountResult.cancelled &&
          choicesCountResult.value &&
          choicesCountResult.value !== currentChoicesCount
        ) {
          configuration.commitChoicesCount = choicesCountResult.value;
          await saveConfiguration(configuration);
          message(t("settings.commitChoicesCount.updated", { value: choicesCountResult.value }), {
            type: "success",
            variant: "title",
          });
        }
        break;
      }

      case "redactSensitive": {
        const currentRedactSensitive = configuration.redactSensitiveData !== false;
        const redactResult = await promptRedactSensitiveData(currentRedactSensitive);

        if (
          !redactResult.cancelled &&
          redactResult.value !== undefined &&
          redactResult.value !== currentRedactSensitive
        ) {
          configuration.redactSensitiveData = redactResult.value;
          await saveConfiguration(configuration);
          message(
            t("settings.redactSensitive.updated", {
              value: formatBooleanAsYesNo(redactResult.value),
            }),
            {
              type: "success",
              variant: "title",
            }
          );
        }
        break;
      }

      case "usageMode": {
        const currentMode = configuration.usageMode || UsageMode.CLIPBOARD;

        const usageModeResult = await promptUsageMode(currentMode);

        if (
          !usageModeResult.cancelled &&
          usageModeResult.value &&
          usageModeResult.value !== currentMode
        ) {
          configuration.usageMode = usageModeResult.value;
          await saveConfiguration(configuration);

          message(t("settings.usageMode.updated"), { type: "success", variant: "title" });
        }
        break;
      }

      case SETTINGS_ACTIONS.CUSTOM_RULES: {
        const currentCustomRules = configuration.customRules || [];
        const customRulesResult = await manageCustomRules(currentCustomRules);

        if (!customRulesResult.cancelled) {
          if (customRulesResult.value!.length > 0) {
            configuration.customRules = customRulesResult.value!;
          } else {
            delete configuration.customRules;
          }
          await saveConfiguration(configuration);
          message(t("settings.customRules.updated"), { type: "success", variant: "title" });
        }
        break;
      }

      case SETTINGS_ACTIONS.UI_LANGUAGE: {
        const currentUILanguage = configuration.uiLanguage || Language.EN;
        const uiLanguageResult = await promptUILanguage(currentUILanguage);

        if (
          !uiLanguageResult.cancelled &&
          uiLanguageResult.value &&
          uiLanguageResult.value !== currentUILanguage
        ) {
          configuration.uiLanguage = uiLanguageResult.value;
          await saveConfiguration(configuration);
          await changeLanguage(uiLanguageResult.value);
          message(
            t("settings.uiLanguage.updated", {
              language: getLanguageDisplayName(uiLanguageResult.value),
            }),
            {
              type: "success",
              variant: "title",
            }
          );
        }
        break;
      }

      case SETTINGS_ACTIONS.COMMIT_LANGUAGE: {
        const currentCommitLanguage = configuration.commitLanguage || Language.EN;
        const commitLanguageResult = await promptCommitLanguage(currentCommitLanguage);

        if (
          !commitLanguageResult.cancelled &&
          commitLanguageResult.value &&
          commitLanguageResult.value !== currentCommitLanguage
        ) {
          configuration.commitLanguage = commitLanguageResult.value;
          await saveConfiguration(configuration);
          message(
            t("settings.commitLanguage.updated", {
              language: getLanguageDisplayName(commitLanguageResult.value),
            }),
            {
              type: "success",
              variant: "title",
            }
          );
        }
        break;
      }
    }
  }

  if (iterations >= maxIterations) {
    message(t("settings.maxIterationsExceeded"), { type: "warning", variant: "title" });
  }
}
