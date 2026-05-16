// ============================================
// WMC KAS - app.js
// Konfigurasi Supabase — isi setelah buat akun
// ============================================

const SUPABASE_URL = 'https://urseszjkqxivvaarjqro.supabase.co';
const SUPABASE_KEY = 'sb_publishable_il7NmuQEiyuVHzzF3XU37A_bLM_We4Q';

// ============================================
// INIT
// ============================================
let db = null;
let currentUser = null;
let currentProfile = null;
let allTrx = [];
let allKategori = [];
let allKas = [];
let activeFilter = 'all';
let selectedKatId = null;
let currentJenis = 'masuk';
let detailTrxId = null;

function initDB() {
  if (SUPABASE_URL === 'ISI_SUPABASE_URL_DISINI') {
    document.getElementById('config-warning').style.display = 'block';
    return false;
  }
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

document.addEventListener('DOMContentLoaded', async () => {
  const ok = initDB();
  if (!ok) return;

  // Check session
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    await loadProfile(session.user);
    showApp();
  }

  // Auth state change
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await loadProfile(session.user);
      showApp();
    } else if (event === 'SIGNED_OUT') {
      showAuth();
    }
  });

  // Login
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  // Search
  document.getElementById('trx-search').addEventListener('input', e => {
    renderTrxList(e.target.value);
  });

  // Close sheets on overlay click
  document.getElementById('overlay-trx').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSheet('trx');
  });
  document.getElementById('overlay-detail').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSheet('detail');
  });

  // Set today's date
  document.getElementById('trx-tanggal').value = new Date().toISOString().split('T')[0];
});

// ============================================
// AUTH
// ============================================
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('btn-login');

  if (!email || !pass) {
    showAuthError('Email dan password wajib diisi');
    return;
  }

  btn.innerHTML = '<div class="spinner"></div>';
  btn.disabled = true;
  errEl.style.display = 'none';

  const { error } = await db.auth.signInWithPassword({ email, password: pass });

  if (error) {
    showAuthError('Email atau password salah');
    btn.innerHTML = '<span id="login-text">Masuk</span>';
    btn.disabled = false;
  }
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function doLogout() {
  await db.auth.signOut();
}

async function loadProfile(user) {
  currentUser = user;
  const { data } = await db.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = data;

  if (!currentProfile) {
    // First time — create profile as admin (first user)
    const { data: count } = await db.from('profiles').select('id', { count: 'exact', head: true });
    const role = (count === 0) ? 'admin' : 'viewer';
    const nama = user.email.split('@')[0];
    await db.from('profiles').insert({ id: user.id, nama, email: user.email, role });
    currentProfile = { id: user.id, nama, email: user.email, role };
  }
}

// ============================================
// APP SHELL
// ============================================
function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  const app = document.getElementById('app');
  app.style.display = 'flex';

  // Header user
  if (currentProfile) {
    document.getElementById('header-user').textContent = currentProfile.nama;
  }

  // Profile page
  updateProfilePage();

  // Load data
  loadAll();
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function updateProfilePage() {
  if (!currentProfile) return;
  const initial = currentProfile.nama.charAt(0).toUpperCase();
  document.getElementById('profile-avatar').textContent = initial;
  document.getElementById('profile-name').textContent = currentProfile.nama;
  const roleLabel = { admin: '👑 Admin', bendahara: '💰 Bendahara', input_only: '✏️ Input Only', viewer: '👁 Viewer' };
  document.getElementById('profile-role').textContent = roleLabel[currentProfile.role] || currentProfile.role;

  if (currentProfile.role === 'admin') {
    document.getElementById('menu-users').style.display = 'flex';
  }
}

// ============================================
// NAVIGATION
// ============================================
function goPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');

  const navMap = { dashboard: 0, transaksi: 1, profil: 2, kategori: -1 };
  const idx = navMap[name];
  if (idx >= 0) {
    document.querySelectorAll('.nav-item')[idx].classList.add('active');
  }

  // Hide FAB on profil & kategori
  document.getElementById('fab').style.display = (name === 'profil' || name === 'kategori') ? 'none' : 'flex';

  if (name === 'transaksi') renderTrxList();
  if (name === 'kategori') renderKategoriPage();
}

// ============================================
// DATA LOADING
// ============================================
async function loadAll() {
  await Promise.all([loadKategori(), loadKas(), loadTrx()]);
  renderDashboard();
  renderTrxList();
  populateKasSelect();
}

async function loadKategori() {
  const { data } = await db.from('kategori').select('*').eq('aktif', true).order('urutan');
  allKategori = data || [];
}

async function loadKas() {
  const { data } = await db.from('posisi_kas').select('*').eq('aktif', true).order('urutan');
  allKas = data || [];
}

async function loadTrx() {
  const { data } = await supabase
    .from('transaksi')
    .select(`*, kategori(nama, warna, jenis), posisi_kas(nama, tipe)`)
    .neq('status', 'batal')
    .order('tanggal', { ascending: false })
    .limit(200);
  allTrx = data || [];
}

// ============================================
// DASHBOARD
// ============================================
function renderDashboard() {
  // Total saldo
  const totalSaldo = allTrx.reduce((s, t) => t.jenis === 'masuk' ? s + t.nominal : s - t.nominal, 0);
  document.getElementById('saldo-total').textContent = formatRp(totalSaldo);
  document.getElementById('saldo-total').style.color = totalSaldo >= 0 ? 'white' : 'var(--red)';

  // Bulan ini
  const now = new Date();
  const bulanIni = allTrx.filter(t => {
    const d = new Date(t.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const masukBulan = bulanIni.filter(t => t.jenis === 'masuk').reduce((s, t) => s + t.nominal, 0);
  const keluarBulan = bulanIni.filter(t => t.jenis === 'keluar').reduce((s, t) => s + t.nominal, 0);
  const net = masukBulan - keluarBulan;

  document.getElementById('masuk-bulan').textContent = formatRp(masukBulan);
  document.getElementById('keluar-bulan').textContent = formatRp(keluarBulan);
  document.getElementById('net-bulan').textContent = formatRp(net);
  document.getElementById('net-bulan').style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('trx-count').textContent = bulanIni.length + ' transaksi';

  // Chart 6 bulan
  renderChart();

  // Posisi kas
  renderKasBreakdown();

  // Recent transaksi
  const recent = allTrx.slice(0, 5);
  document.getElementById('trx-recent').innerHTML = recent.length ? recent.map(trxHTML).join('') :
    '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada transaksi</div></div>';
}

function renderChart() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('id', { month: 'short' }) });
  }

  const data = months.map(m => {
    const trx = allTrx.filter(t => {
      const d = new Date(t.tanggal);
      return d.getMonth() === m.month && d.getFullYear() === m.year;
    });
    return {
      label: m.label,
      masuk: trx.filter(t => t.jenis === 'masuk').reduce((s, t) => s + t.nominal, 0),
      keluar: trx.filter(t => t.jenis === 'keluar').reduce((s, t) => s + t.nominal, 0),
    };
  });

  const maxVal = Math.max(...data.map(d => Math.max(d.masuk, d.keluar)), 1);

  document.getElementById('chart-bars').innerHTML = data.map(d => `
    <div class="chart-bar-wrap">
      <div style="display:flex;gap:2px;align-items:flex-end;height:80px;width:100%">
        <div class="chart-bar green" style="flex:1;height:${Math.max(4, (d.masuk/maxVal)*76)}px"></div>
        <div class="chart-bar red" style="flex:1;height:${Math.max(4, (d.keluar/maxVal)*76)}px"></div>
      </div>
      <div class="chart-bar-label">${d.label}</div>
    </div>
  `).join('');
}

function renderKasBreakdown() {
  if (!allKas.length) {
    document.getElementById('kas-breakdown').innerHTML = '<div style="color:var(--text3);font-size:13px">Tidak ada data kas</div>';
    return;
  }

  const kasData = allKas.map(k => {
    const trx = allTrx.filter(t => t.posisi_kas_id === k.id);
    const saldo = trx.reduce((s, t) => t.jenis === 'masuk' ? s + t.nominal : s - t.nominal, 0);
    return { ...k, saldo };
  });

  const icons = { tunai: '💵', bank: '🏦', ewallet: '📱' };
  document.getElementById('kas-breakdown').innerHTML = kasData.map(k => `
    <div class="kas-item">
      <div class="kas-icon">${icons[k.tipe] || '💰'}</div>
      <div class="kas-info">
        <div class="kas-name">${k.nama}</div>
        <div class="kas-tipe">${k.tipe.toUpperCase()}</div>
      </div>
      <div class="kas-saldo" style="color:${k.saldo >= 0 ? 'var(--text)' : 'var(--red)'}">${formatRp(k.saldo)}</div>
    </div>
  `).join('');
}

// ============================================
// TRANSAKSI LIST
// ============================================
function trxHTML(t) {
  const kat = t.kategori;
  const tgl = new Date(t.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
  return `
    <div class="trx-item" onclick="openDetail('${t.id}')">
      <div class="trx-dot ${t.jenis}"></div>
      <div class="trx-info">
        <div class="trx-ket">${t.keterangan || (kat?.nama || '-')}</div>
        <div class="trx-meta">${tgl} · ${kat?.nama || '-'}</div>
      </div>
      <div class="trx-nominal ${t.jenis}">${t.jenis === 'masuk' ? '+' : '-'}${formatRp(t.nominal)}</div>
    </div>
  `;
}

function renderTrxList(search = '') {
  let filtered = allTrx;
  if (activeFilter !== 'all') filtered = filtered.filter(t => t.jenis === activeFilter);
  if (search) filtered = filtered.filter(t =>
    (t.keterangan || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.kategori?.nama || '').toLowerCase().includes(search.toLowerCase())
  );

  const el = document.getElementById('trx-all');
  el.innerHTML = filtered.length ? filtered.map(trxHTML).join('') : `
    <div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-text">Tidak ada transaksi</div>
      <div class="empty-sub">Coba ubah filter atau kata kunci</div>
    </div>
  `;
}

function setFilter(el, val) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activeFilter = val;
  renderTrxList(document.getElementById('trx-search').value);
}

// ============================================
// DETAIL TRANSAKSI
// ============================================
function openDetail(id) {
  const t = allTrx.find(x => x.id === id);
  if (!t) return;
  detailTrxId = id;

  const tgl = new Date(t.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'long', year: 'numeric' });
  const statusColor = { lunas: 'green', pending: 'yellow', batal: 'red' };

  document.getElementById('detail-title').textContent = t.jenis === 'masuk' ? '↑ Uang Masuk' : '↓ Uang Keluar';

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-row">
      <div class="detail-key">Nominal</div>
      <div class="detail-val" style="font-family:var(--mono);font-size:20px;color:${t.jenis === 'masuk' ? 'var(--green)' : 'var(--red)'}">
        ${t.jenis === 'masuk' ? '+' : '-'}${formatRp(t.nominal)}
      </div>
    </div>
    <div class="detail-row">
      <div class="detail-key">Tanggal</div>
      <div class="detail-val">${tgl}</div>
    </div>
    <div class="detail-row">
      <div class="detail-key">Kategori</div>
      <div class="detail-val">${t.kategori?.nama || '-'}</div>
    </div>
    <div class="detail-row">
      <div class="detail-key">Posisi Kas</div>
      <div class="detail-val">${t.posisi_kas?.nama || '-'}</div>
    </div>
    <div class="detail-row">
      <div class="detail-key">Status</div>
      <div class="detail-val"><span class="badge ${statusColor[t.status] || 'green'}">${t.status}</span></div>
    </div>
    <div class="detail-row">
      <div class="detail-key">Keterangan</div>
      <div class="detail-val">${t.keterangan || '-'}</div>
    </div>
  `;

  // Show delete button only for admin
  const delBtn = document.getElementById('btn-delete-trx');
  delBtn.style.display = currentProfile?.role === 'admin' ? 'block' : 'none';
  delBtn.onclick = () => deleteTrx(id);

  openSheet('detail');
}

async function deleteTrx(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  const { error } = await db.from('transaksi').update({ status: 'batal' }).eq('id', id);
  if (!error) {
    closeSheet('detail');
    await loadTrx();
    renderDashboard();
    renderTrxList();
    showToast('Transaksi dihapus', 'green');
  } else {
    showToast('Gagal menghapus', 'red');
  }
}

// ============================================
// INPUT TRANSAKSI
// ============================================
function openSheet(type = 'trx') {
  // Check permission
  if (type === 'trx') {
    const allowed = ['admin', 'bendahara', 'input_only'];
    if (!currentProfile || !allowed.includes(currentProfile.role)) {
      showToast('Tidak punya akses input', 'red');
      return;
    }
    renderKatGrid();
  }

  const overlay = document.getElementById('overlay-' + type);
  const sheet = document.getElementById('sheet-' + type);
  overlay.classList.add('show');
  setTimeout(() => sheet.classList.add('show'), 10);
}

function closeSheet(type = 'trx') {
  const sheet = document.getElementById('sheet-' + type);
  const overlay = document.getElementById('overlay-' + type);
  sheet.classList.remove('show');
  setTimeout(() => overlay.classList.remove('show'), 300);
}

function setJenis(jenis) {
  currentJenis = jenis;
  document.getElementById('jenis-masuk').className = 'jenis-btn' + (jenis === 'masuk' ? ' active masuk' : '');
  document.getElementById('jenis-keluar').className = 'jenis-btn' + (jenis === 'keluar' ? ' active keluar' : '');

  const btn = document.getElementById('btn-submit-trx');
  btn.className = 'btn-submit ' + (jenis === 'masuk' ? 'green' : 'red');

  selectedKatId = null;
  renderKatGrid();
}

function renderKatGrid() {
  const filtered = allKategori.filter(k => k.jenis === currentJenis);
  document.getElementById('kat-grid').innerHTML = filtered.map(k => `
    <div class="kat-chip ${selectedKatId === k.id ? 'selected' : ''}" onclick="selectKat('${k.id}')">
      ${k.nama}
    </div>
  `).join('');
}

function selectKat(id) {
  selectedKatId = id;
  renderKatGrid();
}

function populateKasSelect() {
  const sel = document.getElementById('trx-kas');
  sel.innerHTML = '<option value="">Pilih posisi kas...</option>' +
    allKas.map(k => `<option value="${k.id}">${k.nama}</option>`).join('');
}

async function submitTrx() {
  const nominal = parseFloat(document.getElementById('trx-nominal').value);
  const tanggal = document.getElementById('trx-tanggal').value;
  const kasId = document.getElementById('trx-kas').value;
  const ket = document.getElementById('trx-ket').value.trim();
  const status = document.getElementById('trx-status').value;

  if (!nominal || nominal <= 0) return showToast('Nominal harus diisi', 'red');
  if (!tanggal) return showToast('Tanggal harus diisi', 'red');
  if (!kasId) return showToast('Pilih posisi kas', 'red');
  if (!selectedKatId) return showToast('Pilih kategori', 'red');

  const btn = document.getElementById('btn-submit-trx');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  const { error } = await db.from('transaksi').insert({
    jenis: currentJenis,
    nominal,
    tanggal,
    posisi_kas_id: kasId,
    kategori_id: selectedKatId,
    keterangan: ket,
    status,
    input_oleh: currentUser.id,
  });

  btn.disabled = false;
  btn.textContent = 'Simpan Transaksi';

  if (!error) {
    closeSheet('trx');
    // Reset form
    document.getElementById('trx-nominal').value = '';
    document.getElementById('trx-ket').value = '';
    selectedKatId = null;

    await loadTrx();
    renderDashboard();
    renderTrxList();
    showToast('Transaksi tersimpan ✓', 'green');
  } else {
    showToast('Gagal menyimpan: ' + error.message, 'red');
  }
}

// ============================================
// KATEGORI PAGE
// ============================================
function renderKategoriPage() {
  const masuk = allKategori.filter(k => k.jenis === 'masuk');
  const keluar = allKategori.filter(k => k.jenis === 'keluar');

  document.getElementById('kat-masuk-list').innerHTML = masuk.map(k => `
    <div class="kat-manage-item">
      <div class="kat-color-dot" style="background:${k.warna}"></div>
      <div class="kat-manage-name">${k.nama}</div>
      <div class="kat-manage-jenis" style="background:var(--green-dim);color:var(--green)">Masuk</div>
    </div>
  `).join('') || '<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada kategori</div>';

  document.getElementById('kat-keluar-list').innerHTML = keluar.map(k => `
    <div class="kat-manage-item">
      <div class="kat-color-dot" style="background:${k.warna}"></div>
      <div class="kat-manage-name">${k.nama}</div>
      <div class="kat-manage-jenis" style="background:var(--red-dim);color:var(--red)">Keluar</div>
    </div>
  `).join('') || '<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada kategori</div>';

  // Show add button only for admin/bendahara
  const canManage = currentProfile?.role === 'admin' || currentProfile?.role === 'bendahara';
  document.getElementById('btn-add-kat').style.display = canManage ? 'block' : 'none';
  document.getElementById('btn-add-kat').onclick = () => alert('Fitur tambah kategori segera hadir di update berikutnya');
}

// ============================================
// UTILS
// ============================================
function formatRp(num) {
  if (num === undefined || num === null) return 'Rp 0';
  return 'Rp ' + Math.abs(Math.round(num)).toLocaleString('id-ID');
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 2800);
}
