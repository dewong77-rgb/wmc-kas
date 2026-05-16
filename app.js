// WMC KAS - app.js v1.1
// Isi dua baris di bawah dengan credentials Supabase kamu

var SUPABASE_URL = 'https://urseszjkqxivvaarjqro.supabase.co';
var SUPABASE_KEY = 'sb_publishable_il7NmuQEiyuVHzzF3XU37A_bLM_We4Q';

var db = null;
var currentUser = null;
var currentProfile = null;
var allTrx = [];
var allKategori = [];
var allKas = [];
var activeFilter = 'all';
var selectedKatId = null;
var currentJenis = 'masuk';
var currentKatJenis = 'masuk';
var currentKasTipe = 'tunai';
var selectedColor = '#22d172';
var detailTrxId = null;

var COLORS = ['#22d172','#3b9eff','#ff5f5f','#fbbf24','#a78bfa','#f472b6','#34d399','#60a5fa','#fb923c','#e879f9','#4ade80','#38bdf8'];

function initDB() {
  if (SUPABASE_URL === 'ISI_SUPABASE_URL_DISINI') {
    document.getElementById('config-warning').textContent = 'Supabase belum dikonfigurasi.';
    document.getElementById('config-warning').style.display = 'block';
    return false;
  }
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

document.addEventListener('DOMContentLoaded', async function() {
  var ok = initDB();
  if (!ok) return;

  var s = await db.auth.getSession();
  if (s.data.session) {
    await loadProfile(s.data.session.user);
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

  var overlays = ['trx','detail','user','kat','kas'];
  overlays.forEach(function(t) {
    var el = document.getElementById('overlay-' + t);
    if (el) el.addEventListener('click', function(e) {
      if (e.target === e.currentTarget) closeSheet(t);
    });
  });

  document.getElementById('trx-tanggal').value = new Date().toISOString().split('T')[0];
  buildColorGrid();
});

// AUTH

async function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-pass').value;
  var btn = document.getElementById('btn-login');
  if (!email || !pass) { showAuthError('Email dan password wajib diisi'); return; }
  btn.innerHTML = '<div class="spinner"></div>';
  btn.disabled = true;
  document.getElementById('auth-error').style.display = 'none';
  var r = await db.auth.signInWithPassword({ email: email, password: pass });
  if (r.error) {
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
  var r = await db.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = r.data;
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
  if (currentProfile) document.getElementById('header-user').textContent = currentProfile.nama;
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
  var adminItems = document.querySelectorAll('.admin-only');
  adminItems.forEach(function(el) {
    el.style.display = currentProfile.role === 'admin' ? 'flex' : 'none';
  });
}

// NAVIGASI

function goPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  var navMap = { dashboard: 0, transaksi: 1, profil: 2 };
  if (navMap[name] !== undefined) document.querySelectorAll('.nav-item')[navMap[name]].classList.add('active');
  var noFab = ['profil','kategori','pengguna','poskas'];
  document.getElementById('fab').style.display = noFab.indexOf(name) >= 0 ? 'none' : 'flex';
  var titles = { dashboard: 'WMC Kas', transaksi: 'Transaksi', profil: 'Profil', pengguna: 'Pengguna', kategori: 'Kategori', poskas: 'Posisi Kas' };
  document.getElementById('header-title').textContent = titles[name] || 'WMC Kas';
  if (name === 'transaksi') renderTrxList();
  if (name === 'kategori') renderKategoriPage();
  if (name === 'pengguna') loadUsers();
  if (name === 'poskas') loadPosKasPage();
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
  allTrx.forEach(function(t) { totalSaldo += t.jenis === 'masuk' ? t.nominal : -t.nominal; });
  document.getElementById('saldo-total').textContent = formatRp(totalSaldo);
  document.getElementById('saldo-total').style.color = totalSaldo >= 0 ? 'white' : 'var(--red)';

  var now = new Date();
  var masukBulan = 0, keluarBulan = 0, countBulan = 0;
  allTrx.forEach(function(t) {
    var d = new Date(t.tanggal);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      countBulan++;
      if (t.jenis === 'masuk') masukBulan += t.nominal;
      else keluarBulan += t.nominal;
    }
  });
  var net = masukBulan - keluarBulan;
  document.getElementById('masuk-bulan').textContent = formatRp(masukBulan);
  document.getElementById('keluar-bulan').textContent = formatRp(keluarBulan);
  document.getElementById('net-bulan').textContent = formatRp(net);
  document.getElementById('net-bulan').style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('trx-count').textContent = countBulan + ' transaksi';

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
  var maxVal = 1;
  var chartData = months.map(function(m) {
    var masuk = 0, keluar = 0;
    allTrx.forEach(function(t) {
      var d = new Date(t.tanggal);
      if (d.getMonth() === m.month && d.getFullYear() === m.year) {
        if (t.jenis === 'masuk') masuk += t.nominal; else keluar += t.nominal;
      }
    });
    if (masuk > maxVal) maxVal = masuk;
    if (keluar > maxVal) maxVal = keluar;
    return { label: m.label, masuk: masuk, keluar: keluar };
  });
  document.getElementById('chart-bars').innerHTML = chartData.map(function(d) {
    return '<div class="chart-bar-wrap">'
      + '<div style="display:flex;gap:2px;align-items:flex-end;height:80px;width:100%">'
      + '<div class="chart-bar green" style="flex:1;height:' + Math.max(4,(d.masuk/maxVal)*76) + 'px"></div>'
      + '<div class="chart-bar red" style="flex:1;height:' + Math.max(4,(d.keluar/maxVal)*76) + 'px"></div>'
      + '</div><div class="chart-bar-label">' + d.label + '</div></div>';
  }).join('');
}

function renderKasBreakdown() {
  if (!allKas.length) { document.getElementById('kas-breakdown').innerHTML = '<div style="color:var(--text3);font-size:13px">Tidak ada data kas</div>'; return; }
  var icons = { tunai: '💵', bank: '🏦', ewallet: '📱' };
  document.getElementById('kas-breakdown').innerHTML = allKas.map(function(k) {
    var saldo = 0;
    allTrx.forEach(function(t) { if (t.posisi_kas_id === k.id) saldo += t.jenis === 'masuk' ? t.nominal : -t.nominal; });
    return '<div class="kas-item">'
      + '<div class="kas-icon">' + (icons[k.tipe] || '💰') + '</div>'
      + '<div class="kas-info"><div class="kas-name">' + k.nama + '</div><div class="kas-tipe">' + k.tipe.toUpperCase() + '</div></div>'
      + '<div class="kas-saldo" style="color:' + (saldo >= 0 ? 'var(--text)' : 'var(--red)') + '">' + formatRp(saldo) + '</div>'
      + '</div>';
  }).join('');
}

// TRANSAKSI

function trxHTML(t) {
  var katNama = t.kategori ? t.kategori.nama : '-';
  var tgl = new Date(t.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
  return '<div class="trx-item" onclick="openDetail(\'' + t.id + '\')">'
    + '<div class="trx-dot ' + t.jenis + '"></div>'
    + '<div class="trx-info"><div class="trx-ket">' + (t.keterangan || katNama) + '</div>'
    + '<div class="trx-meta">' + tgl + ' · ' + katNama + '</div></div>'
    + '<div class="trx-nominal ' + t.jenis + '">' + (t.jenis === 'masuk' ? '+' : '-') + formatRp(t.nominal) + '</div>'
    + '</div>';
}

function renderTrxList(search) {
  search = search || '';
  var filtered = allTrx.filter(function(t) {
    if (activeFilter !== 'all' && t.jenis !== activeFilter) return false;
    if (search) {
      var a = (t.keterangan || '').toLowerCase();
      var b = t.kategori ? t.kategori.nama.toLowerCase() : '';
      if (a.indexOf(search.toLowerCase()) < 0 && b.indexOf(search.toLowerCase()) < 0) return false;
    }
    return true;
  });
  document.getElementById('trx-all').innerHTML = filtered.length
    ? filtered.map(trxHTML).join('')
    : '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Tidak ada transaksi</div></div>';
}

function setFilter(el, val) {
  document.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  activeFilter = val;
  renderTrxList(document.getElementById('trx-search').value);
}

function openDetail(id) {
  var t = null;
  for (var i = 0; i < allTrx.length; i++) { if (allTrx[i].id === id) { t = allTrx[i]; break; } }
  if (!t) return;
  detailTrxId = id;
  var tgl = new Date(t.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'long', year: 'numeric' });
  var sc = { lunas: 'green', pending: 'yellow', batal: 'red' };
  document.getElementById('detail-title').textContent = t.jenis === 'masuk' ? 'Uang Masuk' : 'Uang Keluar';
  document.getElementById('detail-content').innerHTML =
    '<div class="detail-row"><div class="detail-key">Nominal</div><div class="detail-val" style="font-family:var(--mono);font-size:20px;color:' + (t.jenis === 'masuk' ? 'var(--green)' : 'var(--red)') + '">' + (t.jenis === 'masuk' ? '+' : '-') + formatRp(t.nominal) + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Tanggal</div><div class="detail-val">' + tgl + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Kategori</div><div class="detail-val">' + (t.kategori ? t.kategori.nama : '-') + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Posisi Kas</div><div class="detail-val">' + (t.posisi_kas ? t.posisi_kas.nama : '-') + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Status</div><div class="detail-val"><span class="badge ' + (sc[t.status] || 'green') + '">' + t.status + '</span></div></div>'
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
    if (!currentProfile || allowed.indexOf(currentProfile.role) < 0) { showToast('Tidak punya akses input', 'red'); return; }
    renderKatGrid();
  }
  var overlay = document.getElementById('overlay-' + type);
  var sheet = document.getElementById('sheet-' + type);
  if (!overlay || !sheet) return;
  overlay.classList.add('show');
  setTimeout(function() { sheet.classList.add('show'); }, 10);
}

function closeSheet(type) {
  type = type || 'trx';
  var sheet = document.getElementById('sheet-' + type);
  var overlay = document.getElementById('overlay-' + type);
  if (!sheet || !overlay) return;
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
  var r = await db.from('transaksi').insert({ jenis: currentJenis, nominal: nominal, tanggal: tanggal, posisi_kas_id: kasId, kategori_id: selectedKatId, keterangan: ket, status: status, input_oleh: currentUser.id });
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

// MANAJEMEN PENGGUNA

async function loadUsers() {
  var r = await db.from('profiles').select('*').order('created_at');
  var users = r.data || [];
  var roles = { admin: 'Admin', bendahara: 'Bendahara', input_only: 'Input Only', viewer: 'Viewer' };
  var roleColor = { admin: 'var(--accent)', bendahara: 'var(--green)', input_only: 'var(--yellow)', viewer: 'var(--text3)' };
  document.getElementById('user-list').innerHTML = users.length ? users.map(function(u) {
    return '<div class="admin-item">'
      + '<div class="admin-item-icon">' + u.nama.charAt(0).toUpperCase() + '</div>'
      + '<div class="admin-item-info"><div class="admin-item-name">' + u.nama + '</div>'
      + '<div class="admin-item-email">' + u.email + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:' + (roleColor[u.role] || 'var(--text2)') + ';margin-top:3px">' + (roles[u.role] || u.role) + '</div></div>'
      + '<div class="admin-item-actions">'
      + '<button class="btn-sm btn-sm-edit" onclick="editUser(\'' + u.id + '\',\'' + u.nama + '\',\'' + u.email + '\',\'' + u.role + '\')">Edit</button>'
      + (u.id !== currentUser.id ? '<button class="btn-sm btn-sm-del" onclick="deleteUser(\'' + u.id + '\')">Hapus</button>' : '')
      + '</div></div>';
  }).join('') : '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Belum ada pengguna</div></div>';
}

function openSheetUser() {
  document.getElementById('user-sheet-title').textContent = 'Tambah Pengguna';
  document.getElementById('edit-user-id').value = '';
  document.getElementById('user-nama').value = '';
  document.getElementById('user-email').value = '';
  document.getElementById('user-pass').value = '';
  document.getElementById('user-role').value = 'viewer';
  document.getElementById('user-email').disabled = false;
  document.getElementById('user-pass').placeholder = 'Min. 6 karakter';
  openSheet('user');
}

function editUser(id, nama, email, role) {
  document.getElementById('user-sheet-title').textContent = 'Edit Pengguna';
  document.getElementById('edit-user-id').value = id;
  document.getElementById('user-nama').value = nama;
  document.getElementById('user-email').value = email;
  document.getElementById('user-email').disabled = true;
  document.getElementById('user-pass').value = '';
  document.getElementById('user-pass').placeholder = 'Kosongkan jika tidak ganti password';
  document.getElementById('user-role').value = role;
  openSheet('user');
}

async function submitUser() {
  var editId = document.getElementById('edit-user-id').value;
  var nama = document.getElementById('user-nama').value.trim();
  var email = document.getElementById('user-email').value.trim();
  var pass = document.getElementById('user-pass').value;
  var role = document.getElementById('user-role').value;

  if (!nama) { showToast('Nama wajib diisi', 'red'); return; }

  var btn = document.getElementById('btn-submit-user');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  if (editId) {
    // Edit existing — update profile
    var r = await db.from('profiles').update({ nama: nama, role: role }).eq('id', editId);
    if (r.error) { showToast('Gagal: ' + r.error.message, 'red'); btn.disabled = false; btn.textContent = 'Simpan Pengguna'; return; }
    // Update password if filled — needs admin API, use RPC workaround
    if (pass && pass.length >= 6) {
      showToast('Password hanya bisa diubah oleh pengguna sendiri lewat reset email', 'yellow');
    }
  } else {
    // Create new user
    if (!email) { showToast('Email wajib diisi', 'red'); btn.disabled = false; btn.textContent = 'Simpan Pengguna'; return; }
    if (!pass || pass.length < 6) { showToast('Password min. 6 karakter', 'red'); btn.disabled = false; btn.textContent = 'Simpan Pengguna'; return; }

    // Create via admin API workaround — use signUp then update role
    var r2 = await db.auth.admin ? null : await db.rpc('create_user_profile', { p_email: email, p_nama: nama, p_role: role });
    if (!r2 || r2.error) {
      // Fallback: insert profile only (user must register themselves)
      showToast('Gunakan Supabase Dashboard untuk buat akun baru, lalu set role di sini', 'yellow');
      btn.disabled = false;
      btn.textContent = 'Simpan Pengguna';
      return;
    }
  }

  btn.disabled = false;
  btn.textContent = 'Simpan Pengguna';
  closeSheet('user');
  loadUsers();
  showToast('Pengguna disimpan', 'green');
}

async function deleteUser(id) {
  if (!confirm('Hapus pengguna ini?')) return;
  var r = await db.from('profiles').delete().eq('id', id);
  if (!r.error) { loadUsers(); showToast('Pengguna dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

// MANAJEMEN KATEGORI

function renderKategoriPage() {
  var masuk = allKategori.filter(function(k) { return k.jenis === 'masuk'; });
  var keluar = allKategori.filter(function(k) { return k.jenis === 'keluar'; });

  function katItem(k) {
    return '<div class="kat-manage-item">'
      + '<div class="kat-color-dot" style="background:' + k.warna + '"></div>'
      + '<div class="kat-manage-name">' + k.nama + '</div>'
      + (currentProfile && currentProfile.role === 'admin' ? '<button class="btn-sm btn-sm-edit" onclick="editKat(\'' + k.id + '\',\'' + k.nama + '\',\'' + k.jenis + '\',\'' + k.warna + '\')">Edit</button>' : '')
      + (currentProfile && currentProfile.role === 'admin' ? '<button class="btn-sm btn-sm-del" onclick="deleteKat(\'' + k.id + '\')">Hapus</button>' : '')
      + '</div>';
  }

  document.getElementById('kat-masuk-list').innerHTML = masuk.map(katItem).join('')
    || '<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada kategori masuk</div>';
  document.getElementById('kat-keluar-list').innerHTML = keluar.map(katItem).join('')
    || '<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada kategori keluar</div>';
}

function openSheetKat(jenis) {
  document.getElementById('kat-sheet-title').textContent = 'Tambah Kategori';
  document.getElementById('edit-kat-id').value = '';
  document.getElementById('kat-nama').value = '';
  currentKatJenis = jenis || 'masuk';
  selectedColor = '#22d172';
  setKatJenis(currentKatJenis);
  buildColorGrid();
  openSheet('kat');
}

function editKat(id, nama, jenis, warna) {
  document.getElementById('kat-sheet-title').textContent = 'Edit Kategori';
  document.getElementById('edit-kat-id').value = id;
  document.getElementById('kat-nama').value = nama;
  currentKatJenis = jenis;
  selectedColor = warna;
  setKatJenis(jenis);
  buildColorGrid();
  openSheet('kat');
}

function setKatJenis(jenis) {
  currentKatJenis = jenis;
  document.getElementById('kat-jenis-masuk').className = 'jenis-btn' + (jenis === 'masuk' ? ' active masuk' : '');
  document.getElementById('kat-jenis-keluar').className = 'jenis-btn' + (jenis === 'keluar' ? ' active keluar' : '');
}

function buildColorGrid() {
  var el = document.getElementById('color-grid');
  if (!el) return;
  el.innerHTML = COLORS.map(function(c) {
    return '<div class="color-dot ' + (selectedColor === c ? 'selected' : '') + '" style="background:' + c + '" onclick="selectColor(\'' + c + '\')"></div>';
  }).join('');
}

function selectColor(c) {
  selectedColor = c;
  buildColorGrid();
}

async function submitKat() {
  var editId = document.getElementById('edit-kat-id').value;
  var nama = document.getElementById('kat-nama').value.trim();
  if (!nama) { showToast('Nama kategori wajib diisi', 'red'); return; }

  var btn = document.getElementById('btn-submit-kat');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  var payload = { nama: nama, jenis: currentKatJenis, warna: selectedColor };
  var r = editId
    ? await db.from('kategori').update(payload).eq('id', editId)
    : await db.from('kategori').insert(Object.assign(payload, { aktif: true, urutan: 99 }));

  btn.disabled = false;
  btn.textContent = 'Simpan Kategori';

  if (!r.error) {
    closeSheet('kat');
    await loadKategori();
    renderKategoriPage();
    renderKatGrid();
    showToast('Kategori disimpan', 'green');
  } else {
    showToast('Gagal: ' + r.error.message, 'red');
  }
}

async function deleteKat(id) {
  if (!confirm('Hapus kategori ini?')) return;
  var r = await db.from('kategori').update({ aktif: false }).eq('id', id);
  if (!r.error) { await loadKategori(); renderKategoriPage(); showToast('Kategori dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

// MANAJEMEN POSISI KAS

async function loadPosKasPage() {
  await loadKas();
  var icons = { tunai: '💵', bank: '🏦', ewallet: '📱' };
  document.getElementById('poskas-list').innerHTML = allKas.length ? allKas.map(function(k) {
    return '<div class="admin-item">'
      + '<div class="admin-item-icon">' + (icons[k.tipe] || '💰') + '</div>'
      + '<div class="admin-item-info"><div class="admin-item-name">' + k.nama + '</div>'
      + '<div class="admin-item-email">' + k.tipe.toUpperCase() + (k.nomor_rekening ? ' · ' + k.nomor_rekening : '') + '</div></div>'
      + '<div class="admin-item-actions">'
      + '<button class="btn-sm btn-sm-edit" onclick="editKas(\'' + k.id + '\',\'' + k.nama + '\',\'' + k.tipe + '\',\'' + (k.nomor_rekening || '') + '\')">Edit</button>'
      + '<button class="btn-sm btn-sm-del" onclick="deletePosKas(\'' + k.id + '\')">Hapus</button>'
      + '</div></div>';
  }).join('') : '<div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-text">Belum ada posisi kas</div></div>';
}

function openSheetKas() {
  document.getElementById('kas-sheet-title').textContent = 'Tambah Posisi Kas';
  document.getElementById('edit-kas-id').value = '';
  document.getElementById('kas-nama').value = '';
  document.getElementById('kas-norek').value = '';
  currentKasTipe = 'tunai';
  setKasTipe('tunai');
  openSheet('kas');
}

function editKas(id, nama, tipe, norek) {
  document.getElementById('kas-sheet-title').textContent = 'Edit Posisi Kas';
  document.getElementById('edit-kas-id').value = id;
  document.getElementById('kas-nama').value = nama;
  document.getElementById('kas-norek').value = norek;
  currentKasTipe = tipe;
  setKasTipe(tipe);
  openSheet('kas');
}

function setKasTipe(tipe) {
  currentKasTipe = tipe;
  ['tunai','bank','ewallet'].forEach(function(t) {
    document.getElementById('kas-tipe-' + t).className = 'tipe-btn' + (tipe === t ? ' active' : '');
  });
}

async function submitKas() {
  var editId = document.getElementById('edit-kas-id').value;
  var nama = document.getElementById('kas-nama').value.trim();
  var norek = document.getElementById('kas-norek').value.trim();
  if (!nama) { showToast('Nama wajib diisi', 'red'); return; }

  var btn = document.getElementById('btn-submit-kas');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  var payload = { nama: nama, tipe: currentKasTipe, nomor_rekening: norek || null };
  var r = editId
    ? await db.from('posisi_kas').update(payload).eq('id', editId)
    : await db.from('posisi_kas').insert(Object.assign(payload, { aktif: true, urutan: 99 }));

  btn.disabled = false;
  btn.textContent = 'Simpan Posisi Kas';

  if (!r.error) {
    closeSheet('kas');
    await loadKas();
    loadPosKasPage();
    populateKasSelect();
    renderKasBreakdown();
    showToast('Posisi kas disimpan', 'green');
  } else {
    showToast('Gagal: ' + r.error.message, 'red');
  }
}

async function deletePosKas(id) {
  if (!confirm('Hapus posisi kas ini?')) return;
  var r = await db.from('posisi_kas').update({ aktif: false }).eq('id', id);
  if (!r.error) { await loadKas(); loadPosKasPage(); showToast('Posisi kas dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
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
  setTimeout(function() { t.className = 'toast'; }, 3000);
}
