import { classifySupabaseKey } from '@brainscroll/core';

/**
 * Pulls the service-role insight aggregates (20260929 migration) from a
 * Supabase project. Read-only: nothing here writes to the project.
 */
export interface Insights {
  pulledAt: string;
  source: string;
  health: Record<string, unknown>;
  questions: QuestionStat[];
  levels: LevelFunnel[];
  reports: ContentReport[];
}
export interface QuestionStat {
  question_id: string;
  level_id: string;
  learners: number;
  first_try_rate: number | null;
  avg_attempts: number | null;
  first_picks: Record<string, number>;
  review_attempts: number;
  review_first_try_rate: number | null;
}
export interface LevelFunnel {
  level_id: string;
  started: number;
  completed: number;
  completion_rate: number | null;
  mean_first_try_share: number | null;
  exits_by_card: Record<string, number>;
}
export interface ContentReport {
  id: string;
  level_id: string | null;
  revision: number | null;
  object_type: string;
  object_id: string;
  category: string;
  message: string | null;
  status: string;
  created_at: string;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; text(): Promise<string> }>;

export async function pullInsights(url: string, serviceKey: string, opts: { skillId?: string; days?: number } = {}, fetchImpl: Fetch = fetch as unknown as Fetch): Promise<Insights> {
  const kind = classifySupabaseKey(serviceKey);
  if (kind !== 'secret' && kind !== 'service_role_jwt') throw new Error('insights need the service_role / sb_secret key (SUPABASE_SERVICE_ROLE_KEY)');
  const base = url.replace(/\/+$/, '');
  const headers: Record<string, string> = { apikey: serviceKey, 'content-type': 'application/json' };
  if (kind === 'service_role_jwt') headers.authorization = `Bearer ${serviceKey}`;
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const r = await fetchImpl(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
    const text = await r.text();
    if (r.status !== 200) throw new Error(`${fn}: ${r.status} ${text}`);
    return JSON.parse(text) as T;
  };
  const skill = opts.skillId ?? null;
  const [health, questions, levels, reports] = await Promise.all([
    rpc<Record<string, unknown>>('admin_learning_health', { p_days: opts.days ?? 28 }),
    rpc<QuestionStat[]>('admin_question_stats', { p_skill_id: skill }),
    rpc<LevelFunnel[]>('admin_level_funnel', { p_skill_id: skill }),
    rpc<ContentReport[]>('admin_content_reports', { p_status: 'open' }),
  ]);
  return { pulledAt: new Date().toISOString(), source: base, health, questions, levels, reports };
}
