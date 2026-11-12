import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { KeyboardAvoidingView, Modal, Platform, StatusBar, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetHandle,
  BottomSheetModalProvider,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  type BottomSheetHandleProps,
} from "@gorhom/bottom-sheet";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { ViewScope, type ViewScopeName } from "@/films/view-context";
import { SheetComponentsContext } from "@/ui/sheet-components";
import { colors } from "@/ui/tokens";
import { FiltersSheet } from "./filters-sheet";

type Presenter = { open: (scope: ViewScopeName, restoreFocus?: () => void) => void };
type Opening = { id: number; scope: ViewScopeName; restoreFocus?: () => void };
const AndroidFiltersContext = createContext<Presenter | null>(null);
const SNAP_POINTS = ["92%"];

export function useAndroidFilters() {
  return useContext(AndroidFiltersContext);
}

/** Android uses a native modal window above the tabs; iOS keeps its native form sheet. */
export function AndroidFiltersProvider({ children }: { children: ReactNode }) {
  return Platform.OS === "android" ? <AndroidModalHost>{children}</AndroidModalHost> : children;
}

function AndroidModalHost({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const active = useRef<Opening | null>(null);
  const restoreFocus = useRef<(() => void) | undefined>(undefined);
  const [opening, setOpening] = useState<Opening | null>(null);
  const open = useCallback<Presenter["open"]>((scope, onClosed) => {
    const request = { id: ++nextId.current, scope, restoreFocus: onClosed };
    active.current = request;
    setOpening(request);
  }, []);
  const presenter = useMemo(() => ({ open }), [open]);
  const complete = useCallback((id: number) => {
    // A late callback from a previous dismissal must not close a new opening.
    if (active.current?.id !== id) return;
    restoreFocus.current = active.current.restoreFocus;
    active.current = null;
    setOpening(null);
  }, []);
  useEffect(() => {
    if (opening) return;
    const restore = restoreFocus.current;
    restoreFocus.current = undefined;
    if (!restore) return;
    // Allow the native dialog removal to commit before sending focus to the activity.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(restore);
    });
    return () => cancelAnimationFrame(frame);
  }, [opening]);
  return (
    <AndroidFiltersContext.Provider value={presenter}>
      {children}
      {opening ? (
        <AndroidFilterModal key={opening.id} opening={opening} onClosed={complete} />
      ) : null}
    </AndroidFiltersContext.Provider>
  );
}

/** Native window isolates the sheet from the tabs for TalkBack and keyboard resizing. */
function AndroidFilterModal({
  opening,
  onClosed,
}: {
  opening: Opening;
  onClosed: (id: number) => void;
}) {
  const [shown, setShown] = useState(false);
  const back = useRef<(() => void) | null>(null);
  const requestClose = useCallback(() => {
    if (back.current) back.current();
    else onClosed(opening.id);
  }, [onClosed, opening.id]);
  return (
    <Modal
      transparent
      visible
      animationType="none"
      onShow={() => setShown(true)}
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior="height"
          keyboardVerticalOffset={StatusBar.currentHeight ?? 0}
        >
          <SafeAreaProvider>
            <BottomSheetModalProvider>
              <AndroidSheetContents
                opening={opening}
                onClosed={onClosed}
                shown={shown}
                back={back}
              />
            </BottomSheetModalProvider>
          </SafeAreaProvider>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Measures insets inside the dialog, whose usable frame differs from the activity's. */
function AndroidSheetContents({
  opening,
  onClosed,
  shown,
  back,
}: {
  opening: Opening;
  onClosed: (id: number) => void;
  shown: boolean;
  back: RefObject<(() => void) | null>;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const [presented, setPresented] = useState(false);
  const insets = useSafeAreaInsets();
  const close = useCallback(() => modal.current?.dismiss(), []);
  const registerBack = useCallback(
    (handler: () => void) => {
      back.current = handler;
      return () => {
        back.current = null;
      };
    },
    [back],
  );
  useEffect(() => {
    if (shown) modal.current?.present();
  }, [shown]);
  const finish = useCallback(() => onClosed(opening.id), [onClosed, opening.id]);
  const changed = useCallback(
    (index: number) => {
      if (index === -1) finish();
      else setPresented(index === 0);
    },
    [finish],
  );
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.45}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        onPress={close}
        accessible={false}
        accessibilityRole="none"
        accessibilityLabel=""
        accessibilityHint=""
      />
    ),
    [close],
  );
  return (
    <BottomSheetModal
      ref={modal}
      accessible={false}
      accessibilityRole="none"
      accessibilityLabel=""
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      topInset={insets.top}
      enablePanDownToClose
      enableBlurKeyboardOnGesture
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={backdrop}
      backgroundComponent={SheetBackground}
      handleComponent={SheetHandle}
      onChange={changed}
      onDismiss={finish}
    >
      <ViewScope name={opening.scope}>
        <SheetComponentsContext.Provider value={true}>
          <FiltersSheet
            kind={opening.scope}
            onClose={close}
            focusReady={presented}
            registerBack={registerBack}
          />
        </SheetComponentsContext.Provider>
      </ViewScope>
    </BottomSheetModal>
  );
}
// Decorative surfaces must not take TalkBack focus ahead of the heading. The header
// already provides an accessible Close button as the alternative to drag/backdrop dismissal.
function SheetBackground({ style, pointerEvents }: BottomSheetBackgroundProps) {
  return (
    <View accessible={false} pointerEvents={pointerEvents} style={[style, styles.background]} />
  );
}
function SheetHandle(props: BottomSheetHandleProps) {
  return (
    <BottomSheetHandle
      {...props}
      accessible={false}
      accessibilityRole="none"
      accessibilityLabel=""
      accessibilityHint=""
      indicatorStyle={styles.handle}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  background: { backgroundColor: colors.panel, borderRadius: 12 },
  handle: { backgroundColor: colors.muted },
});
