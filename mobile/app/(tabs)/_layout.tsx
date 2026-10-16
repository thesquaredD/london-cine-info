import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTokens } from "../../src/ui";
export default function Tabs() {
  const c = useTokens();
  return (
    <NativeTabs backgroundColor={c.panel} tintColor={c.brass}>
      <NativeTabs.Trigger name="films">
        <NativeTabs.Trigger.Label>Films</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="film" md="movie" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="events">
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="event" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="radar">
        <NativeTabs.Trigger.Label>Radar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="dot.radiowaves.left.and.right" md="radar" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mine">
        <NativeTabs.Trigger.Label>My films</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bookmark" md="bookmark" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
