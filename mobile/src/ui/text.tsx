import { Text as NativeText, type TextProps } from "react-native";
import { colors, fonts, textSize, type TextStep } from "./tokens";

type Props = TextProps & {
  /** A step of the shared scale; 3 (16) is body text. */
  size?: TextStep;
  weight?: "regular" | "medium";
  tone?: "fg" | "muted" | "brass" | "onRed" | "onBrass" | "soldOut";
};

const tones = {
  fg: colors.fg,
  muted: colors.muted,
  brass: colors.brass,
  onRed: colors.onRed,
  onBrass: colors.onBrass,
  soldOut: colors.soldOut,
} as const;

/**
 * The only text component in the app, so that every string uses a step of the shared scale
 * and League Spartan. Line height is 1.25× the size, the website's reading rhythm at phone
 * scale. Dynamic Type and Android font scaling stay on (`allowFontScaling` default).
 */
export function Text({ size = 3, weight = "regular", tone = "fg", style, ...rest }: Props) {
  const fontSize = textSize[size];
  return (
    <NativeText
      {...rest}
      style={[
        {
          fontFamily: weight === "medium" ? fonts.medium : fonts.regular,
          fontSize,
          lineHeight: Math.round(fontSize * 1.25),
          color: tones[tone],
        },
        style,
      ]}
    />
  );
}
