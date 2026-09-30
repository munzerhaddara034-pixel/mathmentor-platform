# Redesign v2 — colour contrast (WCAG 2.1 AA)

Tokens live in `src/app/globals.css` (`:root` / `[data-theme]` / `html.theme-*`) and the glass
primitives in `src/styles/v2.css`. Ratios below are computed with the WCAG relative-luminance formula.
Translucent glass is composited over the page background (`--background`). "glass_hi" is the lightest
dark-mode glass stop (worst case for light text); "glass_lo" is the most transparent light-mode stop.
`glass_solid` is the opaque fallback used by `html.lowend` and by browsers without `backdrop-filter`.

Body text needs 4.5:1. Large/bold display text (≥ 24px, or ≥ 18.66px bold) needs 3:1, but every pair
below also clears 4.5:1.

| Theme | Foreground | Background | Ratio | AA (4.5) |
|---|---|---|---|---|
| dark | ink/heading #F4F6FF | bg | 18.44:1 | pass |
| dark | ink/heading #F4F6FF | card | 16.13:1 | pass |
| dark | ink/heading #F4F6FF | glass_hi | 15.26:1 | pass |
| dark | ink/heading #F4F6FF | glass_solid | 16.13:1 | pass |
| dark | muted #C3CAE4 | bg | 12.20:1 | pass |
| dark | muted #C3CAE4 | card | 10.67:1 | pass |
| dark | muted #C3CAE4 | glass_hi | 10.10:1 | pass |
| dark | muted #C3CAE4 | glass_solid | 10.67:1 | pass |
| dark | link #3DDCF5 | bg | 12.08:1 | pass |
| dark | link #3DDCF5 | card | 10.56:1 | pass |
| dark | link #3DDCF5 | glass_hi | 10.00:1 | pass |
| dark | violet-ink #D7B8FF | bg | 11.54:1 | pass |
| dark | violet-ink #D7B8FF | glass_hi | 9.55:1 | pass |
| dark | gold-ink #F6C453 | bg | 12.25:1 | pass |
| dark | gold-ink #F6C453 | glass_hi | 10.14:1 | pass |
| dark | gold-ink #F6C453 | gold_soft | 9.60:1 | pass |
| dark | white on primary-fill #5B49F0 | pf | 5.74:1 | pass |
| dark | #1A1206 on gold button (#F6C453 end) | g | 11.42:1 | pass |
| dark | rose #FF8FB1 | bg | 9.29:1 | pass |
| dark | rose #FF8FB1 | glass_hi | 7.69:1 | pass |
| light | ink/heading #0B1030 | bg | 17.25:1 | pass |
| light | ink/heading #0B1030 | card | 18.57:1 | pass |
| light | ink/heading #0B1030 | glass_lo | 18.13:1 | pass |
| light | muted #3B4468 | bg | 8.82:1 | pass |
| light | muted #3B4468 | card | 9.49:1 | pass |
| light | muted #3B4468 | glass_lo | 9.27:1 | pass |
| light | link #097386 | bg | 5.12:1 | pass |
| light | link #097386 | card | 5.51:1 | pass |
| light | link #097386 | glass_lo | 5.39:1 | pass |
| light | violet-ink #7B3FE0 | bg | 5.37:1 | pass |
| light | violet-ink #7B3FE0 | card | 5.79:1 | pass |
| light | gold-ink #7A5000 | card | 7.06:1 | pass |
| light | gold-ink #7A5000 | gold_soft | 6.39:1 | pass |
| light | white on primary-fill #5B49F0 | pf | 5.74:1 | pass |
| light | #1A1206 on gold button | g | 11.42:1 | pass |
| light | rose #B8325E | bg | 5.34:1 | pass |
| light | rose #B8325E | card | 5.74:1 | pass |

## Notes

- Light mode `--link` was `#0B7F95` (4.35:1 on the `#F5F6FF` page, a fail). It is now `#097386`
  (5.1:1 on the page, 5.5:1 on white cards).
- The gold CTA (`.v2-btn-gold`) keeps dark text `#1A1206` in both themes. White on gold would be 1.6:1.
- Filled violet buttons use `--primary-fill` `#5B49F0` with white text (5.7:1). The lighter `--primary`
  `#7C6BFF` is used only for borders, focus rings and decoration.
- Focus: `:focus-visible` on v2 controls uses a 2px `--accent-cyan` outline with a 2px offset. Its non-text
  contrast is 12.1:1 on the dark page (`#3DDCF5`) and 4.3:1 on the light page (`#0B7F95`). Both are ≥ 3:1.
- Motion: every entrance animation (CSS `Reveal`, orb pulse, Framer typing bubble) is disabled under
  `prefers-reduced-motion: reduce`.
