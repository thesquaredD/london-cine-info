import { Directory, File, Paths } from "expo-file-system";
import type { CacheFiles } from "./cache";

/**
 * `CacheFiles` on the device: a `catalogue` folder in the app's cache directory. The operating
 * system may clear that folder when storage runs low; the app then loads the catalogue from
 * the network as on a first launch.
 */
export function expoCacheFiles(folder = "catalogue"): CacheFiles {
  const directory = new Directory(Paths.cache, folder);
  const ensure = () => {
    if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  };
  return {
    async list() {
      if (!directory.exists) return [];
      return directory.list().map((item) => item.name);
    },
    async read(name) {
      return new File(directory, name).text();
    },
    async write(name, text) {
      ensure();
      const file = new File(directory, name);
      if (file.exists) file.delete();
      file.create();
      file.write(text);
    },
    async remove(name) {
      const file = new File(directory, name);
      if (file.exists) file.delete();
    },
  };
}
