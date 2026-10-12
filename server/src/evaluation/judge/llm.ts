import type { z } from "zod";

export interface StructuredRequest<S extends z.ZodType> {
  system: string;
  prompt: string;
  schema: S;
  maxTokens: number;
  signal?: AbortSignal;
}

export interface StructuredResponse<T> {
  output: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** The only thing the judge needs from a language model: a prompt in, typed JSON out. */
export interface StructuredLlm {
  readonly model: string;
  generate<S extends z.ZodType>(request: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>>;
}

export type LlmErrorKind = "rate_limited" | "timeout" | "provider_error" | "invalid_output" | "auth";

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
