import { symbol, errorWithDebug, message } from "./ui-utils.js";
import { dim } from "./style.js";
import { t } from "./i18n.js";
import { exit } from "./system-utils.js";

export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly isRetryable: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    options?: {
      statusCode?: number;
      isRetryable?: boolean;
      context?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = options?.statusCode;
    this.isRetryable = options?.isRetryable ?? false;
    this.context = options?.context;

    if (options?.cause) {
      this.cause = options.cause;
    }

    Object.setPrototypeOf(this, new.target.prototype);

    Error.captureStackTrace(this, this.constructor);
  }
}

export class GitError extends BaseError {
  constructor(
    message: string,
    code: string = "GIT_ERROR",
    options?: ConstructorParameters<typeof BaseError>[2]
  ) {
    super(message, code, options);
  }
}

export class GitNotInstalledError extends GitError {
  constructor() {
    super(t("errors.system.commandNotFound", { command: "git" }), "GIT_NOT_INSTALLED");
  }
}

export class NotInGitRepositoryError extends GitError {
  constructor() {
    super(t("errors.git.notARepository"), "NOT_IN_GIT_REPO");
  }
}

export class NoStagedFilesError extends GitError {
  constructor() {
    super(t("errors.git.noStagedFiles"), "NO_STAGED_FILES");
  }
}

export class ConfigurationError extends BaseError {
  constructor(
    message: string,
    code: string = "CONFIG_ERROR",
    options?: ConstructorParameters<typeof BaseError>[2]
  ) {
    super(message, code, options);
  }
}

export class ConfigurationNotFoundError extends ConfigurationError {
  constructor(path?: string) {
    const message = path? t("errors.configuration.notFound", { path }): t("errors.configuration.notFoundNoPath");
    super(message, "CONFIG_NOT_FOUND");
  }
}

export class InvalidConfigurationError extends ConfigurationError {
  constructor(errors: string[]) {
    const message = t("errors.configuration.invalid", { message: errors.join(", ") });
    super(message, "CONFIG_INVALID", {
      context: { errors },
    });
  }
}

export class APIError extends BaseError {
  public readonly provider?: string;

  constructor(
    message: string,
    code: string = "API_ERROR",
    options?: ConstructorParameters<typeof BaseError>[2] & { provider?: string }
  ) {
    super(message, code, options);
    this.provider = options?.provider;
  }
}

export class UnknownProviderError extends APIError {
  constructor(provider: string) {
    super(t("errors.configuration.unsupportedProvider", { provider }), "UNKNOWN_PROVIDER", {
      provider,
      context: { provider },
    });
  }
}

export class InvalidAPIKeyError extends APIError {
  constructor(provider: string) {
    super(t("errors.api.authenticationFailed"), "INVALID_API_KEY", {
      provider,
      statusCode: 401,
      context: { provider },
    });
  }
}

export class APIKeyNotConfiguredError extends APIError {
  constructor(provider: string) {
    super(t("errors.configuration.missingApiKey", { provider }), "API_KEY_NOT_CONFIGURED", {
      provider,
      context: { provider },
    });
  }
}

export class RateLimitError extends APIError {
  constructor(provider: string, retryAfter?: number) {
    super(t("errors.api.rateLimitExceeded"), "RATE_LIMIT", {
      provider,
      statusCode: 429,
      isRetryable: true,
      context: { provider, retryAfter },
    });
  }
}

export class QuotaExceededError extends APIError {
  constructor(provider: string) {
    super(t("errors.api.rateLimitExceeded"), "QUOTA_EXCEEDED", {
      provider,
      statusCode: 429,
      context: { provider },
    });
  }
}

export class NetworkError extends APIError {
  constructor(message: string, originalError?: Error) {
    super(message, "NETWORK_ERROR", {
      isRetryable: true,
      cause: originalError,
    });
  }
}

export class ConnectionRefusedError extends NetworkError {
  constructor(provider?: string) {
    const message = provider? t("errors.network.connectionRefusedWithProvider", { provider }): t("errors.network.connectionRefusedNoProvider");
    super(message);
  }
}

export class TimeoutError extends NetworkError {
  constructor(_provider?: string, seconds: number = 60) {
    const message = t("errors.api.timeout", { seconds });
    super(message);
  }
}

export class ServerNotFoundError extends NetworkError {
  constructor(provider?: string) {
    const message = provider? t("errors.network.serverNotFoundWithProvider", { provider }): t("errors.network.serverNotFoundNoProvider");
    super(message);
  }
}

export class ModelError extends APIError {
  constructor(
    message: string,
    code: string = "MODEL_ERROR",
    options?: ConstructorParameters<typeof APIError>[2]
  ) {
    super(message, code, options);
  }
}

export class ModelNotFoundError extends ModelError {
  constructor(model: string, provider: string) {
    super(t("errors.model.unsupportedModel", { model }), "MODEL_NOT_FOUND", {
      provider,
      context: { model, provider },
    });
  }
}

export class ModelRequiredError extends ModelError {
  constructor() {
    super(t("ai.modelRequired"), "MODEL_REQUIRED");
  }
}

export class NoSuitableModelsError extends ModelError {
  constructor(provider: string) {
    super(t("ai.noSuitableModels", { provider }), "NO_SUITABLE_MODELS", {
      provider,
      context: { provider },
    });
  }
}

export class ResponseError extends APIError {
  constructor(
    message: string,
    code: string = "RESPONSE_ERROR",
    options?: ConstructorParameters<typeof APIError>[2]
  ) {
    super(message, code, options);
  }
}

export class InvalidResponseFormatError extends ResponseError {
  constructor(provider?: string) {
    super(t("ai.invalidResponseFormat"), "INVALID_RESPONSE_FORMAT", { provider });
  }
}

export class InvalidResponseObjectError extends ResponseError {
  constructor() {
    super(t("ai.responseNotObject"), "INVALID_RESPONSE_OBJECT");
  }
}

export class MissingCommitsArrayError extends ResponseError {
  constructor() {
    super(t("ai.missingCommitsArray"), "MISSING_COMMITS_ARRAY");
  }
}

export class EmptyCommitsArrayError extends ResponseError {
  constructor() {
    super(t("ai.commitsArrayEmpty"), "EMPTY_COMMITS_ARRAY");
  }
}

export class NoValidCommitMessagesError extends ResponseError {
  constructor() {
    super(t("ai.noValidCommitMessages"), "NO_VALID_COMMIT_MESSAGES");
  }
}

export class FailedToParseCommitMessagesError extends ResponseError {
  constructor(originalError?: Error) {
    super(t("ai.failedToParseCommits"), "PARSE_COMMIT_MESSAGES_FAILED", {
      cause: originalError,
    });
  }
}

export class SystemError extends BaseError {
  constructor(
    message: string,
    code: string = "SYSTEM_ERROR",
    options?: ConstructorParameters<typeof BaseError>[2]
  ) {
    super(message, code, options);
  }
}

export class ClipboardError extends SystemError {
  constructor(message: string, originalError?: Error) {
    super(message, "CLIPBOARD_ERROR", { cause: originalError });
  }
}

export class CannotCopyEmptyTextError extends ClipboardError {
  constructor() {
    super(t("errors.system.cannotCopyEmptyText"));
  }
}

export function createError(error: unknown, defaultMessage?: string): BaseError {
  if (error instanceof BaseError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("api key not configured") || message.includes("api key is required")) {
      return new APIKeyNotConfiguredError("unknown");
    }

    if (message.includes("enotfound") || message.includes("getaddrinfo")) {
      return new ServerNotFoundError();
    }

    if (message.includes("econnrefused")) {
      return new ConnectionRefusedError();
    }

    if (message.includes("etimedout") || message.includes("timeout")) {
      return new TimeoutError();
    }

    return new SystemError(t("errors.unknown", { message: error.message }), "UNKNOWN_ERROR", {
      cause: error,
    });
  }

  return new SystemError(
    t("errors.unknown", {
      message: String(error || defaultMessage || t("errors.system.defaultError")),
    }),
    "UNKNOWN_ERROR",
    { cause: error }
  );
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof BaseError) {
    return error.isRetryable;
  }

  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    if (
      errorMessage.includes("enotfound") ||
      errorMessage.includes("econnrefused") ||
      errorMessage.includes("etimedout") ||
      errorMessage.includes("timeout")
    ) {
      return true;
    }

    if (errorMessage.includes("rate limit") || errorMessage.includes("rate_limit")) {
      return true;
    }
  }

  return false;
}

export function formatError(err: unknown, _provider: string, showDebug: boolean = false): string {
  const error = createError(err);
  const message = getErrorMessage(error);
  const lines: string[] = [];

  lines.push(`${symbol("error")} ${message}`);

  if (showDebug && err) {
    lines.push("");
    lines.push(dim(t("debug.information")));

    if (err instanceof Error) {
      lines.push(dim(`  ${t("debug.error", { message: err.message })}`));
      if (err.stack) {
        lines.push(dim(`  ${t("debug.stackTrace")}`));
        err.stack
          .split("\n")
          .slice(1, 4)
          .forEach((line: string) => {
            lines.push(dim(`    ${line.trim()}`));
          });
      }
    } else {
      lines.push(dim(`  ${t("debug.rawError", { error: JSON.stringify(err, null, 2) })}`));
    }
  }

  return lines.join("\n");
}

function getErrorMessage(error: BaseError | Error): string {
  if (error instanceof BaseError) {
    return error.message;
  }

  return error instanceof Error? error.message: t("errors.unknown", { message: "An unexpected error occurred" });
}

export function handleError(errorInstance: unknown, showDebug: boolean = false): void {
  if (errorInstance instanceof Error && errorInstance.message.includes("API error")) {
    let provider = "unknown";
    if (errorInstance.message.includes("OpenAI")) {
      provider = "openai";
    } else if (errorInstance.message.includes("Anthropic")) {
      provider = "anthropic";
    }

    errorWithDebug(formatError(errorInstance, provider, showDebug));
  } else {
    const errorMessage =
      errorInstance instanceof Error? errorInstance.message: t("errors.unknown", { message: "Unknown error" });
    message(errorMessage, { type: "error", variant: "title" });

    if (showDebug && errorInstance instanceof Error && errorInstance.stack) {
      message(dim("\n" + t("debug.stackTrace")));
      message(dim(errorInstance.stack));
    }
  }

  exit(1);
}
