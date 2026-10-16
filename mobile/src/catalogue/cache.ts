import { Directory, File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CatalogueCache, Catalogue } from "./loader";
const POINTER = "lci.catalogue-generation.v1";
const directory = () => new Directory(Paths.cache, "catalogues");
export const fileCache: CatalogueCache = {
  async read() {
    const name = await AsyncStorage.getItem(POINTER);
    if (!name || !/^catalogue-[\d-]+\.json$/.test(name)) return null;
    const file = new File(directory(), name);
    return file.exists ? (JSON.parse(await file.text()) as Catalogue) : null;
  },
  async write(data) {
    const dir = directory();
    dir.create({ idempotent: true, intermediates: true });
    const name = `catalogue-${Date.now()}.json`;
    const staged = new File(dir, name);
    staged.write(JSON.stringify(data));
    // The durable pointer commits only after the complete file has been written.
    await AsyncStorage.setItem(POINTER, name);
    for (const file of dir.list())
      if (file.name !== name) {
        try {
          file.delete();
        } catch {
          /* Eviction can retry next refresh. */
        }
      }
  },
};
