import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('production S3 upload handler is present in the committed admin import map', async () => {
  const importMap = await readFile(
    new URL('../src/app/(payload)/admin/importMap.js', import.meta.url),
    'utf8',
  )

  assert.match(
    importMap,
    /@payloadcms\/storage-s3\/client#S3ClientUploadHandler/,
    'Payload Admin renders a white page in production when this conditional plugin entry is missing',
  )
})
