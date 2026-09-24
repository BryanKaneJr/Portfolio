export type Status =
  | 'PROPOSED'
  | 'EXISTING'
  | 'TOO_ABSTRACT'
  | 'PENDING'
  | 'GENERATING'
  | 'GENERATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED';

export type Specificity = 'generic' | 'specific' | 'named';

/** One concept moving through the batch workflow. */
export interface QueueItem {
  key: string;
  inputs: string[]; // raw phrasings that resolved to this item
  canonical_concept: string;
  label: string;
  id: string;
  category: string;
  subject: string; // WHAT to depict (the style spec controls HOW)
  notes: string; // extra depiction constraints, e.g. "No person wearing it."
  contexts: string[]; // batch categories such as "Astronomy"
  status: Status;
  reason?: string;
  existing_id?: string;
  style_test?: boolean;
  image?: string; // path relative to /assets, e.g. "generated/object_telescope__123.png"
  history: string[]; // earlier attempts, same format as image
  transparent?: boolean;
  width?: number;
  height?: number;
  prompt?: string;
  provider_model?: string;
  error?: string;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface RegistryEntry {
  id: string;
  label: string;
  canonical_concept: string;
  category: string;
  subcategory: string;
  description: string;
  tags: string[];
  aliases: string[];
  related_concepts: string[];
  concepts_supported: string[];
  not_for: string[];
  visual_features: string[];
  specificity: Specificity;
  subject_count: number;
  orientation: string;
  asset_type: 'illustration';
  source_contexts: string[];
  style_version: string;
  filename: string;
  format: 'png';
  transparent: boolean;
  width: number;
  height: number;
  provider: string;
  provider_model: string;
  generation_prompt: string;
  status: 'approved';
  metadata_status: 'pending' | 'generated' | 'fallback' | 'failed';
  metadata_error?: string;
  created_at: string;
  approved_at: string;
  updated_at: string;
  notes: string;
}
