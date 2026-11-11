import { Image } from "expo-image";

/**
 * The letter-board wordmark: READOGRAPH | LONDON on board paper, as in the website's masthead.
 * It is a pre-rendered image of that masthead (see docs/mobile.md) because the Clash Display
 * licence covers the website only. `height` 31 is the masthead's own size at 390 points.
 */
// Metro resolves image requires to asset IDs; an import would need generated PNG types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const source = require("../../assets/images/wordmark.png") as number;

/** The image's aspect ratio (width / height): a 723×93 render at 3× of the 390-point masthead. */
export const WORDMARK_RATIO = 723 / 93;

export function Wordmark({ height = 31 }: { height?: number }) {
  return (
    <Image
      source={source}
      style={{ height, width: Math.round(height * WORDMARK_RATIO) }}
      contentFit="contain"
      accessible
      accessibilityRole="header"
      accessibilityLabel="Readograph London"
    />
  );
}
