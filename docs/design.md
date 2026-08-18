# Rolewire — Design Tokens

**Companion to:** `frontend-spec.md`, `rolewire-landing-concept.html`
**Scope:** Color and type tokens for both dark mode (default, shown in the current concept) and light mode.

---

## Fonts

| Role | Typeface | Weight(s) used | Notes |
|---|---|---|---|
| Display (headline) | **Fraunces** | 380 (italic emphasis), 520 (headline) | Editorial serif — deliberately not the expected dev-tool grotesk; carries the page's personality |
| Body / UI (nav, buttons, paragraph) | **Inter** | 400, 500, 600 | Everything a person reads or clicks |
| Mono / data (brand mark, eyebrow, code panels, route labels) | **IBM Plex Mono** | 400, 500 | Reserved for anything that *is* data or signals "infrastructure" — brand mark, API panels, route diagram labels |

Same three typefaces across both modes — only color tokens change between dark and light.

---

## Colors — Dark mode (default)

| Token | Hex / value | Used for |
|---|---|---|
| `--ink` | `#0c0f0d` | Page background |
| `--ink-soft` | `#121512` | Code panel / route-node background |
| `--paper` | `#f3f1ea` | Primary text, primary button background |
| `--line` | `#2a2f2a` | Solid borders (reserved) |
| `--line-soft` | `rgba(243,241,234,0.12)` | Hairline borders, dividers, route track |
| `--copper` | `#c07a3e` | Darker accent variant (reserved) |
| `--copper-bright` | `#e2934f` | Primary accent — eyebrow tag, signal dot, animated wire, CTA button, active nodes |
| `--signal` | `#7fae7a` | HTTP method labels, JSON boolean/number values |
| `--text-dim` | `#9a9d95` | Secondary text, nav links (default state), captions |

---

## Colors — Light mode

Same roles, values flipped for a white/paper background while keeping the copper-wire accent as the one constant that carries brand identity across both modes.

| Token | Hex / value | Used for |
|---|---|---|
| `--ink` | `#17190f` | Primary text (headline, body) |
| `--ink-soft` | `#eceadf` | Code panel / route-node background |
| `--paper` | `#faf8f2` | Page background, primary button text |
| `--line` | `#d8d4c6` | Solid borders (reserved) |
| `--line-soft` | `rgba(23,25,15,0.10)` | Hairline borders, dividers, route track |
| `--copper` | `#a8632c` | Primary accent on light backgrounds (deepened from dark-mode copper for AA contrast on white) |
| `--copper-bright` | `#c9782f` | Hover/highlight state, active route nodes |
| `--signal` | `#4d7548` | HTTP method labels, JSON values (deepened from dark-mode signal green for contrast) |
| `--text-dim` | `#6b6e62` | Secondary text, nav links (default state), captions |

**Why the accent darkens in light mode:** `#e2934f` and `#7fae7a` are tuned for contrast against near-black — placed directly on `#faf8f2`, both fail comfortable AA contrast for text-sized use. `--copper` and `--signal` in light mode are deepened versions of the same hues, not new colors, so the brand reads as the same palette in both modes rather than two different products.

---

## Implementation note

Both palettes are defined as CSS custom properties under `:root` (dark, default) and a `[data-theme="light"]` override block, switched via a `data-theme` attribute on `<html>` — no separate stylesheet, no class-per-component overrides. This is not yet wired into `rolewire-landing-concept.html`; say the word and I'll add the toggle and light-mode block to that file directly.