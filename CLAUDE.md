@AGENTS.md

# Margav brand (use for all UI, PDFs and emails)

- Colours: blue `#3333cc` (`brand-blue`), black `#000000`, white `#ffffff`.
- Green gradient is 3 evenly spaced stops — `#66cc66` 0%, `#33cc66` 50%, `#00cc99` 100% (`bg-brand-green-gradient`, `brand-green-start/mid/end`). The middle colour must stay dead centre.
- The sidebar is `brand-blue` with white text; buttons use the green gradient (`bg-brand-green-gradient`) with black text for contrast.
- Links and selected states use `brand-blue`; positive/success uses brand green; dark hero panels are black.
- Neutrals: `slate-*` is remapped to true greys in `src/app/globals.css` (`slate-950` = black). Don't use Tailwind blue/sky/indigo for UI chrome and don't hardcode slate-blue hexes (`#0f172a`, `#64748b`…).
- Fonts for logos/promotional material: Myriad Pro and Poppins. The app UI uses Poppins (`font-sans`); Myriad Pro has no licensed webfont wired up yet.
- Amber/red/etc. stay only for semantic warning/error states.
