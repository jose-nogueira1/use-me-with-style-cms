import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applySpotlightCuration,
  cleanCaptionForDisplay,
  isInstagramFeedConfigured,
  mapGraphMediaToPosts,
  normalizePermalink,
} from '../src/lib/instagramFeed.ts'

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

test('applySpotlightCuration orders posts by the entries list, not the pool order', () => {
  const pool = [
    { id: '1', imageUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/one/', caption: 'First' },
    { id: '2', imageUrl: 'https://cdn.example/2.jpg', permalink: 'https://www.instagram.com/p/two/', caption: 'Second' },
  ]
  const curated = applySpotlightCuration(pool, [
    { permalink: 'https://www.instagram.com/p/two/' },
    { permalink: 'https://www.instagram.com/p/one/' },
  ])
  assert.deepEqual(curated.map((p) => p.id), ['2', '1'])
})

test('applySpotlightCuration skips entries with no match in the pool instead of erroring', () => {
  const pool = [{ id: '1', imageUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/one/', caption: '' }]
  const curated = applySpotlightCuration(pool, [
    { permalink: 'https://www.instagram.com/p/aged-out/' },
    { permalink: 'https://www.instagram.com/p/one/' },
  ])
  assert.equal(curated.length, 1)
  assert.equal(curated[0].id, '1')
})

test('applySpotlightCuration matches permalinks loosely (trailing slash, query string) but keeps labels/size exact', () => {
  const pool = [{ id: '1', imageUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/one/', caption: '' }]
  const curated = applySpotlightCuration(pool, [
    { permalink: 'instagram.com/p/one', labelPT: 'Conjunto Chocolate', labelEN: 'Chocolate Set', size: 'large' },
  ])
  assert.equal(curated[0].labelPT, 'Conjunto Chocolate')
  assert.equal(curated[0].labelEN, 'Chocolate Set')
  assert.equal(curated[0].size, 'large')
})

test('applySpotlightCuration defaults size to regular and omits blank labels', () => {
  const pool = [{ id: '1', imageUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/one/', caption: '' }]
  const curated = applySpotlightCuration(pool, [{ permalink: 'https://www.instagram.com/p/one/', labelPT: '  ', size: null }])
  assert.equal(curated[0].size, 'regular')
  assert.equal(curated[0].labelPT, undefined)
  assert.equal(curated[0].labelEN, undefined)
})
