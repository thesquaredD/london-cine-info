export const DATA_SCHEMA_VERSION = 2;

export type FacetKey =
  | "day"
  | "time"
  | "venue"
  | "borough"
  | "format"
  | "accessibility"
  | "membership"
  | "genre"
  | "language";
export type Person = { id: string; name: string };
export type Rating = { value: number | null; url: string };
export type RatingKey = "lb" | "im" | "mc" | "rt";
export type Region = "inner" | "outer" | "outside";
export type FacetOption = { id: string; label: string; count: number };
export type Borough = { id: string; name: string; region: Region };
export type Venue = {
  id: string;
  name: string;
  address: string;
  url: string;
  lat: number;
  lon: number;
  group: string | null;
  borough: string;
  memberships: string[];
};

// Indices refer to meta.facets; masks use the format/accessibility option order.
// Keeping these together lets filters match one screening, instead of combining
// a day from one cinema with an accessibility flag from another cinema.
export type ScreeningFacet = [
  day: number,
  minute: number,
  venue: number,
  formatMask: number,
  accessibilityMask: number,
  soldOut: 0 | 1,
  event?: 0 | 1, // optional for compatibility with earlier catalogues
  epoch?: number, // minutes after meta.screeningEpoch; exact UTC ms in older catalogues
  screen?: number | string | null, // index into meta.screens
  eventTypes?: string[],
];
export type Film = {
  id: string;
  ti: string;
  o_ti: string | null;
  di: Person[];
  ye: number | null;
  rd: string | null;
  ru: number | null;
  cl: string | null;
  po: string | null;
  tr: string | null;
  la: string;
  ge: string[];
  ra: Record<RatingKey, Rating | null>;
  fa: Record<FacetKey, string>; // base64 bitsets, using each facet's option order
  sc: ScreeningFacet[];
  new: boolean;
  classic: boolean;
  upcoming: boolean;
  event: boolean;
  ev?: string[]; // special-screening labels, optional in earlier catalogues
  retro: string[];
  unmatched: boolean;
};
export type EventOccurrence = Showtime & {
  id: string;
  filmId: string;
  title: string;
  date: string;
  labels: string[];
  types: string[];
};
export type Showtime = {
  eventTitle?: string;
  venue: string;
  time: number; // UTC epoch milliseconds; repeated DST hours remain distinct
  localTime: string;
  bookingUrl: string;
  bookingFallback: boolean;
  screen: string | null;
  notes: string | null;
  category: string;
  formats: string[];
  accessibility: string[];
  soldOut: boolean;
};
export type FilmShowtimes = {
  id: string;
  details: { actors: Person[]; overview: string | null };
  days: Record<string, Showtime[]>;
};
export type SourceRelease = { repository: string; tag: string; publishedAt: string };
export type DataMeta = {
  schemaVersion: number;
  generatedAt: string;
  screeningEpoch?: number; // UTC midnight baseline in epoch milliseconds
  screens?: string[];
  upstreamGeneratedAt: string;
  sources: { combined: SourceRelease; matched: SourceRelease };
  releaseDateSource: "tmdb-original";
  venues: Venue[];
  boroughs: Borough[];
  memberships: { id: string; label: string; kind: "unlimited" | "membership" | "discount" }[];
  facets: Record<FacetKey, FacetOption[]>;
  counts: { films: number; screenings: number; venues: number };
  diagnostics: {
    expiredScreenings: number;
    duplicateScreenings: number;
    invalidBookingUrls: { movieId: string; showingId: string }[];
    outsideLondonVenues: string[];
  };
};
export type DataManifest = {
  schemaVersion: number;
  generatedAt: string;
  films: string;
  meta: string;
  showtimes: string;
  events: string;
};
