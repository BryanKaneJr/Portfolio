import type { ImageSourcePropType } from 'react-native';

/**
 * Reward artwork (assets/images/ui). Gold is for mastery only, so the gold
 * mastery badges appear only when a skill's mastery level is cleared.
 */
/** Fallback for a skill without its own badge. Gold, so mastery only. */
export const TROPHY_ART: ImageSourcePropType = require('../../../assets/images/ui/trophy.webp');

/** Each skill's mastery badge, shown when its mastery level is cleared. */
const MASTERY_BADGE: Readonly<Record<string, ImageSourcePropType>> = {
  'skill.science.astronomy': require('../../../assets/images/ui/mastery-astronomy.webp'),
  'skill.science.human_body': require('../../../assets/images/ui/mastery-body.webp'),
  'skill.science.chemistry': require('../../../assets/images/ui/mastery-chem.webp'),
  'skill.science.animals': require('../../../assets/images/ui/mastery-animals.webp'),
  'skill.history.ancient_rome': require('../../../assets/images/ui/mastery-rome.webp'),
  'skill.history.ancient_egypt': require('../../../assets/images/ui/mastery-egypt.webp'),
  'skill.history.ancient_greece': require('../../../assets/images/ui/mastery-greece.webp'),
  'skill.history.middle_ages': require('../../../assets/images/ui/mastery-medieval.webp'),
  'skill.geography.world_geography': require('../../../assets/images/ui/mastery-geo.webp'),
  'skill.geography.oceans': require('../../../assets/images/ui/mastery-ocean.webp'),
  'skill.money.how_money_works': require('../../../assets/images/ui/mastery-money.webp'),
  'skill.arts.art_history': require('../../../assets/images/ui/mastery-arts.webp'),
  'skill.arts.music': require('../../../assets/images/ui/mastery-music.webp'),
  'skill.arts.architecture': require('../../../assets/images/ui/mastery-arch.webp'),
  'skill.world_systems.everyday_technology': require('../../../assets/images/ui/mastery-technology.webp'),
  'skill.world_systems.government': require('../../../assets/images/ui/mastery-gov.webp'),
};

export const masteryBadge = (skillId: string): ImageSourcePropType | undefined => MASTERY_BADGE[skillId];
