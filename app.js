// WMC KAS - app.js v2.4 (Fixed Auth & Admin FAB Permissions)
var SUPABASE_URL = 'https://urseszjkqxivvaarjqro.supabase.co';
var SUPABASE_KEY = 'sb_publishable_il7NmuQEiyuVHzzF3XU37A_bLM_We4Q';

var db = null;
var currentUser = null;
var currentProfile = null;
var allTrx = [];
var allKategori = [];
var allKas = [];
var allAnggota = [];
var allKegiatan = [];
var allAnggaran = [];
var activeFilter = 'all';
var selectedKatId = null;
var currentJenis = 'masuk';
var currentKatJenis = 'masuk';
var currentKasTipe = 'tunai';
var currentKegiatanTipe = 'fullboard';
var selectedColor = '#22d172';
var editingTrxId = null;
var editingKegiatanId = null;
var currentPeriod = 'bulan';
var pendingBuktiFile = null;
var currentPage = 'dashboard';
var currentAnggotaTab = 'rekap';
var pesertaStatus = {};
var rekapPage = 0;
var anggotaPage = 0;
var kegiatanPage = 0;
var PAGE_SIZE = 5;
var MAX_BUKTI_SIZE = 200 * 1024;

var COLORS = ['#22d172','#3b9eff','#ff5f5f','#fbbf24','#a78bfa','#f472b6','#34d399','#60a5fa','#fb923c','#e879f9','#4ade80','#38bdf8'];
var BULAN_NAMA = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function initDB() {
  if (!SUPABASE_URL || SUPABASE_URL.indexOf('http') !== 0) {
    var configWarning = document.getElementById('config-warning');
    if (configWarning) {
      configWarning.textContent = 'Supabase belum dikonfigurasi dengan URL yang valid.';
      configWarning.style.display = 'block';
    }
    return false;
  }
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

document.addEventListener('DOMContentLoaded', async function() {
  var ok = initDB();
  if (!ok) return;
  
  // Ambil session secara asinkron dengan metode Supabase v2 yang benar
  var s = await db.auth.getSession();
  if (s.data && s.data.session) {
    currentUser = s.data.session.user;
    await loadProfile(currentUser);
    await showApp();
  } else {
    showAuth();
  }
  
  db.auth.onAuthStateChange(async function(event, session) {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      await loadProfile(currentUser);
      await showApp();
    }
    else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      showAuth();
    }
  });

  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  document.getElementById('trx-search').addEventListener('input', function(e) { renderTrxList(e.target.value); });
  setupNominalInput('trx-nominal-display', 'trx-nominal-raw');
  setupNominalInput('anggaran-nominal-display', 'anggaran-nominal-raw');
  
  ['trx','detail','anggaran','anggota','kegiatan','user','kat','kas'].forEach(function(t) {
    var el = document.getElementById('overlay-' + t);
    if (el) el.addEventListener('click', function(e) { if (e.target === e.currentTarget) closeSheet(t); });
  });
  
  document.getElementById('trx-tanggal').value = new Date().toISOString().split('T')[0];
  var now = new Date();
  ['ekspor-tahun','anggaran-tahun'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    for (var y = now.getFullYear(); y >= 2024; y--) {
      var opt = document.createElement('option'); opt.value = y; opt.textContent = y; sel.appendChild(opt);
    }
  });
  document.getElementById('ekspor-bulan').value = now.getMonth();
  document.getElementById('anggaran-bulan').value = now.getMonth() + 1;
  buildColorGrid();
});

function showAuth() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

async function showApp() {
  var authEl = document.getElementById('auth-screen');
  var appEl = document.getElementById('app');
  
  if (authEl) authEl.style.display = 'none';
  if (appEl) appEl.style.display = 'flex';
  
  var errEl = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';
  
  try {
    await loadAll();
  } catch (e) {
    console.error("Gagal memuat beberapa data Supabase:", e);
  }
  
  if (currentProfile) {
    var headerUserEl = document.getElementById('header-user');
    if (headerUserEl) {
      headerUserEl.textContent = currentProfile.nama || '';
    }
  }
  
  updateProfilePage();
  goPage('dashboard');
}
  

function goPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  
  var page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  currentPage = name;
  
  var navMap = { dashboard: 0, transaksi: 1, anggaran: 2, anggota: 3, profil: 4 };
  if (navMap[name] !== undefined) {
    document.querySelectorAll('.nav-item')[navMap[name]].classList.add('active');
  }
  
  var noFab = ['profil', 'kategori', 'pengguna', 'poskas', 'ekspor'];
  
  // Normalisasi pengecekan role (mengubah ke huruf kecil dan menghapus spasi tak sengaja)
  var cleanRole = currentProfile && currentProfile.role ? currentProfile.role.toString().toLowerCase().trim() : '';
  
  // Cek apakah akun memiliki hak akses untuk menambah data
  var canInput = ['admin', 'bendahara', 'input_only'].indexOf(cleanRole) >= 0;
  
  var fabEl = document.getElementById('fab');
  if (fabEl) {
    // Tombol "+" HANYA muncul jika bukan di halaman terlarang DAN user punya hak akses (canInput)
    if (noFab.indexOf(name) < 0 && canInput) {
      fabEl.style.setProperty('display', 'flex', 'important');
    } else {
      fabEl.style.setProperty('display', 'none', 'important');
    }
  }
  
  var titles = { 
    dashboard: 'WMC Kas', transaksi: 'Transaksi', anggaran: 'Anggaran', 
    anggota: 'Anggota & Kegiatan', profil: 'Profil', pengguna: 'Pengguna', 
    kategori: 'Kategori', poskas: 'Posisi Kas', ekspor: 'Ekspor Laporan' 
  };
  document.getElementById('header-title').textContent = titles[name] || 'WMC Kas';
  
  if (name === 'transaksi') renderTrxList();
  if (name === 'kategori') renderKategoriPage();
  if (name === 'pengguna') loadUsers();
  if (name === 'poskas') loadPosKasPage();
  if (name === 'anggaran') renderAnggaranPage();
  if (name === 'anggota') { 
    rekapPage = 0; 
    anggotaPage = 0; 
    kegiatanPage = 0; 
    renderRekapAnggota(); 
    renderDataAnggota(); 
  }
}

async function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-pass').value;
  var btn = document.getElementById('btn-login');
  if (!email || !pass) { showAuthError('Email dan password wajib diisi'); return; }
  btn.innerHTML = '<div class="spinner"></div>'; btn.disabled = true;
  
  // Perbaikan: Menggunakan 'login-error' agar sesuai dengan file index.html
  var errEl = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';
  
  var r = await db.auth.signInWithPassword({ email: email, password: pass });
  if (r.error) { 
    showAuthError('Email atau password salah'); 
    btn.innerHTML = '<span>Masuk</span>'; 
    btn.disabled = false; 
  }
}

function showAuthError(msg) { 
  // Perbaikan: Menggunakan 'login-error' agar sesuai dengan file index.html
  var el = document.getElementById('login-error'); 
  if (el) {
    el.textContent = msg; 
    el.style.display = 'block'; 
  }
}

async function doLogout() {
  if (!confirm('Keluar dari aplikasi?')) return;
  await db.auth.signOut();
}

async function loadProfile(user) {
  if (!user) return;
  var res = await db.from('profil_pengguna').select('*').eq('id', user.id).maybeSingle();
  if (!res.error && res.data) {
    currentProfile = res.data;
  } else {
    currentProfile = { nama: user.email, role: 'viewer' };
  }
}

async function loadAll() {
  showLoading(true);
  await Promise.all([loadTrx(), loadKategori(), loadKas()]);
  showLoading(false);
}

async function loadTrx() {
  var res = await db.from('transaksi').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false });
  if (!res.error) allTrx = res.data || [];
}

async function loadKategori() {
  var res = await db.from('kategori_transaksi').select('*').eq('aktif', true).order('nama');
  if (!res.error) allKategori = res.data || [];
}

async function loadKas() {
  var res = await db.from('posisi_kas').select('*').eq('aktif', true).order('urutan');
  if (!res.error) allKas = res.data || [];
}

function showLoading(show) {
  var loader = document.getElementById('loading-overlay');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}

function openSheet(type) {
  var overlay = document.getElementById('overlay-' + type);
  var sheet = document.getElementById('sheet-' + type);
  if (overlay && sheet) {
    overlay.classList.add('active');
    sheet.classList.add('active');
  }
}

function closeSheet(type) {
  var overlay = document.getElementById('overlay-' + type);
  var sheet = document.getElementById('sheet-' + type);
  if (overlay && sheet) {
    overlay.classList.remove('active');
    sheet.classList.remove('active');
  }
}

function showToast(msg, color) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.background = color === 'red' ? 'var(--red)' : (color === 'green' ? 'var(--green)' : 'var(--surface2)');
  toast.classList.add('active');
  setTimeout(function() { toast.classList.remove('active'); }, 3000);
}

function formatIDR(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function setupNominalInput(displayId, rawId) {
  var displayInput = document.getElementById(displayId);
  var rawInput = document.getElementById(rawId);
  if (!displayInput || !rawInput) return;
  
  displayInput.addEventListener('input', function(e) {
    var clean = e.target.value.replace(/\D/g, '');
    rawInput.value = clean;
    if (clean) {
      displayInput.value = Number(clean).toLocaleString('id-ID');
    } else {
      displayInput.value = '';
    }
  });
}

function changePeriod(p) {
  currentPeriod = p;
  document.querySelectorAll('.period-btn').forEach(function(b) { b.classList.remove('active'); });
  if (p === 'bulan') document.getElementById('p-bulan').classList.add('active');
  if (p === 'tahun') document.getElementById('p-tahun').classList.add('active');
  if (p === 'semua') document.getElementById('p-semua').classList.add('active');
  renderTrxList();
}

function setFilter(f) {
  activeFilter = f;
  document.querySelectorAll('.filter-pill').forEach(function(p) { p.classList.remove('active'); });
  var el = document.getElementById('f-' + f);
  if (el) el.classList.add('active');
  renderTrxList();
}

function renderTrxList(searchKeyword) {
  var container = document.getElementById('trx-container');
  if (!container) return;
  container.innerHTML = '';
  
  var now = new Date();
  var filtered = allTrx.filter(function(t) {
    var tDate = new Date(t.tanggal);
    if (currentPeriod === 'bulan' && (tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear())) return false;
    if (currentPeriod === 'tahun' && tDate.getFullYear() !== now.getFullYear()) return false;
    
    if (activeFilter === 'masuk' && t.jenis !== 'masuk') return false;
    if (activeFilter === 'keluar' && t.jenis !== 'keluar') return false;
    
    if (searchKeyword) {
      var kw = searchKeyword.toLowerCase();
      var mKet = (t.keterangan || '').toLowerCase().indexOf(kw) >= 0;
      var mKat = false;
      var kat = allKategori.find(function(k) { return k.id === t.kategori_id; });
      if (kat && kat.nama.toLowerCase().indexOf(kw) >= 0) mKat = true;
      if (!mKet && !mKat) return false;
    }
    return true;
  });
  
  var totalMasuk = 0;
  var totalKeluar = 0;
  
  filtered.forEach(function(t) {
    if (t.jenis === 'masuk') totalMasuk += t.nominal;
    else totalKeluar += t.nominal;
  });
  
  var cardMasuk = document.getElementById('summary-masuk');
  var cardKeluar = document.getElementById('summary-keluar');
  var cardSaldo = document.getElementById('summary-saldo');
  if (cardMasuk) cardMasuk.textContent = formatIDR(totalMasuk);
  if (cardKeluar) cardKeluar.textContent = formatIDR(totalKeluar);
  if (cardSaldo) cardSaldo.textContent = formatIDR(totalMasuk - totalKeluar);
  
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:40px 20px">Tidak ada transaksi ditemukan</div>';
    return;
  }
  
  filtered.forEach(function(t) {
    var kat = allKategori.find(function(k) { return k.id === t.kategori_id; });
    var kas = allKas.find(function(k) { return k.id === t.posisi_kas_id; });
    
    var katNama = kat ? kat.nama : 'Tanpa Kategori';
    var katColor = kat ? kat.warna : '#5a7390';
    var kasNama = kas ? kas.nama : 'Kas Utama';
    
    var div = document.createElement('div');
    div.className = 'trx-item';
    div.addEventListener('click', function() { showTrxDetail(t); });
    
    var sign = t.jenis === 'masuk' ? '+' : '-';
    var cName = t.jenis === 'masuk' ? 'trx-amount masuk' : 'trx-amount keluar';
    
    var dObj = new Date(t.tanggal);
    var dStr = dObj.getDate() + ' ' + BULAN_NAMA[dObj.getMonth()];
    
    div.innerHTML = 
      '<div class="trx-icon" style="background:'+katColor+'15;color:'+katColor+'">' +
        (t.jenis === 'masuk' ? '↓' : '↑') +
      '</div>' +
      '<div class="trx-info">' +
        '<div class="trx-title">' + (t.keterangan || katNama) + '</div>' +
        '<div class="trx-meta">' + dStr + ' • <span style="color:var(--text2)">' + katNama + '</span> • <span style="font-size:10px;background:var(--surface2);padding:2px 6px;border-radius:4px">' + kasNama + '</span></div>' +
      '</div>' +
      '<div class="' + cName + '">' + sign + ' ' + formatIDR(t.nominal).replace('Rp ','') + '</div>';
      
    container.appendChild(div);
  });
}

function showTrxDetail(t) {
  var kat = allKategori.find(function(k) { return k.id === t.kategori_id; });
  var kas = allKas.find(function(k) { return k.id === t.posisi_kas_id; });
  
  document.getElementById('det-keterangan').textContent = t.keterangan || '-';
  document.getElementById('det-jenis').textContent = t.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran';
  document.getElementById('det-jenis').className = 'badge ' + (t.jenis === 'masuk' ? 'masuk' : 'keluar');
  document.getElementById('det-nominal').textContent = formatIDR(t.nominal);
  document.getElementById('det-kategori').textContent = kat ? kat.nama : '-';
  document.getElementById('det-kas').textContent = kas ? kas.nama : '-';
  document.getElementById('det-tanggal').textContent = t.tanggal;
  document.getElementById('det-user').textContent = t.created_by_name || '-';
  
  var imgContainer = document.getElementById('det-bukti-container');
  if (t.bukti_url) {
    imgContainer.innerHTML = '<label class="form-label">Nota / Bukti</label><img src="'+t.bukti_url+'" class="bukti-preview-img" onclick="window.open(\''+t.bukti_url+'\')">';
  } else {
    imgContainer.innerHTML = '';
  }
  
  var btnEdit = document.getElementById('btn-det-edit');
  var btnDel = document.getElementById('btn-det-hapus');
  
  var cleanRole = currentProfile && currentProfile.role ? currentProfile.role.toString().toLowerCase().trim() : '';
  if (cleanRole === 'admin' || cleanRole === 'bendahara' || t.created_by === (currentUser ? currentUser.id : '')) {
    if (btnEdit) { btnEdit.style.display = 'block'; btnEdit.onclick = function() { closeSheet('detail'); openEditTrx(t); }; }
    if (btnDel) { btnDel.style.display = 'block'; btnDel.onclick = function() { deleteTrx(t.id); }; }
  } else {
    if (btnEdit) btnEdit.style.display = 'none';
    if (btnDel) btnDel.style.display = 'none';
  }
  
  openSheet('detail');
}

function openAddTrx() {
  editingTrxId = null;
  document.getElementById('trx-sheet-title').textContent = 'Tambah Transaksi';
  document.getElementById('trx-keterangan').value = '';
  document.getElementById('trx-nominal-display').value = '';
  document.getElementById('trx-nominal-raw').value = '';
  document.getElementById('trx-tanggal').value = new Date().toISOString().split('T')[0];
  pendingBuktiFile = null;
  document.getElementById('trx-file-label').textContent = 'Pilih Foto / File (Max 200KB)';
  
  setTrxJenis('masuk');
  populateKasSelect();
  openSheet('trx');
}

function setTrxJenis(j) {
  currentJenis = j;
  var bMasuk = document.getElementById('btn-j-masuk');
  var bKeluar = document.getElementById('btn-j-keluar');
  if (j === 'masuk') {
    if (bMasuk) bMasuk.classList.add('active');
    if (bKeluar) bKeluar.classList.remove('active');
  } else {
    if (bMasuk) bMasuk.classList.remove('active');
    if (bKeluar) bKeluar.classList.add('active');
  }
  populateKatSelect();
}

function populateKatSelect() {
  var sel = document.getElementById('trx-kategori');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Kategori --</option>';
  allKategori.filter(function(k) { return k.jenis === currentJenis; }).forEach(function(k) {
    var opt = document.createElement('option');
    opt.value = k.id;
    opt.textContent = k.nama;
    if (selectedKatId === k.id) opt.selected = true;
    sel.appendChild(opt);
  });
}

function populateKasSelect() {
  var sel = document.getElementById('trx-kas');
  if (!sel) return;
  sel.innerHTML = '';
  allKas.forEach(function(k) {
    var opt = document.createElement('option');
    opt.value = k.id;
    opt.textContent = k.nama;
    sel.appendChild(opt);
  });
}

function handleTrxFile(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > MAX_BUKTI_SIZE) {
    showToast('Ukuran file maksimal 200KB!', 'red');
    e.target.value = '';
    return;
  }
  pendingBuktiFile = file;
  document.getElementById('trx-file-label').textContent = file.name + ' (' + Math.round(file.size/1024) + 'KB)';
}

async function submitTrx() {
  var nominal = parseInt(document.getElementById('trx-nominal-raw').value);
  var katId = document.getElementById('trx-kategori').value;
  var kasId = document.getElementById('trx-kas').value;
  var tanggal = document.getElementById('trx-tanggal').value;
  var keterangan = document.getElementById('trx-keterangan').value.trim();
  
  if (!nominal || !katId || !kasId || !tanggal) {
    showToast('Mohon lengkapi data wajib', 'red');
    return;
  }
  
  var btn = document.getElementById('btn-submit-trx');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  
  var buktiUrl = null;
  if (pendingBuktiFile) {
    var fExt = pendingBuktiFile.name.split('.').pop();
    var fName = 'bukti_' + Date.now() + '.' + fExt;
    var up = await db.storage.from('bukti_transaksi').upload(fName, pendingBuktiFile);
    if (!up.error) {
      var urlRes = db.storage.from('bukti_transaksi').getPublicUrl(fName);
      buktiUrl = urlRes.data ? urlRes.data.publicUrl : urlRes.publicUrl;
    }
  }
  
  var payload = {
    jenis: currentJenis,
    nominal: nominal,
    kategori_id: katId,
    posisi_kas_id: kasId,
    tanggal: tanggal,
    keterangan: keterangan || null
  };
  
  if (buktiUrl) payload.bukti_url = buktiUrl;
  
  var res;
  if (editingTrxId) {
    res = await db.from('transaksi').update(payload).eq('id', editingTrxId);
  } else {
    payload.created_by = currentUser ? currentUser.id : null;
    payload.created_by_name = currentProfile ? currentProfile.nama : (currentUser ? currentUser.email : 'System');
    res = await db.from('transaksi').insert(payload);
  }
  
  btn.disabled = false;
  btn.textContent = 'Simpan Transaksi';
  
  if (!res.error) {
    closeSheet('trx');
    await loadTrx();
    renderTrxList();
    renderKasBreakdown();
    showToast('Transaksi berhasil disimpan', 'green');
  } else {
    showToast('Gagal menyimpan: ' + res.error.message, 'red');
  }
}

function openEditTrx(t) {
  editingTrxId = t.id;
  document.getElementById('trx-sheet-title').textContent = 'Ubah Transaksi';
  document.getElementById('trx-keterangan').value = t.keterangan || '';
  document.getElementById('trx-nominal-raw').value = t.nominal;
  document.getElementById('trx-nominal-display').value = Number(t.nominal).toLocaleString('id-ID');
  document.getElementById('trx-tanggal').value = t.tanggal;
  pendingBuktiFile = null;
  document.getElementById('trx-file-label').textContent = t.bukti_url ? 'Sudah ada bukti (Klik untuk ganti)' : 'Pilih Foto / File (Max 200KB)';
  
  setTrxJenis(t.jenis);
  selectedKatId = t.kategori_id;
  populateKatSelect();
  populateKasSelect();
  document.getElementById('trx-kas').value = t.posisi_kas_id;
  
  openSheet('trx');
}

async function deleteTrx(id) {
  if (!confirm('Hapus transaksi ini permanen?')) return;
  var res = await db.from('transaksi').delete().eq('id', id);
  if (!res.error) {
    closeSheet('detail');
    await loadTrx();
    renderTrxList();
    renderKasBreakdown();
    showToast('Transaksi dihapus', 'green');
  } else {
    showToast('Gagal menghapus', 'red');
  }
}

function renderKategoriPage() {
  var list = document.getElementById('kat-list');
  if (!list) return;
  list.innerHTML = '';
  
  allKategori.forEach(function(k) {
    var div = document.createElement('div');
    div.className = 'kat-item';
    div.innerHTML = 
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<div class="kat-badge-color" style="background:'+k.warna+'"></div>' +
        '<div>' +
          '<div style="font-weight:600">'+k.nama+'</div>' +
          '<div style="font-size:11px;color:var(--text3)">'+(k.jenis==='masuk'?'Pemasukan':'Pengeluaran')+'</div>' +
        '</div>' +
      '</div>' +
      '<button class="btn-text-danger" onclick="deleteKategori(\''+k.id+'\')">Hapus</button>';
    list.appendChild(div);
  });
}

function openAddKategori() {
  document.getElementById('kat-nama').value = '';
  setKatJenis('masuk');
  selectColor(COLORS[0]);
  openSheet('kat');
}

function setKatJenis(j) {
  currentKatJenis = j;
  var bM = document.getElementById('kat-j-masuk');
  var bK = document.getElementById('kat-j-keluar');
  if (j === 'masuk') { if (bM) bM.classList.add('active'); if (bK) bK.classList.remove('active'); }
  else { if (bM) bM.classList.remove('active'); if (bK) bK.classList.add('active'); }
}

function buildColorGrid() {
  var grid = document.getElementById('color-grid');
  if (!grid) return;
  grid.innerHTML = '';
  COLORS.forEach(function(c) {
    var div = document.createElement('div');
    div.className = 'color-dot';
    div.style.background = c;
    div.id = 'dot-' + c.replace('#','');
    div.addEventListener('click', function() { selectColor(c); });
    grid.appendChild(div);
  });
}

function selectColor(c) {
  selectedColor = c;
  document.querySelectorAll('.color-dot').forEach(function(d) { d.classList.remove('active'); });
  var el = document.getElementById('dot-' + c.replace('#',''));
  if (el) el.classList.add('active');
}

async function submitKat() {
  var nama = document.getElementById('kat-nama').value.trim();
  if (!nama) { showToast('Nama kategori wajib diisi', 'red'); return; }
  
  var payload = { nama: nama, jenis: currentKatJenis, warna: selectedColor, aktif: true };
  var res = await db.from('kategori_transaksi').insert(payload);
  if (!res.error) {
    closeSheet('kat');
    await loadKategori();
    renderKategoriPage();
    showToast('Kategori disimpan', 'green');
  } else {
    showToast('Gagal: ' + res.error.message, 'red');
  }
}

async function deleteKategori(id) {
  if (!confirm('Nonaktifkan kategori ini?')) return;
  var res = await db.from('kategori_transaksi').update({ aktif: false }).eq('id', id);
  if (!res.error) {
    await loadKategori();
    renderKategoriPage();
    showToast('Kategori dihapus', 'green');
  } else {
    showToast('Gagal', 'red');
  }
}

function loadPosKasPage() {
  renderKasBreakdown();
}

function renderKasBreakdown() {
  var container = document.getElementById('kas-breakdown-list');
  if (!container) return;
  container.innerHTML = '';
  
  allKas.forEach(function(k) {
    var masuk = 0, keluar = 0;
    allTrx.filter(function(t) { return t.posisi_kas_id === k.id; }).forEach(function(t) {
      if (t.jenis === 'masuk') masuk += t.nominal; else keluar += t.nominal;
    });
    var saldo = masuk - keluar;
    
    var div = document.createElement('div');
    div.className = 'kas-card-detail';
    var icon = k.tipe === 'bank' ? '🏦' : (k.tipe === 'ewallet' ? '📱' : '💵');
    
    div.innerHTML = 
      '<div style="display:flex;justify-content:between;align-items:start">' +
        '<div>' +
          '<div style="font-size:16px;font-weight:700">'+icon+' '+k.nama+'</div>' +
          (k.nomor_rekening ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+k.nomor_rekening+'</div>' : '') +
        '</div>' +
        '<div style="text-align:right">' +
          '<div style="font-size:16px;font-weight:800;color:var(--accent)">'+formatIDR(saldo)+'</div>' +
          '<div style="font-size:10px;color:var(--text3);margin-top:2px">In: '+formatIDR(masuk).replace('Rp ','')+' | Out: '+formatIDR(keluar).replace('Rp ','')+'</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:end;gap:12px;margin-top:12px;border-top:1px solid var(--border);padding-top:8px">' +
        '<button class="btn-text" style="font-size:11px" onclick="openEditKas('+JSON.stringify(k).replace(/"/g, '&quot;')+')">Edit</button>' +
        '<button class="btn-text-danger" style="font-size:11px" onclick="deletePosKas(\''+k.id+'\')">Hapus</button>' +
      '</div>';
    container.appendChild(div);
  });
}

function openAddKas() {
  document.getElementById('edit-kas-id').value = '';
  document.getElementById('kas-sheet-title').textContent = 'Tambah Posisi Kas';
  document.getElementById('kas-nama').value = '';
  document.getElementById('kas-norek').value = '';
  setKasTipe('tunai');
  openSheet('kas');
}

function setKasTipe(t) {
  currentKasTipe = t;
  ['tunai','bank','ewallet'].forEach(function(id) {
    var el = document.getElementById('kas-tipe-' + id);
    if (el) el.classList.remove('active');
  });
  var act = document.getElementById('kas-tipe-' + t);
  if (act) act.classList.add('active');
}

function openEditKas(k) {
  document.getElementById('edit-kas-id').value = k.id;
  document.getElementById('kas-sheet-title').textContent = 'Ubah Posisi Kas';
  document.getElementById('kas-nama').value = k.nama;
  document.getElementById('kas-norek').value = k.nomor_rekening || '';
  setKasTipe(k.tipe);
  openSheet('kas');
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
  var r;
  if (editId) {
    r = await db.from('posisi_kas').update(payload).eq('id', editId);
  } else {
    r = await db.from('posisi_kas').insert(Object.assign(payload, { aktif: true, urutan: 99 }));
  }
  
  btn.disabled = false;
  btn.textContent = 'Simpan Posisi Kas';
  
  if (!r.error) {
    closeSheet('kas');
    await loadKas();
    loadPosKasPage();
    populateKasSelect();
    showToast('Posisi kas disimpan', 'green');
  } else {
    showToast('Gagal: ' + r.error.message, 'red');
  }
}

async function deletePosKas(id) {
  if (!confirm('Hapus posisi kas ini?')) return;
  var r = await db.from('posisi_kas').update({ aktif: false }).eq('id', id);
  if (!r.error) {
    await loadKas();
    loadPosKasPage();
    showToast('Posisi kas dihapus', 'green');
  } else {
    showToast('Gagal menghapus', 'red');
  }
}

function updateProfilePage() {
  if (!currentProfile) return;
  
  var profNamaEl = document.getElementById('prof-nama');
  if (profNamaEl) {
    profNamaEl.textContent = currentProfile.nama || '';
  }
  
  var profEmailEl = document.getElementById('prof-email');
  if (profEmailEl) {
    profEmailEl.textContent = (currentUser && currentUser.email) ? currentUser.email : '-';
  }
  
  var rName = 'Viewer';
  var r = currentProfile.role ? currentProfile.role.toString().toLowerCase().trim() : 'viewer';
  if (r === 'admin') rName = 'Admin Penuh';
  if (r === 'bendahara') rName = 'Bendahara';
  if (r === 'input_only') rName = 'Operator Input';
  
  var profRoleEl = document.getElementById('prof-role');
  if (profRoleEl) {
    profRoleEl.textContent = rName;
  }
  
  var menus = document.getElementById('admin-menus');
  if (menus) {
    if (r === 'admin') menus.style.display = 'block';
    else menus.style.display = 'none';
  }
}
async function loadUsers() {
  var list = document.getElementById('users-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Memuat data...</div>';
  
  var res = await db.from('profil_pengguna').select('*').order('nama');
  if (res.error) { list.innerHTML = 'Gagal memuat data pengguna'; return; }
  
  list.innerHTML = '';
  res.data.forEach(function(p) {
    var div = document.createElement('div');
    div.className = 'user-item';
    
    var rLabel = p.role === 'admin' ? 'Admin' : (p.role === 'bendahara' ? 'Bendahara' : (p.role === 'input_only' ? 'Input Only' : 'Viewer'));
    
    div.innerHTML = 
      '<div>' +
        '<div style="font-weight:600">'+p.nama+'</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">Role: '+rLabel+'</div>' +
      '</div>' +
      '<button class="btn-text" onclick="openEditUser('+JSON.stringify(p).replace(/"/g, '&quot;')+')">Ubah Role</button>';
    list.appendChild(div);
  });
}

function openEditUser(p) {
  document.getElementById('edit-user-id').value = p.id;
  document.getElementById('edit-user-nama').textContent = p.nama;
  document.getElementById('edit-user-role').value = p.role;
  openSheet('user');
}

async function submitUserRole() {
  var id = document.getElementById('edit-user-id').value;
  var role = document.getElementById('edit-user-role').value;
  if (!id) return;
  
  var res = await db.from('profil_pengguna').update({ role: role }).eq('id', id);
  if (!res.error) {
    closeSheet('user');
    loadUsers();
    showToast('Role berhasil diperbarui', 'green');
  } else {
    showToast('Gagal mengubah role', 'red');
  }
}

async function renderAnggaranPage() {
  var tSel = document.getElementById('anggaran-tahun');
  var bSel = document.getElementById('anggaran-bulan');
  if (!tSel || !bSel) return;
  
  var thn = parseInt(tSel.value);
  var bln = parseInt(bSel.value);
  
  var container = document.getElementById('anggaran-container');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Memuat...</div>';
  
  var res = await db.from('anggaran').select('*').eq('tahun', thn).eq('bulan', bln);
  if (!res.error) allAnggaran = res.data || [];
  
  container.innerHTML = '';
  var katsKeluar = allKategori.filter(function(k) { return k.jenis === 'keluar'; });
  
  if (katsKeluar.length === 0) {
    container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Belum ada kategori pengeluaran</div>';
    return;
  }
  
  katsKeluar.forEach(function(k) {
    var ang = allAnggaran.find(function(a) { return a.kategori_id === k.id; });
    var limit = ang ? ang.nominal_limit : 0;
    
    var pakai = 0;
    allTrx.filter(function(t) {
      if (t.jenis !== 'keluar' || t.kategori_id !== k.id) return false;
      var d = new Date(t.tanggal);
      return (d.getFullYear() === thn && (d.getMonth() + 1) === bln);
    }).forEach(function(t) { pakai += t.nominal; });
    
    var sisa = limit - pakai;
    var pct = limit > 0 ? Math.min(100, Math.round((pakai / limit) * 100)) : 0;
    var pColor = pct >= 90 ? 'var(--red)' : (pct >= 70 ? 'var(--orange)' : 'var(--accent)');
    
    var div = document.createElement('div');
    div.className = 'anggaran-card';
    div.innerHTML = 
      '<div style="display:flex;justify-content:between;font-weight:600">' +
        '<div>'+k.nama+'</div>' +
        '<div style="color:var(--text2)">'+pct+'%</div>' +
      '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:'+pct+'%;background:'+pColor+'"></div></div>' +
      '<div style="display:flex;justify-content:between;font-size:11px;color:var(--text2);margin-top:6px">' +
        '<div>Pakai: '+formatIDR(pakai).replace('Rp ','')+' / '+formatIDR(limit).replace('Rp ','')+'</div>' +
        '<div style="color:'+(sisa<0?'var(--red)':'var(--text3)')+'">Sisa: '+formatIDR(sisa).replace('Rp ','')+'</div>' +
      '</div>' +
      '<div style="text-align:right;margin-top:10px;border-top:1px solid var(--border);padding-top:6px">' +
        '<button class="btn-text" style="font-size:11px" onclick="openSetAnggaran(\''+k.id+'\',\''+k.nama+'\','+limit+')">Set Limit</button>' +
      '</div>';
    container.appendChild(div);
  });
}

function openSetAnggaran(katId, katNama, currentLimit) {
  document.getElementById('anggaran-kat-id').value = katId;
  document.getElementById('anggaran-kat-nama').textContent = katNama;
  document.getElementById('anggaran-nominal-raw').value = currentLimit;
  document.getElementById('anggaran-nominal-display').value = currentLimit > 0 ? Number(currentLimit).toLocaleString('id-ID') : '';
  openSheet('anggaran');
}

async function submitAnggaran() {
  var katId = document.getElementById('anggaran-kat-id').value;
  var limit = parseInt(document.getElementById('anggaran-nominal-raw').value) || 0;
  var thn = parseInt(document.getElementById('anggaran-tahun').value);
  var bln = parseInt(document.getElementById('anggaran-bulan').value);
  
  var btn = document.getElementById('btn-submit-anggaran');
  btn.disabled = true;
  
  var exist = allAnggaran.find(function(a) { return a.kategori_id === katId; });
  var r;
  if (exist) {
    r = await db.from('anggaran').update({ nominal_limit: limit }).eq('id', exist.id);
  } else {
    r = await db.from('anggaran').insert({ kategori_id: katId, tahun: thn, bulan: bln, nominal_limit: limit });
  }
  
  btn.disabled = false;
  if (!r.error) {
    closeSheet('anggaran');
    renderAnggaranPage();
    showToast('Limit anggaran diperbarui', 'green');
  } else {
    showToast('Gagal menyimpan limit', 'red');
  }
}

function switchAnggotaTab(t) {
  currentAnggotaTab = t;
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('tab-' + t).classList.add('active');
  
  document.getElementById('sect-rekap').style.display = t === 'rekap' ? 'block' : 'none';
  document.getElementById('sect-anggota').style.display = t === 'anggota' ? 'block' : 'none';
  document.getElementById('sect-kegiatan').style.display = t === 'kegiatan' ? 'block' : 'none';
}

async function renderRekapAnggota() {
  var container = document.getElementById('rekap-list');
  if (!container) return;
  container.innerHTML = 'Memuat rekap...';
  
  var r1 = await db.from('anggota').select('*').eq('aktif', true);
  var r2 = await db.from('kegiatan').select('*').eq('aktif', true);
  var r3 = await db.from('absensi_kegiatan').select('*');
  
  if (r1.error || r2.error || r3.error) { container.innerHTML = 'Gagal memuat rekap'; return; }
  
  allAnggota = r1.data || [];
  allKegiatan = r2.data || [];
  var allAbsen = r3.data || [];
  
  container.innerHTML = '';
  if (allAnggota.length === 0) { container.innerHTML = 'Belum ada data anggota'; return; }
  
  allAnggota.forEach(function(a) {
    var totalHadir = allAbsen.filter(function(b) { return b.anggota_id === a.id && b.status_hadir === 'hadir'; }).length;
    var totalSakit = allAbsen.filter(function(b) { return b.anggota_id === a.id && b.status_hadir === 'sakit'; }).length;
    var totalIzin = allAbsen.filter(function(b) { return b.anggota_id === a.id && b.status_hadir === 'izin'; }).length;
    var totalAlpha = allAbsen.filter(function(b) { return b.anggota_id === a.id && b.status_hadir === 'alpha'; }).length;
    
    var div = document.createElement('div');
    div.className = 'anggota-rekap-card';
    div.innerHTML = 
      '<div style="font-weight:600;font-size:15px">'+a.nama+'</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">ID / NIK: '+(a.nik || '-')+'</div>' +
      '<div class="absen-stats">' +
        '<div class="stat-box"><span style="color:var(--green)">'+totalHadir+'</span>Hadir</div>' +
        '<div class="stat-box"><span style="color:var(--accent)">'+totalSakit+'</span>Sakit</div>' +
        '<div class="stat-box"><span style="color:var(--orange)">'+totalIzin+'</span>Izin</div>' +
        '<div class="stat-box"><span style="color:var(--red)">'+totalAlpha+'</span>Alpha</div>' +
      '</div>';
    container.appendChild(div);
  });
}

function renderDataAnggota() {
  var list = document.getElementById('anggota-list');
  if (!list) return;
  list.innerHTML = '';
  allAnggota.forEach(function(a) {
    var div = document.createElement('div');
    div.className = 'kat-item';
    div.innerHTML = '<div><div style="font-weight:600">'+a.nama+'</div><div style="font-size:11px;color:var(--text3)">'+(a.nik || '-')+'</div></div><button class="btn-text-danger" onclick="deleteAnggota(\''+a.id+'\')">Hapus</button>';
    list.appendChild(div);
  });
  
  var kList = document.getElementById('kegiatan-list');
  if (!kList) return;
  kList.innerHTML = '';
  allKegiatan.forEach(function(k) {
    var div = document.createElement('div');
    div.className = 'kat-item';
    div.innerHTML = '<div><div style="font-weight:600">'+k.nama+'</div><div style="font-size:11px;color:var(--text3)">'+k.tanggal+' ('+k.tipe+')</div></div><div style="display:flex;gap:8px"><button class="btn-text" onclick="openAbsensiSheet(\''+k.id+'\',\''+k.nama+'\')">Absen</button><button class="btn-text-danger" onclick="deleteKegiatan(\''+k.id+'\')">Hapus</button></div>';
    kList.appendChild(div);
  });
}

function openAddAnggota() { document.getElementById('anggota-nama').value = ''; document.getElementById('anggota-nik').value = ''; openSheet('anggota'); }
async function submitAnggota() {
  var nama = document.getElementById('anggota-nama').value.trim();
  var nik = document.getElementById('anggota-nik').value.trim();
  if(!nama) return;
  var r = await db.from('anggota').insert({ nama: nama, nik: nik || null, aktif: true });
  if(!r.error) { closeSheet('anggota'); await renderRekapAnggota(); renderDataAnggota(); showToast('Anggota ditambahkan','green'); }
}
async function deleteAnggota(id) {
  if(!confirm('Hapus anggota ini?')) return;
  await db.from('anggota').update({ aktif: false }).eq('id', id);
  await renderRekapAnggota(); renderDataAnggota();
}

function openAddKegiatan() {
  document.getElementById('kegiatan-nama').value = '';
  document.getElementById('kegiatan-tanggal').value = new Date().toISOString().split('T')[0];
  openSheet('kegiatan');
}
async function submitKegiatan() {
  var nama = document.getElementById('kegiatan-nama').value.trim();
  var tgl = document.getElementById('kegiatan-tanggal').value;
  if(!nama || !tgl) return;
  var r = await db.from('kegiatan').insert({ nama: nama, tanggal: tgl, tipe: currentKegiatanTipe, aktif: true });
  if(!r.error) { closeSheet('kegiatan'); await renderRekapAnggota(); renderDataAnggota(); showToast('Kegiatan dibuat','green'); }
}
async function deleteKegiatan(id) {
  if(!confirm('Hapus kegiatan ini?')) return;
  await db.from('kegiatan').update({ aktif: false }).eq('id', id);
  await renderRekapAnggota(); renderDataAnggota();
}

async function openAbsensiSheet(kegId, kegNama) {
  editingKegiatanId = kegId;
  document.getElementById('absen-kegiatan-nama').textContent = kegNama;
  var container = document.getElementById('absen-players-container');
  container.innerHTML = 'Memuat daftar absensi...';
  
  var res = await db.from('absensi_kegiatan').select('*').eq('kegiatan_id', kegId);
  var currentAbsen = res.error ? [] : (res.data || []);
  
  pesertaStatus = {};
  container.innerHTML = '';
  
  allAnggota.forEach(function(a) {
    var match = currentAbsen.find(function(b) { return b.anggota_id === a.id; });
    var status = match ? match.status_hadir : 'alpha';
    pesertaStatus[a.id] = status;
    
    var div = document.createElement('div');
    div.className = 'absen-row';
    div.innerHTML = 
      '<div style="font-weight:600">'+a.nama+'</div>' +
      '<div class="absen-options" id="opt-group-'+a.id+'">' +
        '<div class="opt-btn '+(status==='hadir'?'active-hadir':'')+'" onclick="setAbsenStatus(\''+a.id+'\',\'hadir\')">H</div>' +
        '<div class="opt-btn '+(status==='sakit'?'active-sakit':'')+'" onclick="setAbsenStatus(\''+a.id+'\',\'sakit\')">S</div>' +
        '<div class="opt-btn '+(status==='izin'?'active-izin':'')+'" onclick="setAbsenStatus(\''+a.id+'\',\'izin\')">I</div>' +
        '<div class="opt-btn '+(status==='alpha'?'active-alpha':'')+'" onclick="setAbsenStatus(\''+a.id+'\',\'alpha\')">A</div>' +
      '</div>';
    container.appendChild(div);
  });
  
  openSheet('players');
}

function setAbsenStatus(anggotaId, status) {
  pesertaStatus[anggotaId] = status;
  var group = document.getElementById('opt-group-' + anggotaId);
  if (!group) return;
  
  group.querySelectorAll('.opt-btn').forEach(function(b, idx) {
    b.className = 'opt-btn';
    if(idx===0 && status==='hadir') b.classList.add('active-hadir');
    if(idx===1 && status==='sakit') b.classList.add('active-sakit');
    if(idx===2 && status==='izin') b.classList.add('active-izin');
    if(idx===3 && status==='alpha') b.classList.add('active-alpha');
  });
}

async function submitAbsensi() {
  if (!editingKegiatanId) return;
  var btn = document.getElementById('btn-submit-absen');
  btn.disabled = true; btn.textContent = 'Menyimpan Absen...';
  
  await db.from('absensi_kegiatan').delete().eq('kegiatan_id', editingKegiatanId);
  
  var inserts = [];
  for (var aId in pesertaStatus) {
    inserts.push({ kegiatan_id: editingKegiatanId, anggota_id: aId, status_hadir: pesertaStatus[aId] });
  }
  
  if (inserts.length > 0) {
    await db.from('absensi_kegiatan').insert(inserts);
  }
  
  btn.disabled = false; btn.textContent = 'Simpan Absensi';
  closeSheet('players');
  renderRekapAnggota();
  showToast('Absensi berhasil disimpan', 'green');
}

function closeSheet(type) {
  // Dukungan penutupan lembar absensi khusus
  var name = type === 'players' ? 'players' : type;
  var overlay = document.getElementById('overlay-' + name);
  var sheet = document.getElementById('sheet-' + name);
  if (overlay && sheet) {
    overlay.classList.remove('active');
    sheet.classList.remove('active');
  }
}

function exportData() {
  var thn = document.getElementById('ekspor-tahun').value;
  var bln = document.getElementById('ekspor-bulan').value;
  
  var filtered = allTrx.filter(function(t) {
    var d = new Date(t.tanggal);
    return d.getFullYear() == thn && d.getMonth() == bln;
  });
  
  if (filtered.length === 0) { showToast('Tidak ada data di periode ini', 'red'); return; }
  
  var csv = 'Tanggal,Keterangan,Kategori,Posisi Kas,Jenis,Nominal,Oleh\n';
  filtered.forEach(function(t) {
    var kat = allKategori.find(function(k) { return k.id === t.kategori_id; });
    var kas = allKas.find(function(k) { return k.id === t.posisi_kas_id; });
    
    var row = [
      t.tanggal,
      '"' + (t.keterangan || '').replace(/"/g, '""') + '"',
      '"' + (kat ? kat.nama : '') + '"',
      '"' + (kas ? kas.nama : '') + '"',
      t.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
      t.nominal,
      '"' + (t.created_by_name || '') + '"'
    ];
    csv += row.join(',') + '\n';
  });
  
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'Laporan_Kas_' + thn + '_' + (parseInt(bln)+1) + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
