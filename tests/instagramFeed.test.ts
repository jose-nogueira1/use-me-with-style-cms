import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyHighlight,
  buildInstagramMediaRequest,
  cleanCaptionForDisplay,
  findInstagramProductTag,
  indexInstagramProductTags,
  instagramLookSlug,
  isInstagramFeedConfigured,
  mapGraphMediaToPosts,
  normalizePermalink,
  removeProductFromInstagramProductTags,
  resolveShopTheLookProducts,
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

test('image posts use media_url and are tagged mediaType IMAGE with no videoUrl', () => {
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
    {
      id: '1',
      imageUrl: 'https://cdn.example/photo.jpg',
      mediaType: 'IMAGE',
      videoUrl: undefined,
      permalink: 'https://instagram.com/p/1',
      caption: 'New drop',
    },
  ])
})

test('video posts fall back to thumbnail_url for imageUrl but keep the real playable file as videoUrl', () => {
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
  assert.equal(posts[0].mediaType, 'VIDEO')
  assert.equal(posts[0].videoUrl, 'https://cdn.example/clip.mp4')
})

test('carousel albums prefer media_url, falling back to thumbnail_url, and are treated as IMAGE (no per-slide video support yet)', () => {
  const withCover = mapGraphMediaToPosts([
    { id: '3', media_type: 'CAROUSEL_ALBUM', media_url: 'https://cdn.example/cover.jpg', permalink: 'https://instagram.com/p/3' },
  ])
  assert.equal(withCover[0].imageUrl, 'https://cdn.example/cover.jpg')
  assert.equal(withCover[0].mediaType, 'IMAGE')
  assert.equal(withCover[0].videoUrl, undefined)

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
    { id: '1', imageUrl: 'https://cdn.example/1.jpg', mediaType: 'IMAGE' as const, permalink: 'https://www.instagram.com/p/one/', caption: 'First' },
    { id: '2', imageUrl: 'https://cdn.example/2.jpg', mediaType: 'IMAGE' as const, permalink: 'https://www.instagram.com/p/two/', caption: 'Second' },
  ]
  const highlighted = applyHighlight(pool, 'https://www.instagram.com/p/two/')
  assert.deepEqual(highlighted.map((p) => p.size), ['regular', 'large'])
})

test('applyHighlight preserves pool order and membership -- it never reorders or drops posts', () => {
  const pool = [
    { id: '1', imageUrl: 'https://cdn.example/1.jpg', mediaType: 'IMAGE' as const, permalink: 'https://www.instagram.com/p/one/', caption: '' },
    { id: '2', imageUrl: 'https://cdn.example/2.jpg', mediaType: 'IMAGE' as const, permalink: 'https://www.instagram.com/p/two/', caption: '' },
  ]
  const highlighted = applyHighlight(pool, 'https://www.instagram.com/p/two/')
  assert.deepEqual(highlighted.map((p) => p.id), ['1', '2'])
})

test('applyHighlight matches permalinks loosely (trailing slash, query string)', () => {
  const pool = [{ id: '1', imageUrl: 'https://cdn.example/1.jpg', mediaType: 'IMAGE' as const, permalink: 'https://www.instagram.com/p/one/', caption: '' }]
  const highlighted = applyHighlight(pool, 'instagram.com/p/one?igsh=xyz')
  assert.equal(highlighted[0].size, 'large')
})

test('applyHighlight highlights nothing when the permalink has aged out of the pool', () => {
  const pool = [{ id: '1', imageUrl: 'https://cdn.example/1.jpg', mediaType: 'IMAGE' as const, permalink: 'https://www.instagram.com/p/one/', caption: '' }]
  const highlighted = applyHighlight(pool, 'https://www.instagram.com/p/aged-out/')
  assert.equal(highlighted[0].size, 'regular')
})

test('applyHighlight highlights nothing when no permalink is set', () => {
  const pool = [{ id: '1', imageUrl: 'https://cdn.example/1.jpg', mediaType: 'IMAGE' as const, permalink: 'https://www.instagram.com/p/one/', caption: '' }]
  assert.equal(applyHighlight(pool, null)[0].size, 'regular')
  assert.equal(applyHighlight(pool, undefined)[0].size, 'regular')
  assert.equal(applyHighlight(pool, '   ')[0].size, 'regular')
})

test('shop-the-look associations prefer stable media IDs and retain permalink compatibility', () => {
  const byId = { mediaId: '1789', permalink: 'https://instagram.com/p/original/', products: [] }
  const legacy = { permalink: 'https://instagram.com/p/legacy/?igsh=old', products: [] }
  const index = indexInstagramProductTags([byId, legacy])

  assert.equal(findInstagramProductTag(index, { id: '1789', permalink: 'https://instagram.com/p/changed/' }), byId)
  assert.equal(findInstagramProductTag(index, { id: 'other', permalink: 'https://www.instagram.com/p/legacy/' }), legacy)
})

test('instagram look slugs are stable shortcode routes', () => {
  assert.equal(instagramLookSlug('https://www.instagram.com/p/AbCd123/?igsh=share'), 'AbCd123')
  assert.equal(instagramLookSlug('https://www.instagram.com/reel/Reel987/'), 'Reel987')
})

test('shop-the-look products resolve current market price, stock, image and selected colour', () => {
  const products = resolveShopTheLookProducts({
    mediaId: 'post-1',
    permalink: 'https://instagram.com/p/look/',
    variantSelections: { '10': 'red' },
    products: [{
      id: 10,
      slug: 'vestido-vermelho',
      name: 'Vestido',
      namePT: 'Vestido Vermelho',
      nameEN: 'Red Dress',
      active: true,
      availableAO: true,
      availablePT: true,
      priceAOKz: 42000,
      pricePTEur: 79,
      saleAOKz: 39000,
      images: [{ image: { url: '/media/dress.jpg', alt: 'Vestido Vermelho Vermelho Vestidos — Use Me With Style' } }],
      variants: [
        { color: { id: 'red', namePT: 'Vermelho', nameEN: 'Red' }, size: 'S', stockAO: 2, stockPT: 0 },
        { color: { id: 'red', namePT: 'Vermelho', nameEN: 'Red' }, size: 'M', stockAO: 1, stockPT: 3 },
        { color: { id: 'blue', namePT: 'Azul', nameEN: 'Blue' }, size: 'S', stockAO: 5, stockPT: 5 },
      ],
    }],
  }, 'AO')

  assert.equal(products.length, 1)
  assert.deepEqual(products[0], {
    id: '10',
    slug: 'vestido-vermelho',
    name: 'Vestido Vermelho',
    namePT: 'Vestido Vermelho',
    nameEN: 'Red Dress',
    imageUrl: '/media/dress.jpg',
    imageAlt: 'Vestido Vermelho Vermelho Vestidos — Use Me With Style',
    price: 39000,
    regularPrice: 42000,
    currency: 'AOA',
    onSale: true,
    inStock: true,
    availableSizes: ['S', 'M'],
    selectedColorId: 'red',
    selectedColorNamePT: 'Vermelho',
    selectedColorNameEN: 'Red',
  })
})

test('shop-the-look resolves one product into one card per selected colour', () => {
  const products = resolveShopTheLookProducts({
    permalink: 'https://instagram.com/p/multi-colour/',
    variantSelections: { '10': ['red', 'blue'] },
    products: [{
      id: 10,
      slug: 'vestido-multi-cor',
      name: 'Vestido',
      namePT: 'Vestido',
      nameEN: 'Dress',
      active: true,
      availableAO: true,
      variants: [
        { color: { id: 'red', namePT: 'Vermelho', nameEN: 'Red' }, size: 'S', stockAO: 1 },
        { color: { id: 'blue', namePT: 'Azul', nameEN: 'Blue' }, size: 'S', stockAO: 1 },
      ],
    }],
  }, 'AO')

  assert.deepEqual(products.map((product) => product.selectedColorId), ['red', 'blue'])
})

test('shop-the-look uses the image assigned to each selected colour', () => {
  const products = resolveShopTheLookProducts({
    permalink: 'https://instagram.com/p/colour-images/',
    variantSelections: { '10': ['red', 'blue'] },
    products: [{
      id: 10,
      slug: 'vestido-multi-cor',
      name: 'Vestido',
      namePT: 'Vestido',
      nameEN: 'Dress',
      active: true,
      availableAO: true,
      images: [
        { image: { url: '/media/general.jpg', alt: 'General' } },
        { image: { url: '/media/red.jpg', alt: 'Red' }, color: { id: 'red' } },
        { image: { url: '/media/blue.jpg', alt: 'Blue' }, color: { id: 'blue' } },
      ],
      variants: [
        { color: { id: 'red', namePT: 'Vermelho', nameEN: 'Red' }, size: 'S', stockAO: 1 },
        { color: { id: 'blue', namePT: 'Azul', nameEN: 'Blue' }, size: 'S', stockAO: 1 },
      ],
    }],
  }, 'AO')

  assert.deepEqual(products.map((product) => product.imageUrl), ['/media/red.jpg', '/media/blue.jpg'])
})

test('shop-the-look products are market-safe and retain sold-out looks without broken products', () => {
  const base = {
    name: 'Top', namePT: 'Top', nameEN: 'Top', active: true,
    priceAOKz: 20000, pricePTEur: 40, images: [],
  }
  const products = resolveShopTheLookProducts({
    permalink: 'https://instagram.com/p/look/',
    products: [
      { ...base, id: 1, slug: 'ao-only', availableAO: true, availablePT: false, variants: [{ color: { id: 'black' }, size: 'M', stockAO: 1, stockPT: 0 }] },
      { ...base, id: 2, slug: 'sold-out-pt', availableAO: true, availablePT: true, variants: [{ color: { id: 'black' }, size: 'M', stockAO: 1, stockPT: 0 }] },
      { ...base, id: 3, slug: 'draft', active: false, availableAO: true, availablePT: true, variants: [] },
    ],
  }, 'PT')

  assert.deepEqual(products.map((product) => product.slug), ['sold-out-pt'])
  assert.equal(products[0].inStock, false)
  assert.deepEqual(products[0].availableSizes, [])
})

test('shop-the-look treats option-less accessories and component-backed kits as sellable', () => {
  const accessory = {
    id: 20,
    slug: 'garrafa',
    name: 'Garrafa',
    productType: 'standard' as const,
    active: true,
    availableAO: true,
    availablePT: true,
    priceAOKz: 5000,
    pricePTEur: 10,
    variants: [{ id: 'bottle', stockAO: 4, stockPT: 0 }],
  }
  const products = resolveShopTheLookProducts({
    products: [
      accessory,
      {
        id: 21,
        slug: 'kit-garrafa',
        name: 'Kit Garrafa',
        productType: 'bundle',
        active: true,
        availableAO: true,
        availablePT: true,
        priceAOKz: 9000,
        pricePTEur: 18,
        variants: [],
        bundleComponents: [{ product: accessory, variantId: 'bottle', qty: 2 }],
      },
    ],
  }, 'AO')

  assert.equal(products[0].inStock, true)
  assert.deepEqual(products[0].availableSizes, [])
  assert.equal(products[1].inStock, true)
})

test('shop-the-look caps every Instagram post at six products', () => {
  const products = resolveShopTheLookProducts({
    permalink: 'https://instagram.com/p/look/',
    products: Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      slug: `product-${index + 1}`,
      name: `Product ${index + 1}`,
      active: true,
      availableAO: true,
      availablePT: true,
      priceAOKz: 1000,
      pricePTEur: 10,
      variants: [{ color: { id: 'black' }, size: 'M', stockAO: 1, stockPT: 1 }],
    })),
  }, 'AO')

  assert.equal(products.length, 6)
})

test('deleting a product removes it and its colour selection from Instagram associations', () => {
  const cleaned = removeProductFromInstagramProductTags([{
    mediaId: 'post-1',
    permalink: 'https://instagram.com/p/look/',
    products: [12, 99],
    variantSelections: { '12': ['blue'], '99': ['red'] },
  }], 99)

  assert.deepEqual(cleaned, [{
    mediaId: 'post-1',
    permalink: 'https://instagram.com/p/look/',
    products: [12],
    variantSelections: { '12': ['blue'] },
  }])
})
