import { ChatAnthropic } from "@langchain/anthropic";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { LangChainBaseProvider } from "./base.js";
import { ModelRequiredError } from "../../utils/errors.js";

export class LangChainAnthropicProvider extends LangChainBaseProvider {
  createModel(): BaseLanguageModel {
    if (!this.modelName) {
      throw new ModelRequiredError();
    }

    return new ChatAnthropic({
      modelName: this.modelName,
      anthropicApiKey: this.apiKey,
      temperature: 0.7,
      maxTokens: 2000,
    });
  }
}
