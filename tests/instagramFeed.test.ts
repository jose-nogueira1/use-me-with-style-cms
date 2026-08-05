import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyHighlight,
  buildInstagramMediaRequest,
  cleanCaptionForDisplay,
  isInstagramFeedConfigured,
  mapGraphMediaToPosts,
  normalizePermalink,
} from '../src/lib/instagramFeed.ts'

test('Instagram Login feed requests use graph.instagram.com and bearer authorization', () => {
  const request = buildInstagramMediaRequest('ig/account', 'secret token', 12)
  const url = new URL(request.url)
  assert.equal(url.origin, 'https://graph.instagram.com')
  assert.equal(url.pathname, '/v26.0/ig%2Faccount/media')
  assert.equal(url.searchParams.get('limit'), '12')
  assert.match(url.searchParams.get('fields') ?? '', /media_url/)
  assert.equal(url.searchParams.has('access_token'), false)
  assert.deepEqual(request.init.headers, { Authorization: 'Bearer secret token' })
})

test('feed is unconfigured until both Graph API credentials are set', () => {
  assert.equal(isInstagramFeedConfigured({}), false)
  assert.equal(isInstagramFeedConfigured({ INSTAGRAM_ACCESS_TOKEN: 'token' }), false)
  assert.equal(isInstagramFeedConfigured({ INSTAGRAM_PAGE_ID: 'id' }), false)
  assert.equal(
    isInstagramFeedConfigured({ INSTAGRAM_ACCESS_TOKEN: 'token', INSTAGRAM_PAGE_ID: 'id' }),
    true,
  )
})

test('image posts use media_url', () => {
  const posts = mapGraphMediaToPosts([
    {
      id: '1',
      media_type: 'IMAGE',
      media_url: 'https://cdn.example/photo.jpg',
      permalink: 'https://instagram.com/p/1',
      caption: '  New drop  ',
    },
  ])
  assert.deepEqual(posts, [
    { id: '1', imageUrl: 'https://cdn.example/photo.jpg', permalink: 'https://instagram.com/p/1', caption: 'New drop' },
  ])
})

test('video posts fall back to thumbnail_url since media_url is not an image', () => {
  const posts = mapGraphMediaToPosts([
    {
      id: '2',
      media_type: 'VIDEO',
      media_url: 'https://cdn.example/clip.mp4',
      thumbnail_url: 'https://cdn.example/clip-thumb.jpg',
      permalink: 'https://instagram.com/p/2',
    },
  ])
  assert.equal(posts[0].imageUrl, 'https://cdn.example/clip-thumb.jpg')
})

test('carousel albums prefer media_url, falling back to thumbnail_url', () => {
  const withCover = mapGraphMediaToPosts([
    { id: '3', media_type: 'CAROUSEL_ALBUM', media_url: 'https://cdn.example/cover.jpg', permalink: 'https://instagram.com/p/3' },
  ])
  assert.equal(withCover[0].imageUrl, 'https://cdn.example/cover.jpg')

  const noCover = mapGraphMediaToPosts([
    { id: '4', media_type: 'CAROUSEL_ALBUM', thumbnail_url: 'https://cdn.example/thumb.jpg', permalink: 'https://instagram.com/p/4' },
  ])
  assert.equal(noCover[0].imageUrl, 'https://cdn.example/thumb.jpg')
})

test('items with genuinely no image at all are dropped, not shown broken', () => {
  const posts = mapGraphMediaToPosts([
    { id: '6', media_type: 'IMAGE', media_url: '', permalink: 'https://instagram.com/p/6' },
  ])
  assert.deepEqual(posts, [])
})

test('a video with no thumbnail_url falls back to media_url as a last resort', () => {
  const posts = mapGraphMediaToPosts([
    { id: '5', media_type: 'VIDEO', media_url: 'https://cdn.example/clip.mp4', permalink: 'https://instagram.com/p/5' },
  ])
  assert.equal(posts[0].imageUrl, 'https://cdn.example/clip.mp4')
})

test('missing caption becomes an empty string, not undefined', () => {
  const posts = mapGraphMediaToPosts([
    { id: '7', media_type: 'IMAGE', media_url: 'https://cdn.example/photo.jpg', permalink: 'https://instagram.com/p/7' },
  ])
  assert.equal(posts[0].caption, '')
})

test('normalizePermalink matches the same post regardless of scheme, trailing slash, or query string', () => {
  const canonical = normalizePermalink('https://www.instagram.com/p/AbCdEfG/')
  assert.equal(normalizePermalink('https://www.instagram.com/p/AbCdEfG'), canonical)
  assert.equal(normalizePermalink('instagram.com/p/AbCdEfG/'), canonical)
  assert.equal(normalizePermalink('https://www.instagram.com/p/AbCdEfG/?igsh=xyz'), canonical)
})

test('normalizePermalink is case-insensitive and never throws on garbage input', () => {
  assert.equal(normalizePermalink('https://www.instagram.com/p/AbCdEfG/'), normalizePermalink('HTTPS://WWW.INSTAGRAM.COM/P/AbCdEfG/'))
  assert.doesNotThrow(() => normalizePermalink('not a url at all'))
})

test('cleanCaptionForDisplay strips hashtags and newlines, keeping the readable sentence', () => {
  const raw = 'Elegância, confiança e conforto num só conjunto. 🤎\n\n#usemewithstyle #activewearonline #fitness'
  assert.equal(cleanCaptionForDisplay(raw), 'Elegância, confiança e conforto num só conjunto. 🤎')
})

test('cleanCaptionForDisplay truncates long captions with an ellipsis', () => {
  const raw = 'A'.repeat(100)
  const cleaned = cleanCaptionForDisplay(raw, 20)
  assert.equal(cleaned.length, 21) // 20 chars + the ellipsis character
  assert.ok(cleaned.endsWith('…'))
})

test('cleanCaptionForDisplay returns an empty string for a caption that is only hashtags', () => {
  assert.equal(cleanCaptionForDisplay('#usemewithstyle #angola'), '')
})

test('applyHighlight marks only the matching post large, everything else regular', () => {
  const pool = [
    { id: '1', imageUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/one/', caption: 'First' },
    { id: '2', imageUrl: 'https://cdn.example/2.jpg', permalink: 'https://www.instagram.com/p/two/', caption: 'Second' },
  ]
  const highlighted = applyHighlight(pool, 'https://www.instagram.com/p/two/')
  assert.deepEqual(highlighted.map((p) => p.size), ['regular', 'large'])
})

test('applyHighlight preserves pool order and membership -- it never reorders or drops posts', () => {
  const pool = [
    { id: '1', imageUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/one/', caption: '' },
    { id: '2', imageUrl: 'https://cdn.example/2.jpg', permalink: 'https://www.instagram.com/p/two/', caption: '' },
  ]
  const highlighted = applyHighlight(pool, 'https://www.instagram.com/p/two/')
  assert.deepEqual(highlighted.map((p) => p.id), ['1', '2'])
})

test('applyHighlight matches permalinks loosely (trailing slash, query string)', () => {
  const pool = [{ id: '1', imageUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/one/', caption: '' }]
  const highlighted = applyHighlight(pool, 'instagram.com/p/one?igsh=xyz')
  assert.equal(highlighted[0].size, 'large')
})

test('applyHighlight highlights nothing when the permalink has aged out of the pool', () => {
  const pool = [{ id: '1', imageUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/one/', caption: '' }]
  const highlighted = applyHighlight(pool, 'https://www.instagram.com/p/aged-out/')
  assert.equal(highlighted[0].size, 'regular')
})

test('applyHighlight highlights nothing when no permalink is set', () => {
  const pool = [{ id: '1', imageUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/one/', caption: '' }]
  assert.equal(applyHighlight(pool, null)[0].size, 'regular')
  assert.equal(applyHighlight(pool, undefined)[0].size, 'regular')
  assert.equal(applyHighlight(pool, '   ')[0].size, 'regular')
})
