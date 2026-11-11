import { Notice } from "@/ui/notice";
import { useCatalogue, useCatalogueStore } from "./provider";

/**
 * What a screen shows while there is no catalogue at all: loading, an app update needed
 * (rule 5 with nothing cached), or the failed first download with Try again.
 */
export function CatalogueStatus() {
  const { loading, error, updateRequired } = useCatalogue();
  const store = useCatalogueStore();
  if (loading) return <Notice title="Loading listings…" />;
  if (updateRequired)
    return (
      <Notice
        title="Update the app to see the listings"
        body="The listings now need the latest version of Readograph."
      />
    );
  return (
    <Notice
      title="No listings yet"
      body={error ?? undefined}
      action={{ label: "Try again", onPress: () => void store.refresh() }}
    />
  );
}
