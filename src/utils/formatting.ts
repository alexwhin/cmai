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
      return "Español";
    case Language.FR:
      return "Français";
    case Language.DE:
      return "Deutsch";
    case Language.IT:
      return "Italiano";
    case Language.PT:
      return "Português";
    case Language.NL:
      return "Nederlands";
    case Language.RU:
      return "Русский";
    case Language.JA:
      return "日本語";
    case Language.ZH:
      return "中文";
    case Language.KO:
      return "한국어";
    case Language.AR:
      return "العربية";
    case Language.HI:
      return "हिन्दी";
    case Language.TR:
      return "Türkçe";
    case Language.PL:
      return "Polski";
    case Language.SV:
      return "Svenska";
    case Language.DA:
      return "Dansk";
    case Language.NO:
      return "Norsk";
    case Language.FI:
      return "Suomi";
    case Language.CS:
      return "Čeština";
    case Language.HE:
      return "עברית";
    case Language.TH:
      return "ไทย";
    case Language.VI:
      return "Tiếng Việt";
    case Language.ID:
      return "Bahasa Indonesia";
    case Language.UK:
      return "Українська";
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
