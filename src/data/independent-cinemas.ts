import type { Venue } from "../shared/data";

/** Independently run / charitable cinemas, not an inference from missing group metadata.
 * Sources reviewed 2026-10-19. Unknown venues stay out until reviewed. Membership eligibility
 * and programming style do not establish ownership. Keep IDs exact so a new venue is reviewed.
 */
export const INDEPENDENT_CINEMAS: Record<string, string> = {
  "davidleancinema.org.uk": "https://www.davidleancinema.org.uk/about/",
  "regentstreetcinema.com": "https://www.regentstreetcinema.com/about-us/",
  "cinemamuseum.org.uk": "https://cinemamuseum.org.uk/",
  "peckhamplex.london": "https://www.peckhamplex.london/index.php/about-us",
  "riversidestudios.co.uk": "https://riversidestudios.co.uk/privacy-and-cookies/",
  "princecharlescinema.com": "https://princecharlescinema.com/about/",
  "thegardencinema.co.uk": "https://www.thegardencinema.co.uk/about-us/",
  "genesiscinema.co.uk": "https://genesiscinema.co.uk/hire",
  "riocinema.org.uk": "https://riocinema.org.uk/",
  "thelexicinema.co.uk": "https://filmlondon.org.uk/resource/film-london-lodestars-2021-exhibitors",
  "phoenixcinema.co.uk": "https://phoenixcinema.co.uk/",
  "actonecinema.co.uk": "https://actonecinema.co.uk/",
  "arthousecrouchend.co.uk": "https://www.arthousecrouchend.co.uk/contact/",
  "closeupfilmcentre.com": "https://www.closeupfilmcentre.com/footer/about/",
  "thecastlecinema.com": "https://thecastlecinema.com/about-us/",
  "castlesidcup.com": "https://thecastlecinema.com/about-us/",
  "thenickel.co.uk": "https://thenickel.co.uk/about",
  "ica.art": "https://ica.art/about",
  "bfi.org.uk-southbank": "https://www.bfi.org.uk/about-bfi",
  "bfi.org.uk-imax": "https://www.bfi.org.uk/about-bfi",
};

export function isIndependentCinema(venue: Pick<Venue, "id"> | undefined): boolean {
  return !!venue && Object.hasOwn(INDEPENDENT_CINEMAS, venue.id);
}
