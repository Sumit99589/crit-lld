import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { LlmError, type StructuredLlm, type StructuredRequest, type StructuredResponse } from "./llm.js";

export interface AnthropicLlmOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export class AnthropicLlm implements StructuredLlm {
  readonly model: string;
  private readonly client: Anthropic;

  constructor(options: AnthropicLlmOptions) {
    this.model = options.model;
    // The SDK already retries 429/5xx/connection errors with backoff; two retries is plenty here.
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs, maxRetries: 2 });
  }

  async generate<S extends z.ZodType>(request: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>> {
    let response;
    try {
      response = await this.client.messages.parse(
        {
          model: this.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: "user", content: request.prompt }],
          // Low effort keeps cost and latency down; the rubric does the heavy lifting.
          output_config: { format: zodOutputFormat(request.schema), effort: "low" },
        },
        { signal: request.signal },
      );
    } catch (error) {
      throw toLlmError(error);
    }

    if (response.stop_reason === "refusal")
      throw new LlmError("invalid_output", "The model declined to review this submission");
    if (response.stop_reason === "max_tokens")
      throw new LlmError("invalid_output", "The review was cut off before it finished");
    if (!response.parsed_output) throw new LlmError("invalid_output", "The review did not match the expected format");

    return {
      output: response.parsed_output as z.infer<S>,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

function toLlmError(error: unknown): LlmError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new LlmError("auth", "The AI provider rejected our credentials");
  }
  if (error instanceof Anthropic.RateLimitError)
    return new LlmError("rate_limited", "The AI provider is rate limiting us");
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new LlmError("timeout", "The AI review timed out");
  if (error instanceof Anthropic.APIUserAbortError) return new LlmError("timeout", "The AI review was cancelled");
  if (error instanceof Anthropic.APIConnectionError)
    return new LlmError("provider_error", "Could not reach the AI provider");
  if (error instanceof Anthropic.APIError)
    return new LlmError("provider_error", `AI provider error (${error.status ?? "unknown"})`);
  if (error instanceof SyntaxError) return new LlmError("invalid_output", "The review was not valid JSON");
  return new LlmError("provider_error", error instanceof Error ? error.message : "Unknown AI error");
}
