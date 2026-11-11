import type { ReactElement, ReactNode } from "react";
import { Platform } from "react-native";
import { Link, type Href } from "expo-router";
import type { Film } from "@readograph/core/data";
import { IOS_POSTER_TRANSITION } from "@/ui/motion";
import type { ViewScopeName } from "./view-context";

/** The film detail route inside the tab's own stack, so Back returns within the tab. */
export function detailHref(scope: ViewScopeName, film: Pick<Film, "id">): Href {
  return { pathname: `/${scope}/[id]`, params: { id: film.id } } as Href;
}

const zoom = Platform.OS === "ios" && IOS_POSTER_TRANSITION === "zoom";

/**
 * Opens the film detail from a row or a grid poster. On iOS 18 and later the poster inside
 * `ZoomSource` grows into the detail poster through Expo Router's `Link.AppleZoom`, with the
 * system's interactive swipe back; elsewhere it is the stack's push. `canOpen` lets the
 * List ⇄ Posters morph ignore taps until it settles.
 */
export function DetailLink({
  href,
  canOpen,
  children,
}: {
  href: Href;
  canOpen?: () => boolean;
  children: ReactElement;
}) {
  return (
    <Link
      href={href}
      asChild
      onPress={(event: { preventDefault(): void }) => {
        if (canOpen && !canOpen()) event.preventDefault();
      }}
    >
      {children}
    </Link>
  );
}

/** Marks the poster that zooms into the detail screen (iOS); a plain wrapper elsewhere. */
export function ZoomSource({ children }: { children: ReactNode }) {
  return zoom ? <Link.AppleZoom>{children}</Link.AppleZoom> : <>{children}</>;
}

/** The detail screen's poster, where the zoom lands (iOS); a plain wrapper elsewhere. */
export function ZoomTarget({ children }: { children: ReactNode }) {
  return zoom ? <Link.AppleZoomTarget>{children}</Link.AppleZoomTarget> : <>{children}</>;
}
