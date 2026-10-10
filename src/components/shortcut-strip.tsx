import { Fragment } from "preact";
import type { ViewState } from "../lib/catalogue";
import { shortcutItems } from "../lib/shortcuts";

export function ShortcutStrip(
  props: Parameters<typeof shortcutItems>[0] & {
    onChange: (changes: Partial<ViewState>) => void;
    onNearby: () => void;
  },
) {
  const items = shortcutItems(props);
  return (
    <div class="shortcut-strip" role="group" aria-label="Shortcuts">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 && item.group !== items[index - 1]?.group && (
            <span class="strip-sep" aria-hidden="true" />
          )}
          <button
            aria-pressed={item.active}
            disabled={item.disabled}
            title={item.title}
            onClick={() => (item.changes ? props.onChange(item.changes) : props.onNearby())}
          >
            {item.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
