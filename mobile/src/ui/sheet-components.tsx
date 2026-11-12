import { createContext, useContext, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { ScrollView, TextInput } from "react-native";
import { BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";

/** Native formSheet content uses RN controls; the Android modal needs gesture/keyboard-aware ones. */
export const SheetComponentsContext = createContext(false);

export function SheetScrollView(
  props: ComponentPropsWithoutRef<typeof ScrollView> & { children: ReactNode },
) {
  const inBottomSheet = useContext(SheetComponentsContext);
  return inBottomSheet ? <BottomSheetScrollView {...props} /> : <ScrollView {...props} />;
}

export function SheetTextInput(props: ComponentPropsWithoutRef<typeof TextInput>) {
  const inBottomSheet = useContext(SheetComponentsContext);
  return inBottomSheet ? <BottomSheetTextInput {...props} /> : <TextInput {...props} />;
}
