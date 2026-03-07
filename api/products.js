// ═══════════════════════════════════════════════════════════════
//  api/products.js — Vercel Serverless Function
//  Doğa Pasajı · Ürün + Kategori Veritabanı (Vercel Blob)
//
//  GET  /api/products  → ürünleri VE kategorileri döndür
//  POST /api/products  → ürünleri VE kategorileri kaydet (admin)
// ═══════════════════════════════════════════════════════════════

import { list, put, del } from '@vercel/blob';

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};

const PRODUCTS_PATH  = 'dogapasaji/products.json';
const CATEGORIES_PATH = 'dogapasaji/categories.json';
const TOKEN          = process.env.BLOB_READ_WRITE_TOKEN;

// ── Varsayılan ürünler ─────────────────────────────────────────
const DEFAULT_PRODUCTS = [
  { id:'p1', name:'Renkli Betta Balığı',       price:'250', old:'320', catId:'c1', desc:'Görkemli yüzgeçleri ve parlak renkleriyle eşsiz betta.',    img:'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=500&q=80' },
  { id:'p2', name:'Kaktüs Aranjmanı',           price:'180', old:'',    catId:'c2', desc:'4 farklı kaktüs türü, özel seramik saksı.',                 img:'https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?w=500&q=80' },
  { id:'p3', name:'Dekoratif Akvaryum Seti',    price:'250', old:'',    catId:'c3', desc:'30lt kompakt akvaryum, filtre ve aydınlatma dahil.',         img:'https://images.unsplash.com/photo-1497206365907-f5e630693df0?w=500&q=80' },
  { id:'p4', name:'Nadir Sukulentler (3lü Set)',price:'80',  old:'120', catId:'c2', desc:'Birbirinden nadir 3 adet sukulent koleksiyonu.',             img:'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=500&q=80' },
  { id:'p5', name:'El Yapımı Terrarium',         price:'420', old:'',    catId:'c4', desc:'Cam küre terrarium, canlı yosun ve dekor taşları.',         img:'https://images.unsplash.com/photo-1611843467160-25afb8df1074?w=500&q=80' },
  { id:'p6', name:'Hasır Saksı Seti',            price:'290', old:'350', catId:'c4', desc:'3lü doğal hasır dokuma saksı, el yapımı.',                 img:'https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=500&q=80' },
  { id:'p7', name:'Oscar Balığı',                price:'150', old:'',    catId:'c1', desc:'Büyük ve akıllı tropik balık, 10-12 cm.',                  img:'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=500&q=80' },
  { id:'p8', name:'Makrome Duvar Süsü',          price:'350', old:'',    catId:'c4', desc:'El örmesi makrome, doğal pamuk iplik, 70cm.',              img:'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=500&q=80' },
];

// ── Varsayılan kategoriler ─────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id:'c1', name:'Balıklar',         emoji:'🐟', img:'' },
  { id:'c2', name:'Kaktüs & Bitkiler',emoji:'🌵', img:'' },
  { id:'c3', name:'Akvaryum',         emoji:'🐠', img:'' },
  { id:'c4', name:'Ev & Yaşam',       emoji:'🏡', img:'' },
];

// ── Blob'dan URL bul ───────────────────────────────────────────
async function findBlobUrl(path) {
  const { blobs } = await list({ prefix: path, token: TOKEN });
  return blobs.length > 0 ? blobs[0].url : null;
}

// ── Blob'a JSON kaydet (eskiyi sil + yeni yaz) ─────────────────
async function saveToBlobAtPath(path, data) {
  const oldUrl = await findBlobUrl(path);
  if (oldUrl) await del(oldUrl, { token: TOKEN });

  const blob = await put(path, JSON.stringify(data), {
    access:          'public',
    contentType:     'application/json',
    addRandomSuffix: false,
    token:           TOKEN,
  });
  return blob.url;
}

// ── Blob'dan JSON oku ──────────────────────────────────────────
async function readFromBlob(path) {
  const url = await findBlobUrl(path);
  if (!url) return null;
  const r = await fetch(url + '?t=' + Date.now()); // cache bypass
  if (!r.ok) return null;
  return await r.json();
}

// ══════════════════════════════════════════════════════════════
//  ANA HANDLER
// ══════════════════════════════════════════════════════════════
export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!TOKEN) {
    return res.status(500).json({ success: false, error: 'BLOB_READ_WRITE_TOKEN eksik.' });
  }

  // ════════════════════════════════════════
  //  GET — ürünleri VE kategorileri oku
  // ════════════════════════════════════════
  if (req.method === 'GET') {
    try {
      // Ürünleri oku
      let products = await readFromBlob(PRODUCTS_PATH);
      if (!products) {
        await saveToBlobAtPath(PRODUCTS_PATH, DEFAULT_PRODUCTS);
        products = DEFAULT_PRODUCTS;
      }

      // ★ Kategorileri oku — tüm cihazlar aynı kategori görselini görür
      let categories = await readFromBlob(CATEGORIES_PATH);
      if (!categories) {
        // Blob'da kategori yoksa default döndür (kaydetme — admin kaydetsin)
        categories = DEFAULT_CATEGORIES;
      }

      return res.status(200).json({ success: true, products, categories });

    } catch (err) {
      console.error('[GET] Hata:', err);
      return res.status(200).json({
        success: true,
        products: DEFAULT_PRODUCTS,
        categories: DEFAULT_CATEGORIES,
        fallback: true
      });
    }
  }

  // ════════════════════════════════════════════════════════
  //  POST — ürünleri VE kategorileri kaydet
  // ════════════════════════════════════════════════════════
  if (req.method === 'POST') {
    try {
      const { products, categories, adminKey } = req.body;

      if (adminKey !== (process.env.ADMIN_KEY || 'dp_admin_2025')) {
        return res.status(401).json({ success: false, error: 'Yetkisiz.' });
      }

      // Ürünleri kaydet
      let productsBlobUrl = null;
      if (Array.isArray(products)) {
        productsBlobUrl = await saveToBlobAtPath(PRODUCTS_PATH, products);
      }

      // ★ Kategorileri kaydet — artık Blob'a yazılıyor
      let categoriesBlobUrl = null;
      if (Array.isArray(categories) && categories.length > 0) {
        categoriesBlobUrl = await saveToBlobAtPath(CATEGORIES_PATH, categories);
      }

      return res.status(200).json({
        success: true,
        productsBlobUrl,
        categoriesBlobUrl,
        productsCount:   Array.isArray(products)   ? products.length   : 0,
        categoriesCount: Array.isArray(categories) ? categories.length : 0,
      });

    } catch (err) {
      console.error('[POST] Hata:', err);
      return res.status(500).json({ success: false, error: 'Kayıt hatası: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
