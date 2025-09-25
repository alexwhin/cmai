import { ChatOllama } from "@langchain/ollama";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { LangChainBaseProvider } from "./base.js";
import { MODEL_DEFAULTS } from "../../constants.js";

export class LangChainOllamaProvider extends LangChainBaseProvider {
  createModel(): BaseLanguageModel {
    this.validateModelName();

    return new ChatOllama({
      model: this.modelName,
      baseUrl: this.apiKey,
      temperature: MODEL_DEFAULTS.TEMPERATURE,
      numPredict: MODEL_DEFAULTS.MAX_TOKENS,
      format: "json",
    });
  }
}
