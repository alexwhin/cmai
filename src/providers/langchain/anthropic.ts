import { ChatAnthropic } from "@langchain/anthropic";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { LangChainBaseProvider } from "./base.js";
import { MODEL_DEFAULTS } from "../../constants.js";

export class LangChainAnthropicProvider extends LangChainBaseProvider {
  createModel(): BaseLanguageModel {
    this.validateModelName();

    return new ChatAnthropic({
      modelName: this.modelName,
      anthropicApiKey: this.apiKey,
      temperature: MODEL_DEFAULTS.TEMPERATURE,
      maxTokens: MODEL_DEFAULTS.MAX_TOKENS,
    });
  }
}
