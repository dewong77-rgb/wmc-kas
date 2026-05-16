-- ============================================
-- WMC KAS - Supabase Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- USERS & ROLES
-- ============================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  nama text not null,
  email text not null,
  role text not null check (role in ('admin', 'bendahara', 'viewer', 'input_only')),
  aktif boolean default true,
  created_at timestamptz default now()
);

-- Role permissions:
-- admin: semua akses (lihat, input, edit, hapus, kelola user)
-- bendahara: lihat, input, edit
-- input_only: hanya input transaksi baru
-- viewer: hanya lihat

alter table profiles enable row level security;

create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Admin can view all profiles" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin can manage profiles" on profiles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================
-- KATEGORI
-- ============================================
create table kategori (
  id uuid default uuid_generate_v4() primary key,
  nama text not null,
  jenis text not null check (jenis in ('masuk', 'keluar')),
  warna text default '#6366f1',
  ikon text default 'circle',
  urutan int default 0,
  aktif boolean default true,
  created_at timestamptz default now()
);

alter table kategori enable row level security;

create policy "All authenticated can view kategori" on kategori
  for select using (auth.role() = 'authenticated');

create policy "Admin and bendahara can manage kategori" on kategori
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'bendahara'))
  );

-- Seed kategori default
insert into kategori (nama, jenis, warna, ikon, urutan) values
  ('Penghasilan Jasa', 'masuk', '#22c55e', 'briefcase', 1),
  ('Honor Kegiatan', 'masuk', '#16a34a', 'award', 2),
  ('PPh / Potongan Pajak', 'masuk', '#15803d', 'receipt', 3),
  ('Modal / Investasi', 'masuk', '#14532d', 'trending-up', 4),
  ('Hibah & Donasi Masuk', 'masuk', '#84cc16', 'heart', 5),
  ('Piutang Terbayar', 'masuk', '#65a30d', 'check-circle', 6),
  ('Biaya Operasional', 'keluar', '#ef4444', 'settings', 1),
  ('Biaya Transportasi', 'keluar', '#dc2626', 'car', 2),
  ('Biaya Pemasaran', 'keluar', '#b91c1c', 'megaphone', 3),
  ('Biaya Gaji', 'keluar', '#f97316', 'users', 4),
  ('Belanja Alat / Bahan', 'keluar', '#ea580c', 'shopping-bag', 5),
  ('Hibah & Donasi Keluar', 'keluar', '#c2410c', 'gift', 6),
  ('Hutang / Cicilan', 'keluar', '#9a3412', 'credit-card', 7);

-- ============================================
-- POSISI KAS
-- ============================================
create table posisi_kas (
  id uuid default uuid_generate_v4() primary key,
  nama text not null,
  tipe text not null check (tipe in ('tunai', 'bank', 'ewallet')),
  nomor_rekening text,
  aktif boolean default true,
  urutan int default 0,
  created_at timestamptz default now()
);

alter table posisi_kas enable row level security;
create policy "All authenticated can view posisi_kas" on posisi_kas
  for select using (auth.role() = 'authenticated');
create policy "Admin and bendahara can manage posisi_kas" on posisi_kas
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'bendahara'))
  );

insert into posisi_kas (nama, tipe, urutan) values
  ('Kas di Tangan (Tunai)', 'tunai', 1),
  ('Bank BRI', 'bank', 2),
  ('Bank BCA', 'bank', 3),
  ('Bank Mandiri', 'bank', 4),
  ('GoPay / OVO Bisnis', 'ewallet', 5);

-- ============================================
-- TRANSAKSI
-- ============================================
create table transaksi (
  id uuid default uuid_generate_v4() primary key,
  tanggal date not null,
  jenis text not null check (jenis in ('masuk', 'keluar')),
  nominal numeric(15,2) not null check (nominal > 0),
  kategori_id uuid references kategori(id),
  posisi_kas_id uuid references posisi_kas(id),
  keterangan text,
  status text default 'lunas' check (status in ('lunas', 'pending', 'batal')),
  pajak text default 'tanpa_pajak' check (pajak in ('tanpa_pajak', 'ppn', 'pph21', 'pph23')),
  bukti_url text,
  input_oleh uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table transaksi enable row level security;

create policy "All authenticated can view transaksi" on transaksi
  for select using (auth.role() = 'authenticated');

create policy "Admin, bendahara, input_only can insert" on transaksi
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'bendahara', 'input_only'))
  );

create policy "Admin and bendahara can update" on transaksi
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'bendahara'))
  );

create policy "Only admin can delete" on transaksi
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Auto update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transaksi_updated_at
  before update on transaksi
  for each row execute function update_updated_at();

-- ============================================
-- VIEW: SALDO PER POSISI KAS
-- ============================================
create view v_saldo_kas as
select
  pk.id,
  pk.nama,
  pk.tipe,
  coalesce(sum(case when t.jenis = 'masuk' then t.nominal else 0 end), 0) as total_masuk,
  coalesce(sum(case when t.jenis = 'keluar' then t.nominal else 0 end), 0) as total_keluar,
  coalesce(sum(case when t.jenis = 'masuk' then t.nominal else -t.nominal end), 0) as saldo
from posisi_kas pk
left join transaksi t on t.posisi_kas_id = pk.id and t.status != 'batal'
where pk.aktif = true
group by pk.id, pk.nama, pk.tipe;

-- ============================================
-- VIEW: RINGKASAN BULANAN
-- ============================================
create view v_ringkasan_bulanan as
select
  date_trunc('month', tanggal) as bulan,
  sum(case when jenis = 'masuk' then nominal else 0 end) as total_masuk,
  sum(case when jenis = 'keluar' then nominal else 0 end) as total_keluar,
  sum(case when jenis = 'masuk' then nominal else -nominal end) as net
from transaksi
where status != 'batal'
group by date_trunc('month', tanggal)
order by bulan desc;

