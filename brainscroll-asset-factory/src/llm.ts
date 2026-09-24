// Small JSON-mode text/vision helper used for concept preprocessing and metadata.
import { settings } from './config.ts';

export const hasLLM = () => !!settings.apiKey && !settings.mock;

export async function chatJSON<T>(system: string, user: string, imagePng?: Buffer): Promise<T> {
  const content = imagePng
    ? [
        { type: 'text', text: user },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imagePng.toString('base64')}` } },
      ]
    : user;

  const res = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: settings.textModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`OpenAI text error (${res.status}): ${json.error?.message || res.statusText}`);
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned an empty response.');
  return JSON.parse(text) as T;
}
