import { Provider, UsageMode, Language } from "../types/index.js";
import { t } from "./i18n.js";
import { sortByKey } from "../utils/api-helpers.js";

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

const LANGUAGE_KEYS: Record<Language, string> = {
  [Language.EN]: "languages.english",
  [Language.ES]: "languages.spanish",
  [Language.FR]: "languages.french",
  [Language.DE]: "languages.german",
  [Language.IT]: "languages.italian",
  [Language.PT]: "languages.portuguese",
  [Language.NL]: "languages.dutch",
  [Language.RU]: "languages.russian",
  [Language.JA]: "languages.japanese",
  [Language.ZH]: "languages.chinese",
  [Language.KO]: "languages.korean",
  [Language.AR]: "languages.arabic",
  [Language.HI]: "languages.hindi",
  [Language.TR]: "languages.turkish",
  [Language.PL]: "languages.polish",
  [Language.SV]: "languages.swedish",
  [Language.DA]: "languages.danish",
  [Language.NO]: "languages.norwegian",
  [Language.FI]: "languages.finnish",
  [Language.CS]: "languages.czech",
  [Language.HE]: "languages.hebrew",
  [Language.TH]: "languages.thai",
  [Language.VI]: "languages.vietnamese",
  [Language.ID]: "languages.indonesian",
  [Language.UK]: "languages.ukrainian",
};

export function getLanguageDisplayName(language: Language): string {
  const key = LANGUAGE_KEYS[language];
  return key ? t(key) : language;
}

export function getLanguageChoices(): Array<{ title: string; value: Language }> {
  const languages = Object.values(Language);
  const english = Language.EN;
  const otherLanguages = languages.filter((lang) => lang !== english);

  const languagesWithNames = otherLanguages.map(lang => ({
    lang,
    name: getLanguageDisplayName(lang)
  }));
  
  const sortedOthers = sortByKey(languagesWithNames, "name");
  const sortedLanguages = sortedOthers.map(item => item.lang);

  const orderedLanguages = [english, ...sortedLanguages];

  return orderedLanguages.map((lang) => ({
    title: getLanguageDisplayName(lang),
    value: lang,
  }));
}

export function getUILanguageChoices(): Array<{ title: string; value: Language }> {
  return [{ title: getLanguageDisplayName(Language.EN), value: Language.EN }];
}

export function getProviderChoices(): Array<{ title: string; value: Provider }> {
  return [
    { title: getProviderDisplayName(Provider.OPENAI), value: Provider.OPENAI },
    { title: getProviderDisplayName(Provider.ANTHROPIC), value: Provider.ANTHROPIC },
    { title: getProviderDisplayName(Provider.OLLAMA), value: Provider.OLLAMA },
    { title: getProviderDisplayName(Provider.GEMINI), value: Provider.GEMINI },
  ];
}
