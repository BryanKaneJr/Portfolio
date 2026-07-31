import { z } from "zod";

/**
 * The strict structured-output contract the model must satisfy (blueprint §7.3).
 * The server rejects any response that fails this schema and rejects any citation
 * whose identifier does not resolve against the active source snapshots (§7.4).
 * The model NEVER selects a source version — the server fixes it.
 */
export const RuleCitation = z.object({
  rule_number: z.string().min(1),
  claim: z.string().min(1),
});

export const CardCitation = z.object({
  oracle_id: z.string().uuid(),
  field: z.enum(["oracle_text", "ruling"]),
});

export const PolicyCitation = z.object({
  key: z.string().min(1),
});

export const RulesAnswer = z.object({
  answer: z.string().min(1),
  explanation: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  rule_citations: z.array(RuleCitation).default([]),
  card_citations: z.array(CardCitation).default([]),
  policy_citations: z.array(PolicyCitation).default([]),
  confidence: z.enum(["high", "medium", "low"]),
  needs_more_information: z.boolean(),
  missing_information: z.array(z.string()).default([]),
  answer_type: z.enum(["official_rule", "policy", "table_convention", "strategy"]),
});

export type RulesAnswer = z.infer<typeof RulesAnswer>;

/**
 * The system prompt policy (blueprint §7.5). Kept as a constant so it is
 * versioned in source control and covered by evaluation runs.
 */
export const RULES_SYSTEM_PROMPT = `You are a Commander rules companion. Use only the supplied tools and evidence for factual rules conclusions. Never rely on remembered card text when a current database record is available. Never invent a card, Oracle text, legality, ruling, rule number, or policy. Distinguish rules, policy, table convention, and strategy. State assumptions. When evidence is insufficient, return needs_more_information or explain that the conclusion cannot be verified.`;
