import type { Level } from '@brainscroll/core';

/**
 * What server builds load in place of `built/levels` (metro.config.js): no
 * lessons at all. Those builds get every level from the server (start_level
 * hands over the learner bundle, and evidence cards come from
 * get_level_bundles), so shipping 14 MB of lessons only slowed launch and
 * made development builds download a 32 MB bundle.
 */
export const SKILL_LEVELS: Record<string, () => Level[]> = {};
