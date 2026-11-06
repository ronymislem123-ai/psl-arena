# PSL scales and the Scale Builder

A PSL scale maps the 0–10 rating to named tiers. Scales are user data (`psl_scales`), except the built-in **PSL Standard** scale, which is served from code (`buildStandardScale()` in `src/engine/psl/scale.ts`).

## Data model

```
PslScale  { id, name, description, rangeMin, rangeMax, tiers[], version, builtIn, createdAt, updatedAt }
PslTier   { id, name, short, group, min, max, order, description, color, percentile, images[{ imageId, caption }], notes }
```

Reference images live in the encrypted image store (owner-scoped); a tier stores only their ids and captions. Every rating and tournament stores a **snapshot** of the scale (`PslScaleSnapshot`: name, version, range, tiers without images) so later edits of the template never change finished results.

## Standard scale (0.0–10.0, 7 groups, 21 tiers)

| Group | Tiers (id) | Ranges |
| --- | --- | --- |
| Lowest Tiers | sub1, sub2, sub3, sub4 | 0–1, 1–2, 2–3, 3–4 |
| Low Tier Normie | lltn, mltn, hltn | 4–4.333333, 4.333333–4.666667, 4.666667–5 |
| Mid Tier Normie | lmtn, mmtn, hmtn | 5–5.333333, 5.333333–5.666667, 5.666667–6 |
| High Tier Normie | lhtn, mhtn, hhtn | 6–6.333333, 6.333333–6.666667, 6.666667–7 |
| Chadlite | chadlite_low, chadlite_mid, chadlite_high | 7–7.333333, 7.333333–7.666667, 7.666667–8 |
| Chad | chad_low, chad_mid, chad_high | 8–8.333333, 8.333333–8.666667, 8.666667–9 |
| Adam Tier | adamlite, adam | 9–9.5, 9.5–10 |

Thirds are generated as `min + (max − min)·k/3` and rounded to six decimals; adjacent tiers share exactly the same stored boundary, so the ladder is gap-free by construction. The standard scale is a configurable community convention, not a validated attractiveness scale (the research log documents how inconsistent the community's own versions are).

## Assignment rules

- Lower bound inclusive, upper bound exclusive: `min ≤ value < max`.
- Only the top bound of the scale is inclusive (`value = rangeMax` belongs to the last tier).
- Assignment uses the **unrounded** value; e.g. 4.6666 displays as 4.67 but is *Mid LTN*, 4.666667 is *High LTN*.
- Values outside the range have no tier (`null`).

## Validation (`validateScale`)

Checked on every edit and before saving/activating: empty scale name, invalid range, no tiers, duplicate tier ids, empty tier names, `min ≥ max`, overlaps, gaps (including at the ends of the range), tiers outside the range, order not matching the ranges, invalid colours, invalid image references. The editor shows every problem and disables saving while any exists; the API rejects invalid scales with HTTP 400 and the list of issues.

## Editor features

- Create (starts from a copy of the standard scale), rename, describe, set the range.
- Tiers: add, duplicate, remove (the neighbour absorbs the freed range), move (identity swaps while the ranges stay in place), linked bounds (editing a tier's max moves the next tier's min), "distribute bounds evenly", colour picker, short name, parent group, percentile claim (free text — never computed), description, notes.
- Reference images per tier (up to 12): upload (resized client-side, stored encrypted), caption, reorder, move to another tier, remove. Images require a saved scale.
- Live preview in five views: vertical ranking, horizontal overview (bar + groups), table, cards, image overview; a value tester shows the assigned tier.
- Manage: duplicate, export JSON, import JSON (validated; images excluded), delete (removes its reference images), compare all scales on one axis, restore the standard scale as an editable copy.

## Integration

The rater offers every scale of the account; the tournament wizard too (participants' ratings keep their own scores, the tournament assigns tiers from its own snapshot for display). Exports carry the snapshot. Deleting a scale never alters stored ratings.
