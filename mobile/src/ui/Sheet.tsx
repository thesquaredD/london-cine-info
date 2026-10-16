import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, type PropsWithChildren } from "react";
import { BackHandler, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { Button, Footer, Text, useTokens } from "./index";
export function Sheet({
  title,
  open,
  onClose,
  children,
  result,
}: PropsWithChildren<{ title: string; open: boolean; onClose(): void; result?: string }>) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const c = useTokens();
  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [open, onClose]);
  return (
    <BottomSheetModal
      ref={ref}
      topInset={insets.top}
      snapPoints={["85%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: c.bg }}
      handleIndicatorStyle={{ backgroundColor: c.brass }}
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
      )}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text accessibilityRole="header" tone="heading">
          {title}
        </Text>
      </View>
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        {children}
      </BottomSheetScrollView>
      <View style={{ paddingBottom: insets.bottom }}>
        <Footer>
          <Button label={result ?? "Done"} onPress={onClose} selected />
        </Footer>
      </View>
    </BottomSheetModal>
  );
}
