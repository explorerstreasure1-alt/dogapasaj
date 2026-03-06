// ═══════════════════════════════════════════════════════════════
//  api/upload.js — Vercel Serverless Function
//  Doğa Pasajı · Ürün Görseli Yükleme Endpoint'i
//
//  ✅ Vercel Blob  →  access: 'public'  (herkese açık URL)
//  ✅ contentType header  →  tarayıcı indirmek yerine gösterir
//  ✅ 10 MB limit, JPEG / PNG / WEBP / GIF / AVIF desteği
//  ✅ Benzersiz dosya adı — çakışma olmaz
//  ✅ Hata yönetimi üretim standardında
// ═══════════════════════════════════════════════════════════════

import { put } from '@vercel/blob';

// ── Body parser sınırı (base64 ~%33 şişer, 10 MB ≈ 7.5 MB görsel) ──
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// ── İzin verilen MIME tipleri ──────────────────────────────────
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
  'image/avif': 'avif',
};

// ── base64 data URL → Buffer + MIME ───────────────────────────
function parseBase64(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const buffer   = Buffer.from(match[2], 'base64');
  return { mimeType, buffer };
}

// ── Çakışmasız benzersiz dosya adı üret ───────────────────────
function buildFilename(originalName, mimeType) {
  const ext       = ALLOWED_MIME[mimeType] || 'jpg';
  const timestamp = Date.now();
  const random    = Math.random().toString(36).slice(2, 8);
  const base      = originalName
    ? originalName
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase()
        .slice(0, 40)
    : 'urun';
  return `dogapasaji/${base}-${timestamp}-${random}.${ext}`;
}

// ══════════════════════════════════════════════════════════════
//  ANA HANDLER
// ══════════════════════════════════════════════════════════════
export default async function handler(req, res) {

  // ── CORS ────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // ── BLOB_READ_WRITE_TOKEN zorunlu ──────────────────────────
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[upload] BLOB_READ_WRITE_TOKEN eksik!');
    return res.status(500).json({
      success: false,
      error:   'Sunucu yapılandırması eksik: BLOB_READ_WRITE_TOKEN tanımlanmamış.',
    });
  }

  try {
    const { image, filename } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, error: 'Görsel verisi eksik veya geçersiz.' });
    }

    const parsed = parseBase64(image);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error:   'Geçersiz format. Beklenen: data:image/...;base64,...',
      });
    }

    const { mimeType, buffer } = parsed;

    if (!ALLOWED_MIME[mimeType]) {
      return res.status(415).json({
        success: false,
        error:   `Desteklenmeyen tip: ${mimeType}. İzin verilenler: JPEG, PNG, WEBP, GIF, AVIF`,
      });
    }

    const maxBytes = 7 * 1024 * 1024; // 7 MB
    if (buffer.byteLength > maxBytes) {
      return res.status(413).json({
        success: false,
        error:   `Görsel çok büyük (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Maks: 7 MB`,
      });
    }

    const blobFilename = buildFilename(filename || '', mimeType);

    // ════════════════════════════════════════════════════════
    //  VERCEL BLOB PUT  —  access: 'public'
    //
    //  access: 'public'
    //    → Token gerektirmeyen, CDN üzerinden herkese açık URL.
    //    → WhatsApp / Instagram önizlemesi      ✅
    //    → Google görsel arama indexleme        ✅
    //    → Müşteri / tarayıcı / uygulama        ✅
    //
    //  contentType: mimeType
    //    → HTTP yanıtına Content-Type ekler.
    //    → Tarayıcı dosyayı indirmek yerine INLINE gösterir.
    // ════════════════════════════════════════════════════════
    const blob = await put(blobFilename, buffer, {
      access:          'public',   // ✅ KRİTİK — herkese açık CDN
      contentType:     mimeType,   // ✅ inline render (indirme yok)
      addRandomSuffix: false,      // adı kendimiz benzersiz yaptık
      token:           process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({
      success:     true,
      url:         blob.url,         // 🌐 Herkese açık CDN URL
      downloadUrl: blob.downloadUrl, // ⬇️  İndirme linki (opsiyonel)
      pathname:    blob.pathname,
      size:        buffer.byteLength,
      mimeType,
    });

  } catch (err) {
    console.error('[upload] Hata:', err);

    if (err.message?.includes('token') || err.message?.includes('unauthorized')) {
      return res.status(401).json({
        success: false,
        error:   'Blob token geçersiz. Vercel → Settings → Environment Variables → BLOB_READ_WRITE_TOKEN',
      });
    }

    return res.status(500).json({
      success: false,
      error:   'Görsel yüklenirken sunucu hatası oluştu.',
      detail:  process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}
