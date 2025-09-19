import { ChatOllama } from "@langchain/ollama";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { LangChainBaseProvider } from "./base.js";
import { ModelRequiredError } from "../../utils/errors.js";

export class LangChainOllamaProvider extends LangChainBaseProvider {
  createModel(): BaseLanguageModel {
    if (!this.modelName) {
      throw new ModelRequiredError();
    }

    return new ChatOllama({
      model: this.modelName,
      baseUrl: this.apiKey,
      temperature: 0.7,
      numPredict: 2000,
      format: "json",
    });
  }
}
