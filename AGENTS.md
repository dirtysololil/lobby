# Lobby Agent Instructions

All UI, styling, layout, motion, and copy changes in this repository must follow [DESIGN.md](./DESIGN.md).

## UI Workflow

1. Read `DESIGN.md` before making UI changes.
2. Start with shared tokens, typography, and reusable primitives.
3. Prefer system-level fixes over local one-off styling.
4. Keep existing functionality intact while refactoring visuals.
5. Validate focus states, hover states, empty states, and loading states.

## Design Priorities

- Use the Lobby design system defined in `DESIGN.md`.
- Preserve a Vercel/Geist-inspired monochrome language.
- Avoid gradients, glow, glassmorphism, and decorative blue fills unless `DESIGN.md` explicitly permits them.
- Favor precision, compact hierarchy, and black-first surfaces.

## When Updating Screens

- Reuse shared classes/components first.
- Keep navigation dense and readable.
- Maintain accessibility and existing interaction behavior.
- Do not introduce a second visual language for one screen.

## If Design And Existing Code Conflict

- Keep product behavior.
- Refactor visuals toward `DESIGN.md`.
- If a local style fights the system, remove or normalize it unless it is functionally required.
