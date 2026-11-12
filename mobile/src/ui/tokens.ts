/**
 * The app's design tokens: the website's palette with native type and touch sizes.
 *
 * - Colours: the Picturehouse theme's final `:root` block in `src/styles/picturehouse.css`
 *   (the website is dark only, `data-theme="dark"` in `index.html`). Hex values only live in
 *   this file; screens use `colors.*`.
 * - Type: a native phone scale, with an 18-point/sp body and a 14-point/sp floor.
 *   Every screen uses these steps; text follows the system size up to 1.6×.
 *
 * The app is dark only for now (`userInterfaceStyle: "dark"` in app.json). A light set, if dio
 * asks for one, is a second object with the same keys chosen by `useColorScheme`; keep every
 * colour in `palettes` so that stays a one-file change.
 */

const dark = {
  /** Screen background (`--bg`). */
  bg: "#171310",
  /** Raised surfaces: rating cards, sheets (`--panel`). */
  panel: "#211b17",
  /** Inputs and pressed states (`--shade`). */
  shade: "#2c231d",
  /** Primary text (`--fg`). */
  fg: "#faf7ef",
  /** Secondary text: original titles, directors, notes (`--muted`). */
  muted: "#c4b8a8",
  /** Hairlines between rows (`--line`). */
  line: "#514335",
  /** The softer rule between list rows, as drawn in mock-up 1. */
  rowLine: "#3a2f26",
  /** Curtain red: the masthead, Book buttons, the active Filters button (`--active-bg`). */
  red: "#8b2434",
  /** The brighter red used for the selected tab icon (`--accent`). */
  accent: "#c94451",
  /** Brass trim: selected collection underline, next-screening time, badges (`--brass`). */
  brass: "#c3a771",
  /** The masthead's lower rule (`--programme-rule`). */
  brassRule: "#ad915c",
  /** Day headings' rule: `--programme-rule` at 44% opacity. */
  brassRuleSoft: "rgba(173,145,92,0.44)",
  /** Text on red (`--accent-ink`). */
  onRed: "#fff7eb",
  /** Text on brass badges (`--board-ink`). */
  onBrass: "#151517",
  /** Sold-out labels (`--sold-out`). */
  soldOut: "#ff9e93",
  /** Letter-board paper behind the wordmark (`--board-paper`). */
  boardPaper: "#fffdf5",
} as const;

export type Palette = { [K in keyof typeof dark]: string };

export const palettes: { dark: Palette } = { dark };

/** The palette in use. Dark only until a light set is approved. */
export const colors: Palette = palettes.dark;

/** The shared native text scale, in points on iOS and sp on Android. */
export const textSize = {
  1: 14,
  2: 16,
  3: 18,
  4: 20,
  5: 24,
  6: 28,
  7: 34,
  8: 40,
  9: 48,
} as const;
export type TextStep = keyof typeof textSize;

/** Shared cap for text and inputs; native bars retain the platform’s own scaling. */
export const maxFontSizeMultiplier = 1.6;

/** League Spartan, embedded through the expo-font config plugin (assets/fonts). */
export const fonts = {
  regular: "LeagueSpartan-Regular",
  medium: "LeagueSpartan-Medium",
} as const;

/** The spacing steps used in mock-up 1: 4, 8, 12, 16, 20, 24 and 32. */
export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Every corner in the app uses the same radius, as on the website's controls. */
export const radius = 4;

/** Minimum touch target on both platforms. */
export const touchTarget = 48;

/** The list row's poster thumbnail (mock-up 1): 48×72, a 2:3 poster. */
export const thumbnail = { width: 48, height: 72 } as const;

/** The detail screen's poster (mock-up 1): 112×168. */
export const detailPoster = { width: 112, height: 168 } as const;
