import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { CommitCandidate, GitContext, AIProvider, TokenUsage } from "../../types/index.js";
import {
  getCommitGenerationPrompt,
  formatRecentCommitsSection,
  formatRegenerationNote,
  formatCustomRulesSection,
  formatLanguageRule,
  formatCommitlintRulesSection,
} from "./prompts.js";
import {
  InvalidResponseObjectError,
  MissingCommitsArrayError,
  EmptyCommitsArrayError,
  NoValidCommitMessagesError,
  FailedToParseCommitMessagesError,
  TimeoutError,
  createError,
  ModelRequiredError,
} from "../../utils/errors.js";
import { DEFAULTS, API_TIMEOUT_MS, GIT } from "../../constants.js";
import { message } from "../../utils/ui-utils.js";
import { t } from "../../utils/i18n.js";
import {
  isString,
  isRecord,
  hasProperty,
  isArray,
  isNonEmptyString,
  isJSONString,
  isNumber,
} from "../../utils/guards.js";
import { trimTrailingChars } from "../../utils/api-helpers.js";

export abstract class LangChainBaseProvider implements AIProvider {
  protected model: BaseLanguageModel;
  private lastTokenUsage: TokenUsage | null = null;

  constructor(
    protected apiKey: string,
    protected modelName: string,
    protected maxCommitLength: number = DEFAULTS.MAX_COMMIT_LENGTH,
    protected commitChoicesCount: number = DEFAULTS.COMMIT_CHOICES_COUNT,
    protected customRules?: string[],
    protected commitLanguage: string = DEFAULTS.COMMIT_LANGUAGE
  ) {
    this.model = this.createModel();
  }

  abstract createModel(): BaseLanguageModel;

  protected validateModelName(): void {
    if (!this.modelName) {
      throw new ModelRequiredError();
    }
  }

  async generateCandidates(context: GitContext): Promise<CommitCandidate[]> {
    try {
      const promptText = await getCommitGenerationPrompt().format({
        recentCommitsSection: formatRecentCommitsSection(context.recentCommits),
        regenerationNote: formatRegenerationNote(context.regenerationAttempts),
        customRulesSection: formatCustomRulesSection(this.customRules),
        commitlintRulesSection: formatCommitlintRulesSection(context.commitlintRules),
        branch: context.branch,
        files: context.stagedFiles.join(", "),
        difference: context.difference.substring(0, GIT.DIFF_TRUNCATION_LIMIT),
        maxCommitLength: this.maxCommitLength,
        commitChoicesCount: this.commitChoicesCount,
        languageRule: formatLanguageRule(this.commitLanguage),
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError());
        }, API_TIMEOUT_MS);
      });

      const response = await Promise.race([this.model.invoke(promptText), timeoutPromise]);

      this.extractTokenUsage(response);

      let content: string = "";
      if (isString(response)) {
        content = response;
      } else if (isRecord(response) && hasProperty(response, "content")) {
        if (isString(response.content)) {
          content = response.content;
        } else if (isArray(response.content)) {
          content = response.content
            .map((item) => {
              if (isString(item)) {
                return item;
              }
              if (isRecord(item) && hasProperty(item, "text") && isString(item.text)) {
                return item.text;
              }
              return "";
            })
            .join("");
        }
      }

      return this.parseTextResponse(content);
    } catch (error) {
      throw createError(error, "Provider error: Unknown error occurred");
    }
  }

  public buildPrompt(context: GitContext): string {
    const formatted = {
      recentCommitsSection: formatRecentCommitsSection(context.recentCommits),
      regenerationNote: formatRegenerationNote(context.regenerationAttempts),
      customRulesSection: formatCustomRulesSection(this.customRules),
      commitlintRulesSection: formatCommitlintRulesSection(context.commitlintRules),
      branch: context.branch,
      files: context.stagedFiles.join(", "),
      difference: context.difference.substring(0, 3000),
      maxCommitLength: this.maxCommitLength,
      commitChoicesCount: this.commitChoicesCount,
      languageRule: formatLanguageRule(this.commitLanguage),
    };

    const { template } = getCommitGenerationPrompt();
    let prompt = isString(template) ? template : String(template);

    Object.entries(formatted).forEach(([key, value]) => {
      prompt = prompt.replace(new RegExp(`{${key}}`, "g"), String(value));
    });

    return prompt;
  }

  protected parseTextResponse(text: string): CommitCandidate[] {
    try {
      let cleanText = text.trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/```json\s*/, "").replace(/```\s*$/, "");
      }
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/```\s*/, "").replace(/```\s*$/, "");
      }

      if (!isJSONString(cleanText)) {
        throw new InvalidResponseObjectError();
      }
      const response = JSON.parse(cleanText);

      if (!isRecord(response)) {
        throw new InvalidResponseObjectError();
      }

      if (!hasProperty(response, "commits") || !isArray(response.commits)) {
        throw new MissingCommitsArrayError();
      }

      if (response.commits.length === 0) {
        throw new EmptyCommitsArrayError();
      }

      const commits = response.commits
        .filter((commit: unknown): commit is string => isNonEmptyString(commit))
        .slice(0, this.commitChoicesCount)
        .map((commit: string) => {
          const cleanedCommit = commit.trim();
          return trimTrailingChars(cleanedCommit, ["."]);
        })
        .filter((commit: string) => commit.length <= this.maxCommitLength);

      if (commits.length === 0) {
        throw new NoValidCommitMessagesError();
      }

      return commits;
    } catch (error) {
      message(
        t("ai.jsonParsingFailed", {
          error:
            error instanceof Error
              ? error.message
              : t("errors.unknown", { message: String(error) }),
        }),
        { type: "warning", variant: "title" }
      );

      const lines = text
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line) => {
          if (line.length === 0) {
            return false;
          }
          if (line.startsWith("-")) {
            return false;
          }
          if (line.startsWith("Here are")) {
            return false;
          }
          if (line.includes("commit messages")) {
            return false;
          }
          if (line.includes("describing")) {
            return false;
          }
          if (/^\d+\./.test(line)) {
            return false;
          }
          if (line === "[" || line === "]" || line === "{" || line === "}") {
            return false;
          }
          if (line.includes('"commits"') || line.includes("'commits'")) {
            return false;
          }
          return (
            line.includes(":") ||
            line.match(/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)/)
          );
        })
        .slice(0, this.commitChoicesCount);

      if (lines.length === 0) {
        throw new FailedToParseCommitMessagesError(error instanceof Error ? error : undefined);
      }

      return lines
        .map((line: string) => {
          let cleanedLine = line;
          if (
            (line.startsWith('"') && line.endsWith('"')) ||
            (line.startsWith("'") && line.endsWith("'"))
          ) {
            cleanedLine = line.slice(1, -1);
          }

          cleanedLine = trimTrailingChars(cleanedLine, [".", ","]);
          return cleanedLine.trim();
        })
        .filter((commit: string) => commit.length <= this.maxCommitLength);
    }
  }

  protected extractTokenUsage(response: unknown): void {
    this.lastTokenUsage = null;

    if (isRecord(response) && hasProperty(response, "response_metadata")) {
      const metadata = response.response_metadata;

      if (isRecord(metadata)) {
        if (hasProperty(metadata, "tokenUsage") && isRecord(metadata.tokenUsage)) {
          const tokenUsage = metadata.tokenUsage;
          if (
            hasProperty(tokenUsage, "promptTokens") &&
            isNumber(tokenUsage.promptTokens) &&
            hasProperty(tokenUsage, "completionTokens") &&
            isNumber(tokenUsage.completionTokens) &&
            hasProperty(tokenUsage, "totalTokens") &&
            isNumber(tokenUsage.totalTokens)
          ) {
            this.lastTokenUsage = {
              promptTokens: tokenUsage.promptTokens,
              completionTokens: tokenUsage.completionTokens,
              totalTokens: tokenUsage.totalTokens,
            };
          }
        } else if (hasProperty(metadata, "usage") && isRecord(metadata.usage)) {
          const usage = metadata.usage;
          if (
            hasProperty(usage, "input_tokens") &&
            isNumber(usage.input_tokens) &&
            hasProperty(usage, "output_tokens") &&
            isNumber(usage.output_tokens)
          ) {
            this.lastTokenUsage = {
              promptTokens: usage.input_tokens,
              completionTokens: usage.output_tokens,
              totalTokens: usage.input_tokens + usage.output_tokens,
            };
          }
        }
      }
    }
  }

  getLastTokenUsage(): TokenUsage | null {
    return this.lastTokenUsage;
  }
}
