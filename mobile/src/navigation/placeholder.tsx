import { ScrollView, StyleSheet } from "react-native";
import { Notice } from "@/ui/notice";
import { colors } from "@/ui/tokens";

/** The tabs that later PRs fill: Events and Radar (PR 5), My films and Account (PR 6). */
export function PlaceholderScreen({ title, body }: { title: string; body: string }) {
  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic">
      <Notice title={title} body={body} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg } });
