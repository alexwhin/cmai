import { ChatOpenAI } from "@langchain/openai";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { LangChainBaseProvider } from "./base.js";
import { ModelRequiredError } from "../../utils/errors.js";

export class LangChainOpenAIProvider extends LangChainBaseProvider {
  createModel(): BaseLanguageModel {
    if (!this.modelName) {
      throw new ModelRequiredError();
    }

    return new ChatOpenAI({
      model: this.modelName,
      apiKey: this.apiKey,
      temperature: 0.7,
      maxTokens: 2000,
    });
  }
}
