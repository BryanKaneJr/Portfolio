import type { ImageSourcePropType } from 'react-native';

/**
 * The owner's streak flame for the World Map header (StreakBadge). Until the
 * file exists the header shows the flame icon. To add it: save the image as
 * app/assets/images/ui/streak-flame.webp (transparent background, square) and
 * uncomment the line below.
 */
export const STREAK_FLAME: ImageSourcePropType | undefined = undefined;
// export const STREAK_FLAME: ImageSourcePropType | undefined = require('../../../assets/images/ui/streak-flame.webp');
