import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { LangChainBaseProvider } from "./base.js";
import { ModelNotFoundError } from "../../utils/errors.js";
import { Provider } from "../../types/index.js";
import { getProviderDisplayName } from "../../utils/formatting.js";

export class LangChainGeminiProvider extends LangChainBaseProvider {
  createModel(): BaseLanguageModel {
    const supportedModels = [
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-2.0-flash-exp",
      "gemini-pro",
      "gemini-pro-vision",
    ];

    if (!supportedModels.includes(this.modelName)) {
      throw new ModelNotFoundError(this.modelName, getProviderDisplayName(Provider.GEMINI));
    }

    return new ChatGoogleGenerativeAI({
      model: this.modelName,
      apiKey: this.apiKey,
      maxOutputTokens: 2048,
      temperature: 0.7,
      topP: 0.8,
      topK: 10,
    }) as unknown as BaseLanguageModel;
  }
}
