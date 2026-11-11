import { JavaScriptTabs } from "@/navigation/javascript-tabs";
import { NativeTabsLayout } from "@/navigation/native-tabs";
import { USE_NATIVE_TABS } from "@/navigation/tabs";

/** The five tabs. One switch picks native tabs or the JavaScript fallback (`tabs.ts`). */
export default function TabsLayout() {
  return USE_NATIVE_TABS ? <NativeTabsLayout /> : <JavaScriptTabs />;
}
