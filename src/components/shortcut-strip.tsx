import type { ViewState } from "../lib/catalogue";
import { shortcutItems, type ShortcutItem } from "../lib/shortcuts";

export function ShortcutStrip(
  props: Parameters<typeof shortcutItems>[0] & {
    onChange: (changes: Partial<ViewState>) => void;
    onNearby: () => void;
  },
) {
  const items = shortcutItems(props);
  const button = (item: ShortcutItem) => (
    <button
      key={item.id}
      data-shortcut={item.id}
      aria-pressed={item.changes ? !!item.active : undefined}
      aria-haspopup={item.changes ? undefined : "dialog"}
      disabled={item.disabled}
      title={item.title}
      onClick={() => (item.changes ? props.onChange(item.changes) : props.onNearby())}
    >
      {item.label}
    </button>
  );
  const when = items.filter((item) => item.group === "when");
  const personal = items.filter((item) => item.group !== "when");
  // Two rows by meaning: one line with a separator on desktop, two centred rows on the phone.
  return (
    <div class="shortcut-strip" role="group" aria-label="Shortcuts">
      <div class="strip-row" data-group="when">
        {when.map(button)}
      </div>
      {personal.length > 0 && <span class="strip-sep" aria-hidden="true" />}
      {personal.length > 0 && (
        <div class="strip-row" data-group="personal">
          {personal.map(button)}
        </div>
      )}
    </div>
  );
}
