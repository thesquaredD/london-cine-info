import { useState } from "preact/hooks";
import { RATINGS } from "@lci/core/catalogue";
import { moveRating, type DisplayState, type TitleMode } from "../lib/display";
import type { RatingKey } from "@lci/core/data";
type Props = {
  value: DisplayState;
  onChange: (value: DisplayState) => void;
};
export function DisplayControls({ value, onChange }: Props) {
  return (
    <>
      <label>
        Film titles
        <select
          value={value.titleMode}
          onChange={(event) =>
            onChange({ ...value, titleMode: event.currentTarget.value as TitleMode })
          }
        >
          <option value="both">Title & original</option>
          <option value="title">Title only</option>
          <option value="original">Original title</option>
        </select>
      </label>
      <label class="checkbox-choice">
        <input
          type="checkbox"
          checked={!!value.hideWatchlistRatings}
          onChange={(event) =>
            onChange({ ...value, hideWatchlistRatings: event.currentTarget.checked })
          }
        />{" "}
        Hide ratings in my watchlist
      </label>
    </>
  );
}
export function RatingOrderControls({ value, onChange }: Props) {
  const [announcement, setAnnouncement] = useState("");
  function move(key: RatingKey, destination: number) {
    onChange({ ...value, ratingOrder: moveRating(value.ratingOrder, key, destination) });
    setAnnouncement(
      `${RATINGS.find((rating) => rating.key === key)!.name} is rating column ${destination + 1} of 4.`,
    );
  }
  return (
    <>
      <p class="filter-hint">Drag or use the arrows to reorder.</p>
      <ol aria-label="Rating column order">
        {value.ratingOrder.map((key, index) => {
          const rating = RATINGS.find((rating) => rating.key === key)!;
          return (
            <li
              key={key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const source = event.dataTransfer?.getData("text/plain") as RatingKey;
                if (value.ratingOrder.includes(source)) move(source, index);
              }}
            >
              <span
                class="rating-drag"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer!.setData("text/plain", key);
                  event.dataTransfer!.effectAllowed = "move";
                }}
                title={`Drag ${rating.name}`}
                aria-hidden="true"
              >
                ⠿
              </span>
              <span>{rating.name}</span>
              <button
                type="button"
                aria-label={`Move ${rating.name} rating up`}
                disabled={index === 0}
                onClick={() => move(key, index - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${rating.name} rating down`}
                disabled={index === value.ratingOrder.length - 1}
                onClick={() => move(key, index + 1)}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
      <span class="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}
