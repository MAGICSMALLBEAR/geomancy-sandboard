/**
 * Calls the Claude API from the browser with the user's own key (DECISIONS D42).
 * The SDK is loaded only when the user asks for an AI reading, so the App shell stays small and offline-first.
 */
import { OUTPUT_SCHEMA, aiPromptVersion, parseAiOutput, systemPrompt, type AiModel } from '../infrastructure/ai.ts';
import type { AiReading } from '../domain/contracts.ts';

export type AiFailure =
  | 'offline' | 'auth' | 'permission' | 'rate-limit' | 'overloaded' | 'bad-request'
  | 'refusal' | 'truncated' | 'invalid-output' | 'cancelled' | 'network' | 'unknown';

export type AiResult = { ok: true; reading: Omit<AiReading, 'sentQuestion' | 'recordedAt'> } | { ok: false; failure: AiFailure; detail?: string };

export async function requestAiReading(
  options: { apiKey: string; model: AiModel; payload: unknown; signal: AbortSignal; lang?: 'zh-TW' | 'en' },
): Promise<AiResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, failure: 'offline' };
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // The key never leaves this device except in the request to the Claude API itself.
  const client = new Anthropic({ apiKey: options.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const stream = client.beta.messages.stream({
      model: options.model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: systemPrompt(options.lang ?? 'zh-TW'),
      messages: [{ role: 'user', content: `${options.lang === 'en' ? 'Here is the chart data (JSON). Write the explanation following the rules.' : '以下是這張盤的資料（JSON）。請依規則寫說明。'}\n\n${JSON.stringify(options.payload)}` }],
    }, { signal: options.signal });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') return { ok: false, failure: 'refusal' };
    if (message.stop_reason === 'max_tokens') return { ok: false, failure: 'truncated' };
    const text = message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('');
    const parsed = parseAiOutput(text);
    if (!parsed.ok) return { ok: false, failure: 'invalid-output', detail: parsed.reason };
    return { ok: true, reading: {
      model: message.model, promptVersion: aiPromptVersion(options.lang ?? 'zh-TW'), paragraphs: parsed.paragraphs,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    } };
  } catch (error) {
    if (options.signal.aborted || error instanceof Anthropic.APIUserAbortError) return { ok: false, failure: 'cancelled' };
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, failure: 'auth' };
    if (error instanceof Anthropic.PermissionDeniedError) return { ok: false, failure: 'permission' };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, failure: 'rate-limit' };
    if (error instanceof Anthropic.BadRequestError) return { ok: false, failure: 'bad-request', detail: error.message };
    if (error instanceof Anthropic.InternalServerError) return { ok: false, failure: 'overloaded' };
    if (error instanceof Anthropic.APIConnectionError) return { ok: false, failure: 'network' };
    if (error instanceof Anthropic.APIError) return { ok: false, failure: 'unknown', detail: `${error.status ?? ''}` };
    return { ok: false, failure: 'unknown' };
  }
}
