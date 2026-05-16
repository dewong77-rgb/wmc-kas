# WMC KAS — Panduan Setup

## File yang Ada
- `index.html` — tampilan app
- `app.js` — logika app (EDIT INI untuk isi Supabase)
- `manifest.json` — agar bisa diinstall di HP
- `schema.sql` — struktur database Supabase

---

## LANGKAH 1 — Setup Supabase

1. Login ke https://supabase.com
2. Klik **New Project**
   - Organization: pilih yang ada atau buat baru
   - Name: `wmc-kas`
   - Database Password: buat yang kuat, **catat**
   - Region: Southeast Asia (Singapore)
3. Tunggu project dibuat (~2 menit)
4. Masuk ke **SQL Editor** (menu kiri)
5. Paste isi file `schema.sql` → klik **Run**
6. Ambil credentials:
   - Menu kiri → **Settings** → **API**
   - Copy **Project URL** → isi di `app.js` baris `SUPABASE_URL`
   - Copy **anon public key** → isi di `app.js` baris `SUPABASE_KEY`

---

## LANGKAH 2 — Buat User Pertama (Admin)

1. Di Supabase → **Authentication** → **Users** → **Add User**
2. Isi email & password kamu
3. Klik **Create User**

---

## LANGKAH 3 — Upload ke GitHub

1. Login https://github.com
2. Klik **+** → **New repository**
   - Name: `wmc-kas`
   - Public
   - Klik **Create repository**
3. Upload 4 file: `index.html`, `app.js`, `manifest.json`, `schema.sql`
   - Klik **uploading an existing file**
   - Drag semua file → **Commit changes**

---

## LANGKAH 4 — Deploy ke Netlify

1. Login https://netlify.com dengan akun GitHub
2. **Add new site** → **Import from Git** → **GitHub**
3. Pilih repo `wmc-kas`
4. Klik **Deploy site**
5. Tunggu ~1 menit → dapat URL seperti `wmc-kas-xyz.netlify.app`

---

## LANGKAH 5 — Install di HP

1. Buka URL Netlify di Chrome HP
2. Klik menu Chrome (⋮) → **Add to Home screen**
3. Konfirmasi → ikon WMC Kas muncul di homescreen
4. Buka seperti app biasa

---

## Akun & Role

| Role | Bisa Apa |
|------|----------|
| admin | Semua akses + kelola user |
| bendahara | Lihat, input, edit |
| input_only | Hanya input transaksi |
| viewer | Hanya lihat |

Untuk tambah anggota tim:
1. Supabase → Authentication → Add User (buat akun)
2. SQL Editor → jalankan:
   ```sql
   UPDATE profiles SET role = 'bendahara' WHERE email = 'email@anggota.com';
   ```

---

## Import Data Lama

Setelah app jalan, data dari Excel bisa diimport manual atau minta bantuan untuk buat script import otomatis.
