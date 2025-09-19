import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatOllama } from "@langchain/ollama";
import { LangChainOllamaProvider } from "../../../src/providers/langchain/ollama.js";
import { ModelRequiredError } from "../../../src/utils/errors.js";

vi.mock("@langchain/ollama");

describe("LangChainOllamaProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createModel", () => {
    it("should create ChatOllama instance with model and provided URL", () => {
      const provider = new LangChainOllamaProvider("http://localhost:11434", "llama2", 72, 5);
      provider.createModel();

      expect(ChatOllama).toHaveBeenCalledWith({
        model: "llama2",
        baseUrl: "http://localhost:11434",
        temperature: 0.7,
        numPredict: 2000,
        format: "json",
      });
    });

    it("should create ChatOllama instance with model and custom URL when apiKey provided", () => {
      const provider = new LangChainOllamaProvider("http://custom:11434", "codellama", 72, 5);
      provider.createModel();

      expect(ChatOllama).toHaveBeenCalledWith({
        model: "codellama",
        baseUrl: "http://custom:11434",
        temperature: 0.7,
        numPredict: 2000,
        format: "json",
      });
    });

    it("should throw ModelRequiredError when no model provided", () => {
      expect(() => new LangChainOllamaProvider("http://localhost:11434", "", 72, 5)).toThrow(
        ModelRequiredError
      );
    });
  });
});
