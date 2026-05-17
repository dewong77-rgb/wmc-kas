// WMC KAS - core.js
// Ganti dua baris ini dengan credentials Supabase kamu
var SUPABASE_URL = 'https://urseszjkqxivvaarjqro.supabase.co';
var SUPABASE_KEY = 'sb_publishable_il7NmuQEiyuVHzzF3XU37A_bLM_We4Q';

// Global state
var db = null;
var currentUser = null;
var currentProfile = null;
var allTrx = [];
var allKategori = [];
var allKas = [];
var allAnggota = [];
var allKegiatan = [];
var allAnggaran = [];
var currentPage = 'dashboard';
var currentAnggotaTab = 'rekap';
var PAGE_SIZE = 5;
var MAX_BUKTI_SIZE = 200 * 1024; // 200KB
var BULAN_NAMA = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// DB init
function initDB() {
  if (SUPABASE_URL === 'ISI_SUPABASE_URL_DISINI') {
    document.getElementById('config-warning').textContent = 'Supabase belum dikonfigurasi.';
    document.getElementById('config-warning').style.display = 'block';
    return false;
  }
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

// AUTH
async function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-pass').value;
  var btn = document.getElementById('btn-login');
  if (!email || !pass) { showAuthError('Email dan password wajib diisi'); return; }
  btn.innerHTML = '<div class="spinner"></div>'; btn.disabled = true;
  document.getElementById('auth-error').style.display = 'none';
  var r = await db.auth.signInWithPassword({ email: email, password: pass });
  if (r.error) { showAuthError('Email atau password salah'); btn.innerHTML = '<span>Masuk</span>'; btn.disabled = false; }
}
function showAuthError(msg) {
  var el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
}
async function doLogout() { await db.auth.signOut(); }

async function loadProfile(user) {
  currentUser = user;
  var r = await db.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = r.data;
  if (!currentProfile) {
    var nama = user.email.split('@')[0];
    await db.from('profiles').insert({ id: user.id, nama: nama, email: user.email, role: 'admin' });
    currentProfile = { id: user.id, nama: nama, email: user.email, role: 'admin' };
  }
  // Log login - fire and forget
  db.from('log_login').insert({
    user_id: currentUser.id,
    user_nama: currentProfile.nama,
    user_role: currentProfile.role,
    user_agent: navigator.userAgent.substring(0, 200)
  });
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('header-user').textContent = currentProfile.nama;
  updateProfileUI();
  loadAll();
}
function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function updateProfileUI() {
  if (!currentProfile) return;
  var isAdmin = currentProfile.role === 'admin';
  var canEdit = isAdmin || currentProfile.role === 'bendahara';
  document.querySelectorAll('.admin-only').forEach(function(el) {
    el.style.display = isAdmin ? 'flex' : 'none';
  });
  document.querySelectorAll('.ekspor-menu').forEach(function(el) {
    el.style.display = canEdit ? 'flex' : 'none';
  });
  var btnKeg = document.getElementById('btn-add-kegiatan');
  if (btnKeg) btnKeg.style.display = canEdit ? 'block' : 'none';
  var btnAng = document.getElementById('btn-add-anggaran');
  if (btnAng) btnAng.style.display = isAdmin ? 'block' : 'none';
  // Profil page
  var av = document.getElementById('profile-avatar');
  if (av) av.textContent = currentProfile.nama.charAt(0).toUpperCase();
  var pn = document.getElementById('profile-name');
  if (pn) pn.textContent = currentProfile.nama;
  var pr = document.getElementById('profile-role');
  var roles = { admin:'Admin', bendahara:'Bendahara', input_only:'Input Only', viewer:'Viewer' };
  if (pr) pr.textContent = roles[currentProfile.role] || currentProfile.role;
}

// NAVIGASI
function goPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  currentPage = name;
  var navMap = { dashboard:0, transaksi:1, anggaran:2, anggota:3, profil:4 };
  if (navMap[name] !== undefined) {
    document.querySelectorAll('.nav-item')[navMap[name]].classList.add('active');
  }
  var canAddTrx = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'bendahara' || currentProfile.role === 'input_only');
  document.getElementById('fab').style.display = (name === 'transaksi' && canAddTrx) ? 'flex' : 'none';
  var titles = {
    dashboard:'WMC Kas', transaksi:'Transaksi', anggaran:'Anggaran',
    anggota:'Anggota & Kegiatan', profil:'Profil', pengguna:'Pengguna',
    kategori:'Kategori', poskas:'Posisi Kas', ekspor:'Ekspor Laporan'
  };
  document.getElementById('header-title').textContent = titles[name] || 'WMC Kas';
  // Trigger render per halaman
  if (name === 'transaksi') renderTrxList();
  if (name === 'kategori') renderKategoriPage();
  if (name === 'pengguna') loadUsers();
  if (name === 'poskas') loadPosKasPage();
  if (name === 'anggaran') renderAnggaranPage();
  if (name === 'anggota') {
    rekapPage = 0; anggotaPage = 0; kegiatanPage = 0;
    renderRekapAnggota(); renderDataAnggota();
  }
}

function onFabClick() {
  if (currentPage === 'anggaran') { openSheetAnggaran(); return; }
  openSheet('trx');
}

// SHEET UTILS
function openSheet(type) {
  if (type === 'trx') {
    var allowed = ['admin','bendahara','input_only'];
    if (!currentProfile || allowed.indexOf(currentProfile.role) < 0) {
      showToast('Tidak punya akses input','red'); return;
    }
    resetTrxForm();
    renderKatGrid();
  }
  var overlay = document.getElementById('overlay-' + type);
  var sheet = document.getElementById('sheet-' + type);
  if (!overlay || !sheet) return;
  overlay.classList.add('show');
  setTimeout(function() { sheet.classList.add('show'); }, 10);
}

function closeSheet(type) {
  if (type === 'trx') editingTrxId = null;
  if (type === 'kegiatan') editingKegiatanId = null;
  var sheet = document.getElementById('sheet-' + type);
  var overlay = document.getElementById('overlay-' + type);
  if (!sheet || !overlay) return;
  sheet.classList.remove('show');
  setTimeout(function() { overlay.classList.remove('show'); }, 300);
}

// DATA LOADERS
async function loadAll() {
  await Promise.all([loadKategori(), loadKas(), loadTrx(), loadAnggota(), loadAnggaran()]);
  renderDashboard();
  renderTrxList();
  populateKasSelect();
  loadKegiatan();
}

async function loadKategori() {
  var r = await db.from('kategori').select('*').eq('aktif', true).order('urutan');
  allKategori = r.data || [];
}
async function loadKas() {
  var r = await db.from('posisi_kas').select('*').eq('aktif', true).order('urutan');
  allKas = r.data || [];
}
async function loadTrx() {
  var r = await db.from('transaksi')
    .select('*, kategori(nama,warna,jenis), posisi_kas(nama,tipe)')
    .neq('status', 'batal')
    .order('tanggal', { ascending: false })
    .limit(500);
  allTrx = r.data || [];
}
async function loadAnggota() {
  var r = await db.from('anggota').select('*').order('nama');
  allAnggota = r.data || [];
}
async function loadAnggaran() {
  var r = await db.from('anggaran')
    .select('*, kategori(nama,warna)')
    .order('tahun', { ascending: false })
    .order('bulan', { ascending: false });
  allAnggaran = r.data || [];
}
async function loadKegiatan() {
  var r = await db.from('kegiatan')
    .select('*, bendahara:bendahara_id(nama)')
    .order('tanggal_mulai', { ascending: false });
  var kegiatan = r.data || [];
  if (kegiatan.length) {
    var ids = kegiatan.map(function(k) { return k.id; });
    var rp = await db.from('kegiatan_peserta').select('*, anggota(nama)').in('kegiatan_id', ids);
    var pm = {};
    (rp.data || []).forEach(function(p) {
      if (!pm[p.kegiatan_id]) pm[p.kegiatan_id] = [];
      pm[p.kegiatan_id].push(p);
    });
    kegiatan.forEach(function(k) { k.kegiatan_peserta = pm[k.id] || []; });
  }
  allKegiatan = kegiatan;
  if (currentPage === 'anggota') { renderRekapAnggota(); renderKegiatanList(); }
}

// NOMINAL INPUT SETUP
function setupNominalInput(displayId, rawId) {
  var el = document.getElementById(displayId);
  if (!el) return;
  el.addEventListener('input', function() {
    var raw = this.value.replace(/\D/g, '');
    document.getElementById(rawId).value = raw;
    this.value = raw ? parseInt(raw).toLocaleString('id-ID') : '';
  });
  el.addEventListener('keydown', function(e) {
    var allowed = [8,46,37,38,39,40,9];
    if (allowed.indexOf(e.keyCode) >= 0) return;
    if ((e.keyCode < 48 || e.keyCode > 57) && (e.keyCode < 96 || e.keyCode > 105)) e.preventDefault();
  });
}

// PAGINATION HELPER
function renderPagerHTML(page, total, perPage, prevFn, nextFn) {
  var totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return '';
  var maxPage = totalPages - 1;
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;color:var(--text2);font-size:13px">'
    + '<button class="pager-btn" ' + (page === 0 ? 'disabled' : '') + ' onclick="' + prevFn + '">← Sebelumnya</button>'
    + '<span>' + (page + 1) + ' / ' + totalPages + '</span>'
    + '<button class="pager-btn" ' + (page >= maxPage ? 'disabled' : '') + ' onclick="' + nextFn + '">Berikutnya →</button>'
    + '</div>';
}

// UTILS
function formatRp(num) {
  if (!num) return 'Rp 0';
  return 'Rp ' + Math.abs(Math.round(num)).toLocaleString('id-ID');
}
function showToast(msg, type) {
  type = type || '';
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(function() { t.className = 'toast'; }, 3000);
}
function escQ(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// INIT
document.addEventListener('DOMContentLoaded', async function() {
  var ok = initDB();
  if (!ok) return;

  // Setup overlay close on backdrop click
  ['trx','detail','anggaran','anggota','kegiatan','user','kat','kas'].forEach(function(t) {
    var el = document.getElementById('overlay-' + t);
    if (el) el.addEventListener('click', function(e) {
      if (e.target === e.currentTarget) closeSheet(t);
    });
  });

  setupNominalInput('trx-nominal-display', 'trx-nominal-raw');
  setupNominalInput('anggaran-nominal-display', 'anggaran-nominal-raw');

  // Populate tahun selects
  var now = new Date();
  ['ekspor-tahun','anggaran-tahun'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    for (var y = now.getFullYear(); y >= 2024; y--) {
      var opt = document.createElement('option'); opt.value = y; opt.textContent = y;
      sel.appendChild(opt);
    }
  });
  document.getElementById('ekspor-bulan').value = now.getMonth();
  document.getElementById('anggaran-bulan').value = now.getMonth() + 1;

  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('trx-search').addEventListener('input', function(e) {
    renderTrxList(e.target.value);
  });

  // Auth state
  var s = await db.auth.getSession();
  if (s.data.session) { await loadProfile(s.data.session.user); showApp(); }
  db.auth.onAuthStateChange(async function(event, session) {
    if (event === 'SIGNED_IN' && session) { await loadProfile(session.user); showApp(); }
    else if (event === 'SIGNED_OUT') { showAuth(); }
  });
});
