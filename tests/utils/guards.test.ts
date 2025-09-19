import { describe, it, expect } from "vitest";
import {
  isRecord,
  hasProperty,
  isString,
  isArray,
  isNonEmptyString,
  isValidEmail,
  isNumber,
  isPositiveNumber,
  isValidProvider,
  isValidUsageMode,
  isCommitCandidate,
  isJSONString,
  isStringArray,
} from "../../src/utils/guards.js";
import { Provider, UsageMode } from "../../src/types/index.js";

describe("guards", () => {
  describe("isRecord", () => {
    it("returns true for objects", () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ key: "value" })).toBe(true);
      expect(isRecord(new Date())).toBe(true);
    });

    it("returns false for null", () => {
      expect(isRecord(null)).toBe(false);
    });

    it("returns false for primitives", () => {
      expect(isRecord("string")).toBe(false);
      expect(isRecord(123)).toBe(false);
      expect(isRecord(true)).toBe(false);
      expect(isRecord(undefined)).toBe(false);
    });
  });

  describe("hasProperty", () => {
    it("returns true when object has the property", () => {
      const object = { key: "value", other: 123 };

      expect(hasProperty(object, "key")).toBe(true);
      expect(hasProperty(object, "other")).toBe(true);
    });

    it("returns false when object lacks the property", () => {
      const object = { key: "value" };

      expect(hasProperty(object, "missing")).toBe(false);
    });

    it("returns true even for undefined values", () => {
      const object = { key: undefined };

      expect(hasProperty(object, "key")).toBe(true);
    });
  });

  describe("isString", () => {
    it("returns true for strings", () => {
      expect(isString("")).toBe(true);
      expect(isString("hello")).toBe(true);
      expect(isString("123")).toBe(true);
    });

    it("returns false for non-strings", () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString([])).toBe(false);
    });
  });

  describe("isArray", () => {
    it("returns true for arrays", () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it("returns false for non-arrays", () => {
      expect(isArray({})).toBe(false);
      expect(isArray("string")).toBe(false);
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
      expect(isArray(123)).toBe(false);
    });

    it("returns false for array-like objects", () => {
      expect(isArray({ length: 0 })).toBe(false);
      expect(isArray({ 0: "a", 1: "b", length: 2 })).toBe(false);
    });
  });

  describe("isNonEmptyString", () => {
    it("returns true for non-empty strings", () => {
      expect(isNonEmptyString("hello")).toBe(true);
      expect(isNonEmptyString("a")).toBe(true);
      expect(isNonEmptyString("  test  ")).toBe(true);
    });

    it("returns false for empty or whitespace-only strings", () => {
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString("   ")).toBe(false);
      expect(isNonEmptyString("\t")).toBe(false);
    });

    it("returns false for non-strings", () => {
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
    });
  });

  describe("isValidEmail", () => {
    it("returns true for valid emails", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name@domain.co.uk")).toBe(true);
      expect(isValidEmail("test123@test-domain.org")).toBe(true);
    });

    it("returns false for invalid emails", () => {
      expect(isValidEmail("invalid-email")).toBe(false);
      expect(isValidEmail("test@")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("test..test@example.com")).toBe(false);
    });

    it("returns false for non-strings", () => {
      expect(isValidEmail(123)).toBe(false);
      expect(isValidEmail({})).toBe(false);
    });
  });

  describe("isNumber", () => {
    it("returns true for numbers", () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
    });

    it("returns false for NaN", () => {
      expect(isNumber(NaN)).toBe(false);
    });

    it("returns false for non-numbers", () => {
      expect(isNumber("123")).toBe(false);
      expect(isNumber({})).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe("isPositiveNumber", () => {
    it("returns true for positive numbers", () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(123.45)).toBe(true);
      expect(isPositiveNumber(0.1)).toBe(true);
    });

    it("returns false for zero or negative numbers", () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(-123.45)).toBe(false);
    });

    it("returns false for non-numbers", () => {
      expect(isPositiveNumber("123")).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
    });
  });

  describe("isValidProvider", () => {
    it("returns true for valid providers", () => {
      expect(isValidProvider(Provider.OPENAI)).toBe(true);
      expect(isValidProvider(Provider.ANTHROPIC)).toBe(true);
    });

    it("returns false for invalid providers", () => {
      expect(isValidProvider("invalid")).toBe(false);
      expect(isValidProvider("openai")).toBe(false);
      expect(isValidProvider(123)).toBe(false);
    });
  });

  describe("isValidUsageMode", () => {
    it("returns true for valid usage modes", () => {
      expect(isValidUsageMode(UsageMode.CLIPBOARD)).toBe(true);
      expect(isValidUsageMode(UsageMode.COMMIT)).toBe(true);
      expect(isValidUsageMode(UsageMode.TERMINAL)).toBe(true);
    });

    it("returns false for invalid usage modes", () => {
      expect(isValidUsageMode("invalid")).toBe(false);
      expect(isValidUsageMode(123)).toBe(false);
    });
  });

  describe("isCommitCandidate", () => {
    it("returns true for valid commit message strings", () => {
      expect(isCommitCandidate("feat: add new feature")).toBe(true);
      expect(isCommitCandidate("fix: resolve bug")).toBe(true);
    });

    it("returns false for empty or whitespace strings", () => {
      expect(isCommitCandidate("")).toBe(false);
      expect(isCommitCandidate("   ")).toBe(false);
    });

    it("returns false for non-strings", () => {
      expect(isCommitCandidate({})).toBe(false);
      expect(isCommitCandidate(123)).toBe(false);
    });
  });

  describe("isJSONString", () => {
    it("returns true for valid JSON strings", () => {
      expect(isJSONString("{}")).toBe(true);
      expect(isJSONString('{"key": "value"}')).toBe(true);
      expect(isJSONString("[]")).toBe(true);
      expect(isJSONString('"string"')).toBe(true);
    });

    it("returns false for invalid JSON strings", () => {
      expect(isJSONString("invalid")).toBe(false);
      expect(isJSONString("{key: value}")).toBe(false);
      expect(isJSONString(123)).toBe(false);
    });
  });

  describe("isStringArray", () => {
    it("returns true for string arrays", () => {
      expect(isStringArray(["a", "b", "c"])).toBe(true);
      expect(isStringArray([])).toBe(true);
    });

    it("returns false for mixed arrays", () => {
      expect(isStringArray(["a", 1, "c"])).toBe(false);
    });
  });
});
