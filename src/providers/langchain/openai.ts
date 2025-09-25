import { ChatOpenAI } from "@langchain/openai";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { LangChainBaseProvider } from "./base.js";
import { MODEL_DEFAULTS } from "../../constants.js";

export class LangChainOpenAIProvider extends LangChainBaseProvider {
  createModel(): BaseLanguageModel {
    this.validateModelName();

    return new ChatOpenAI({
      model: this.modelName,
      apiKey: this.apiKey,
      temperature: MODEL_DEFAULTS.TEMPERATURE,
      maxTokens: MODEL_DEFAULTS.MAX_TOKENS,
    });
  }
}
