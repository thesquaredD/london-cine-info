export const MEMBERSHIPS = [
  { id: "cineworld-unlimited", label: "Cineworld Unlimited", kind: "unlimited" },
  { id: "odeon-limitless", label: "Odeon Limitless", kind: "unlimited" },
  { id: "curzon", label: "Curzon membership", kind: "membership" },
  { id: "everyman", label: "Everyman membership", kind: "membership" },
  { id: "picturehouse", label: "Picturehouse membership", kind: "membership" },
  { id: "bfi", label: "BFI membership", kind: "membership" },
  { id: "prince-charles", label: "Prince Charles membership", kind: "membership" },
  { id: "genesis", label: "Genesis membership", kind: "membership" },
  { id: "rio", label: "Rio membership", kind: "membership" },
  { id: "garden", label: "Garden Cinema membership", kind: "membership" },
  { id: "lexi", label: "Lexi membership", kind: "membership" },
  { id: "ica", label: "ICA membership", kind: "membership" },
  { id: "barbican", label: "Barbican membership", kind: "membership" },
  { id: "vue-pass", label: "Vue Pass", kind: "discount" },
] as const;

// Venue eligibility only: premium formats and special events may have exclusions.
const rules = [
  { membership: "cineworld-unlimited", prefixes: ["cineworld.co.uk-"], groups: ["Cineworld"] },
  { membership: "odeon-limitless", prefixes: ["odeon.co.uk-"], groups: ["Odeon"] },
  {
    membership: "curzon",
    prefixes: ["curzon.com-", "curzonseacontainers.com"],
    groups: ["Curzon"],
  },
  { membership: "everyman", prefixes: ["everymancinema.com-"], groups: ["Everyman"] },
  { membership: "picturehouse", prefixes: ["picturehouses.com-"], groups: ["Picturehouse"] },
  { membership: "bfi", prefixes: ["bfi.org.uk-"], groups: ["BFI"] },
  { membership: "prince-charles", prefixes: ["princecharlescinema.com"], groups: [] },
  { membership: "genesis", prefixes: ["genesiscinema.co.uk"], groups: [] },
  { membership: "rio", prefixes: ["riocinema.org.uk"], groups: [] },
  { membership: "garden", prefixes: ["thegardencinema.co.uk"], groups: [] },
  { membership: "lexi", prefixes: ["thelexicinema.co.uk"], groups: [] },
  { membership: "ica", prefixes: ["ica.art"], groups: [] },
  { membership: "barbican", prefixes: ["barbican.org.uk"], groups: [] },
  { membership: "vue-pass", prefixes: ["myvue.com-"], groups: ["Vue"] },
];

export function membershipsForVenue(id: string, group?: string): string[] {
  return rules
    .filter(
      (rule) =>
        rule.prefixes.some(
          (prefix) => id === prefix || id.startsWith(prefix.endsWith("-") ? prefix : `${prefix}-`),
        ) ||
        (group !== undefined && rule.groups.includes(group)),
    )
    .map((rule) => rule.membership);
}
