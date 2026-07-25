// Best-guess hex values for the Portuguese colour NAMES already live in the
// catalogue (2026-07-25 taxonomy migration seeded these from free text with
// no hex, since none existed before). Since the names are literal colour
// words, leaving 13 empty swatches for the admin to fill by hand was the
// wrong default -- this backfills sensible values on migration and reseed.
// Purely a starting point: every colour stays editable (and its hex
// overridable) in Settings -> Products -> Colours.
//
// Matched case-insensitively, trimmed. Unrecognised names (new colours the
// admin types in later) simply get no hex -- the dashed "no swatch yet"
// circle is the correct state for those until someone picks one.
export const PT_COLOR_HEX: Record<string, string> = {
  antracite: '#3B3B3D',
  areia: '#D9C6A5',
  azul: '#3B5D82',
  branco: '#F7F5F0',
  caramelo: '#A9702F',
  'carvão': '#2B2B2B',
  carvao: '#2B2B2B',
  cinza: '#9B9B93',
  coral: '#E8785A',
  marfim: '#F1E9D8',
  noite: '#14171F',
  preto: '#111111',
  rosa: '#E6A8B8',
  verde: '#5C7A5A',
}

export function guessHex(name: string): string | undefined {
  return PT_COLOR_HEX[name.trim().toLowerCase()]
}
