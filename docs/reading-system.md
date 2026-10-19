# Reading system

How text is presented anywhere on the site that is mostly words: the Privacy, About and
What's new pages, the sign-in and settings ledes, the feedback dialog, notices and empty
states. One scale and a small set of blocks, so every text surface reads as the same site.
The shared stylesheet is `src/styles/prose.css`.

Mockups of every block in use: https://claude.ai/artifact/XrtzgxorfQirUYVFPTfTnk.

## Rules

1. **Do not set your own scale.** No `font-size`, `line-height`, `max-width` or vertical
   spacing on a text page or dialog outside `prose.css`. Add a token or block there instead.
2. **Three or more parallel facts are never a paragraph.** They are a bulleted list, a
   definition list (what is what) or a table (every row has the same two or three facts).
3. **Every long page starts with a lede** (one or two sentences, full foreground colour) and,
   when it has more than four sections, an **In short** summary card and an **On this page**
   map.
4. **Sections are delimited**: a hairline above, a numbered heading when there is a map,
   40px to the next. Groups inside a section get an eyebrow label, not a heading.
5. **Small print is small and muted, and never carries the main point.** Caveats, status
   lines and legal notes use the small size; the thing the reader came for uses the body size.
6. **A setting inside prose is a control row**, not a sentence with a checkbox in it.
7. **An action sits in a footer bar**: small print left, one primary button right. Dialogs
   end this way.
8. **Notices have a title, one sentence and an actions row.** Error edge in `--link`, status
   in `--brass`, success in `--rating`. Empty states name what is on and offer to loosen it.
9. **Copy stays plain.** Restructure before rewording; one idea per sentence; no design or
   engineering vocabulary in anything a reader sees.
10. **Colours are tokens** from the last `:root` block in `src/styles/picturehouse.css`. No hex
    in prose rules.

## Scale

| Token             | Value                                        | Use                                     |
| ----------------- | -------------------------------------------- | --------------------------------------- |
| `--prose-measure` | `62ch`                                       | max-width of any `p`, `li`, `dd`        |
| `--prose-body`    | `15px / 1.55` (phone `16px / 1.5`)           | body copy                               |
| `--prose-small`   | `14px`, `--muted`                            | caveats, small print, status            |
| `--prose-lede`    | `17px / 1.5`, `--fg`                         | the opening sentence or two             |
| `--prose-h1`      | `30px / 1.15`, weight 500                    | page title, one per page                |
| `--prose-h2`      | `20px / 1.3`, weight 500                     | section heading                         |
| `--prose-eyebrow` | `11px`, weight 500, `.12em`, caps, `--brass` | group label inside a section            |
| `--prose-gap`     | `12px`                                       | between paragraphs; between list groups |
| `--prose-section` | `40px`                                       | between sections                        |

Weights are 400 and 500 only. League Spartan for everything; Clash Display is the wordmark
alone.

## Blocks

| Class            | What it is                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `.prose`         | The article: measure, body size, `overflow-wrap: anywhere`, 960px max, centred.                        |
| `.prose-head`    | Title plus a `·`-separated meta line (last updated, operator, contact).                                |
| `.prose-lede`    | The lede.                                                                                              |
| `.prose-summary` | "In short" card: panel background, 2px brass top rule, eyebrow, three or four bullets.                 |
| `.prose-map`     | Sticky "On this page" list, 44px links, brass marker on the current section; `<details>` below 900px.  |
| `.prose-two`     | 200px map column plus content; one column below 900px.                                                 |
| `.prose-section` | Hairline above, 16px to the heading, `scroll-margin-top`, numbered heading optional.                   |
| `.prose ul`      | Brass markers, 6px between items, two levels at most.                                                  |
| `.prose dl`      | `11em` term column, muted terms; stacked on the phone.                                                 |
| `.prose table`   | Muted header row, hairline rows, `11em` first column; three-plus columns scroll in a box on the phone. |
| `.prose-cols`    | Two paired lists side by side (measured / never sent); one column on the phone.                        |
| `.prose-control` | A bordered row holding one setting: label, 18px brass checkbox, status text at right.                  |
| `.prose-footer`  | Hairline above; small print left (40ch max), primary action right; stacked on the phone.               |
| `.prose-facts`   | Fact tiles: label, value, note; four across, two on the phone.                                         |
| `.notice`        | Title, sentence, actions row, 3px left edge coloured by kind.                                          |

## Checklist before opening a PR that touches text

- The page or dialog uses `.prose` blocks and no local scale rules.
- Nothing is a paragraph that should be a list, dl or table.
- Every accessible name, section id and status string an e2e spec asserts still resolves.
- 390px: no horizontal page scroll, targets at least 44px, the map or details collapses.
- The changelog fragment describes what the reader sees, not the system.
