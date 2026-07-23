import assert from 'node:assert/strict'
import test from 'node:test'
import { isInstagramFeedConfigured, mapGraphMediaToPosts } from '../src/lib/instagramFeed.ts'

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
