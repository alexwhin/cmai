export enum Provider {
  OPENAI = "OPENAI",
  ANTHROPIC = "ANTHROPIC",
  OLLAMA = "OLLAMA",
  GEMINI = "GEMINI",
}

export enum UsageMode {
  TERMINAL = "TERMINAL",
  COMMIT = "COMMIT",
  CLIPBOARD = "CLIPBOARD",
}

export enum Language {
  EN = "en",
  ES = "es",
  FR = "fr",
  DE = "de",
  IT = "it",
  PT = "pt",
  NL = "nl",
  RU = "ru",
  JA = "ja",
  ZH = "zh",
  KO = "ko",
  AR = "ar",
  HI = "hi",
  TR = "tr",
  PL = "pl",
  SV = "sv",
  DA = "da",
  NO = "no",
  FI = "fi",
  CS = "cs",
  HE = "he",
  TH = "th",
  VI = "vi",
  ID = "id",
  UK = "uk",
}

export interface Config {
  provider: Provider;
  apiKey?: string;
  model: string;
  maxCommitLength?: number;
  usageMode?: UsageMode;
  completionAction?: UsageMode;
  commitChoicesCount?: number;
  redactSensitiveData?: boolean;
  customRules?: string[];
  uiLanguage?: Language;
  commitLanguage?: Language;
}

export type CommitCandidate = string;

export interface GitContext {
  stagedFiles: string[];
  branch: string;
  difference: string;
  recentCommits?: string[];
  regenerationAttempts?: number;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AIProvider {
  generateCandidates(context: GitContext): Promise<CommitCandidate[]>;
  buildPrompt(context: GitContext): string;
  getLastTokenUsage(): TokenUsage | null;
}
