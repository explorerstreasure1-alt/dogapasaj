// ═══════════════════════════════════════════════════════════════
//  api/products.js — Vercel Serverless Function
//  Doğa Pasajı · Ürün Veritabanı (Vercel Blob üzerinde JSON)
//
//  GET  /api/products        → tüm ürünleri döndür
//  POST /api/products        → ürün listesini kaydet (admin)
//  DEL mevcut blob + PUT yeni → her zaman güncel tek dosya
// ═══════════════════════════════════════════════════════════════

import { list, put, del } from '@vercel/blob';

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
};

const BLOB_PATH  = 'dogapasaji/products.json';
const TOKEN      = process.env.BLOB_READ_WRITE_TOKEN;

// ── Varsayılan ürünler (Blob boşsa kullanılır) ─────────────────
const DEFAULT_PRODUCTS = [
  { id:'p1', name:'Renkli Betta Balığı',      price:'250', old:'320', catId:'c1', desc:'Görkemli yüzgeçleri ve parlak renkleriyle eşsiz betta.',       img:'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=500&q=80' },
  { id:'p2', name:'Kaktüs Aranjmanı',          price:'180', old:'',    catId:'c2', desc:'4 farklı kaktüs türü, özel seramik saksı.',                    img:'https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?w=500&q=80' },
  { id:'p3', name:'Dekoratif Akvaryum Seti',   price:'250', old:'',    catId:'c3', desc:'30lt kompakt akvaryum, filtre ve aydınlatma dahil.',            img:'https://images.unsplash.com/photo-1497206365907-f5e630693df0?w=500&q=80' },
  { id:'p4', name:'Nadir Sukulentler (3lü Set)',price:'80',  old:'120', catId:'c2', desc:'Birbirinden nadir 3 adet sukulent koleksiyonu.',               img:'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=500&q=80' },
  { id:'p5', name:'El Yapımı Terrarium',        price:'420', old:'',    catId:'c4', desc:'Cam küre terrarium, canlı yosun ve dekor taşları.',            img:'https://images.unsplash.com/photo-1611843467160-25afb8df1074?w=500&q=80' },
  { id:'p6', name:'Hasır Saksı Seti',           price:'290', old:'350', catId:'c4', desc:'3lü doğal hasır dokuma saksı, el yapımı.',                    img:'https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=500&q=80' },
  { id:'p7', name:'Oscar Balığı',               price:'150', old:'',    catId:'c1', desc:'Büyük ve akıllı tropik balık, 10-12 cm.',                     img:'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=500&q=80' },
  { id:'p8', name:'Makrome Duvar Süsü',         price:'350', old:'',    catId:'c4', desc:'El örmesi makrome, doğal pamuk iplik, 70cm.',                 img:'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=500&q=80' },
];

// ── Blob'daki mevcut products.json URL'ini bul ─────────────────
async function findBlobUrl() {
  const { blobs } = await list({ prefix: BLOB_PATH, token: TOKEN });
  return blobs.length > 0 ? blobs[0].url : null;
}

// ── Ürünleri Blob'a kaydet (eskiyi sil + yeni yaz) ─────────────
async function saveProducts(products) {
  // Varsa eskiyi sil
  const oldUrl = await findBlobUrl();
  if (oldUrl) await del(oldUrl, { token: TOKEN });

  // Yeni JSON'u yaz — access: 'public' → CDN'den doğrudan okunabilir
  const blob = await put(BLOB_PATH, JSON.stringify(products), {
    access:          'public',
    contentType:     'application/json',
    addRandomSuffix: false,
    token:           TOKEN,
  });
  return blob.url;
}

// ══════════════════════════════════════════════════════════════
//  ANA HANDLER
// ══════════════════════════════════════════════════════════════
export default async function handler(req, res) {

  // ── CORS ────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── TOKEN kontrolü ──────────────────────────────────────────
  if (!TOKEN) {
    return res.status(500).json({ success: false, error: 'BLOB_READ_WRITE_TOKEN eksik.' });
  }

  // ════════════════════
  //  GET — ürünleri oku
  // ════════════════════
  if (req.method === 'GET') {
    try {
      const url = await findBlobUrl();

      if (!url) {
        // İlk çalıştırma: default ürünleri Blob'a kaydet
        await saveProducts(DEFAULT_PRODUCTS);
        return res.status(200).json({ success: true, products: DEFAULT_PRODUCTS });
      }

      // Public URL'den JSON'u çek
      const response = await fetch(url);
      if (!response.ok) throw new Error('Blob fetch başarısız: ' + response.status);
      const products = await response.json();

      return res.status(200).json({ success: true, products });

    } catch (err) {
      console.error('[products GET] Hata:', err);
      // Hata durumunda default ürünleri döndür
      return res.status(200).json({ success: true, products: DEFAULT_PRODUCTS, fallback: true });
    }
  }

  // ════════════════════════════════
  //  POST — ürün listesini güncelle
  // ════════════════════════════════
  if (req.method === 'POST') {
    try {
      const { products, adminKey } = req.body;

      // Basit admin key kontrolü (index.html ile eşleşmeli)
      if (adminKey !== (process.env.ADMIN_KEY || 'dp_admin_2025')) {
        return res.status(401).json({ success: false, error: 'Yetkisiz.' });
      }

      if (!Array.isArray(products)) {
        return res.status(400).json({ success: false, error: 'Geçersiz veri formatı.' });
      }

      const blobUrl = await saveProducts(products);

      return res.status(200).json({
        success:  true,
        blobUrl,
        count:    products.length,
      });

    } catch (err) {
      console.error('[products POST] Hata:', err);
      return res.status(500).json({ success: false, error: 'Kayıt hatası: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
