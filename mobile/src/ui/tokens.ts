import { useColorScheme } from "react-native";
// Website base.css (light) and the final Picturehouse palette (dark).
export const colors = {
  light: {
    bg: "#eaeaea",
    panel: "#ffffff",
    shade: "#f1f1f1",
    fg: "#111111",
    muted: "#646464",
    line: "#d0d0d0",
    link: "#172e59",
    brass: "#514335",
    active: "#8b2434",
    onActive: "#ffffff",
    sign: "#fffdf5",
    ink: "#151517",
    error: "#9d342b",
  },
  dark: {
    bg: "#171310",
    panel: "#211b17",
    shade: "#2c231d",
    fg: "#faf7ef",
    muted: "#c4b8a8",
    line: "#514335",
    link: "#ffffff",
    brass: "#c3a771",
    active: "#8b2434",
    onActive: "#ffffff",
    sign: "#fffdf5",
    ink: "#151517",
    error: "#ff9e93",
  },
};
export const space = { gap: 12, section: 40, inset: 16, small: 6 };
export const type = {
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 14, lineHeight: 21 },
  lede: { fontSize: 17, lineHeight: 25.5 },
  title: { fontSize: 30, lineHeight: 34.5 },
  heading: { fontSize: 20, lineHeight: 26 },
};
export function useTokens() {
  return colors[useColorScheme() === "dark" ? "dark" : "light"];
}
