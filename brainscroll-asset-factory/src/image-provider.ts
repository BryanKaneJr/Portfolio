// All image generation lives here. Swap the provider or model in this one file.
import { settings } from './config.ts';
import { mockPng } from './png.ts';

export const IMAGE_PROVIDER = settings.mock ? 'mock' : 'openai';
export const IMAGE_MODEL = settings.mock ? 'mock' : settings.imageModel;

export interface GeneratedImage {
  png: Buffer;
  provider: string;
  model: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Models return either base64 data or a temporary URL. */
async function readImage(d: { b64_json?: string; url?: string } | undefined): Promise<Buffer> {
  if (d?.b64_json) return Buffer.from(d.b64_json, 'base64');
  if (d?.url) {
    const res = await fetch(d.url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Could not download generated image (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('OpenAI returned no image data.');
}

export async function generateImage(prompt: string, seed: string): Promise<GeneratedImage> {
  if (settings.mock) {
    await sleep(600 + Math.random() * 900);
    return { png: mockPng(seed + Date.now()), provider: IMAGE_PROVIDER, model: IMAGE_MODEL };
  }
  if (!settings.apiKey) throw new Error('OPENAI_API_KEY is not set. Add it to .env and restart.');

  // Defaults suit OpenAI's GPT image models. Other models may name or support parameters
  // differently; adjust with OPENAI_IMAGE_PARAMS instead of editing code.
  const body: Record<string, unknown> = {
    model: settings.imageModel,
    prompt,
    n: 1,
    size: settings.imageSize,
    quality: settings.imageQuality || undefined,
    background: 'transparent',
    output_format: 'png',
    ...settings.imageParams,
  };
  for (const [k, v] of Object.entries(body)) if (v === null || v === undefined) delete body[k];

  // Retry rate limits and server errors a couple of times with backoff.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${settings.baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { b64_json?: string; url?: string }[];
      error?: { message?: string };
    };
    if (res.ok) {
      const png = await readImage(json.data?.[0]);
      return { png, provider: IMAGE_PROVIDER, model: IMAGE_MODEL };
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 2) {
      throw new Error(`OpenAI image error (${res.status}): ${json.error?.message || res.statusText}`);
    }
    await sleep(4000 * (attempt + 1));
  }
}
