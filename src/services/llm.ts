/**
 * GhostFit — unified LLM layer (server-side only)
 *
 * Provider chain: Gemini (primary) → Qwen via DashScope (fallback)
 *                 → OpenAI (last resort, only if key present).
 * Every call: per-provider retries, tolerant JSON extraction, and a
 * caller-supplied structural validator. A response that fails to parse or
 * validate is treated exactly like a network failure — retried, then handed
 * to the next provider — so malformed output never reaches the app.
 */

export interface LlmImage {
  base64: string;      // raw base64, no data: prefix
  mimeType?: string;   // default image/jpeg
}

export interface GenerateJsonOptions {
  system: string;
  user: string;
  image?: LlmImage;
  maxTokens?: number;               // default 2048
  temperature?: number;             // default 0.4 — precision over flair
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validate?: (parsed: any) => boolean;
}

const ATTEMPTS_PER_PROVIDER = 2;
const TIMEOUT_MS = 90_000;

// ─── JSON extraction ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJson(text: string): any {
  // Fast path
  try { return JSON.parse(text); } catch { /* keep going */ }

  // Strip markdown fences
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(unfenced); } catch { /* keep going */ }

  // Outermost object slice
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(unfenced.slice(start, end + 1));
  }
  throw new Error('No JSON object found in model output');
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Providers ───────────────────────────────────────────────────────────────

async function callGemini(opts: GenerateJsonOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const parts: Array<Record<string, unknown>> = [{ text: opts.user }];
  if (opts.image) {
    parts.push({
      inline_data: {
        mime_type: opts.image.mimeType ?? 'image/jpeg',
        data: opts.image.base64,
      },
    });
  }

  const res = await fetchWithTimeout(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: Math.max(opts.maxTokens ?? 2048, 1024),
          temperature: opts.temperature ?? 0.4,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => p.text ?? '')
    .join('');
  if (!text) throw new Error(`Gemini returned empty content (finishReason: ${data.candidates?.[0]?.finishReason})`);
  return text;
}

async function callQwen(opts: GenerateJsonOptions): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('QWEN_API_KEY not set');

  const isVision = !!opts.image;
  const model = isVision ? 'qwen-vl-plus' : 'qwen-plus';

  const userContent = isVision
    ? [
        { type: 'text', text: opts.user },
        {
          type: 'image_url',
          image_url: { url: `data:${opts.image!.mimeType ?? 'image/jpeg'};base64,${opts.image!.base64}` },
        },
      ]
    : opts.user;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: userContent },
    ],
    max_tokens: Math.max(opts.maxTokens ?? 2048, 1024),
    temperature: opts.temperature ?? 0.4,
  };
  // json_object mode is only reliable on the text models
  if (!isVision) body.response_format = { type: 'json_object' };

  const res = await fetchWithTimeout(
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`Qwen ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Qwen returned empty content');
  return text;
}

async function callOpenAI(opts: GenerateJsonOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY') throw new Error('OPENAI_API_KEY not set');

  const userContent = opts.image
    ? [
        { type: 'text', text: opts.user },
        {
          type: 'image_url',
          image_url: { url: `data:${opts.image.mimeType ?? 'image/jpeg'};base64,${opts.image.base64}`, detail: 'low' },
        },
      ]
    : opts.user;

  const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.image ? 'gpt-4o' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: userContent },
      ],
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.4,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned empty content');
  return text;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

type Provider = { name: string; call: (opts: GenerateJsonOptions) => Promise<string> };

function providerChain(): Provider[] {
  const chain: Provider[] = [];
  if (process.env.GEMINI_API_KEY) chain.push({ name: 'gemini', call: callGemini });
  if (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY) chain.push({ name: 'qwen', call: callQwen });
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'YOUR_OPENAI_API_KEY') {
    chain.push({ name: 'openai', call: callOpenAI });
  }
  return chain;
}

/**
 * Generate a validated JSON object. Tries each configured provider in order
 * (Gemini → Qwen → OpenAI), with retries and structural validation at every
 * step. Throws only when the entire chain is exhausted.
 */
export async function generateJSON<T>(opts: GenerateJsonOptions): Promise<T> {
  const chain = providerChain();
  if (chain.length === 0) {
    throw new Error('No AI provider configured. Set GEMINI_API_KEY (and QWEN_API_KEY as fallback).');
  }

  const errors: string[] = [];
  for (const provider of chain) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_PROVIDER; attempt++) {
      try {
        const text = await provider.call(opts);
        const parsed = extractJson(text);
        if (opts.validate && !opts.validate(parsed)) {
          throw new Error('Output failed structural validation');
        }
        return parsed as T;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.name}#${attempt}: ${msg}`);
        console.warn(`LLM ${provider.name} attempt ${attempt} failed: ${msg}`);
      }
    }
  }
  throw new Error(`All AI providers failed. ${errors.join(' | ')}`);
}
