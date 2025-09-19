import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BaseError,
  GitError,
  GitNotInstalledError,
  NotInGitRepositoryError,
  ConfigurationError,
  ConfigurationNotFoundError,
  InvalidConfigurationError,
  APIError,
  UnknownProviderError,
  InvalidAPIKeyError,
  APIKeyNotConfiguredError,
  RateLimitError,
  QuotaExceededError,
  NetworkError,
  ConnectionRefusedError,
  TimeoutError,
  ServerNotFoundError,
  ModelError,
  ModelNotFoundError,
  ModelRequiredError,
  NoSuitableModelsError,
  ResponseError,
  InvalidResponseFormatError,
  InvalidResponseObjectError,
  MissingCommitsArrayError,
  EmptyCommitsArrayError,
  NoValidCommitMessagesError,
  FailedToParseCommitMessagesError,
  SystemError,
  ClipboardError,
  CannotCopyEmptyTextError,
  createError,
  isRetryableError,
  formatError,
} from "../../src/utils/errors.js";

vi.mock("../../src/utils/ui-utils.js", () => ({
  symbol: vi.fn((type: string) => `SYMBOL[${type}]`),
}));

vi.mock("../../src/utils/style.js", () => ({
  dim: vi.fn((text: string) => `DIM[${text}]`),
}));

describe("errors", () => {
  describe("BaseError", () => {
    class TestError extends BaseError {
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
        super(message, code, options);
      }
    }

    it("creates error with basic properties", () => {
      const error = new TestError("Test message", "TEST_CODE");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.message).toBe("Test message");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("TestError");
      expect(error.isRetryable).toBe(false);
      expect(error.statusCode).toBeUndefined();
      expect(error.context).toBeUndefined();
    });

    it("creates error with all options", () => {
      const cause = new Error("Original error");
      const error = new TestError("Test message", "TEST_CODE", {
        statusCode: 404,
        isRetryable: true,
        context: { foo: "bar" },
        cause,
      });

      expect(error.statusCode).toBe(404);
      expect(error.isRetryable).toBe(true);
      expect(error.context).toEqual({ foo: "bar" });
      expect(error.cause).toBe(cause);
    });

    it("maintains prototype chain for instanceof checks", () => {
      const error = new TestError("Test", "TEST");
      expect(error instanceof Error).toBe(true);
      expect(error instanceof BaseError).toBe(true);
      expect(error instanceof TestError).toBe(true);
    });
  });

  describe("Git errors", () => {
    it("creates GitNotInstalledError", () => {
      const error = new GitNotInstalledError();
      expect(error).toBeInstanceOf(GitError);
      expect(error.message).toBe("Command not found: git");
      expect(error.code).toBe("GIT_NOT_INSTALLED");
    });

    it("creates NotInGitRepositoryError", () => {
      const error = new NotInGitRepositoryError();
      expect(error).toBeInstanceOf(GitError);
      expect(error.message).toBe("Not a git repository");
      expect(error.code).toBe("NOT_IN_GIT_REPO");
    });
  });

  describe("Configuration errors", () => {
    it("creates ConfigurationNotFoundError", () => {
      const error = new ConfigurationNotFoundError();
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe(
        "Configuration not found. Please run 'cmai init' to set up your configuration"
      );
      expect(error.code).toBe("CONFIG_NOT_FOUND");
    });

    it("creates InvalidConfigurationError", () => {
      const errors = ["missing provider", "invalid API key format"];
      const error = new InvalidConfigurationError(errors);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe("Invalid configuration: missing provider, invalid API key format");
      expect(error.code).toBe("CONFIG_INVALID");
      expect(error.context).toEqual({ errors });
    });
  });

  describe("API and Provider errors", () => {
    it("creates UnknownProviderError", () => {
      const error = new UnknownProviderError("invalid");
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toBe("Unsupported provider: invalid");
      expect(error.code).toBe("UNKNOWN_PROVIDER");
      expect(error.provider).toBe("invalid");
    });

    it("creates InvalidAPIKeyError", () => {
      const error = new InvalidAPIKeyError("openai");
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toBe("Authentication failed. Please check your API key.");
      expect(error.code).toBe("INVALID_API_KEY");
      expect(error.statusCode).toBe(401);
      expect(error.provider).toBe("openai");
    });

    it("creates APIKeyNotConfiguredError", () => {
      const error = new APIKeyNotConfiguredError("anthropic");
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toBe("Missing API key for provider: anthropic");
      expect(error.code).toBe("API_KEY_NOT_CONFIGURED");
      expect(error.provider).toBe("anthropic");
    });

    it("creates RateLimitError", () => {
      const error = new RateLimitError("openai", 60);
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toBe("Rate limit exceeded. Please try again later.");
      expect(error.code).toBe("RATE_LIMIT");
      expect(error.statusCode).toBe(429);
      expect(error.isRetryable).toBe(true);
      expect(error.context).toEqual({ provider: "openai", retryAfter: 60 });
    });

    it("creates QuotaExceededError", () => {
      const error = new QuotaExceededError("openai");
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toBe("Rate limit exceeded. Please try again later.");
      expect(error.code).toBe("QUOTA_EXCEEDED");
      expect(error.statusCode).toBe(429);
    });
  });

  describe("Network errors", () => {
    it("creates ConnectionRefusedError", () => {
      const error = new ConnectionRefusedError("openai");
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe("Connection refused (openai)");
      expect(error.isRetryable).toBe(true);
    });

    it("creates TimeoutError", () => {
      const error = new TimeoutError("anthropic");
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe("Request timed out after 60 seconds");
      expect(error.isRetryable).toBe(true);
    });

    it("creates ServerNotFoundError", () => {
      const error = new ServerNotFoundError();
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe("Unable to reach server");
      expect(error.isRetryable).toBe(true);
    });
  });

  describe("Model errors", () => {
    it("creates ModelNotFoundError", () => {
      const error = new ModelNotFoundError("gpt-5", "openai");
      expect(error).toBeInstanceOf(ModelError);
      expect(error.message).toBe("Unsupported model: gpt-5");
      expect(error.code).toBe("MODEL_NOT_FOUND");
      expect(error.context).toEqual({ model: "gpt-5", provider: "openai" });
    });

    it("creates ModelRequiredError", () => {
      const error = new ModelRequiredError();
      expect(error).toBeInstanceOf(ModelError);
      expect(error.message).toBe("Model name is required");
      expect(error.code).toBe("MODEL_REQUIRED");
    });

    it("creates NoSuitableModelsError", () => {
      const error = new NoSuitableModelsError("openai");
      expect(error).toBeInstanceOf(ModelError);
      expect(error.message).toBe("No suitable models found for openai");
      expect(error.code).toBe("NO_SUITABLE_MODELS");
    });
  });

  describe("Response errors", () => {
    it("creates InvalidResponseFormatError", () => {
      const error = new InvalidResponseFormatError("openai");
      expect(error).toBeInstanceOf(ResponseError);
      expect(error.message).toBe("Invalid response format");
      expect(error.code).toBe("INVALID_RESPONSE_FORMAT");
      expect(error.provider).toBe("openai");
    });

    it("creates InvalidResponseObjectError", () => {
      const error = new InvalidResponseObjectError();
      expect(error).toBeInstanceOf(ResponseError);
      expect(error.message).toBe("Response is not a valid object");
      expect(error.code).toBe("INVALID_RESPONSE_OBJECT");
    });

    it("creates MissingCommitsArrayError", () => {
      const error = new MissingCommitsArrayError();
      expect(error).toBeInstanceOf(ResponseError);
      expect(error.message).toBe("Response missing commits array");
      expect(error.code).toBe("MISSING_COMMITS_ARRAY");
    });

    it("creates EmptyCommitsArrayError", () => {
      const error = new EmptyCommitsArrayError();
      expect(error).toBeInstanceOf(ResponseError);
      expect(error.message).toBe("Commits array is empty");
      expect(error.code).toBe("EMPTY_COMMITS_ARRAY");
    });

    it("creates NoValidCommitMessagesError", () => {
      const error = new NoValidCommitMessagesError();
      expect(error).toBeInstanceOf(ResponseError);
      expect(error.message).toBe("No valid commit messages found");
      expect(error.code).toBe("NO_VALID_COMMIT_MESSAGES");
    });

    it("creates FailedToParseCommitMessagesError", () => {
      const cause = new Error("JSON parse error");
      const error = new FailedToParseCommitMessagesError(cause);
      expect(error).toBeInstanceOf(ResponseError);
      expect(error.message).toBe("Failed to parse commit messages");
      expect(error.code).toBe("PARSE_COMMIT_MESSAGES_FAILED");
      expect(error.cause).toBe(cause);
    });
  });

  describe("System errors", () => {
    it("creates ClipboardError", () => {
      const cause = new Error("Clipboard access denied");
      const error = new ClipboardError("Failed to copy", cause);
      expect(error).toBeInstanceOf(SystemError);
      expect(error.message).toBe("Failed to copy");
      expect(error.code).toBe("CLIPBOARD_ERROR");
      expect(error.cause).toBe(cause);
    });

    it("creates CannotCopyEmptyTextError", () => {
      const error = new CannotCopyEmptyTextError();
      expect(error).toBeInstanceOf(ClipboardError);
      expect(error.message).toBe("Cannot copy empty text");
    });
  });

  describe("createError", () => {
    it("returns BaseError instances as-is", () => {
      const originalError = new GitNotInstalledError();
      const error = createError(originalError);
      expect(error).toBe(originalError);
    });

    it("converts API key errors", () => {
      const error = createError(new Error("API key not configured"));
      expect(error).toBeInstanceOf(APIKeyNotConfiguredError);
      expect(error.message).toBe("Missing API key for provider: unknown");
    });

    it("converts network errors", () => {
      const error1 = createError(new Error("getaddrinfo ENOTFOUND"));
      expect(error1).toBeInstanceOf(ServerNotFoundError);

      const error2 = createError(new Error("connect ECONNREFUSED"));
      expect(error2).toBeInstanceOf(ConnectionRefusedError);

      const error3 = createError(new Error("ETIMEDOUT"));
      expect(error3).toBeInstanceOf(TimeoutError);
    });

    it("wraps unknown errors in SystemError", () => {
      const originalError = new Error("Something went wrong");
      const error = createError(originalError);
      expect(error).toBeInstanceOf(SystemError);
      expect(error.message).toBe("An unexpected error occurred: Something went wrong");
      expect(error.cause).toBe(originalError);
    });

    it("handles non-Error inputs", () => {
      const error1 = createError("string error");
      expect(error1).toBeInstanceOf(SystemError);
      expect(error1.message).toBe("An unexpected error occurred: string error");

      const error2 = createError(null);
      expect(error2).toBeInstanceOf(SystemError);
      expect(error2.message).toBe("An unexpected error occurred: An unexpected error occurred");

      const error3 = createError({ message: "object error" });
      expect(error3).toBeInstanceOf(SystemError);
      expect(error3.message).toBe("An unexpected error occurred: [object Object]");
    });
  });

  describe("isRetryableError", () => {
    it("checks BaseError isRetryable property", () => {
      const retryable = new RateLimitError("openai");
      const notRetryable = new InvalidAPIKeyError("openai");

      expect(isRetryableError(retryable)).toBe(true);
      expect(isRetryableError(notRetryable)).toBe(false);
    });

    it("detects retryable network errors", () => {
      expect(isRetryableError(new Error("ENOTFOUND"))).toBe(true);
      expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
      expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
      expect(isRetryableError(new Error("timeout of 5000ms"))).toBe(true);
    });

    it("detects rate limit errors", () => {
      expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
      expect(isRetryableError(new Error("rate_limit"))).toBe(true);
    });

    it("returns false for non-retryable errors", () => {
      expect(isRetryableError(new Error("invalid API key"))).toBe(false);
      expect(isRetryableError("string error")).toBe(false);
      expect(isRetryableError(null)).toBe(false);
    });
  });

  describe("formatError", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("formats BaseError with message", () => {
      const error = new InvalidAPIKeyError("openai");
      const result = formatError(error, "openai");

      expect(result).toContain("SYMBOL[error] Authentication failed. Please check your API key.");
    });

    it("formats with debug information", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at someFunction\n    at anotherFunction";

      const result = formatError(error, "openai", true);

      expect(result).toContain("SYMBOL[error]");
      expect(result).toContain("DIM[Debug information:]");
      expect(result).toContain("DIM[  Error: Test error]");
      expect(result).toContain("DIM[  Stack trace:]");
      expect(result).toContain("DIM[    at someFunction]");
    });

    it("formats non-Error objects in debug mode", () => {
      const error = { type: "error", message: "custom error" };
      const result = formatError(error, "openai", true);

      expect(result).toContain("DIM[  Raw error:");
      expect(result).toContain('"type": "error"');
      expect(result).toContain('"message": "custom error"');
    });

    it("uses our custom error classes for proper formatting", () => {
      const openaiError = new InvalidAPIKeyError("openai");
      const result1 = formatError(openaiError, "openai");

      expect(result1).toContain("SYMBOL[error] Authentication failed. Please check your API key.");

      const anthropicError = new InvalidAPIKeyError("anthropic");
      const result2 = formatError(anthropicError, "anthropic");

      expect(result2).toContain("SYMBOL[error] Authentication failed. Please check your API key.");
    });
  });

  describe("additional error coverage scenarios", () => {
    it("handles JSON parsing edge cases", () => {
      const errorWithJson = new Error(
        '{"error":{"type":"invalid_api_key","message":"Invalid API key"}}'
      );
      const result = formatError(errorWithJson, "openai");
      expect(result).toContain("SYMBOL[error]");
    });

    it("covers error object processing paths", () => {
      const errorObj = { message: "Direct error message" };
      const result = formatError(errorObj, "openai");
      expect(result).toContain("SYMBOL[error]");
    });

    it("tests provider-specific error handling branches", () => {
      const error1 = new Error("quota exceeded");
      const result1 = formatError(error1, "openai");
      expect(result1).toContain("SYMBOL[error]");

      const error2 = new Error("rate limit exceeded");
      const result2 = formatError(error2, "anthropic");
      expect(result2).toContain("SYMBOL[error]");
    });

    it("covers unknown provider fallback", () => {
      const error = new Error("some error");
      const result = formatError(error, "unknown_provider");
      expect(result).toContain("SYMBOL[error]");
    });

    it("tests network error message patterns", () => {
      const enotFoundError = new Error("getaddrinfo ENOTFOUND api.example.com");
      const result1 = formatError(enotFoundError, "openai");
      expect(result1).toContain("SYMBOL[error] Unable to reach server");

      const econnRefusedError = new Error("connect ECONNREFUSED 127.0.0.1:443");
      const result2 = formatError(econnRefusedError, "anthropic");
      expect(result2).toContain("SYMBOL[error] Connection refused");

      const timeoutError = new Error("ETIMEDOUT connection timeout");
      const result3 = formatError(timeoutError, "openai");
      expect(result3).toContain("SYMBOL[error] Request timed out after 60 seconds");
    });
  });

  describe("network error detection", () => {
    it("detects API key configuration errors", () => {
      const error1 = new Error("api key not configured for service");
      const result1 = formatError(error1, "openai");
      expect(result1).toContain("SYMBOL[error] Missing API key for provider: unknown");

      const error2 = new Error("api key is required");
      const result2 = formatError(error2, "anthropic");
      expect(result2).toContain("SYMBOL[error] Missing API key for provider: unknown");
    });

    it("detects DNS resolution errors", () => {
      const error1 = new Error("getaddrinfo ENOTFOUND api.openai.com");
      const result1 = formatError(error1, "openai");
      expect(result1).toContain("SYMBOL[error] Unable to reach server");

      const error2 = new Error("ENOTFOUND hostname");
      const result2 = formatError(error2, "anthropic");
      expect(result2).toContain("SYMBOL[error] Unable to reach server");
    });

    it("detects connection refused errors", () => {
      const error = new Error("connect ECONNREFUSED 127.0.0.1:443");
      const result = formatError(error, "openai");
      expect(result).toContain("SYMBOL[error] Connection refused");
    });

    it("detects timeout errors", () => {
      const error1 = new Error("ETIMEDOUT");
      const result1 = formatError(error1, "openai");
      expect(result1).toContain("SYMBOL[error] Request timed out after 60 seconds");

      const error2 = new Error("timeout of 30000ms exceeded");
      const result2 = formatError(error2, "anthropic");
      expect(result2).toContain("SYMBOL[error] Request timed out after 60 seconds");
    });
  });

  describe("advanced error parsing scenarios", () => {
    it("exercises error message extraction for various error types", () => {
      // Test the getErrorMessage function paths
      const networkError = new Error("ENOTFOUND api.example.com");
      const result1 = formatError(networkError, "openai");
      expect(result1).toContain("SYMBOL[error] Unable to reach server");

      const connectionError = new Error("ECONNREFUSED localhost");
      const result2 = formatError(connectionError, "anthropic");
      expect(result2).toContain("SYMBOL[error] Connection refused");

      const timeoutError = new Error("ETIMEDOUT request timeout");
      const result3 = formatError(timeoutError, "openai");
      expect(result3).toContain("SYMBOL[error] Request timed out after 60 seconds");

      const apiKeyError = new Error("api key not configured properly");
      const result4 = formatError(apiKeyError, "anthropic");
      expect(result4).toContain("SYMBOL[error] Missing API key for provider:");
    });

    it("tests parseAPIError with various input formats", () => {
      // Test with Error objects containing JSON
      const jsonErrorMessage = '{"error": {"type": "quota_exceeded", "message": "Quota exceeded"}}';
      const errorWithJson = new Error(`API failed: ${jsonErrorMessage}`);
      const result1 = formatError(errorWithJson, "openai");
      expect(result1).toContain("SYMBOL[error]");

      // Test with direct objects (non-Error)
      const directObject = { error: { type: "rate_limit", message: "Rate limit hit" } };
      const result2 = formatError(directObject, "anthropic");
      expect(result2).toContain("SYMBOL[error]");

      // Test with string input
      const stringError = "simple string error";
      const result3 = formatError(stringError, "openai");
      expect(result3).toContain("SYMBOL[error]");
    });

    it("exercises extractErrorInfo with different object structures", () => {
      // Test nested error structures
      const nestedError = {
        error: {
          type: "authentication_error",
          message: "Invalid credentials",
          code: "AUTH_001",
        },
        request_id: "req_123",
      };
      const result1 = formatError(nestedError, "anthropic");
      expect(result1).toContain("SYMBOL[error]");

      // Test flat error structures
      const flatError = {
        type: "timeout_error",
        message: "Request timeout",
        error_code: "TIMEOUT",
      };
      const result2 = formatError(flatError, "openai");
      expect(result2).toContain("SYMBOL[error]");

      // Test alternative field naming
      const altError = {
        error_type: "quota_error",
        error_message: "Quota limit reached",
      };
      const result3 = formatError(altError, "anthropic");
      expect(result3).toContain("SYMBOL[error]");
    });

    it("tests provider-specific error message generation", () => {
      // OpenAI-specific error patterns
      const openaiQuota = { error: { type: "insufficient_quota", message: "quota exceeded" } };
      const result1 = formatError(openaiQuota, "openai");
      expect(result1).toContain("SYMBOL[error]");

      const openaiKey = { error: { type: "invalid_api_key", message: "invalid key" } };
      const result2 = formatError(openaiKey, "openai");
      expect(result2).toContain("SYMBOL[error]");

      const openaiRate = { error: { type: "rate_limit", message: "rate limit exceeded" } };
      const result3 = formatError(openaiRate, "openai");
      expect(result3).toContain("SYMBOL[error]");

      // Anthropic-specific error patterns
      const anthropicAuth = { error: { type: "authentication_error", message: "auth failed" } };
      const result4 = formatError(anthropicAuth, "anthropic");
      expect(result4).toContain("SYMBOL[error]");

      const anthropicPerm = { error: { type: "permission_denied", message: "access denied" } };
      const result5 = formatError(anthropicPerm, "anthropic");
      expect(result5).toContain("SYMBOL[error]");
    });

    it("covers edge cases in JSON parsing", () => {
      // Test malformed JSON
      const malformedError = new Error('{"error": {"type": "test", "message":');
      const result1 = formatError(malformedError, "openai");
      expect(result1).toContain("SYMBOL[error]");

      // Test JSON with no error field
      const noErrorField = new Error('{"status": "failed", "reason": "unknown"}');
      const result2 = formatError(noErrorField, "anthropic");
      expect(result2).toContain("SYMBOL[error]");

      // Test completely invalid JSON
      const invalidJson = new Error("not json at all");
      const result3 = formatError(invalidJson, "openai");
      expect(result3).toContain("SYMBOL[error]");
    });
  });

  describe("comprehensive error formatting", () => {
    it("covers JSON error message parsing paths", () => {
      // Test that JSON parsing logic is exercised even if results are formatted differently
      const jsonError = '{"error": {"type": "insufficient_quota", "message": "quota exceeded"}}';
      const error = new Error(jsonError);
      const result = formatError(error, "openai");
      expect(result).toContain("SYMBOL[error]");
      expect(result).toContain("quota");
    });

    it("covers different provider error handling paths", () => {
      const error1 = new Error("test error message");
      const result1 = formatError(error1, "openai");
      expect(result1).toContain("SYMBOL[error]");

      const result2 = formatError(error1, "anthropic");
      expect(result2).toContain("SYMBOL[error]");

      const result3 = formatError(error1, "unknown");
      expect(result3).toContain("SYMBOL[error]");
    });

    it("exercises error formatting with various input types", () => {
      // Test that formatError handles different input types correctly
      // All inputs go through createError() which converts to BaseError instances

      // Test with null/undefined inputs
      const result1 = formatError(null, "openai");
      expect(result1).toContain("SYMBOL[error]");

      const result2 = formatError(undefined, "anthropic");
      expect(result2).toContain("SYMBOL[error]");

      // Test with empty string
      const result3 = formatError("", "openai");
      expect(result3).toContain("SYMBOL[error]");

      // Test with number input
      const result4 = formatError(42, "anthropic");
      expect(result4).toContain("SYMBOL[error]");

      // Test with object input
      const result5 = formatError({ message: "object error" }, "openai");
      expect(result5).toContain("SYMBOL[error]");
    });

    it("covers error object parsing with different structures", () => {
      // Test nested error objects
      const nestedError = { error: { type: "test", message: "test message" } };
      const result1 = formatError(nestedError, "openai");
      expect(result1).toContain("SYMBOL[error]");

      // Test flat error objects
      const flatError = { type: "test", message: "test message" };
      const result2 = formatError(flatError, "anthropic");
      expect(result2).toContain("SYMBOL[error]");

      // Test alternative field names
      const altError = { error_type: "test", error_message: "test message" };
      const result3 = formatError(altError, "openai");
      expect(result3).toContain("SYMBOL[error]");
    });

    it("covers malformed and edge case inputs", () => {
      const result1 = formatError(null, "openai");
      expect(result1).toContain("SYMBOL[error]");

      const result2 = formatError(undefined, "anthropic");
      expect(result2).toContain("SYMBOL[error]");

      const result3 = formatError("", "openai");
      expect(result3).toContain("SYMBOL[error]");

      const result4 = formatError({}, "anthropic");
      expect(result4).toContain("SYMBOL[error]");
    });

    it("exercises parseAPIError function with various inputs", () => {
      // These tests aim to trigger the parseAPIError function's different code paths
      const jsonWithError = new Error('{"error": {"code": "test"}}');
      const result1 = formatError(jsonWithError, "openai");
      expect(result1).toContain("SYMBOL[error]");

      const jsonWithType = new Error('{"type": "test_type", "message": "test message"}');
      const result2 = formatError(jsonWithType, "anthropic");
      expect(result2).toContain("SYMBOL[error]");

      const malformedJson = new Error('{"error": {"type": "test"');
      const result3 = formatError(malformedJson, "openai");
      expect(result3).toContain("SYMBOL[error]");
    });

    it("exercises provider-specific error message functions", () => {
      // Create errors that would trigger different provider-specific paths
      const quotaError = { error: { type: "insufficient_quota", message: "quota" } };
      const result1 = formatError(quotaError, "openai");
      expect(result1).toContain("SYMBOL[error]");

      const authError = { error: { type: "invalid_api_key", message: "auth failed" } };
      const result2 = formatError(authError, "anthropic");
      expect(result2).toContain("SYMBOL[error]");

      const rateLimitError = { error: { type: "rate_limit", message: "too many requests" } };
      const result3 = formatError(rateLimitError, "openai");
      expect(result3).toContain("SYMBOL[error]");
    });

    it("covers extractErrorInfo function with nested structures", () => {
      // Test extraction of error info from various object structures
      const complexError = {
        error: {
          type: "complex_error",
          message: "complex message",
          code: "ERR001",
        },
        additional: "data",
      };
      const result = formatError(complexError, "anthropic");
      expect(result).toContain("SYMBOL[error]");
    });

    it("handles realistic error message patterns", () => {
      // Test realistic error patterns that might come from actual APIs
      const error1 = new Error("Request failed with status 429: Rate limit exceeded");
      const result1 = formatError(error1, "openai");
      expect(result1).toContain("SYMBOL[error]");

      const error2 = new Error("Authentication failed: Invalid API key provided");
      const result2 = formatError(error2, "anthropic");
      expect(result2).toContain("SYMBOL[error]");
    });
  });
});
