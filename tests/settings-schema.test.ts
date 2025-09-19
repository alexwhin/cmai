import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import { readFileSync } from "fs";
import { resolve } from "path";

const schemaPath = resolve(process.cwd(), "settings.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

describe("settings.schema.json validation", () => {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);

  describe("OLLAMA provider validation", () => {
    it("should accept valid OLLAMA configuration with URL", () => {
      const config = {
        provider: "OLLAMA",
        apiKey: "http://localhost:11434",
        model: "llama2"
      };
      
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it("should accept OLLAMA with custom URL", () => {
      const config = {
        provider: "OLLAMA",
        apiKey: "http://192.168.1.100:11434",
        model: "codellama"
      };
      
      const valid = validate(config);
      expect(valid).toBe(true);
    });

    it("should accept OLLAMA with https URL", () => {
      const config = {
        provider: "OLLAMA",
        apiKey: "https://ollama.example.com:443",
        model: "mistral"
      };
      
      const valid = validate(config);
      expect(valid).toBe(true);
    });

    it("should reject OLLAMA with non-URL apiKey", () => {
      const config = {
        provider: "OLLAMA",
        apiKey: "sk-1234567890abcdef",
        model: "llama2"
      };
      
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors?.[0]?.schemaPath).toContain("pattern");
    });

    it("should reject OLLAMA with invalid URL format", () => {
      const config = {
        provider: "OLLAMA",
        apiKey: "not-a-url",
        model: "llama2"
      };
      
      const valid = validate(config);
      expect(valid).toBe(false);
    });
  });

  describe("API-based provider validation", () => {
    it("should accept valid OpenAI configuration", () => {
      const config = {
        provider: "OPENAI",
        apiKey: "sk-1234567890abcdef",
        model: "gpt-4o"
      };
      
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it("should accept valid Anthropic configuration", () => {
      const config = {
        provider: "ANTHROPIC",
        apiKey: "sk-ant-1234567890abcdef",
        model: "claude-3-5-sonnet-20241022"
      };
      
      const valid = validate(config);
      expect(valid).toBe(true);
    });

    it("should accept OpenAI with URL-like apiKey", () => {
      const config = {
        provider: "OPENAI",
        apiKey: "http://localhost:11434",
        model: "gpt-4o"
      };
      
      const valid = validate(config);
      expect(valid).toBe(true);
    });
  });

  describe("required fields", () => {
    it("should reject missing provider", () => {
      const config = {
        apiKey: "sk-1234567890abcdef",
        model: "gpt-4o"
      };
      
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors?.some(err => err.keyword === "required" && err.params?.missingProperty === "provider")).toBe(true);
    });

    it("should accept missing apiKey (now optional)", () => {
      const config = {
        provider: "OPENAI",
        model: "gpt-4o"
      };
      
      const valid = validate(config);
      expect(valid).toBe(true);
    });

    it("should reject missing model", () => {
      const config = {
        provider: "OPENAI",
        apiKey: "sk-1234567890abcdef"
      };
      
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors?.some(err => err.keyword === "required" && err.params?.missingProperty === "model")).toBe(true);
    });
  });

  describe("optional fields", () => {
    it("should accept complete configuration with all fields", () => {
      const config = {
        provider: "OLLAMA",
        apiKey: "http://localhost:11434",
        model: "llama2",
        maxCommitLength: 72,
        usageMode: "CLIPBOARD",
        commitChoicesCount: 5,
        redactSensitiveData: true,
        customRules: ["Use present tense", "Be concise"],
        uiLanguage: "en",
        commitLanguage: "en"
      };
      
      const valid = validate(config);
      expect(valid).toBe(true);
    });

    it("should accept configuration with deprecated completionAction", () => {
      const config = {
        provider: "OPENAI",
        apiKey: "sk-1234567890abcdef",
        model: "gpt-4o",
        completionAction: "COMMIT"
      };
      
      const valid = validate(config);
      expect(valid).toBe(true);
    });
  });

  describe("model examples", () => {
    it("should have Ollama models in examples", () => {
      const modelExamples = schema.properties.model.examples;
      expect(modelExamples).toContain("llama2");
      expect(modelExamples).toContain("codellama");
      expect(modelExamples).toContain("mistral");
      expect(modelExamples).toContain("mixtral");
    });
  });
});