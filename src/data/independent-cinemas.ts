import type { Venue } from "../shared/data";

/** Reviewed venues that are independently run, charities, or run by a public or educational
 * body (BFI, Barbican, a university, a national cultural institute). Never inferred from
 * missing group metadata. Sources reviewed 2026-10-19: the venue's own about page, or its
 * Charity Commission entry. Unknown venues stay out until reviewed. Membership eligibility and
 * programming style do not establish ownership. Keep IDs exact so a new venue is reviewed;
 * build-data warns when an ID here is missing from the dataset.
 */
export const INDEPENDENT_CINEMAS: Record<string, string> = {
  "davidleancinema.org.uk": "https://www.davidleancinema.org.uk/about/",
  "regentstreetcinema.com": "https://www.regentstreetcinema.com/about-us/",
  "cinemamuseum.org.uk": "https://cinemamuseum.org.uk/",
  "peckhamplex.london": "https://www.peckhamplex.london/index.php/about-us",
  "riversidestudios.co.uk":
    "https://register-of-charities.charitycommission.gov.uk/en/charity-search/-/charity-details/5244698",
  "princecharlescinema.com": "https://princecharlescinema.com/about/",
  "thegardencinema.co.uk": "https://www.thegardencinema.co.uk/about-us/",
  "genesiscinema.co.uk": "https://genesiscinema.co.uk/about",
  "riocinema.org.uk": "https://riocinema.org.uk/",
  "thelexicinema.co.uk": "https://thelexicinema.co.uk/TheLexiCinema.dll/Page?p=0&m=m",
  "phoenixcinema.co.uk": "https://phoenixcinema.co.uk/",
  "actonecinema.co.uk": "https://actonecinema.co.uk/",
  "arthousecrouchend.co.uk": "https://www.arthousecrouchend.co.uk/about/",
  "closeupfilmcentre.com": "https://www.closeupfilmcentre.com/footer/about/",
  "thecastlecinema.com": "https://thecastlecinema.com/about-us/",
  "castlesidcup.com": "https://castlesidcup.com/about-us/",
  "thenickel.co.uk": "https://thenickel.co.uk/about",
  "ica.art": "https://ica.art/about",
  "bfi.org.uk-southbank": "https://www.bfi.org.uk/about-bfi",
  "bfi.org.uk-imax": "https://www.bfi.org.uk/about-bfi",
  "bfi.org.uk-stephen-street": "https://www.bfi.org.uk/about-bfi",
  "forestcinema.co.uk": "https://www.forestcinema.co.uk/about",
  "richmix.org.uk":
    "https://register-of-charities.charitycommission.gov.uk/en/charity-search/-/charity-details/3973244",
  "jw3.org.uk":
    "https://register-of-charities.charitycommission.gov.uk/en/charity-search/-/charity-details/4028710",
  "kilntheatre.com":
    "https://register-of-charities.charitycommission.gov.uk/en/charity-search/-/charity-details/276892",
  "castlehaven.org.uk":
    "https://register-of-charities.charitycommission.gov.uk/en/charity-search/-/charity-details/295829",
  "barbican.org.uk": "https://www.barbican.org.uk/about-us",
  "institut-francais.org.uk": "https://www.institut-francais.org.uk/about-us/",
  "qmul.ac.uk-bloc": "https://www.qmul.ac.uk/bloc/",
};

export function isIndependentCinema(venue: Pick<Venue, "id"> | undefined): boolean {
  return !!venue && Object.hasOwn(INDEPENDENT_CINEMAS, venue.id);
}

/** Allowlisted IDs absent from the dataset: a renamed or closed venue needs review. */
export function missingIndependentCinemas(venues: Pick<Venue, "id">[]): string[] {
  const known = new Set(venues.map((venue) => venue.id));
  return Object.keys(INDEPENDENT_CINEMAS).filter((id) => !known.has(id));
}
