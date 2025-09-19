import prompts from "prompts";
import { bold, color, styledSymbol, type SymbolType, type Color, dim } from "./style.js";
import { type FilePathItem } from "./data-utils.js";
import {
  getUsageModeChoices,
  getProviderDisplayName,
  getLanguageDisplayName,
  getLanguageChoices,
  getUILanguageChoices,
} from "./formatting.js";
import { exit } from "./system-utils.js";
import ora, { type Ora } from "ora";
import { isString } from "./guards.js";
import { Provider, UsageMode, Config, Language } from "../types/index.js";
import { getAvailableModels, validateAndFetchModels } from "../providers/models.js";
import { t } from "./i18n.js";
import { getProviderChoices, DEFAULTS, VALIDATION_LIMITS, UI } from "../constants.js";
import { getPromptMessage, getPromptHint, getUsageModeDisplayText } from "./i18n.js";
import { createError, NoSuitableModelsError } from "./errors.js";
import { isUrlBasedProvider, getProviderDefaultUrl } from "../providers/configuration.js";

interface MessageOptions {
  type?: SymbolType;
  styled?: boolean;
  items?: FilePathItem[] | string;
  valueColor?: Color;
  variant?: "text" | "title";
}

interface PromptResult<T> {
  value: T | undefined;
  cancelled: boolean;
}

export const SYMBOLS = UI.SYMBOLS;

class SpinnerManager {
  private static currentSpinner: Ora | null = null;
  private static progressTimer: ReturnType<typeof setTimeout> | null = null;
  private static startTime: number = 0;

  static start(text: string, showProgress: boolean = false): Ora {
    this.stop();
    this.currentSpinner = ora(bold(text)).start();
    this.startTime = Date.now();

    if (showProgress) {
      const originalText = text;
      // eslint-disable-next-line no-undef
      this.progressTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        if (this.currentSpinner && elapsed > 5) {
          this.currentSpinner.text = bold(`${originalText} (${elapsed}s)`);
        }
      }, 1000);
    }

    return this.currentSpinner;
  }

  static succeed(text: string): Ora {
    this.stop();
    if (this.currentSpinner) {
      const spinner = this.currentSpinner;
      this.currentSpinner = null;
      return spinner.succeed(bold(text));
    }
    return ora().succeed(bold(text));
  }

  static fail(text: string): Ora {
    this.stop();
    if (this.currentSpinner) {
      const spinner = this.currentSpinner;
      this.currentSpinner = null;
      return spinner.fail(bold(text));
    }
    return ora().fail(bold(text));
  }

  static create(text: string): Ora {
    return ora(bold(text));
  }

  private static stop(): void {
    if (this.progressTimer) {
      // eslint-disable-next-line no-undef
      clearInterval(this.progressTimer as unknown as Parameters<typeof clearInterval>[0]);
      this.progressTimer = null;
    }
  }
}

class MessageRenderer {
  static renderBasicMessage(content: string, options?: MessageOptions): void {
    if (options?.type) {
      const displayText = options?.variant === "title" ? bold(content) : content;
      console.log(`${symbol(options.type)} ${displayText}`);
    } else {
      const displayText = options?.variant === "title" ? bold(content) : content;
      console.log(displayText);
    }
  }

  static renderItemsMessage(options: MessageOptions & { items: FilePathItem[] }): void {
    const firstItem = options.items[0];
    if (!firstItem) {
      return;
    }

    const valueColor = options.valueColor || "gray";
    const firstItemLabel = color("gray", `${firstItem.label} › `);
    const firstItemValue = color(valueColor, firstItem.value);
    const firstItemText = firstItemLabel + firstItemValue;
    const displayText = options?.variant === "title" ? bold(firstItemText) : firstItemText;

    console.log(`${symbol(options.type!)} ${displayText}`);

    const remainingItems = (options.items as FilePathItem[]).slice(1);
    if (remainingItems.length > 0) {
      remainingItems.forEach(({ label, value }: FilePathItem) => {
        console.log(color("gray", `  ${label} › `) + color(valueColor, value));
      });
    }
  }

  static renderAdditionalItems(options: MessageOptions): void {
    if (isString(options.items)) {
      console.log(color("gray", "  ") + options.items);
    } else if (options.items?.length) {
      const valueColor = options.valueColor || "gray";
      options.items.forEach(({ label, value }) => {
        console.log(color("gray", `  ${label} › `) + color(valueColor, value));
      });
    }
  }
}

class PromptValidator {
  static validateApiKey(value: string): string | true {
    return value.length > 0 ? true : t("validation.apiKeyRequired");
  }

  static validateMaxCommitLength(value: number | undefined): string | true {
    if (value === undefined || value === null || value === 0) {
      return true;
    }
    if (
      value < VALIDATION_LIMITS.MIN_COMMIT_LENGTH ||
      value > VALIDATION_LIMITS.MAX_COMMIT_LENGTH
    ) {
      return t("validation.maxCommitLengthRange", {
        min: VALIDATION_LIMITS.MIN_COMMIT_LENGTH,
        max: VALIDATION_LIMITS.MAX_COMMIT_LENGTH,
      });
    }
    return true;
  }

  static validateCommitChoicesCount(value: number | undefined): string | true {
    if (value === undefined || value === null || value === 0) {
      return true;
    }
    if (
      value < VALIDATION_LIMITS.MIN_COMMIT_CHOICES ||
      value > VALIDATION_LIMITS.MAX_COMMIT_CHOICES
    ) {
      return t("validation.commitChoicesRange", {
        min: VALIDATION_LIMITS.MIN_COMMIT_CHOICES,
        max: VALIDATION_LIMITS.MAX_COMMIT_CHOICES,
      });
    }
    return true;
  }

  static validateCustomRule(rule: string, existingRules: string[]): string | true {
    if (!rule.trim()) {
      return t("validation.ruleEmpty");
    }
    if (existingRules.includes(rule.trim())) {
      return t("validation.ruleExists");
    }
    return true;
  }
}

class PromptFactory {
  static createProviderPrompt(currentProvider?: Provider): prompts.PromptObject {
    const isUpdate = !!currentProvider;
    const message = isUpdate ? getPromptMessage("SELECT_NEW_PROVIDER") : getPromptMessage("SELECT_PROVIDER");
    const initial = isUpdate ? Object.values(Provider).indexOf(currentProvider) : 0;

    return {
      type: "select" as const,
      name: "provider",
      message,
      choices: getProviderChoices(),
      initial,
      hint: getPromptHint("SELECT"),
    };
  }

  static createApiKeyPrompt(): prompts.PromptObject {
    return {
      type: "invisible" as const,
      name: "value",
      message: getPromptMessage("ENTER_API_KEY"),
      validate: PromptValidator.validateApiKey,
    };
  }

  static createModelPrompt(
    models: { id: string; name?: string }[],
    currentModel?: string
  ): prompts.PromptObject {
    if (!models || models.length === 0) {
      throw new NoSuitableModelsError("provider");
    }
    
    const choices = models.map((model) => ({
      title: model.name || model.id,
      value: model.id,
    }));
    
    const initialIndex = currentModel ? models.findIndex((m) => m.id === currentModel) : 0;
    
    return {
      type: "select" as const,
      name: "model",
      message: getPromptMessage("SELECT_MODEL"),
      choices,
      initial: initialIndex >= 0 ? initialIndex : 0,
      hint: getPromptHint("SELECT"),
    };
  }

  static createUsageModePrompt(currentMode?: UsageMode): prompts.PromptObject {
    const isUpdate = !!currentMode;
    const message = isUpdate ? getPromptMessage("SELECT_USAGE_MODE") : getPromptMessage("SELECT_USAGE_MODE");
    const initial = isUpdate ? Object.values(UsageMode).indexOf(currentMode) : 0;

    return {
      type: "select" as const,
      name: "usageMode",
      message,
      choices: getUsageModeChoices(),
      initial,
      hint: getPromptHint("SELECT"),
    };
  }

  static createLanguagePrompt(
    currentLanguage?: Language,
    isCommitLanguage: boolean = false
  ): prompts.PromptObject {
    const message = isCommitLanguage ? t("prompts.selectCommitLanguage") : t("prompts.selectUILanguage");
    const choices = isCommitLanguage ? getLanguageChoices() : getUILanguageChoices();
    const initial = currentLanguage ? choices.findIndex((choice) => choice.value === currentLanguage) : 0;

    return {
      type: "select" as const,
      name: "language",
      message,
      choices,
      initial: initial >= 0 ? initial : 0,
      hint: getPromptHint("SELECT"),
    };
  }
}

class ApiKeyFormatter {
  private static readonly MASK_CHAR = "•";
  private static readonly MIN_LENGTH_FOR_PARTIAL_DISPLAY = 12;

  static formatForDisplay(apiKey: string): string {
    if (apiKey.length <= this.MIN_LENGTH_FOR_PARTIAL_DISPLAY) {
      return this.MASK_CHAR.repeat(8);
    }

    const first = apiKey.slice(0, 6);
    const last = apiKey.slice(-6);
    return `${first}...${last}`;
  }
}

class CustomRuleManager {
  static async promptAddRule(existingRules: string[]): Promise<string | undefined> {
    const { rule } = await prompts({
      type: "text",
      name: "rule",
      message: t("prompts.enterCustomRule"),
      hint: t("hints.customRule"),
      validate: (rule: string) => {
        if (!rule.trim()) {
          return t("validation.ruleEmpty");
        }
        if (existingRules.includes(rule.trim())) {
          return t("validation.ruleExists");
        }
        return true;
      },
    });

    return rule?.trim();
  }

  static async selectRuleToRemove(rules: string[]): Promise<string | undefined> {
    const { ruleToRemove } = await prompts({
      type: "select",
      name: "ruleToRemove",
      message: t("prompts.selectRuleToRemove"),
      choices: rules.map((rule, index) => ({
        title: rule,
        value: index.toString(),
      })),
      hint: getPromptHint("SELECT"),
    });

    return ruleToRemove !== undefined ? rules[parseInt(ruleToRemove, 10)] : undefined;
  }

  static formatRulesList(rules: string[]): string {
    if (rules.length === 0) {
      return `  ${t("messages.noCustomRules")}`;
    }
    return rules.map((rule, i) => `  ${i + 1}. ${rule}`).join("\n");
  }
}

export function logo(): void {
  console.log(
    color(
      "white",
      `
  █▀▀ █▀▄▀█ ▄▀█ █
  █▄▄ █░▀░█ █▀█ █`
    )
  );
  console.log();
}

export function symbol(type: SymbolType): string {
  const symbolChar = SYMBOLS[type];

  if (process.env.NODE_ENV === "test") {
    switch (type) {
      case "success":
        return `GREEN[${symbolChar}]`;
      case "error":
        return `RED[${symbolChar}]`;
      case "warning":
        return `YELLOW[${symbolChar}]`;
      case "info":
        return `CYAN[${symbolChar}]`;
      case "regenerate":
      case "edit":
      case "exit":
      default:
        return `DIM[${symbolChar}]`;
    }
  }

  return styledSymbol(type, symbolChar);
}

export function exitWithError(messageText: string): never {
  message(messageText, { type: "error", variant: "title" });
  exit(1);
  process.exit(1);
}

export function errorWithDebug(formattedError: string): void {
  MessageRenderer.renderBasicMessage(formattedError);
}

export function message(content: string, options?: MessageOptions): void {
  if (content) {
    MessageRenderer.renderBasicMessage(content, options);
  } else if (
    !content &&
    options?.type &&
    options?.items &&
    Array.isArray(options.items) &&
    options.items.length > 0
  ) {
    MessageRenderer.renderItemsMessage(options as MessageOptions & { items: FilePathItem[] });
    return;
  }

  if (options?.items) {
    MessageRenderer.renderAdditionalItems(options);
  }
}

export function spinner(
  text: string,
  state?: "start" | "succeed" | "fail",
  showProgress: boolean = false
): Ora | null {
  switch (state) {
    case "start":
      return SpinnerManager.start(text, showProgress);
    case "succeed":
      return SpinnerManager.succeed(text);
    case "fail":
      return SpinnerManager.fail(text);
    default:
      return SpinnerManager.create(text);
  }
}

export async function invisiblePrompt(message: string): Promise<string | undefined> {
  const { value } = await prompts({
    type: "invisible",
    name: "value",
    message: message,
    validate: PromptValidator.validateApiKey,
  });

  return value;
}

export async function promptProvider(currentProvider?: Provider): Promise<PromptResult<Provider>> {
  const promptConfig = PromptFactory.createProviderPrompt(currentProvider);
  const { provider } = await prompts(promptConfig);

  return {
    value: provider,
    cancelled: !provider,
  };
}

export async function promptApiKey(provider?: Provider): Promise<PromptResult<string>> {
  if (!provider) {
    const apiKey = await invisiblePrompt(getPromptMessage("ENTER_API_KEY"));
    return {
      value: apiKey,
      cancelled: !apiKey,
    };
  }

  const isUrlBased = isUrlBasedProvider(provider);
  const messageKey = isUrlBased ? "prompts.enterProviderUrl" : "prompts.enterApiKey";
  const message = t(messageKey, { provider: getProviderDisplayName(provider) });

  if (isUrlBased) {
    const { value } = await prompts({
      type: "text",
      name: "value",
      message: message,
      initial: getProviderDefaultUrl(provider),
      validate: (value: string) => value.length > 0 || t("validation.urlRequired"),
    });

    return {
      value: value,
      cancelled: !value,
    };
  }

  const apiKey = await invisiblePrompt(message);
  return {
    value: apiKey,
    cancelled: !apiKey,
  };
}

export async function validateAndSelectModel(
  provider: Provider,
  apiKey: string,
  currentModel?: string
): Promise<PromptResult<string>> {
  spinner(t("prompts.fetchingModels"), "start", true);

  try {
    const models = await getAvailableModels(provider, apiKey);
    spinner(t("prompts.modelsLoaded"), "succeed");
    
    if (!models || models.length === 0) {
      throw new NoSuitableModelsError(getProviderDisplayName(provider));
    }

    const promptConfig = PromptFactory.createModelPrompt(models, currentModel);
    const { model } = await prompts(promptConfig);

    return {
      value: model,
      cancelled: !model,
    };
  } catch (error) {
    spinner(t("messages.failedToLoadModels"), "fail");
    throw createError(error);
  }
}

export async function promptMaxCommitLength(currentLength?: number): Promise<PromptResult<number>> {
  const { maxCommitLength } = await prompts({
    type: "number",
    name: "maxCommitLength",
    message: getPromptMessage("MAX_COMMIT_LENGTH"),
    initial: currentLength || DEFAULTS.MAX_COMMIT_LENGTH,
    validate: PromptValidator.validateMaxCommitLength,
  });

  return {
    value: maxCommitLength || DEFAULTS.MAX_COMMIT_LENGTH,
    cancelled: false,
  };
}

export async function promptCommitChoicesCount(
  currentCount?: number
): Promise<PromptResult<number>> {
  const { commitChoicesCount } = await prompts({
    type: "number",
    name: "commitChoicesCount",
    message: t("labels.commitChoicesCount"),
    initial: currentCount || DEFAULTS.COMMIT_CHOICES_COUNT,
    validate: PromptValidator.validateCommitChoicesCount,
  });

  return {
    value: commitChoicesCount || DEFAULTS.COMMIT_CHOICES_COUNT,
    cancelled: false,
  };
}

export async function promptRedactSensitiveData(
  currentValue?: boolean
): Promise<PromptResult<boolean>> {
  const { redactSensitiveData } = await prompts({
    type: "confirm",
    name: "redactSensitiveData",
    message: t("labels.redactSensitiveData"),
    initial: currentValue !== undefined ? currentValue : true,
  });

  return {
    value: redactSensitiveData,
    cancelled: redactSensitiveData === undefined,
  };
}

export async function promptUsageMode(currentMode?: UsageMode): Promise<PromptResult<UsageMode>> {
  const promptConfig = PromptFactory.createUsageModePrompt(currentMode);
  const { usageMode } = await prompts(promptConfig);

  return {
    value: usageMode,
    cancelled: !usageMode,
  };
}

export async function promptUILanguage(
  currentLanguage?: Language
): Promise<PromptResult<Language>> {
  const promptConfig = PromptFactory.createLanguagePrompt(currentLanguage, false);
  const { language } = await prompts(promptConfig);

  return {
    value: language,
    cancelled: !language,
  };
}

export async function promptCommitLanguage(
  currentLanguage?: Language
): Promise<PromptResult<Language>> {
  const promptConfig = PromptFactory.createLanguagePrompt(currentLanguage, true);
  const { language } = await prompts(promptConfig);

  return {
    value: language,
    cancelled: !language,
  };
}

export async function validateApiKey(provider: Provider, apiKey: string): Promise<boolean> {
  spinner(t("messages.validatingKey"), "start", true);

  const result = await validateAndFetchModels(provider, apiKey);

  if (result.isValid) {
    spinner(t("messages.keyValidated"), "succeed");
    return true;
  } else {
    spinner(t("messages.keyValidationFailed"), "fail");
    message(t("messages.invalidKeyOrConnection"), { type: "warning", variant: "title" });

    if (result.error instanceof Error) {
      if (
        result.error.message.toLowerCase().includes("401") ||
        result.error.message.toLowerCase().includes("unauthorized") ||
        result.error.message.toLowerCase().includes("invalid")
      ) {
        message(color("gray", t("errors.network.invalidKey")));
      } else if (
        result.error.message.toLowerCase().includes("network") ||
        result.error.message.toLowerCase().includes("fetch")
      ) {
        message(color("gray", t("errors.network.checkConnection")));
      } else {
        message(color("gray", t("debug.error", { message: result.error.message })));
      }
    }

    return false;
  }
}

export function formatModelChoice(model: { id: string; name?: string }): {
  title: string;
  value: string;
} {
  return {
    title: model.name || model.id,
    value: model.id,
  };
}

function formatApiKeyForDisplay(apiKey: string): string {
  return ApiKeyFormatter.formatForDisplay(apiKey);
}

export function formatBooleanAsYesNo(value: boolean): string {
  return value ? t("labels.yes") : t("labels.no");
}

export function formatMenuOption(text: string, symbolName?: SymbolType): string {
  return symbolName ? dim(`${symbol(symbolName)} ${text}`) : dim(text);
}

export async function manageCustomRules(
  currentRules: string[] = []
): Promise<PromptResult<string[]>> {
  const rules = [...currentRules];

  while (true) {
    const rulesList = CustomRuleManager.formatRulesList(rules);
    message(`${t("messages.currentRules")}\n${rulesList}`);

    const { action } = await prompts({
      type: "select",
      name: "action",
      message: t("prompts.whatToDo"),
      choices: [
        { title: formatMenuOption(t("actions.addRule")), value: "add" },
        {
          title: formatMenuOption(t("actions.removeRule")),
          value: "remove",
          disabled: rules.length === 0,
        },
        { title: dim(`← ${t("actions.return")}`), value: "done" },
      ],
      hint: getPromptHint("SELECT"),
    });

    if (!action || action === "done") {
      break;
    }

    if (action === "add") {
      const newRule = await CustomRuleManager.promptAddRule(rules);
      if (newRule) {
        rules.push(newRule);
        message(t("messages.addedRule", { rule: newRule }), { type: "success", variant: "title" });
      }
    }

    if (action === "remove") {
      const ruleToRemove = await CustomRuleManager.selectRuleToRemove(rules);
      if (ruleToRemove) {
        const index = rules.indexOf(ruleToRemove);
        if (index > -1) {
          rules.splice(index, 1);
          message(t("messages.removedRule", { rule: ruleToRemove }), {
            type: "success",
            variant: "title",
          });
        }
      }
    }
  }

  return {
    value: rules,
    cancelled: false,
  };
}

export function displayConfiguration(configuration: Config): void {
  const items: FilePathItem[] = [];

  items.push({
    label: t("labels.provider"),
    value: color("green", getProviderDisplayName(configuration.provider)),
  });

  items.push({
    label: t("labels.apiKey"),
    value: color("gray", formatApiKeyForDisplay(configuration.apiKey || "")),
  });

  items.push({
    label: t("labels.model"),
    value: color("magenta", configuration.model),
  });

  const maxLength = configuration.maxCommitLength || DEFAULTS.MAX_COMMIT_LENGTH;
  const choicesCount = configuration.commitChoicesCount || DEFAULTS.COMMIT_CHOICES_COUNT;
  items.push({
    label: t("labels.limits"),
    value: `${color("cyan", String(maxLength))} chars, ${color(
      "cyan",
      String(choicesCount)
    )} choices`,
  });

  if (configuration.usageMode !== undefined || configuration.completionAction !== undefined) {
    const usageMode =
      configuration.usageMode || configuration.completionAction || UsageMode.CLIPBOARD;
    items.push({
      label: t("labels.usageMode"),
      value: color("cyan", getUsageModeDisplayText(usageMode)),
    });
  }

  if (configuration.redactSensitiveData !== undefined) {
    const isEnabled = configuration.redactSensitiveData !== false;
    items.push({
      label: t("labels.security"),
      value: isEnabled ? color("green", t("labels.enabled")) : color("red", t("labels.disabled")),
    });
  }

  if (configuration.uiLanguage || configuration.commitLanguage) {
    const languages = [];
    if (configuration.uiLanguage) {
      languages.push(`UI: ${color("cyan", getLanguageDisplayName(configuration.uiLanguage))}`);
    }
    if (configuration.commitLanguage) {
      languages.push(
        `Commits: ${color("cyan", getLanguageDisplayName(configuration.commitLanguage))}`
      );
    }
    items.push({ label: t("labels.languages"), value: languages.join(", ") });
  }

  if (configuration.customRules && configuration.customRules.length > 0) {
    const count = configuration.customRules.length;
    items.push({
      label: t("labels.customRules"),
      value: color(
        "magenta",
        count === 1 ? t("labels.rules_one", { count }) : t("labels.rules_other", { count })
      ),
    });
  }

  items.sort((a, b) => b.label.length - a.label.length);

  message("", { items });
}

export async function promptCustomRules(
  currentCustomRules: string[] = []
): Promise<PromptResult<string[]>> {
  const { wantCustomRules } = await prompts({
    type: "confirm",
    name: "wantCustomRules",
    message: t("prompts.addCustomRules"),
    initial: currentCustomRules.length > 0,
    hint: t("hints.optional"),
  });

  if (wantCustomRules === undefined) {
    return {
      value: undefined,
      cancelled: true,
    };
  }

  if (!wantCustomRules) {
    return {
      value: [],
      cancelled: false,
    };
  }

  return await manageCustomRules(currentCustomRules);
}
