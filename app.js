// WMC KAS - app.js
// Isi dua baris di bawah dengan credentials Supabase kamu

const SUPABASE_URL = 'https://urseszjkqxivvaarjqro.supabase.co';
const SUPABASE_KEY = 'sb_publishable_il7NmuQEiyuVHzzF3XU37A_bLM_We4Q';

var db = null;
var currentUser = null;
var currentProfile = null;
var allTrx = [];
var allKategori = [];
var allKas = [];
var activeFilter = 'all';
var selectedKatId = null;
var currentJenis = 'masuk';
var detailTrxId = null;

function initDB() {
  if (SUPABASE_URL === 'ISI_SUPABASE_URL_DISINI') {
    document.getElementById('config-warning').style.display = 'block';
    return false;
  }
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

document.addEventListener('DOMContentLoaded', async function() {
  var ok = initDB();
  if (!ok) return;

  var sessionData = await db.auth.getSession();
  if (sessionData.data.session) {
    await loadProfile(sessionData.data.session.user);
    showApp();
  }

  db.auth.onAuthStateChange(async function(event, session) {
    if (event === 'SIGNED_IN' && session) {
      await loadProfile(session.user);
      showApp();
    } else if (event === 'SIGNED_OUT') {
      showAuth();
    }
  });

  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('trx-search').addEventListener('input', function(e) {
    renderTrxList(e.target.value);
  });
  document.getElementById('overlay-trx').addEventListener('click', function(e) {
    if (e.target === e.currentTarget) closeSheet('trx');
  });
  document.getElementById('overlay-detail').addEventListener('click', function(e) {
    if (e.target === e.currentTarget) closeSheet('detail');
  });

  document.getElementById('trx-tanggal').value = new Date().toISOString().split('T')[0];
});

// AUTH

async function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-pass').value;
  var btn = document.getElementById('btn-login');

  if (!email || !pass) {
    showAuthError('Email dan password wajib diisi');
    return;
  }

  btn.innerHTML = '<div class="spinner"></div>';
  btn.disabled = true;
  document.getElementById('auth-error').style.display = 'none';

  var result = await db.auth.signInWithPassword({ email: email, password: pass });

  if (result.error) {
    showAuthError('Email atau password salah');
    btn.innerHTML = '<span>Masuk</span>';
    btn.disabled = false;
  }
}

function showAuthError(msg) {
  var el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function doLogout() {
  await db.auth.signOut();
}

async function loadProfile(user) {
  currentUser = user;
  var result = await db.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = result.data;

  if (!currentProfile) {
    var nama = user.email.split('@')[0];
    await db.from('profiles').insert({ id: user.id, nama: nama, email: user.email, role: 'admin' });
    currentProfile = { id: user.id, nama: nama, email: user.email, role: 'admin' };
  }
}

// APP SHELL

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  if (currentProfile) {
    document.getElementById('header-user').textContent = currentProfile.nama;
  }
  updateProfilePage();
  loadAll();
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function updateProfilePage() {
  if (!currentProfile) return;
  document.getElementById('profile-avatar').textContent = currentProfile.nama.charAt(0).toUpperCase();
  document.getElementById('profile-name').textContent = currentProfile.nama;
  var roles = { admin: 'Admin', bendahara: 'Bendahara', input_only: 'Input Only', viewer: 'Viewer' };
  document.getElementById('profile-role').textContent = roles[currentProfile.role] || currentProfile.role;
  if (currentProfile.role === 'admin') {
    document.getElementById('menu-users').style.display = 'flex';
  }
}

// NAVIGASI

function goPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });

  var page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');

  var navMap = { dashboard: 0, transaksi: 1, profil: 2 };
  if (navMap[name] !== undefined) {
    document.querySelectorAll('.nav-item')[navMap[name]].classList.add('active');
  }

  document.getElementById('fab').style.display = (name === 'profil' || name === 'kategori') ? 'none' : 'flex';

  if (name === 'transaksi') renderTrxList();
  if (name === 'kategori') renderKategoriPage();
}

// LOAD DATA

async function loadAll() {
  await Promise.all([loadKategori(), loadKas(), loadTrx()]);
  renderDashboard();
  renderTrxList();
  populateKasSelect();
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
    .select('*, kategori(nama, warna, jenis), posisi_kas(nama, tipe)')
    .neq('status', 'batal')
    .order('tanggal', { ascending: false })
    .limit(200);
  allTrx = r.data || [];
}

// DASHBOARD

function renderDashboard() {
  var totalSaldo = 0;
  for (var i = 0; i < allTrx.length; i++) {
    totalSaldo += allTrx[i].jenis === 'masuk' ? allTrx[i].nominal : -allTrx[i].nominal;
  }
  document.getElementById('saldo-total').textContent = formatRp(totalSaldo);
  document.getElementById('saldo-total').style.color = totalSaldo >= 0 ? 'white' : 'var(--red)';

  var now = new Date();
  var bulanIni = allTrx.filter(function(t) {
    var d = new Date(t.tanggal);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  var masukBulan = 0, keluarBulan = 0;
  bulanIni.forEach(function(t) {
    if (t.jenis === 'masuk') masukBulan += t.nominal;
    else keluarBulan += t.nominal;
  });
  var net = masukBulan - keluarBulan;

  document.getElementById('masuk-bulan').textContent = formatRp(masukBulan);
  document.getElementById('keluar-bulan').textContent = formatRp(keluarBulan);
  document.getElementById('net-bulan').textContent = formatRp(net);
  document.getElementById('net-bulan').style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('trx-count').textContent = bulanIni.length + ' transaksi';

  renderChart();
  renderKasBreakdown();

  var recent = allTrx.slice(0, 5);
  document.getElementById('trx-recent').innerHTML = recent.length
    ? recent.map(trxHTML).join('')
    : '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada transaksi</div></div>';
}

function renderChart() {
  var now = new Date();
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('id', { month: 'short' }) });
  }

  var chartData = months.map(function(m) {
    var masuk = 0, keluar = 0;
    allTrx.forEach(function(t) {
      var d = new Date(t.tanggal);
      if (d.getMonth() === m.month && d.getFullYear() === m.year) {
        if (t.jenis === 'masuk') masuk += t.nominal;
        else keluar += t.nominal;
      }
    });
    return { label: m.label, masuk: masuk, keluar: keluar };
  });

  var maxVal = 1;
  chartData.forEach(function(d) {
    if (d.masuk > maxVal) maxVal = d.masuk;
    if (d.keluar > maxVal) maxVal = d.keluar;
  });

  document.getElementById('chart-bars').innerHTML = chartData.map(function(d) {
    var hMasuk = Math.max(4, (d.masuk / maxVal) * 76);
    var hKeluar = Math.max(4, (d.keluar / maxVal) * 76);
    return '<div class="chart-bar-wrap">'
      + '<div style="display:flex;gap:2px;align-items:flex-end;height:80px;width:100%">'
      + '<div class="chart-bar green" style="flex:1;height:' + hMasuk + 'px"></div>'
      + '<div class="chart-bar red" style="flex:1;height:' + hKeluar + 'px"></div>'
      + '</div>'
      + '<div class="chart-bar-label">' + d.label + '</div>'
      + '</div>';
  }).join('');
}

function renderKasBreakdown() {
  if (!allKas.length) {
    document.getElementById('kas-breakdown').innerHTML = '<div style="color:var(--text3);font-size:13px">Tidak ada data kas</div>';
    return;
  }
  var icons = { tunai: '💵', bank: '🏦', ewallet: '📱' };
  document.getElementById('kas-breakdown').innerHTML = allKas.map(function(k) {
    var saldo = 0;
    allTrx.forEach(function(t) {
      if (t.posisi_kas_id === k.id) {
        saldo += t.jenis === 'masuk' ? t.nominal : -t.nominal;
      }
    });
    return '<div class="kas-item">'
      + '<div class="kas-icon">' + (icons[k.tipe] || '💰') + '</div>'
      + '<div class="kas-info"><div class="kas-name">' + k.nama + '</div><div class="kas-tipe">' + k.tipe.toUpperCase() + '</div></div>'
      + '<div class="kas-saldo" style="color:' + (saldo >= 0 ? 'var(--text)' : 'var(--red)') + '">' + formatRp(saldo) + '</div>'
      + '</div>';
  }).join('');
}

// TRANSAKSI LIST

function trxHTML(t) {
  var katNama = t.kategori ? t.kategori.nama : '-';
  var tgl = new Date(t.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
  var sign = t.jenis === 'masuk' ? '+' : '-';
  return '<div class="trx-item" onclick="openDetail(\'' + t.id + '\')">'
    + '<div class="trx-dot ' + t.jenis + '"></div>'
    + '<div class="trx-info">'
    + '<div class="trx-ket">' + (t.keterangan || katNama) + '</div>'
    + '<div class="trx-meta">' + tgl + ' · ' + katNama + '</div>'
    + '</div>'
    + '<div class="trx-nominal ' + t.jenis + '">' + sign + formatRp(t.nominal) + '</div>'
    + '</div>';
}

function renderTrxList(search) {
  search = search || '';
  var filtered = allTrx.filter(function(t) {
    if (activeFilter !== 'all' && t.jenis !== activeFilter) return false;
    if (search) {
      var ket = (t.keterangan || '').toLowerCase();
      var kat = t.kategori ? t.kategori.nama.toLowerCase() : '';
      if (ket.indexOf(search.toLowerCase()) < 0 && kat.indexOf(search.toLowerCase()) < 0) return false;
    }
    return true;
  });

  document.getElementById('trx-all').innerHTML = filtered.length
    ? filtered.map(trxHTML).join('')
    : '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Tidak ada transaksi</div><div class="empty-sub">Coba ubah filter atau kata kunci</div></div>';
}

function setFilter(el, val) {
  document.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  activeFilter = val;
  renderTrxList(document.getElementById('trx-search').value);
}

// DETAIL

function openDetail(id) {
  var t = null;
  for (var i = 0; i < allTrx.length; i++) {
    if (allTrx[i].id === id) { t = allTrx[i]; break; }
  }
  if (!t) return;
  detailTrxId = id;

  var tgl = new Date(t.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'long', year: 'numeric' });
  var statusColor = { lunas: 'green', pending: 'yellow', batal: 'red' };
  var nominalColor = t.jenis === 'masuk' ? 'var(--green)' : 'var(--red)';

  document.getElementById('detail-title').textContent = t.jenis === 'masuk' ? 'Uang Masuk' : 'Uang Keluar';
  document.getElementById('detail-content').innerHTML =
    '<div class="detail-row"><div class="detail-key">Nominal</div>'
    + '<div class="detail-val" style="font-family:var(--mono);font-size:20px;color:' + nominalColor + '">'
    + (t.jenis === 'masuk' ? '+' : '-') + formatRp(t.nominal) + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Tanggal</div><div class="detail-val">' + tgl + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Kategori</div><div class="detail-val">' + (t.kategori ? t.kategori.nama : '-') + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Posisi Kas</div><div class="detail-val">' + (t.posisi_kas ? t.posisi_kas.nama : '-') + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Status</div><div class="detail-val"><span class="badge ' + (statusColor[t.status] || 'green') + '">' + t.status + '</span></div></div>'
    + '<div class="detail-row"><div class="detail-key">Keterangan</div><div class="detail-val">' + (t.keterangan || '-') + '</div></div>';

  var delBtn = document.getElementById('btn-delete-trx');
  delBtn.style.display = currentProfile && currentProfile.role === 'admin' ? 'block' : 'none';
  delBtn.onclick = function() { deleteTrx(id); };

  openSheet('detail');
}

async function deleteTrx(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  var r = await db.from('transaksi').update({ status: 'batal' }).eq('id', id);
  if (!r.error) {
    closeSheet('detail');
    await loadTrx();
    renderDashboard();
    renderTrxList();
    showToast('Transaksi dihapus', 'green');
  } else {
    showToast('Gagal menghapus', 'red');
  }
}

// INPUT TRANSAKSI

function openSheet(type) {
  type = type || 'trx';
  if (type === 'trx') {
    var allowed = ['admin', 'bendahara', 'input_only'];
    if (!currentProfile || allowed.indexOf(currentProfile.role) < 0) {
      showToast('Tidak punya akses input', 'red');
      return;
    }
    renderKatGrid();
  }
  var overlay = document.getElementById('overlay-' + type);
  var sheet = document.getElementById('sheet-' + type);
  overlay.classList.add('show');
  setTimeout(function() { sheet.classList.add('show'); }, 10);
}

function closeSheet(type) {
  type = type || 'trx';
  var sheet = document.getElementById('sheet-' + type);
  var overlay = document.getElementById('overlay-' + type);
  sheet.classList.remove('show');
  setTimeout(function() { overlay.classList.remove('show'); }, 300);
}

function setJenis(jenis) {
  currentJenis = jenis;
  document.getElementById('jenis-masuk').className = 'jenis-btn' + (jenis === 'masuk' ? ' active masuk' : '');
  document.getElementById('jenis-keluar').className = 'jenis-btn' + (jenis === 'keluar' ? ' active keluar' : '');
  document.getElementById('btn-submit-trx').className = 'btn-submit ' + (jenis === 'masuk' ? 'green' : 'red');
  selectedKatId = null;
  renderKatGrid();
}

function renderKatGrid() {
  var filtered = allKategori.filter(function(k) { return k.jenis === currentJenis; });
  document.getElementById('kat-grid').innerHTML = filtered.map(function(k) {
    return '<div class="kat-chip ' + (selectedKatId === k.id ? 'selected' : '') + '" onclick="selectKat(\'' + k.id + '\')">' + k.nama + '</div>';
  }).join('');
}

function selectKat(id) {
  selectedKatId = id;
  renderKatGrid();
}

function populateKasSelect() {
  document.getElementById('trx-kas').innerHTML = '<option value="">Pilih posisi kas...</option>'
    + allKas.map(function(k) { return '<option value="' + k.id + '">' + k.nama + '</option>'; }).join('');
}

async function submitTrx() {
  var nominal = parseFloat(document.getElementById('trx-nominal').value);
  var tanggal = document.getElementById('trx-tanggal').value;
  var kasId = document.getElementById('trx-kas').value;
  var ket = document.getElementById('trx-ket').value.trim();
  var status = document.getElementById('trx-status').value;

  if (!nominal || nominal <= 0) { showToast('Nominal harus diisi', 'red'); return; }
  if (!tanggal) { showToast('Tanggal harus diisi', 'red'); return; }
  if (!kasId) { showToast('Pilih posisi kas', 'red'); return; }
  if (!selectedKatId) { showToast('Pilih kategori', 'red'); return; }

  var btn = document.getElementById('btn-submit-trx');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  var r = await db.from('transaksi').insert({
    jenis: currentJenis,
    nominal: nominal,
    tanggal: tanggal,
    posisi_kas_id: kasId,
    kategori_id: selectedKatId,
    keterangan: ket,
    status: status,
    input_oleh: currentUser.id
  });

  btn.disabled = false;
  btn.textContent = 'Simpan Transaksi';

  if (!r.error) {
    closeSheet('trx');
    document.getElementById('trx-nominal').value = '';
    document.getElementById('trx-ket').value = '';
    selectedKatId = null;
    await loadTrx();
    renderDashboard();
    renderTrxList();
    showToast('Transaksi tersimpan', 'green');
  } else {
    showToast('Gagal: ' + r.error.message, 'red');
  }
}

// KATEGORI PAGE

function renderKategoriPage() {
  var masuk = allKategori.filter(function(k) { return k.jenis === 'masuk'; });
  var keluar = allKategori.filter(function(k) { return k.jenis === 'keluar'; });

  document.getElementById('kat-masuk-list').innerHTML = masuk.map(function(k) {
    return '<div class="kat-manage-item">'
      + '<div class="kat-color-dot" style="background:' + k.warna + '"></div>'
      + '<div class="kat-manage-name">' + k.nama + '</div>'
      + '<div class="kat-manage-jenis" style="background:var(--green-dim);color:var(--green)">Masuk</div>'
      + '</div>';
  }).join('') || '<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada kategori</div>';

  document.getElementById('kat-keluar-list').innerHTML = keluar.map(function(k) {
    return '<div class="kat-manage-item">'
      + '<div class="kat-color-dot" style="background:' + k.warna + '"></div>'
      + '<div class="kat-manage-name">' + k.nama + '</div>'
      + '<div class="kat-manage-jenis" style="background:var(--red-dim);color:var(--red)">Keluar</div>'
      + '</div>';
  }).join('') || '<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada kategori</div>';

  var canManage = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'bendahara');
  document.getElementById('btn-add-kat').style.display = canManage ? 'block' : 'none';
  document.getElementById('btn-add-kat').onclick = function() { alert('Fitur tambah kategori segera hadir'); };
}

// UTILS

function formatRp(num) {
  if (num === undefined || num === null) return 'Rp 0';
  return 'Rp ' + Math.abs(Math.round(num)).toLocaleString('id-ID');
}

function showToast(msg, type) {
  type = type || '';
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(function() { t.className = 'toast'; }, 2800);
}
