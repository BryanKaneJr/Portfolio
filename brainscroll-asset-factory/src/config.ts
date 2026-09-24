import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;
const styleVersion = env.STYLE_VERSION || 'brainscroll-core-v1';

export const settings = {
  port: Number(env.PORT || 4321),
  apiKey: env.OPENAI_API_KEY || '',
  baseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  // The image model is a setting, not an assumption. gpt-image-1 is only the fallback.
  imageModel: env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  imageSize: env.OPENAI_IMAGE_SIZE || '1024x1024',
  imageQuality: env.OPENAI_IMAGE_QUALITY ?? 'medium',
  imageParams: parseParams(env.OPENAI_IMAGE_PARAMS),
  textModel: env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',
  concurrency: Math.min(3, Math.max(1, Number(env.CONCURRENCY || 1) || 1)),
  mock: env.MOCK_OPENAI === '1',
  styleVersion,
};

/** OPENAI_IMAGE_PARAMS: JSON merged into the request. A null value removes a default parameter. */
function parseParams(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch {}
  throw new Error('OPENAI_IMAGE_PARAMS must be a JSON object, e.g. {"quality":"high"}');
}

export const paths = {
  public: path.join(ROOT, 'public'),
  assets: path.join(ROOT, 'assets'),
  generated: path.join(ROOT, 'assets', 'generated'),
  approved: path.join(ROOT, 'assets', 'approved'),
  rejected: path.join(ROOT, 'assets', 'rejected'),
  registry: path.join(ROOT, 'data', 'asset-registry.json'),
  aliases: path.join(ROOT, 'data', 'aliases.json'),
  queue: path.join(ROOT, 'data', 'queue.json'),
  style: path.join(ROOT, 'config', `${styleVersion}.txt`),
  styleTest: path.join(ROOT, 'config', 'style-test.txt'),
};

for (const dir of [paths.generated, paths.approved, paths.rejected, path.dirname(paths.registry)]) {
  fs.mkdirSync(dir, { recursive: true });
}
