// Best-guess hex + English name for the Portuguese colour NAMES already live
// in the catalogue (2026-07-25 taxonomy migration seeded these from free
// text with no hex/translation, since none existed before). Since the names
// are literal colour words, leaving them untranslated with empty swatches
// was the wrong default -- this backfills sensible values on migration and
// reseed. Purely a starting point: everything stays editable in
// Settings -> Products -> Colours.
//
// Matched case-insensitively, trimmed. Unrecognised names (new colours the
// admin types in later) get no hex and no English translation -- the
// dashed "no swatch yet" circle and the PT-name-as-fallback-EN behaviour
// are both correct states for those until someone fills them in.
export const PT_COLOR_PRESETS: Record<string, { hex: string; nameEN: string }> = {
  antracite: { hex: '#3B3B3D', nameEN: 'Anthracite' },
  areia: { hex: '#D9C6A5', nameEN: 'Sand' },
  azul: { hex: '#3B5D82', nameEN: 'Blue' },
  branco: { hex: '#F7F5F0', nameEN: 'White' },
  caramelo: { hex: '#A9702F', nameEN: 'Caramel' },
  'carvão': { hex: '#2B2B2B', nameEN: 'Charcoal' },
  carvao: { hex: '#2B2B2B', nameEN: 'Charcoal' },
  cinza: { hex: '#9B9B93', nameEN: 'Grey' },
  coral: { hex: '#E8785A', nameEN: 'Coral' },
  marfim: { hex: '#F1E9D8', nameEN: 'Ivory' },
  noite: { hex: '#14171F', nameEN: 'Midnight' },
  preto: { hex: '#111111', nameEN: 'Black' },
  rosa: { hex: '#E6A8B8', nameEN: 'Pink' },
  verde: { hex: '#5C7A5A', nameEN: 'Green' },
}

// Kept for the one external caller (seed.ts) that only ever wanted the hex.
export const PT_COLOR_HEX: Record<string, string> = Object.fromEntries(
  Object.entries(PT_COLOR_PRESETS).map(([name, preset]) => [name, preset.hex]),
)

export function guessHex(name: string): string | undefined {
  return PT_COLOR_PRESETS[name.trim().toLowerCase()]?.hex
}

export function guessNameEN(name: string): string | undefined {
  return PT_COLOR_PRESETS[name.trim().toLowerCase()]?.nameEN
}
