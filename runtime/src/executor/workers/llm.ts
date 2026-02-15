/**
 * Gigent Agent Runtime -- LLM Worker
 *
 * Executes order work using LLM providers (Anthropic Claude or OpenAI).
 */

import { ExecutionConfig } from '../../config/schema';
import { Logger } from '../../logger';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export class LLMWorker {
  private config: ExecutionConfig;
  private logger: Logger;

  constructor(config: ExecutionConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child('llm');
  }

  /**
   * Process an order by sending the brief to the configured LLM.
   * Returns the LLM's text response.
   */
  async process(brief: string, inputData?: any): Promise<string> {
    const userMessage = this.buildUserMessage(brief, inputData);

    this.logger.debug(`Sending to ${this.config.provider} (${this.config.model})...`);
    this.logger.debug(`System prompt: ${this.config.system_prompt.substring(0, 100)}...`);
    this.logger.debug(`User message length: ${userMessage.length} chars`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        let result: string;

        if (this.config.provider === 'anthropic') {
          result = await this.callAnthropic(userMessage);
        } else if (this.config.provider === 'openai') {
          result = await this.callOpenAI(userMessage);
        } else {
          throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
        }

        this.logger.debug(`LLM response: ${result.length} chars`);
        return result;
      } catch (err: any) {
        lastError = err;
        const isRateLimit = err.message?.includes('rate') || err.status === 429;
        const isTimeout = err.message?.includes('timeout') || err.code === 'ETIMEDOUT';

        if (isRateLimit || isTimeout) {
          const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
          this.logger.warn(
            `LLM ${isRateLimit ? 'rate limited' : 'timed out'} (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${backoff}ms...`
          );
          if (attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, backoff));
          }
        } else {
          // Non-retryable error (auth, invalid request, etc.)
          this.logger.error(`LLM error (non-retryable): ${err.message}`);
          throw err;
        }
      }
    }

    throw new Error(
      `LLM processing failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
    );
  }

  private buildUserMessage(brief: string, inputData?: any): string {
    let message = brief || 'No specific brief provided.';

    if (inputData) {
      let inputStr: string;
      if (typeof inputData === 'string') {
        try {
          const parsed = JSON.parse(inputData);
          inputStr = JSON.stringify(parsed, null, 2);
        } catch {
          inputStr = inputData;
        }
      } else {
        inputStr = JSON.stringify(inputData, null, 2);
      }
      message += `\n\n--- Input Data ---\n${inputStr}`;
    }

    return message;
  }

  private async callAnthropic(userMessage: string): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;

    const client = new Anthropic({
      apiKey: this.config.api_key,
    });

    const response = await client.messages.create({
      model: this.config.model,
      max_tokens: this.config.max_tokens,
      temperature: this.config.temperature,
      system: this.config.system_prompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Extract text from response
    const textBlocks = response.content.filter((block: any) => block.type === 'text');
    if (textBlocks.length === 0) {
      throw new Error('Anthropic returned no text content');
    }

    return textBlocks.map((block: any) => block.text).join('\n');
  }

  private async callOpenAI(userMessage: string): Promise<string> {
    const OpenAI = (await import('openai')).default;

    const client = new OpenAI({
      apiKey: this.config.api_key,
    });

    const response = await client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.max_tokens,
      temperature: this.config.temperature,
      messages: [
        { role: 'system', content: this.config.system_prompt },
        { role: 'user', content: userMessage },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned no content');
    }

    return content;
  }
}
