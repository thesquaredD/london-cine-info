import { Redirect } from "expo-router";

/**
 * The launch URL is `/`, which no tab owns (each tab's list is `/<tab>`). Without this route
 * Expo Router matched `/` to whichever tab it resolved first, and the app opened on My films.
 */
export default function Index() {
  return <Redirect href="/films" />;
}
