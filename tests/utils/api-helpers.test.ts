import { describe, it, expect, vi } from "vitest";
import {
  handleApiError,
  validateApiResponse,
  validateResponseStructure,
  trimTrailingChars,
  isEnumValue,
  sortById,
} from "../../src/utils/api-helpers.js";
import {
  NetworkError,
  InvalidAPIKeyError,
  InvalidResponseFormatError,
} from "../../src/utils/errors.js";
import { Provider } from "../../src/types/index.js";

vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string) => key),
}));

vi.mock("../../src/utils/formatting.js", () => ({
  getProviderDisplayName: vi.fn((provider: Provider) => provider),
}));

describe("api-helpers", () => {
  describe("handleApiError", () => {
    it("should rethrow Error instances", () => {
      const error = new Error("Test error");
      expect(() => handleApiError(error)).toThrow(error);
    });

    it("should throw NetworkError for non-Error values", () => {
      expect(() => handleApiError("string error")).toThrow(NetworkError);
      expect(() => handleApiError(null)).toThrow(NetworkError);
      expect(() => handleApiError(undefined)).toThrow(NetworkError);
    });
  });

  describe("validateApiResponse", () => {
    it("should not throw for successful response", () => {
      const response = { ok: true, status: 200, statusText: "OK", json: vi.fn() };
      expect(() => validateApiResponse(response, Provider.OPENAI)).not.toThrow();
    });

    it("should throw InvalidAPIKeyError for 401 status", () => {
      const response = { ok: false, status: 401, statusText: "Unauthorized", json: vi.fn() };
      expect(() => validateApiResponse(response, Provider.OPENAI)).toThrow(InvalidAPIKeyError);
    });

    it("should throw InvalidAPIKeyError for custom invalid status codes", () => {
      const response = { ok: false, status: 403, statusText: "Forbidden", json: vi.fn() };
      expect(() => validateApiResponse(response, Provider.GEMINI, [401, 403])).toThrow(
        InvalidAPIKeyError
      );
    });

    it("should throw NetworkError for other error statuses", () => {
      const response = { ok: false, status: 500, statusText: "Server Error", json: vi.fn() };
      expect(() => validateApiResponse(response, Provider.OPENAI)).toThrow(NetworkError);
    });
  });

  describe("validateResponseStructure", () => {
    it("should not throw for valid structure with default field name", () => {
      const responseData = { data: [{ id: 1 }, { id: 2 }] };
      expect(() =>
        validateResponseStructure(responseData, Provider.OPENAI)
      ).not.toThrow();
    });

    it("should not throw for valid structure with custom field name", () => {
      const responseData = { models: [{ id: 1 }, { id: 2 }] };
      expect(() =>
        validateResponseStructure(responseData, Provider.OLLAMA, "models")
      ).not.toThrow();
    });

    it("should throw InvalidResponseFormatError for non-object response", () => {
      expect(() =>
        validateResponseStructure("string", Provider.OPENAI)
      ).toThrow(InvalidResponseFormatError);
      expect(() =>
        validateResponseStructure(null, Provider.OPENAI)
      ).toThrow(InvalidResponseFormatError);
    });

    it("should throw InvalidResponseFormatError for missing data field", () => {
      const responseData = { other: "field" };
      expect(() =>
        validateResponseStructure(responseData, Provider.OPENAI)
      ).toThrow(InvalidResponseFormatError);
    });

    it("should throw InvalidResponseFormatError for non-array data field", () => {
      const responseData = { data: "not an array" };
      expect(() =>
        validateResponseStructure(responseData, Provider.OPENAI)
      ).toThrow(InvalidResponseFormatError);
    });
  });

  describe("trimTrailingChars", () => {
    it("should trim single trailing character", () => {
      expect(trimTrailingChars("Hello.", ["."])).toBe("Hello");
      expect(trimTrailingChars("Hello,", [","])).toBe("Hello");
      expect(trimTrailingChars("Hello,", ["."])).toBe("Hello,");
    });

    it("should trim multiple different trailing characters", () => {
      expect(trimTrailingChars("Hello.", [".", ","])).toBe("Hello");
      expect(trimTrailingChars("Hello,", [".", ","])).toBe("Hello");
      expect(trimTrailingChars("Hello;", [".", ","])).toBe("Hello;");
    });

    it("should trim all occurrences of trailing characters", () => {
      expect(trimTrailingChars("Hello...", ["."])).toBe("Hello");
      expect(trimTrailingChars("Hello.,.", [".", ","])).toBe("Hello");
    });

    it("should handle empty string and empty chars array", () => {
      expect(trimTrailingChars("", ["."])).toBe("");
      expect(trimTrailingChars("Hello", [])).toBe("Hello");
    });

    it("should handle multi-character strings", () => {
      expect(trimTrailingChars("Hello...", ["..."])).toBe("Hello");
      expect(trimTrailingChars("Hello>>;", [">>", ";"])).toBe("Hello");
    });
  });

  describe("isEnumValue", () => {
    enum TestEnum {
      VALUE1 = "value1",
      VALUE2 = "value2",
    }

    it("should return true for valid enum values", () => {
      expect(isEnumValue("value1", TestEnum)).toBe(true);
      expect(isEnumValue("value2", TestEnum)).toBe(true);
    });

    it("should return false for invalid enum values", () => {
      expect(isEnumValue("value3", TestEnum)).toBe(false);
      expect(isEnumValue("", TestEnum)).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isEnumValue(123, TestEnum)).toBe(false);
      expect(isEnumValue(null, TestEnum)).toBe(false);
      expect(isEnumValue(undefined, TestEnum)).toBe(false);
      expect(isEnumValue({}, TestEnum)).toBe(false);
    });
  });

  describe("sortById", () => {
    it("should sort items by id using locale comparison", () => {
      const items = [
        { id: "z-item", name: "Last" },
        { id: "a-item", name: "First" },
        { id: "m-item", name: "Middle" },
      ];

      const sorted = sortById(items);

      expect(sorted).toEqual([
        { id: "a-item", name: "First" },
        { id: "m-item", name: "Middle" },
        { id: "z-item", name: "Last" },
      ]);
    });

    it("should handle empty arrays", () => {
      expect(sortById([])).toEqual([]);
    });

    it("should handle arrays with one item", () => {
      const items = [{ id: "single", name: "Only" }];
      expect(sortById(items)).toEqual(items);
    });

    it("should handle items with numeric ids", () => {
      const items = [
        { id: "10", name: "Ten" },
        { id: "2", name: "Two" },
        { id: "1", name: "One" },
      ];

      const sorted = sortById(items);

      expect(sorted).toEqual([
        { id: "1", name: "One" },
        { id: "10", name: "Ten" },
        { id: "2", name: "Two" },
      ]);
    });
  });
});