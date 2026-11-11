import * as WebBrowser from "expo-web-browser";
import { colors } from "./tokens";

/** Links open in the in-app browser, tinted to match the app. */
export function openLink(url: string) {
  return WebBrowser.openBrowserAsync(url, {
    controlsColor: colors.fg,
    toolbarColor: colors.bg,
    dismissButtonStyle: "close",
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => undefined);
}
