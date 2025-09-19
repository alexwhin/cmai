import { Provider, UsageMode, Language } from "../types/index.js";
import { t } from "./i18n.js";

export function getProviderDisplayName(provider: string | Provider): string {
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case Provider.OPENAI.toLowerCase():
      return t("providers.openai");
    case Provider.ANTHROPIC.toLowerCase():
      return t("providers.anthropic");
    case Provider.OLLAMA.toLowerCase():
      return t("providers.ollama");
    case Provider.GEMINI.toLowerCase():
      return t("providers.gemini");
    default:
      return provider.toString();
  }
}

export function getUsageModeChoices(): Array<{
  title: string;
  value: UsageMode;
  description: string;
}> {
  return [
    {
      title: t("usageModes.terminal.name"),
      value: UsageMode.TERMINAL,
      description: t("usageModes.terminal.description"),
    },
    {
      title: t("usageModes.interactive.name"),
      value: UsageMode.COMMIT,
      description: t("usageModes.interactive.description"),
    },
    {
      title: t("usageModes.automatic.name"),
      value: UsageMode.CLIPBOARD,
      description: t("usageModes.automatic.description"),
    },
  ];
}

export function getLanguageDisplayName(language: Language): string {
  switch (language) {
    case Language.EN:
      return t("languages.english");
    case Language.ES:
      return t("languages.spanish");
    case Language.FR:
      return t("languages.french");
    case Language.DE:
      return t("languages.german");
    case Language.IT:
      return t("languages.italian");
    case Language.PT:
      return t("languages.portuguese");
    case Language.NL:
      return t("languages.dutch");
    case Language.RU:
      return t("languages.russian");
    case Language.JA:
      return t("languages.japanese");
    case Language.ZH:
      return t("languages.chinese");
    case Language.KO:
      return t("languages.korean");
    case Language.AR:
      return t("languages.arabic");
    case Language.HI:
      return t("languages.hindi");
    case Language.TR:
      return t("languages.turkish");
    case Language.PL:
      return t("languages.polish");
    case Language.SV:
      return t("languages.swedish");
    case Language.DA:
      return t("languages.danish");
    case Language.NO:
      return t("languages.norwegian");
    case Language.FI:
      return t("languages.finnish");
    case Language.CS:
      return t("languages.czech");
    case Language.HE:
      return t("languages.hebrew");
    case Language.TH:
      return t("languages.thai");
    case Language.VI:
      return t("languages.vietnamese");
    case Language.ID:
      return t("languages.indonesian");
    case Language.UK:
      return t("languages.ukrainian");
    default:
      return language;
  }
}

export function getLanguageChoices(): Array<{ title: string; value: Language }> {
  const languages = Object.values(Language);
  const english = Language.EN;
  const otherLanguages = languages.filter((lang) => lang !== english);

  const sortedOthers = otherLanguages.sort((a, b) => {
    const nameA = getLanguageDisplayName(a);
    const nameB = getLanguageDisplayName(b);
    return nameA.localeCompare(nameB);
  });

  const orderedLanguages = [english, ...sortedOthers];

  return orderedLanguages.map((lang) => ({
    title: getLanguageDisplayName(lang),
    value: lang,
  }));
}

export function getUILanguageChoices(): Array<{ title: string; value: Language }> {
  return [{ title: getLanguageDisplayName(Language.EN), value: Language.EN }];
}
