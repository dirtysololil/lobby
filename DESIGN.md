# Lobby UI Design System

This file defines the design language for Lobby. It is inspired by the `vercel-ink` reference and Vercel's public interface guidelines, but adapted for Lobby's product shape: private communication, dense navigation, realtime messaging, and moderated community spaces.

## 1. Visual Theme & Atmosphere

- Mood: precise, editorial, terminal-adjacent, and quietly premium.
- Overall direction: Vercel-like black-and-white restraint, not dashboard neon, not glassmorphism.
- Emotional target: calm, technical, trustworthy, low-noise.
- Density: compact and efficient, especially in rails, lists, and detail panels.
- Surfaces should feel machined, not glossy.
- Lobby is not a marketing site first. Favor utility, clarity, and hierarchy over spectacle.

## 2. Core Principles

- Prefer monochrome first. Build hierarchy with contrast, spacing, weight, and border treatment before reaching for color.
- Use color as a status or interaction cue, not as a fill strategy.
- Every panel should have a reason to exist. Avoid nested cards unless they convey structure.
- Shapes are slightly rounded but not soft. Prefer 10px, 12px, 14px, 16px radii.
- Shadows are minimal and mostly ambient. Borders do most of the structural work.
- Motion should be subtle and fast. No decorative floating, glowing, or bloom-heavy effects.
- Empty states, loading states, and error states must look designed, not like leftovers.

## 3. Color Palette & Roles

### Base

- `--bg-app`: `#000000`
- `--bg-sidebar`: `#050505`
- `--bg-panel`: `#0a0a0a`
- `--bg-panel-muted`: `#111111`
- `--bg-panel-soft`: `rgba(255,255,255,0.03)`
- `--bg-hover`: `rgba(255,255,255,0.05)`
- `--bg-active`: `rgba(255,255,255,0.075)`
- `--bg-accent-soft`: `rgba(255,255,255,0.06)`
- `--bg-accent-strong`: `rgba(255,255,255,0.12)`

### Borders

- `--border`: `rgba(255,255,255,0.10)`
- `--border-strong`: `rgba(255,255,255,0.18)`
- `--border-soft`: `rgba(255,255,255,0.07)`

### Text

- `--text`: `#f5f5f5`
- `--text-soft`: `#d4d4d4`
- `--text-dim`: `#a3a3a3`
- `--text-muted`: `#737373`

### Accent & Semantic

- `--accent`: `#fafafa`
- `--accent-strong`: `#ffffff`
- `--accent-secondary`: `#d4d4d4`
- `--accent-warm`: `#ffffff`
- `--success`: `#22c55e`
- `--warning`: `#f59e0b`
- `--danger`: `#ef4444`
- `--ring`: `rgba(255,255,255,0.18)`

### Usage Rules

- Default fills are black or near-black.
- Use white or neutral gray for primary actions before using colored fills.
- Green is only for success/online.
- Amber is only for warning/pending.
- Red is only for destructive or error states.
- Blue/purple gradient fills are not allowed in the main app UI.

## 4. Typography Rules

- Primary font: Geist Sans.
- Monospace font: Geist Mono.
- Headings: tight tracking, high contrast, medium-to-semibold weight.
- Body: readable, compact, neutral.
- UI labels: slightly smaller and cleaner than body text.
- Kicker/eyebrow text: uppercase, mono, widely tracked, low contrast.

### Type Scale

- Display 1: `40-48px`, `font-weight: 600`, `letter-spacing: -0.06em`
- Display 2: `30-36px`, `font-weight: 600`, `letter-spacing: -0.05em`
- Heading 1: `24-28px`, `font-weight: 600`, `letter-spacing: -0.04em`
- Heading 2: `18-22px`, `font-weight: 600`, `letter-spacing: -0.03em`
- Heading 3: `15-17px`, `font-weight: 600`, `letter-spacing: -0.02em`
- Body: `14px`, `line-height: 1.55`
- Body compact: `13px`, `line-height: 1.45`
- Meta: `12px`
- Kicker: `10-11px`, mono, uppercase, tracked

## 5. Spacing & Layout

- Base spacing unit: `4px`.
- Preferred rhythm: `8, 12, 16, 20, 24, 32`.
- Use more whitespace between sections than inside controls.
- Rails and side panels should feel compact and aligned to a grid.
- Default content widths should favor readability over maximum fill.
- Avoid giant hero padding on app screens.

## 6. Radius & Shape

- Small controls: `10px`
- Standard inputs/buttons: `12px`
- Cards/panels: `16px`
- Large shells/modals: `18-24px`
- Pills: full radius

Do not use overly soft 28-32px radii except for top-level shells or modal containers where already established.

## 7. Depth & Elevation

- Prefer border + tonal contrast over heavy shadow.
- Shadows should be soft, neutral, and low spread.
- Internal highlights should be faint and rarely necessary.
- Remove glow-based active states from navigation.

## 8. Components

### Buttons

- Primary: white or near-white fill, black text, minimal shadow.
- Secondary: black fill, subtle border, white text.
- Ghost: transparent, no heavy fill, slightly brighter on hover.
- Destructive: black/red treatment with restrained contrast.
- Buttons should look crisp, not inflated.

### Inputs

- Black fill with subtle border.
- On focus, increase border contrast and show a restrained ring.
- Placeholder text should be muted, never bright.
- Avoid tinted fills.

### Cards & Panels

- Use black/near-black fill.
- Use subtle borders.
- Avoid gradients except in special marketing-only moments, and even there keep them understated.
- Nested panel stacks should differentiate through spacing and border opacity, not color.

### Lists & Rows

- Row states use slight tonal changes only.
- Active rows may use stronger contrast or a left rule, but not glows.
- Hover states should be immediate and subtle.

### Navigation Rails

- Far-left rail: strict, compact, monochrome.
- Context rail: slightly softer, but still black-first.
- Active state: stronger surface contrast and border, no colored bloom.

### Message UI

- The conversation area should remain pure black or near-black.
- Message chrome should be reduced.
- Media frames and overlays should be neutral black.
- Readability should come from spacing and typography, not decorative fills.

### Empty / Error / Loading

- Keep them architectural and calm.
- Use mono kicker + short heading + compact description.
- Retry and recovery actions should be obvious but understated.

## 9. Copy Style

- Clear, short, direct.
- Prefer concrete action labels.
- Avoid filler copy and over-explaining.
- Headings in product surfaces should feel product-like, not marketing-poetic.
- Russian copy in the app should stay concise and operational.

## 10. Motion

- Duration mostly `120-180ms`.
- Prefer opacity, border-color, background-color, and transform.
- No long easing chains.
- No decorative shimmer or blur transitions in the app shell.

## 11. Responsive Behavior

- Mobile stays dense but tappable.
- Minimum touch target: `44px`.
- Keep search, filters, and key actions visible without decorative wrappers.
- Do not introduce mobile-only ornamental layers.

## 12. Do

- Use monochrome surfaces with crisp borders.
- Use Geist Sans and Geist Mono consistently.
- Keep rail navigation tight and scannable.
- Favor compact cards and structural whitespace.
- Use neutral hierarchy before accent color.

## 13. Don't

- Do not use blue or purple gradient cards as a default surface style.
- Do not use glassmorphism, blurred overlays, or glows as a primary visual language.
- Do not rely on shadows to separate every layer.
- Do not mix soft, playful SaaS styling with strict app-shell styling.
- Do not introduce rounded candy-like buttons or oversized pills on core app screens.

## 14. Main Screen Guidance

### Home / Auth

- Editorial and minimal.
- Strong typography, strict black surfaces, sparse supporting elements.
- Avoid noisy feature tiles.

### Messages

- Black conversation focus.
- Inbox and details should feel utilitarian and premium.
- Reduce decorative treatment in empty states and search/filter controls.

### People

- Replace colorful dashboard motifs with cleaner statistics and list-first organization.
- Use structured cards only where they aid scanning.

### Hubs

- Make creation, invites, and hub lists feel like one coherent system.
- Prefer stacked monochrome panels with precise borders.

### Settings

- Treat settings as a professional control surface.
- Strong grouping, clear labels, restrained utility actions.

## 15. Implementation Notes For Agents

- When editing UI, check this file before inventing new colors, radii, or shadows.
- Prefer changing shared tokens/classes before adding local exceptions.
- If a surface still looks "blue", "glassy", or "gradient-heavy", it is likely off-system.
- When unsure between two options, choose the more minimal one.
