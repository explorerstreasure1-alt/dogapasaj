# 🌿 Doğa Pasajı

```
arya-atelier/
├── api/
│   ├── upload.js      # Görsel yükleme → Blob (access: 'public')
│   └── products.js    # Ürün listesi → Blob (products.json)
├── index.html         # Tüm frontend
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

## Nasıl Çalışır?

1. Admin görsel yükler → `/api/upload` → Blob CDN (herkese açık URL)
2. Admin ürün kaydeder → `/api/products` → `products.json` Blob'a yazılır
3. Ziyaretçi siteyi açar → `/api/products` → Blob'dan okur → ürünleri görür ✅

## Kurulum

```bash
npm install
cp .env.example .env   # BLOB_READ_WRITE_TOKEN ekle
npm run dev
npm run deploy
```

## Vercel Panel

Storage → Blob → Connect → `BLOB_READ_WRITE_TOKEN` → Environment Variables
