// Renders the HTML files written by scripts/preview-email.mjs into PNG
// images for a quick structural sanity check (layout, copy, section order)
// without opening a real browser. Deliberately dependency-free -- shells out
// to `soffice` (LibreOffice headless, already used elsewhere for document
// conversion) and `pdftoppm` (poppler-utils) instead of adding a browser-
// automation package (Playwright/Puppeteer) as a project dependency just for
// this. See the note printed at the end: LibreOffice's HTML engine does NOT
// support CSS media queries or fetch remote images the way a real browser
// does, so this is a structural preview only, not a substitute for opening
// the .html files directly in an actual browser/email client, which is the
// only way to see genuine Gmail/Outlook/Apple Mail-accurate rendering
// (including the responsive mobile behaviour driven by the `@media` rules
// in lib/email.ts, which LibreOffice's renderer ignores entirely).
//
// Run with: node scripts/screenshot-email-previews.mjs
// (after `npx tsx scripts/preview-email.mjs` has generated the HTML files)
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const previewDir = resolve('output/email-previews')
const screenshotDir = resolve('output/email-previews/screenshots')
mkdirSync(screenshotDir, { recursive: true })

const files = readdirSync(previewDir).filter((f) => f.endsWith('.html'))
if (!files.length) {
  console.error('No .html files found in output/email-previews -- run scripts/preview-email.mjs first.')
  process.exit(1)
}

for (const file of files) {
  const base = file.replace(/\.html$/, '')
  const htmlPath = resolve(previewDir, file)
  const pdfPath = resolve(screenshotDir, `${base}.pdf`)

  execFileSync(
    'soffice',
    ['--headless', '--convert-to', 'pdf:writer_web_pdf_Export', '--outdir', screenshotDir, htmlPath],
    { stdio: 'inherit' },
  )
  execFileSync('pdftoppm', ['-png', '-r', '110', pdfPath, resolve(screenshotDir, base)], { stdio: 'inherit' })
  // Intermediate .pdf is left alongside the PNGs (output/ is gitignored
  // scratch) rather than deleted -- some sandboxed/synced filesystems don't
  // allow unlinking a just-written file, and it's harmless clutter either way.
}

console.log(`\nWrote structural PNG previews to ${screenshotDir}`)
console.log(
  'Reminder: these come from LibreOffice\'s HTML engine, not a real browser -- no @media/responsive support, ' +
    'no remote image loading. Open the .html files directly in a browser for an accurate check.',
)
