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

export async function generateImage(prompt: string, seed: string): Promise<GeneratedImage> {
  if (settings.mock) {
    await sleep(600 + Math.random() * 900);
    return { png: mockPng(seed + Date.now()), provider: IMAGE_PROVIDER, model: IMAGE_MODEL };
  }
  if (!settings.apiKey) throw new Error('OPENAI_API_KEY is not set. Add it to .env and restart.');

  const body = {
    model: settings.imageModel,
    prompt,
    n: 1,
    size: settings.imageSize,
    quality: settings.imageQuality,
    background: 'transparent',
    output_format: 'png',
  };

  // Retry rate limits and server errors a couple of times with backoff.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${settings.baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { b64_json?: string }[];
      error?: { message?: string };
    };
    if (res.ok) {
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) throw new Error('OpenAI returned no image data.');
      return { png: Buffer.from(b64, 'base64'), provider: IMAGE_PROVIDER, model: IMAGE_MODEL };
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 2) {
      throw new Error(`OpenAI image error (${res.status}): ${json.error?.message || res.statusText}`);
    }
    await sleep(4000 * (attempt + 1));
  }
}
