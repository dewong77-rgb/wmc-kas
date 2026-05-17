// WMC KAS - app.js v2.4 (Full Clean Version with Robust Error Protection)
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
  
  try {
    var s = await db.auth.getSession();
    if (s.data && s.data.session) {
      currentUser = s.data.session.user;
      await loadProfile(currentUser);
      await showApp();
    } else {
      showAuth();
    }
  } catch(e) {
    console.error("Gagal memuat sesi awal:", e);
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

  var loginBtn = document.getElementById('btn-login');
  if (loginBtn) loginBtn.addEventListener('click', doLogin);
  
  var loginPass = document.getElementById('login-pass');
  if (loginPass) loginPass.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  
  var trxSearch = document.getElementById('trx-search');
  if (trxSearch) trxSearch.addEventListener('input', function(e) { renderTrxList(e.target.value); });
  
  setupNominalInput('trx-nominal-display', 'trx-nominal-raw');
  setupNominalInput('anggaran-nominal-display', 'anggaran-nominal-raw');
  
  ['trx','detail','anggaran','anggota','kegiatan','user','kat','kas'].forEach(function(t) {
    var el = document.getElementById('overlay-' + t);
    if (el) el.addEventListener('click', function(e) { if (e.target === e.currentTarget) closeSheet(t); });
  });
  
  var trxTanggal = document.getElementById('trx-tanggal');
  if (trxTanggal) trxTanggal.value = new Date().toISOString().split('T')[0];
  
  var now = new Date();
  ['ekspor-tahun','anggaran-tahun'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    for (var y = now.getFullYear(); y >= 2024; y--) {
      var opt = document.createElement('option'); opt.value = y; opt.textContent = y; sel.appendChild(opt);
    }
  });
  
  var eksporBulan = document.getElementById('ekspor-bulan');
  if (eksporBulan) eksporBulan.value = now.getMonth();
  
  var anggaranBulan = document.getElementById('anggaran-bulan');
  if (anggaranBulan) anggaranBulan.value = now.getMonth() + 1;
  
  buildColorGrid();
});

function setupNominalInput(displayId, rawId) {
  var el = document.getElementById(displayId);
  if (!el) return;
  el.addEventListener('input', function() {
    var raw = this.value.replace(/\D/g, '');
    var rawInput = document.getElementById(rawId);
    if (rawInput) rawInput.value = raw;
    this.value = raw ? parseInt(raw).toLocaleString('id-ID') : '';
  });
  el.addEventListener('keydown', function(e) {
    var allowed = [8,46,37,38,39,40,9];
    if (allowed.indexOf(e.keyCode) >= 0) return;
    if ((e.keyCode < 48 || e.keyCode > 57) && (e.keyCode < 96 || e.keyCode > 105)) e.preventDefault();
  });
}

async function doLogin() {
  var emailEl = document.getElementById('login-email');
  var passEl = document.getElementById('login-pass');
  var btn = document.getElementById('btn-login');
  
  var email = emailEl ? emailEl.value.trim() : '';
  var pass = passEl ? passEl.value : '';
  
  if (!email || !pass) { showAuthError('Email dan password wajib diisi'); return; }
  if (btn) { btn.innerHTML = '<div class="spinner"></div>'; btn.disabled = true; }
  
  var errEl = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';
  
  try {
    var r = await db.auth.signInWithPassword({ email: email, password: pass });
    if (r.error) { 
      showAuthError('Email atau password salah'); 
      if (btn) { btn.innerHTML = '<span>Masuk</span>'; btn.disabled = false; }
    }
  } catch (e) {
    showAuthError('Terjadi kesalahan koneksi sistem');
    if (btn) { btn.innerHTML = '<span>Masuk</span>'; btn.disabled = false; }
  }
}

function showAuthError(msg) { 
  var el = document.getElementById('login-error'); 
  if (el) {
    el.textContent = msg; 
    el.style.display = 'block'; 
  }
}

async function doLogout() { if(db) await db.auth.signOut(); }

async function loadProfile(user) {
  if (!user) return;
  currentUser = user;
  try {
    var r = await db.from('profiles').select('*').eq('id', user.id).single();
    currentProfile = r.data;
    if (!currentProfile) {
      var nama = user.email ? user.email.split('@')[0] : 'User';
      await db.from('profiles').insert({ id: user.id, nama: nama, email: user.email, role: 'admin' });
      currentProfile = { id: user.id, nama: nama, email: user.email, role: 'admin' };
    }
    await db.from('log_login').insert({ 
      user_id: currentUser.id, 
      user_nama: currentProfile.nama, 
      user_role: currentProfile.role, 
      user_agent: navigator.userAgent.substring(0,200) 
    });
  } catch (e) {
    console.error("Gagal memuat profil Supabase:", e);
  }
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

function showAuth() { 
  var authEl = document.getElementById('auth-screen');
  var appEl = document.getElementById('app');
  if (authEl) authEl.style.display = 'flex'; 
  if (appEl) appEl.style.display = 'none'; 
}

function updateProfilePage() {
  if (!currentProfile) return;
  
  // Ambil role dan paksa jadi huruf kecil untuk validasi kode internal
  var dbRole = currentProfile.role ? currentProfile.role.toString().toLowerCase().trim() : '';
  
  var avatarEl = document.getElementById('profile-avatar');
  if (avatarEl && currentProfile.nama) {
    avatarEl.textContent = currentProfile.nama.charAt(0).toUpperCase();
  }
  
  var nameEl = document.getElementById('profile-name');
  if (nameEl) {
    nameEl.textContent = currentProfile.nama || '';
  }
  
  var roles = { admin:'Admin', bendahara:'Bendahara', input_only:'Input Only', viewer:'Viewer' };
  var roleEl = document.getElementById('profile-role');
  if (roleEl) {
    roleEl.textContent = roles[dbRole] || currentProfile.role || 'Viewer';
  }
  
  // Cek hak akses menggunakan dbRole yang sudah pasti huruf kecil
  var isAdmin = dbRole === 'admin';
  var canEdit = isAdmin || dbRole === 'bendahara';
  
  document.querySelectorAll('.admin-only').forEach(function(el) { el.style.display = isAdmin ? 'flex' : 'none'; });
  document.querySelectorAll('.ekspor-menu').forEach(function(el) { el.style.display = canEdit ? 'flex' : 'none'; });
  
  var btnKeg = document.getElementById('btn-add-kegiatan');
  if (btnKeg) btnKeg.style.display = canEdit ? 'block' : 'none';
  
  var btnAng = document.getElementById('btn-add-anggaran');
  if (btnAng) btnAng.style.display = isAdmin ? 'block' : 'none';
}

function goPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  
  var page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  currentPage = name;
  
  var navMap = { dashboard:0, transaksi:1, anggaran:2, anggota:3, profil:4 };
  if (navMap[name] !== undefined) {
    var navItems = document.querySelectorAll('.nav-item');
    if (navItems[navMap[name]]) navItems[navMap[name]].classList.add('active');
  }
  
  var noFab = ['profil','kategori','pengguna','poskas','ekspor'];
  var cleanRole = currentProfile && currentProfile.role ? currentProfile.role.toString().toLowerCase().trim() : '';
  var canInput = ['admin', 'bendahara', 'input_only'].indexOf(cleanRole) >= 0;
  
  var fabEl = document.getElementById('fab');
if (fabEl) {
  // PAKSA MUNCUL DI MANAPUN UNTUK TESTING HTML
  fabEl.style.setProperty('display', 'flex', 'important');
  fabEl.style.display = 'flex';
}
  
  var titles = { dashboard:'WMC Kas', transaksi:'Transaksi', anggaran:'Anggaran', anggota:'Anggota & Kegiatan', profil:'Profil', pengguna:'Pengguna', kategori:'Kategori', poskas:'Posisi Kas', ekspor:'Ekspor Laporan' };
  var titleHeader = document.getElementById('header-title');
  if (titleHeader) titleHeader.textContent = titles[name] || 'WMC Kas';
  
  if (name === 'transaksi') renderTrxList();
  if (name === 'kategori') renderKategoriPage();
  if (name === 'pengguna') loadUsers();
  if (name === 'poskas') loadPosKasPage();
  if (name === 'anggaran') renderAnggaranPage();
  if (name === 'anggota') { rekapPage=0; anggotaPage=0; kegiatanPage=0; renderRekapAnggota(); renderDataAnggota(); }
}

function onFabClick() {
  if (currentPage === 'anggaran') { openSheetAnggaran(); return; }
  openSheet('trx');
}

async function loadAll() {
  try {
    await Promise.all([loadKategori(), loadKas(), loadTrx(), loadAnggota(), loadAnggaran()]);
    renderDashboard(); renderTrxList(); populateKasSelect();
    await loadKegiatan();
  } catch(e) {
    console.error("Gagal sinkronisasi komponen data utama:", e);
  }
}
async function loadKategori() { var r = await db.from('kategori').select('*').eq('aktif',true).order('urutan'); allKategori = r.data||[]; }
async function loadKas() { var r = await db.from('posisi_kas').select('*').eq('aktif',true).order('urutan'); allKas = r.data||[]; }
async function loadTrx() {
  var r = await db.from('transaksi').select('*, kategori(nama,warna,jenis), posisi_kas(nama,tipe)').neq('status','batal').order('tanggal',{ascending:false}).limit(500);
  allTrx = r.data||[];
}
async function loadAnggota() { var r = await db.from('anggota').select('*').order('nama'); allAnggota = r.data||[]; }
async function loadAnggaran() { var r = await db.from('anggaran').select('*, kategori(nama,warna)').order('tahun',{ascending:false}).order('bulan',{ascending:false}); allAnggaran = r.data||[]; }

async function loadKegiatan() {
  var r = await db.from('kegiatan').select('*, bendahara:bendahara_id(nama)').order('tanggal_mulai',{ascending:false});
  var kegiatan = r.data || [];
  if (kegiatan.length) {
    var ids = kegiatan.map(function(k){ return k.id; });
    var rp = await db.from('kegiatan_peserta').select('*, anggota(nama)').in('kegiatan_id', ids);
    var pm = {};
    (rp.data||[]).forEach(function(p){ if (!pm[p.kegiatan_id]) pm[p.kegiatan_id]=[]; pm[p.kegiatan_id].push(p); });
    kegiatan.forEach(function(k){ k.kegiatan_peserta = pm[k.id]||[]; });
  }
  allKegiatan = kegiatan;
  if (currentPage === 'anggota') { renderRekapAnggota(); renderKegiatanList(); }
}

function renderDashboard() {
  var totalMasuk=0, totalKeluar=0;
  allTrx.forEach(function(t){ if(t.jenis==='masuk') totalMasuk+=t.nominal; else totalKeluar+=t.nominal; });
  var saldo = totalMasuk - totalKeluar;
  
  var saldoTotalEl = document.getElementById('saldo-total');
  if (saldoTotalEl) {
    saldoTotalEl.textContent = formatRp(saldo);
    saldoTotalEl.style.color = saldo>=0?'white':'var(--red)';
  }
  
  var now=new Date(), masukBulan=0, keluarBulan=0, countBulan=0;
  allTrx.forEach(function(t){
    var d=new Date(t.tanggal);
    if (d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()) {
      countBulan++; if(t.jenis==='masuk') masukBulan+=t.nominal; else keluarBulan+=t.nominal;
    }
  });
  var net = masukBulan-keluarBulan;
  
  var mbEl = document.getElementById('masuk-bulan'); if (mbEl) mbEl.textContent = formatRp(masukBulan);
  var kbEl = document.getElementById('keluar-bulan'); if (kbEl) kbEl.textContent = formatRp(keluarBulan);
  
  var nbEl = document.getElementById('net-bulan');
  if (nbEl) {
    nbEl.textContent = formatRp(net);
    nbEl.style.color = net>=0?'var(--green)':'var(--red)';
  }
  
  var tcEl = document.getElementById('trx-count'); if (tcEl) tcEl.textContent = allTrx.length+' transaksi';
  
  renderPieChart(totalMasuk, totalKeluar);
  renderTopKategori();
  renderKasBreakdown();
  
  var recent = allTrx.slice(0,5);
  var trEl = document.getElementById('trx-recent');
  if (trEl) {
    trEl.innerHTML = recent.length ? recent.map(trxHTML).join('') : '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada transaksi</div></div>';
  }
}

function renderPieChart(totalMasuk, totalKeluar) {
  var total=totalMasuk+totalKeluar;
  var svgEl = document.getElementById('pie-svg');
  var legEl = document.getElementById('pie-legend');
  
  if (!total) { 
    if (svgEl) svgEl.innerHTML='<circle cx="55" cy="55" r="38" fill="none" stroke="#2a3f55" stroke-width="16"/>'; 
    if (legEl) legEl.innerHTML='<div style="color:var(--text3);font-size:13px">Belum ada data</div>'; 
    return; 
  }
  var pM=totalMasuk/total, pK=totalKeluar/total, r=38, cx=55, cy=55, sw=16, circ=2*Math.PI*r;
  if (svgEl) {
    svgEl.innerHTML =
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#22d172" stroke-width="'+sw+'" stroke-dasharray="'+(pM*circ)+' '+circ+'" stroke-dashoffset="'+(circ*0.25)+'" transform="rotate(-90 '+cx+' '+cy+')" />'
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#ff5f5f" stroke-width="'+sw+'" stroke-dasharray="'+(pK*circ)+' '+circ+'" stroke-dashoffset="'+(-(pM*circ)+circ*0.25)+'" transform="rotate(-90 '+cx+' '+cy+')" />'
      +'<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" fill="#e8eef5" font-size="11" font-family="Plus Jakarta Sans" font-weight="700">'+Math.round(pM*100)+'%</text>'
      +'<text x="'+cx+'" y="'+(cy+10)+'" text-anchor="middle" fill="#8fa3b8" font-size="9" font-family="Plus Jakarta Sans">Masuk</text>';
  }
  if (legEl) {
    legEl.innerHTML =
      '<div class="pie-leg-item"><div class="pie-leg-dot" style="background:var(--green)"></div><div class="pie-leg-label">Pemasukan</div><div><span class="pie-leg-val" style="color:var(--green)">'+formatRp(totalMasuk)+'</span><span class="pie-leg-pct">'+Math.round(pM*100)+'%</span></div></div>'
      +'<div class="pie-leg-item"><div class="pie-leg-dot" style="background:var(--red)"></div><div class="pie-leg-label">Pengeluaran</div><div><span class="pie-leg-val" style="color:var(--red)">'+formatRp(totalKeluar)+'</span><span class="pie-leg-pct">'+Math.round(pK*100)+'%</span></div></div>'
      +'<div class="pie-leg-item" style="border-top:1px solid var(--border);padding-top:10px"><div class="pie-leg-dot" style="background:var(--accent)"></div><div class="pie-leg-label">Saldo Bersih</div><div><span class="pie-leg-val" style="color:'+(totalMasuk>=totalKeluar?'var(--green)':'var(--red)')+'">'+formatRp(totalMasuk-totalKeluar)+'</span></div></div>';
  }
}

function renderTopKategori() {
  var now=new Date();
  var bulanIni=allTrx.filter(function(t){ var d=new Date(t.tanggal); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
  function topKat(jenis, elId) {
    var map={};
    bulanIni.filter(function(t){ return t.jenis===jenis; }).forEach(function(t){
      var nama=t.kategori?t.kategori.nama:'Lain-lain', warna=t.kategori?t.kategori.warna:(jenis==='masuk'?'#22d172':'#ff5f5f');
      if (!map[nama]) map[nama]={nama:nama,warna:warna,total:0}; map[nama].total+=t.nominal;
    });
    var sorted=Object.values(map).sort(function(a,b){ return b.total-a.total; }).slice(0,4);
    var el = document.getElementById(elId);
    if (!el) return;
    if (!sorted.length) { el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada transaksi bulan ini</div>'; return; }
    var maxVal=sorted[0].total;
    el.innerHTML=sorted.map(function(k,i){
      return '<div class="top-kat-item"><div class="top-kat-rank">'+(i+1)+'</div><div class="top-kat-info"><div class="top-kat-name">'+k.nama+'</div><div class="top-kat-bar-wrap"><div class="top-kat-bar" style="width:'+Math.round((k.total/maxVal)*100)+'%;background:'+k.warna+'"></div></div></div><div class="top-kat-val" style="color:'+k.warna+'">'+formatRp(k.total)+'</div></div>';
    }).join('');
  }
  topKat('masuk','top-masuk'); topKat('keluar','top-keluar');
}

function renderKasBreakdown() {
  var el = document.getElementById('kas-breakdown');
  if (!el) return;
  if (!allKas.length) { el.innerHTML='<div style="color:var(--text3);font-size:13px">Tidak ada data kas</div>'; return; }
  var icons={tunai:'💵',bank:'🏦',ewallet:'📱'};
  el.innerHTML=allKas.map(function(k){
    var saldo=0; allTrx.forEach(function(t){ if(t.posisi_kas_id===k.id) saldo+=t.jenis==='masuk'?t.nominal:-t.nominal; });
    return '<div class="kas-item"><div class="kas-icon">'+(icons[k.tipe]||'💰')+'</div><div class="kas-info"><div class="kas-name">'+k.nama+'</div><div class="kas-tipe">'+k.tipe.toUpperCase()+'</div></div><div class="kas-saldo" style="color:'+(saldo>=0?'var(--text)':'var(--red)')+'">'+formatRp(saldo)+'</div></div>';
  }).join('');
}

function trxHTML(t) {
  var katNama=t.kategori?t.kategori.nama:'-';
  var tgl=new Date(t.tanggal).toLocaleDateString('id',{day:'numeric',month:'short',year:'numeric'});
  return '<div class="trx-item" onclick="openDetail(\''+t.id+'\')"><div class="trx-dot '+t.jenis+'"></div><div class="trx-info"><div class="trx-ket">'+(t.keterangan||katNama)+'</div><div class="trx-meta">'+tgl+' · '+katNama+(t.bukti_url?' · 📎':'')+'</div></div><div class="trx-nominal '+t.jenis+'">'+(t.jenis==='masuk'?'+':'-')+formatRp(t.nominal)+'</div></div>';
}

function renderTrxList(search) {
  search=search||'';
  var filtered=allTrx.filter(function(t){
    if (activeFilter!=='all'&&t.jenis!==activeFilter) return false;
    if (search) { var a=(t.keterangan||'').toLowerCase(), b=t.kategori?t.kategori.nama.toLowerCase():''; if (a.indexOf(search.toLowerCase())<0&&b.indexOf(search.toLowerCase())<0) return false; }
    return true;
  });
  var el = document.getElementById('trx-all');
  if (el) el.innerHTML=filtered.length?filtered.map(trxHTML).join(''):'<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Tidak ada transaksi</div></div>';
}

function setFilter(el,val) { document.querySelectorAll('.filter-chip').forEach(function(c){ c.classList.remove('active'); }); el.classList.add('active'); activeFilter=val; var searchEl=document.getElementById('trx-search'); renderTrxList(searchEl?searchEl.value:''); }

function openDetail(id) {
  var t=null; for(var i=0;i<allTrx.length;i++){ if(allTrx[i].id===id){ t=allTrx[i]; break; } }
  if (!t) return;
  var tgl=new Date(t.tanggal).toLocaleDateString('id',{day:'numeric',month:'long',year:'numeric'});
  var sc={lunas:'green',pending:'yellow',batal:'red'};
  
  var titleEl = document.getElementById('detail-title'); if (titleEl) titleEl.textContent=t.jenis==='masuk'?'Uang Masuk':'Uang Keluar';
  var contentEl = document.getElementById('detail-content');
  if (contentEl) {
    contentEl.innerHTML=
      '<div class="detail-row"><div class="detail-key">Nominal</div><div class="detail-val" style="font-family:var(--mono);font-size:20px;color:'+(t.jenis==='masuk'?'var(--green)':'var(--red)')+'">'+(t.jenis==='masuk'?'+':'-')+formatRp(t.nominal)+'</div></div>'
      +'<div class="detail-row"><div class="detail-key">Tanggal</div><div class="detail-val">'+tgl+'</div></div>'
      +'<div class="detail-row"><div class="detail-key">Kategori</div><div class="detail-val">'+(t.kategori?t.kategori.nama:'-')+'</div></div>'
      +'<div class="detail-row"><div class="detail-key">Posisi Kas</div><div class="detail-val">'+(t.posisi_kas?t.posisi_kas.nama:'-')+'</div></div>'
      +'<div class="detail-row"><div class="detail-key">Status</div><div class="detail-val"><span class="badge '+(sc[t.status]||'green')+'">'+t.status+'</span></div></div>'
      +'<div class="detail-row"><div class="detail-key">Keterangan</div><div class="detail-val">'+(t.keterangan||'-')+'</div></div>';
  }
  var buktiWrap=document.getElementById('detail-bukti-wrap'), buktiImg=document.getElementById('detail-bukti-img'), delBuktiBtn=document.getElementById('btn-del-bukti');
  if (t.bukti_url) { 
    if(buktiWrap) buktiWrap.style.display='block'; 
    if(buktiImg) buktiImg.src=t.bukti_url; 
    if(delBuktiBtn) {
      delBuktiBtn.style.display=currentProfile&&currentProfile.role==='admin'?'block':'none'; 
      delBuktiBtn.onclick=function(){ deleteBukti(t.id,t.bukti_url); }; 
    }
  } else { 
    if(buktiWrap) buktiWrap.style.display='none'; 
  }
  var canEdit=currentProfile&&(currentProfile.role==='admin'||currentProfile.role==='bendahara');
  var canDel=currentProfile&&currentProfile.role==='admin';
  var eb=document.getElementById('btn-edit-trx'), db2=document.getElementById('btn-delete-trx');
  if(eb) { eb.style.display=canEdit?'block':'none'; eb.onclick=function(){ closeSheet('detail'); openEditTrx(id); }; }
  if(db2) { db2.style.display=canDel?'block':'none'; db2.onclick=function(){ deleteTrx(id); }; }
  openSheet('detail');
}

async function deleteBukti(trxId, buktiUrl) {
  if (!confirm('Hapus bukti?')) return;
  var path=buktiUrl.split('/bukti-transaksi/')[1];
  if (path) await db.storage.from('bukti-transaksi').remove([decodeURIComponent(path)]);
  await db.from('transaksi').update({bukti_url:null}).eq('id',trxId);
  closeSheet('detail'); await loadTrx(); renderDashboard(); showToast('Bukti dihapus','green');
}

function openEditTrx(id) {
  var t=null; for(var i=0;i<allTrx.length;i++){ if(allTrx[i].id===id){ t=allTrx[i]; break; } }
  if (!t) return;
  editingTrxId=id;
  
  var titleEl = document.getElementById('trx-sheet-title'); if (titleEl) titleEl.textContent='Edit Transaksi';
  var editTrxIdEl = document.getElementById('edit-trx-id'); if (editTrxIdEl) editTrxIdEl.value=id;
  setJenis(t.jenis);
  
  var tnd = document.getElementById('trx-nominal-display'); if (tnd) tnd.value=parseInt(t.nominal).toLocaleString('id-ID');
  var tnr = document.getElementById('trx-nominal-raw'); if (tnr) tnr.value=t.nominal;
  var tt = document.getElementById('trx-tanggal'); if (tt) tt.value=t.tanggal;
  var ts = document.getElementById('trx-status'); if (ts) ts.value=t.status;
  var tk = document.getElementById('trx-ket'); if (tk) tk.value=t.keterangan||'';
  
  selectedKatId=t.kategori_id; renderKatGrid(); populateKasSelect();
  
  var tkas = document.getElementById('trx-kas'); if (tkas) tkas.value=t.posisi_kas_id||'';
  var curWrap=document.getElementById('current-bukti-wrap');
  if (t.bukti_url) { 
    if (curWrap) curWrap.style.display='block'; 
    var cbimg = document.getElementById('current-bukti-img'); if (cbimg) cbimg.src=t.bukti_url; 
  } else { 
    if (curWrap) curWrap.style.display='none'; 
  }
  pendingBuktiFile=null;
  var bp = document.getElementById('bukti-preview'); if (bp) bp.style.display='none';
  var bfn = document.getElementById('bukti-filename'); if (bfn) bfn.style.display='none';
  var berr = document.getElementById('bukti-error'); if (berr) berr.style.display='none';
  openSheet('trx');
}

async function deleteTrx(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  var r=await db.from('transaksi').update({status:'batal'}).eq('id',id);
  if (!r.error) { closeSheet('detail'); await loadTrx(); renderDashboard(); renderTrxList(); showToast('Transaksi dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

function previewBukti(input) {
  var errEl=document.getElementById('bukti-error'), fnEl=document.getElementById('bukti-filename'), prevEl=document.getElementById('bukti-preview');
  if (errEl) errEl.style.display='none'; if (fnEl) fnEl.style.display='none'; if (prevEl) prevEl.style.display='none';
  if (!input.files||!input.files[0]) return;
  var file=input.files[0];
  if (file.size>MAX_BUKTI_SIZE) { 
    if (errEl) { errEl.textContent='File terlalu besar. Maks 200KB. Ukuran: '+Math.round(file.size/1024)+'KB'; errEl.style.display='block'; }
    input.value=''; pendingBuktiFile=null; return; 
  }
  pendingBuktiFile=file;
  if (fnEl) { fnEl.textContent=file.name+' ('+Math.round(file.size/1024)+'KB)'; fnEl.style.display='block'; }
  if (file.type.startsWith('image/')) { 
    var reader=new FileReader(); 
    reader.onload=function(e){ if (prevEl) { prevEl.src=e.target.result; prevEl.style.display='block'; } }; 
    reader.readAsDataURL(file); 
  }
}

async function uploadBukti(trxId) {
  if (!pendingBuktiFile) return null;
  var ext=pendingBuktiFile.name.split('.').pop();
  var path=trxId+'/'+Date.now()+'.'+ext;
  var r=await db.storage.from('bukti-transaksi').upload(path, pendingBuktiFile, {upsert:true});
  if (r.error) { showToast('Gagal upload bukti','red'); return null; }
  return db.storage.from('bukti-transaksi').getPublicUrl(path).data.publicUrl;
}

function openSheet(type) {
  type=type||'trx';
  if (type==='trx') {
    var allowed=['admin','bendahara','input_only'];
    if (!currentProfile||allowed.indexOf(currentProfile.role)<0) { showToast('Tidak punya akses input','red'); return; }
    if (!editingTrxId) {
      var tst = document.getElementById('trx-sheet-title'); if (tst) tst.textContent='Transaksi Baru';
      var etid = document.getElementById('edit-trx-id'); if (etid) etid.value='';
      var tnd = document.getElementById('trx-nominal-display'); if (tnd) tnd.value='';
      var tnr = document.getElementById('trx-nominal-raw'); if (tnr) tnr.value='';
      var tk = document.getElementById('trx-ket'); if (tk) tk.value='';
      var ts = document.getElementById('trx-status'); if (ts) ts.value='lunas';
      var tt = document.getElementById('trx-tanggal'); if (tt) tt.value=new Date().toISOString().split('T')[0];
      var bp = document.getElementById('bukti-preview'); if (bp) bp.style.display='none';
      var bfn = document.getElementById('bukti-filename'); if (bfn) bfn.style.display='none';
      var berr = document.getElementById('bukti-error'); if (berr) berr.style.display='none';
      var cbw = document.getElementById('current-bukti-wrap'); if (cbw) cbw.style.display='none';
      var bfile = document.getElementById('bukti-file'); if (bfile) bfile.value='';
      pendingBuktiFile=null; selectedKatId=null; setJenis('masuk');
    }
    renderKatGrid();
  }
  var overlay=document.getElementById('overlay-'+type), sheet=document.getElementById('sheet-'+type);
  if (!overlay||!sheet) return;
  overlay.classList.add('show'); setTimeout(function(){ sheet.classList.add('show'); }, 10);
}

function closeSheet(type) {
  type=type||'trx';
  if (type==='trx') editingTrxId=null;
  if (type==='kegiatan') editingKegiatanId=null;
  var sheet=document.getElementById('sheet-'+type), overlay=document.getElementById('overlay-'+type);
  if (!sheet||!overlay) return;
  sheet.classList.remove('show'); setTimeout(function(){ overlay.classList.remove('show'); }, 300);
}

function setJenis(jenis) {
  currentJenis=jenis;
  var jm = document.getElementById('jenis-masuk'); if (jm) jm.className='jenis-btn'+(jenis==='masuk'?' active masuk':'');
  var jk = document.getElementById('jenis-keluar'); if (jk) jk.className='jenis-btn'+(jenis==='keluar'?' active keluar':'');
  var sbtn = document.getElementById('btn-submit-trx'); if (sbtn) sbtn.className='btn-submit '+(jenis==='masuk'?'green':'red');
  if (!editingTrxId) selectedKatId=null;
  renderKatGrid();
}

function renderKatGrid() {
  var filtered=allKategori.filter(function(k){ return k.jenis===currentJenis; });
  var kg = document.getElementById('kat-grid');
  if (!kg) return;
  kg.innerHTML=filtered.length?filtered.map(function(k){
    return '<div class="kat-chip'+(selectedKatId===k.id?' selected':'')+'" onclick="selectKat(\''+k.id+'\')">'+k.nama+'</div>';
  }).join(''):'<div style="color:var(--text3);font-size:12px;padding:8px 0;grid-column:span 3">Belum ada kategori.</div>';
}
function selectKat(id) { selectedKatId=id; renderKatGrid(); }
function populateKasSelect() { 
  var tkas = document.getElementById('trx-kas');
  if (tkas) tkas.innerHTML='<option value="">Pilih posisi kas...</option>'+allKas.map(function(k){ return '<option value="'+k.id+'">'+k.nama+'</option>'; }).join(''); 
}

async function submitTrx() {
  var editId=document.getElementById('edit-trx-id').value;
  var nominal=parseFloat(document.getElementById('trx-nominal-raw').value);
  var tanggal=document.getElementById('trx-tanggal').value;
  var kasId=document.getElementById('trx-kas').value;
  var ket=document.getElementById('trx-ket').value.trim();
  var status=document.getElementById('trx-status').value;
  if (!nominal||nominal<=0) { showToast('Nominal harus diisi','red'); return; }
  if (!tanggal) { showToast('Tanggal harus diisi','red'); return; }
  if (!kasId) { showToast('Pilih posisi kas','red'); return; }
  if (!selectedKatId) { showToast('Pilih kategori','red'); return; }
  if (pendingBuktiFile&&pendingBuktiFile.size>MAX_BUKTI_SIZE) { showToast('File bukti terlalu besar (maks 200KB)','red'); return; }
  var btn=document.getElementById('btn-submit-trx'); if (btn) { btn.disabled=true; btn.textContent='Menyimpan...'; }
  var payload={jenis:currentJenis,nominal:nominal,tanggal:tanggal,posisi_kas_id:kasId,kategori_id:selectedKatId,keterangan:ket,status:status};
  var r, trxId;
  if (editId) { r=await db.from('transaksi').update(payload).eq('id',editId).select().single(); trxId=editId; }
  else { payload.input_oleh=currentUser.id; r=await db.from('transaksi').insert(payload).select().single(); trxId=r.data?r.data.id:null; }
  if (r.error) { showToast('Gagal: '+r.error.message,'red'); if (btn) { btn.disabled=false; btn.textContent='Simpan Transaksi'; } return; }
  if (pendingBuktiFile&&trxId) { if (btn) btn.textContent='Upload bukti...'; var buktiUrl=await uploadBukti(trxId); if(buktiUrl) await db.from('transaksi').update({bukti_url:buktiUrl}).eq('id',trxId); }
  if (btn) { btn.disabled=false; btn.textContent='Simpan Transaksi'; } pendingBuktiFile=null;
  closeSheet('trx'); await loadTrx(); renderDashboard(); renderTrxList();
  showToast(editId?'Transaksi diperbarui':'Transaksi tersimpan','green');
}

// ANGGARAN
function renderAnggaranPage() {
  var years={};
  allAnggaran.forEach(function(a){ years[a.tahun]=true; });
  var yearList=Object.keys(years).sort(function(a,b){ return b-a; });
  var fr=document.getElementById('anggaran-filter-row');
  if (!fr) return;
  fr.innerHTML='<button class="filter-chip active" onclick="setAnggaranFilter(this,\'semua\')">Semua</button>'
    +yearList.map(function(y){ return '<button class="filter-chip" onclick="setAnggaranFilter(this,\''+y+'\')">'+y+'</button>'; }).join('');
  renderAnggaranList('semua');
}

function setAnggaranFilter(el, val) {
  document.querySelectorAll('#anggaran-filter-row .filter-chip').forEach(function(c){ c.classList.remove('active'); });
  el.classList.add('active');
  renderAnggaranList(val);
}

function renderAnggaranList(filter) {
  var alist = document.getElementById('anggaran-list');
  if (!alist) return;
  var filtered=filter==='semua'?allAnggaran:allAnggaran.filter(function(a){ return String(a.tahun)===String(filter); });
  if (!filtered.length) { alist.innerHTML='<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">Belum ada anggaran</div></div>'; return; }
  alist.innerHTML=filtered.map(function(a){
    var realisasi=allTrx.filter(function(t){
      if (t.jenis!=='keluar') return false;
      var d=new Date(t.tanggal);
      var mB=a.bulan?(d.getMonth()+1)===a.bulan:true;
      var mT=d.getFullYear()===a.tahun;
      var mK=a.kategori_id?t.kategori_id===a.kategori_id:true;
      return mB&&mT&&mK;
    }).reduce(function(s,t){ return s+t.nominal; }, 0);
    var pct=Math.min(100,Math.round((realisasi/a.nominal_target)*100));
    var isAlert=pct>=80;
    var barColor=pct>=100?'var(--red)':pct>=80?'var(--yellow)':'var(--green)';
    var periode=a.bulan?BULAN_NAMA[a.bulan-1]+' '+a.tahun:'Tahun '+a.tahun;
    var hapusBtn=currentProfile&&currentProfile.role==='admin'
      ? '<div style="margin-top:10px"><button class="btn-sm btn-sm-del" onclick="deleteAnggaran(\''+a.id+'\')">Hapus</button></div>'
      : '';
    return '<div class="anggaran-item">'
      +'<div class="anggaran-header"><div><div class="anggaran-nama">'+a.nama+(isAlert?'<span class="alert-badge">⚠️ '+pct+'%</span>':'')+'</div>'
      +'<div class="anggaran-periode">'+periode+(a.kategori?' · '+a.kategori.nama:'')+'</div></div>'
      +'<div class="anggaran-target">'+formatRp(a.nominal_target)+'</div></div>'
      +'<div class="progress-wrap"><div class="progress-bar" style="width:'+pct+'%;background:'+barColor+'"></div></div>'
      +'<div class="anggaran-footer"><div class="anggaran-realisasi" style="color:'+barColor+'">Terpakai: '+formatRp(realisasi)+'</div>'
      +'<div class="anggaran-sisa">Sisa: '+formatRp(Math.max(0,a.nominal_target-realisasi))+'</div></div>'
      +hapusBtn+'</div>';
  }).join('');
}

function openSheetAnggaran() {
  var ast = document.getElementById('anggaran-sheet-title'); if (ast) ast.textContent='Tambah Anggaran';
  var eaid = document.getElementById('edit-anggaran-id'); if (eaid) eaid.value='';
  var anama = document.getElementById('anggaran-nama'); if (anama) anama.value='';
  var and = document.getElementById('anggaran-nominal-display'); if (and) and.value='';
  var anr = document.getElementById('anggaran-nominal-raw'); if (anr) anr.value='';
  var acat = document.getElementById('anggaran-catatan'); if (acat) acat.value='';
  
  var sel=document.getElementById('anggaran-kat');
  if (sel) {
    sel.innerHTML='<option value="">Semua Kategori (Global)</option>'+allKategori.filter(function(k){ return k.jenis==='keluar'; }).map(function(k){ return '<option value="'+k.id+'">'+k.nama+'</option>'; }).join('');
  }
  openSheet('anggaran');
}

async function submitAnggaran() {
  var nama=document.getElementById('anggaran-nama').value.trim();
  var target=parseFloat(document.getElementById('anggaran-nominal-raw').value);
  var tahun=parseInt(document.getElementById('anggaran-tahun').value);
  var bulanVal=document.getElementById('anggaran-bulan').value;
  var bulan=bulanVal?parseInt(bulanVal):null;
  var katId=document.getElementById('anggaran-kat').value;
  var catatan=document.getElementById('anggaran-catatan').value.trim();
  if (!nama||!target) { showToast('Nama dan target wajib diisi','red'); return; }
  var btn=document.getElementById('btn-submit-anggaran'); if (btn) { btn.disabled=true; btn.textContent='Menyimpan...'; }
  var payload={nama:nama,nominal_target:target,tahun:tahun,bulan:bulan,kategori_id:katId||null,catatan:catatan||null};
  var r=await db.from('anggaran').insert(payload);
  if (btn) { btn.disabled=false; btn.textContent='Simpan Anggaran'; }
  if (!r.error) { closeSheet('anggaran'); await loadAnggaran(); renderAnggaranPage(); showToast('Anggaran disimpan','green'); }
  else showToast('Gagal: '+r.error.message,'red');
}

async function deleteAnggaran(id) {
  if (!confirm('Hapus anggaran ini?')) return;
  var r=await db.from('anggaran').delete().eq('id',id);
  if (!r.error) { await loadAnggaran(); renderAnggaranPage(); showToast('Anggaran dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

// REKAP ANGGOTA
function renderRekapAnggota() {
  var el=document.getElementById('rekap-anggota-list');
  if (!el) return;
  if (!allAnggota.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Belum ada data rekap</div></div>'; return; }
  var rekap={};
  allAnggota.forEach(function(a){ rekap[a.id]={id:a.id,nama:a.nama,total:0,fullboard:0,perjadin:0,pinjam:0}; });
  allKegiatan.forEach(function(k){
    (k.kegiatan_peserta||[]).forEach(function(p){
      var r=rekap[p.anggota_id];
      if (r) {
        r.total++;
        if (p.status==='hadir') { if (k.tipe==='fullboard') r.fullboard++; else r.perjadin++; }
        else if (p.status==='pinjam_nama') { r.pinjam++; }
      }
    });
  });
  var sorted=Object.values(rekap).sort(function(a,b){ return b.total-a.total; });
  var start=rekapPage*PAGE_SIZE;
  var slice=sorted.slice(start, start+PAGE_SIZE);
  el.innerHTML=slice.map(function(a){
    var pinjamText=a.pinjam>0?' <span style="color:var(--id-red);font-weight:600">('+a.pinjam+' pinjam)</span>':'';
    return '<div class="anggota-card">'
      +'<div class="anggota-card-header"><div class="anggota-avatar">'+a.nama.charAt(0).toUpperCase()+'</div>'
      +'<div><div class="anggota-card-name">'+a.nama+'</div>'
      +'<div style="font-size:11px;color:var(--text2)">'+a.total+' kegiatan'+pinjamText+'</div></div></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
      +'<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--accent)">'+a.fullboard+'</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Fullboard</div></div>'
      +'<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green)">'+a.perjadin+'</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Perjadin</div></div>'
      +'<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:'+(a.pinjam>0?'var(--yellow)':'var(--text3)')+'">'+a.pinjam+'</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Pinjam Nama</div></div>'
      +'</div></div>';
  }).join('');
  el.innerHTML+=renderPagerHTML(rekapPage, sorted.length, PAGE_SIZE, 'rekapPage=Math.max(0,rekapPage-1);renderRekapAnggota()', 'rekapPage=Math.min('+Math.ceil(sorted.length/PAGE_SIZE-1)+',rekapPage+1);renderRekapAnggota()');
}

// DATA ANGGOTA
function renderDataAnggota() {
  var isAdmin=currentProfile&&currentProfile.role==='admin';
  var el=document.getElementById('data-anggota-list');
  if (!el) return;
  if (!allAnggota.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Belum ada anggota</div></div>'; return; }
  var start=anggotaPage*PAGE_SIZE;
  var slice=allAnggota.slice(start, start+PAGE_SIZE);
  el.innerHTML=slice.map(function(a){
    var editBtn=isAdmin?'<button class="btn-sm btn-sm-edit" onclick="editAnggota(\''+a.id+'\',\''+escQ(a.nama)+'\',\''+(a.nip||'')+'\')">Edit</button>':'';
    return '<div class="anggota-manage-item">'
      +'<div class="anggota-avatar">'+a.nama.charAt(0).toUpperCase()+'</div>'
      +'<div style="flex:1"><div class="anggota-manage-name">'+a.nama+'</div><div class="anggota-manage-nip">NIP: '+(a.nip||'-')+'</div></div>'
      +editBtn+'</div>';
  }).join('');
  el.innerHTML+=renderPagerHTML(anggotaPage, allAnggota.length, PAGE_SIZE, 'anggotaPage=Math.max(0,anggotaPage-1);renderDataAnggota()', 'anggotaPage=Math.min('+Math.ceil(allAnggota.length/PAGE_SIZE-1)+',anggotaPage+1);renderDataAnggota()');
}

function openSheetAnggota() {
  var ast = document.getElementById('anggota-sheet-title'); if (ast) ast.textContent='Tambah Anggota';
  var eaid = document.getElementById('edit-anggota-id'); if (eaid) eaid.value='';
  var anama = document.getElementById('anggota-nama'); if (anama) anama.value='';
  var anip = document.getElementById('anggota-nip'); if (anip) anip.value='';
  openSheet('anggota');
}

function editAnggota(id, nama, nip) {
  var ast = document.getElementById('anggota-sheet-title'); if (ast) ast.textContent='Edit Anggota';
  var eaid = document.getElementById('edit-anggota-id'); if (eaid) eaid.value=id;
  var anama = document.getElementById('anggota-nama'); if (anama) anama.value=nama;
  var anip = document.getElementById('anggota-nip'); if (anip) anip.value=nip;
  openSheet('anggota');
}

async function submitAnggota() {
  var editId=document.getElementById('edit-anggota-id').value;
  var nama=document.getElementById('anggota-nama').value.trim();
  var nip=document.getElementById('anggota-nip').value.trim();
  if (!nama) { showToast('Nama wajib diisi','red'); return; }
  var btn=document.getElementById('btn-submit-anggota'); if (btn) { btn.disabled=true; btn.textContent='Menyimpan...'; }
  var payload={nama:nama,nip:nip||null};
  var r=editId?await db.from('anggota').update(payload).eq('id',editId):await db.from('anggota').insert(payload);
  if (btn) { btn.disabled=false; btn.textContent='Simpan Anggota'; }
  if (!r.error) { closeSheet('anggota'); await loadAnggota(); renderDataAnggota(); renderRekapAnggota(); showToast('Data anggota disimpan','green'); }
  else showToast('Gagal: '+r.error.message,'red');
}

// KEGIATAN
function renderKegiatanList() {
  var el=document.getElementById('kegiatan-list');
  if (!el) return;
  if (!allKegiatan.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Belum ada kegiatan</div></div>'; return; }
  var start=kegiatanPage*PAGE_SIZE;
  var slice=allKegiatan.slice(start, start+PAGE_SIZE);
  var canEdit=currentProfile&&(currentProfile.role==='admin'||currentProfile.role==='bendahara');
  el.innerHTML=slice.map(function(k){
    var tglM=new Date(k.tanggal_mulai).toLocaleDateString('id',{day:'numeric',month:'short'});
    var tglS=new Date(k.tanggal_selesai).toLocaleDateString('id',{day:'numeric',month:'short',year:'numeric'});
    var bNama=k.bendahara?k.bendahara.nama:'-';
    var badgeColor=k.tipe==='fullboard'?'badge-accent':'badge-green';
    var editBtn=canEdit?'<button class="btn-sm btn-sm-edit" onclick="openEditKegiatan(\''+k.id+'\')">Edit</button>':'';
    return '<div class="kegiatan-item-box">'
      +'<div class="kegiatan-item-header"><div><div class="kegiatan-item-nama">'+k.nama+'</div>'
      +'<div class="kegiatan-item-meta">📅 '+tglM+' - '+tglS+' · 👤 '+bNama+'</div></div>'
      +'<span class="badge '+badgeColor+'">'+k.tipe.toUpperCase()+'</span></div>'
      +'<div class="kegiatan-peserta-count">👥 '+k.kegiatan_peserta.length+' Peserta ('+k.kegiatan_peserta.filter(function(p){ return p.status==='hadir'; }).length+' Hadir, '+k.kegiatan_peserta.filter(function(p){ return p.status==='pinjam_nama'; }).length+' Pinjam)</div>'
      +'<div style="margin-top:10px;display:flex;gap:6px;justify-content:flex-end">'+editBtn+'</div></div>';
  }).join('');
  el.innerHTML+=renderPagerHTML(kegiatanPage, allKegiatan.length, PAGE_SIZE, 'kegiatanPage=Math.max(0,kegiatanPage-1);renderKegiatanList()', 'kegiatanPage=Math.min('+Math.ceil(allKegiatan.length/PAGE_SIZE-1)+',kegiatanPage+1);renderKegiatanList()');
}

function openSheetKegiatan() {
  editingKegiatanId=null;
  var kst = document.getElementById('kegiatan-sheet-title'); if (kst) kst.textContent='Tambah Kegiatan';
  var knama = document.getElementById('kegiatan-nama'); if (knama) knama.value='';
  var ktm = document.getElementById('kegiatan-tgl-mulai'); if (ktm) ktm.value='';
  var kts = document.getElementById('kegiatan-tgl-selesai'); if (kts) kts.value='';
  setKegiatanTipe('fullboard'); populateBendahara(); buildPesertaChecklist({});
  openSheet('kegiatan');
}

function openEditKegiatan(id) {
  var k=null; for(var i=0;i<allKegiatan.length;i++){ if(allKegiatan.length&&allKegiatan[i].id===id){ k=allKegiatan[i]; break; } }
  if (!k) return;
  editingKegiatanId=id;
  
  var kst = document.getElementById('kegiatan-sheet-title'); if (kst) kst.textContent='Edit Kegiatan';
  var knama = document.getElementById('kegiatan-nama'); if (knama) knama.value=k.nama;
  var ktm = document.getElementById('kegiatan-tgl-mulai'); if (ktm) ktm.value=k.tanggal_mulai;
  var kts = document.getElementById('kegiatan-tgl-selesai'); if (kts) kts.value=k.tanggal_selesai;
  setKegiatanTipe(k.tipe); populateBendahara(k.bendahara_id);
  var pre={}; k.kegiatan_peserta.forEach(function(p){ pre[p.anggota_id]=p.status; });
  buildPesertaChecklist(pre);
  openSheet('kegiatan');
}

function setKegiatanTipe(t) {
  currentKegiatanTipe=t;
  var ktf = document.getElementById('ktipe-fullboard'); if (ktf) ktf.className='tipe-btn'+(t==='fullboard'?' active':'');
  var ktp = document.getElementById('ktipe-perjadin'); if (ktp) ktp.className='tipe-btn'+(t==='perjadin'?' active':'');
}

function populateBendahara(selectedId) {
  var bendSel=document.getElementById('kegiatan-bendahara');
  if (!bendSel) return;
  bendSel.innerHTML='<option value="">Pilih bendahara...</option>';
  db.from('profiles').select('id,nama,role').in('role',['admin','bendahara']).then(function(r){
    (r.data||[]).forEach(function(p){
      var opt=document.createElement('option'); opt.value=p.id; opt.textContent=p.nama+' ('+p.role+')';
      if (selectedId&&p.id===selectedId) opt.selected=true;
      bendSel.appendChild(opt);
    });
  });
}

function buildPesertaChecklist(preSelected) {
  pesertaStatus=Object.assign({},preSelected);
  var cl=document.getElementById('peserta-checklist');
  if (!cl) return;
  if (!allAnggota.length) { cl.innerHTML='<div style="color:var(--text3);font-size:13px">Belum ada anggota.</div>'; return; }
  cl.innerHTML=allAnggota.map(function(a){
    var status=pesertaStatus[a.id];
    var isSelected=status!==undefined;
    var checkStyle='width:20px;height:20px;border-radius:5px;border:2px solid '+(isSelected?'var(--green)':'var(--border)')+';background:'+(isSelected?'var(--green)':'transparent')+';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:white';
    return '<div class="peserta-item" id="pitem-'+a.id+'">'
      +'<div style="'+checkStyle+'" id="pcheck-'+a.id+'" onclick="togglePesertaCheck(\''+a.id+'\')">'+(isSelected?'✓':'')+'</div>'
      +'<div class="peserta-nama">'+a.nama+'</div>'
      +'<div class="peserta-status-toggle" id="ptoggle-'+a.id+'" style="display:'+(isSelected?'flex':'none')+'">'
      +'<div class="peserta-status-btn'+(status==='hadir'?' hadir-active':'')+'" onclick="setPesertaStatus(\''+a.id+'\',\'hadir\')">Hadir</div>'
      +'<div class="peserta-status-btn'+(status==='pinjam_nama'?' pinjam-active':'')+'" onclick="setPesertaStatus(\''+a.id+'\',\'pinjam_nama\')">Pinjam</div>'
      +'</div></div>';
  }).join('');
}

function togglePesertaCheck(id) {
  var check=document.getElementById('pcheck-'+id);
  var toggle=document.getElementById('ptoggle-'+id);
  if (!check) return;
  if (pesertaStatus[id]!==undefined) {
    delete pesertaStatus[id]; check.innerHTML=''; check.style.background='transparent'; check.style.borderColor='var(--border)';
    if(toggle) toggle.style.display='none';
  } else {
    pesertaStatus[id]='hadir'; check.innerHTML='✓'; check.style.background='var(--green)'; check.style.borderColor='var(--green)';
    if(toggle) {
      toggle.style.display='flex';
      var btns = toggle.querySelectorAll('.peserta-status-btn');
      if (btns[0]) btns[0].className='peserta-status-btn hadir-active';
      if (btns[1]) btns[1].className='peserta-status-btn';
    }
  }
}

function setPesertaStatus(id, st) {
  pesertaStatus[id]=st;
  var toggle=document.getElementById('ptoggle-'+id);
  if (!toggle) return;
  var b1=toggle.querySelectorAll('.peserta-status-btn')[0], b2=toggle.querySelectorAll('.peserta-status-btn')[1];
  if(b1 && b2) {
    b1.className='peserta-status-btn'+(st==='hadir'?' hadir-active':'');
    b2.className='peserta-status-btn'+(st==='pinjam_nama'?' pinjam-active':'');
  }
}

async function submitKegiatan() {
  var nama=document.getElementById('kegiatan-nama').value.trim();
  var tm=document.getElementById('kegiatan-tgl-mulai').value;
  var ts=document.getElementById('kegiatan-tgl-selesai').value;
  var bId=document.getElementById('kegiatan-bendahara').value;
  if (!nama||!tm||!ts||!bId) { showToast('Semua kolom utama wajib diisi','red'); return; }
  var btn=document.getElementById('btn-submit-kegiatan'); if (btn) { btn.disabled=true; btn.textContent='Menyimpan...'; }
  var payload={nama:nama,tanggal_mulai:tm,tanggal_selesai:ts,tipe:currentKegiatanTipe,bendahara_id:bId};
  var r;
  if(editingKegiatanId) r=await db.from('kegiatan').update(payload).eq('id',editingKegiatanId);
  else r=await db.from('kegiatan').insert(payload).select().single();
  if (r.error) { showToast('Gagal: '+r.error.message,'red'); if (btn) { btn.disabled=false; btn.textContent='Simpan Kegiatan'; } return; }
  var kId=editingKegiatanId || r.data.id;
  if (editingKegiatanId) await db.from('kegiatan_peserta').delete().eq('kegiatan_id',kId);
  var pIns=[]; Object.keys(pesertaStatus).forEach(function(aId){ pIns.push({kegiatan_id:kId,anggota_id:aId,status:pesertaStatus[aId]}); });
  if (pIns.length) await db.from('kegiatan_peserta').insert(pIns);
  if (btn) { btn.disabled=false; btn.textContent='Simpan Kegiatan'; }
  closeSheet('kegiatan'); await loadKegiatan(); showToast('Kegiatan berhasil disimpan','green');
}

// KATEGORI & POSKAS & PENGGUNA PAGE HANDLERS
function renderKategoriPage() {
  var masuk=allKategori.filter(function(k){ return k.jenis==='masuk'; });
  var keluar=allKategori.filter(function(k){ return k.jenis==='keluar'; });
  function katItem(k) {
    var isAdmin=currentProfile&&currentProfile.role==='admin';
    return '<div class="kat-manage-item">'
      +'<div class="kat-color-dot" style="background:'+k.warna+'"></div>'
      +'<div class="kat-manage-name">'+k.nama+'</div>'
      +(isAdmin?'<button class="btn-sm btn-sm-edit" onclick="editKat(\''+k.id+'\',\''+escQ(k.nama)+'\',\''+k.jenis+'\',\''+k.warna+'\')">Edit</button>':'')
      +(isAdmin?'<button class="btn-sm btn-sm-del" onclick="deleteKat(\''+k.id+'\')">Hapus</button>':'')
      +'</div>';
  }
  var km = document.getElementById('kat-masuk-list'); if (km) km.innerHTML=masuk.map(katItem).join('')||'<div style="color:var(--text3);font-size:12px;padding:8px">Belum ada kategori masuk.</div>';
  var kk = document.getElementById('kat-keluar-list'); if (kk) kk.innerHTML=keluar.map(katItem).join('')||'<div style="color:var(--text3);font-size:12px;padding:8px">Belum ada kategori keluar.</div>';
}

function openSheetKat() {
  var kst = document.getElementById('kat-sheet-title'); if (kst) kst.textContent='Tambah Kategori';
  var ekid = document.getElementById('edit-kat-id'); if (ekid) ekid.value='';
  var knama = document.getElementById('kat-nama'); if (knama) knama.value='';
  setKatJenis('masuk'); selectColor('#22d172'); openSheet('kat');
}

function editKat(id, nama, jenis, warna) {
  var kst = document.getElementById('kat-sheet-title'); if (kst) kst.textContent='Edit Kategori';
  var ekid = document.getElementById('edit-kat-id'); if (ekid) ekid.value=id;
  var knama = document.getElementById('kat-nama'); if (knama) knama.value=nama;
  setKatJenis(jenis); selectColor(warna); openSheet('kat');
}

function setKatJenis(j) {
  currentKatJenis=j;
  var kjm = document.getElementById('kat-jenis-masuk'); if (kjm) kjm.className='tipe-btn'+(j==='masuk'?' active':'');
  var kjk = document.getElementById('kat-jenis-keluar'); if (kjk) kjk.className='tipe-btn'+(j==='keluar'?' active':'');
}

function buildColorGrid() {
  var cg = document.getElementById('color-grid');
  if (!cg) return;
  cg.innerHTML=COLORS.map(function(c){ return '<div class="color-dot'+(selectedColor===c?' selected':'')+'" style="background:'+c+'" onclick="selectColor(\''+c+'\')"></div>'; }).join('');
}
function selectColor(c) { selectedColor=c; buildColorGrid(); }

async function submitKat() {
  var editId=document.getElementById('edit-kat-id').value;
  var nama=document.getElementById('kat-nama').value.trim();
  if (!nama) { showToast('Nama wajib diisi','red'); return; }
  var payload={nama:nama,jenis:currentKatJenis,warna:selectedColor};
  var r=editId?await db.from('kategori').update(payload).eq('id',editId):await db.from('kategori').insert(Object.assign(payload,{aktif:true,urutan:99}));
  if (!r.error) { closeSheet('kat'); await loadKategori(); renderKategoriPage(); showToast('Kategori disimpan','green'); }
  else showToast('Gagal: '+r.error.message,'red');
}

async function deleteKat(id) {
  if (!confirm('Hapus kategori ini?')) return;
  var r=await db.from('kategori').update({aktif:false}).eq('id',id);
  if (!r.error) { await loadKategori(); renderKategoriPage(); showToast('Kategori dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

function loadPosKasPage() {
  var el = document.getElementById('poskas-list');
  if (!el) return;
  if (!allKas.length) { el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:10px">Belum ada posisi kas.</div>'; return; }
  var icons={tunai:'💵',bank:'🏦',ewallet:'📱'};
  var isAdmin=currentProfile&&currentProfile.role==='admin';
  el.innerHTML=allKas.map(function(k){
    var editBtn=isAdmin?'<button class="btn-sm btn-sm-edit" onclick="editPosKas(\''+k.id+'\',\''+escQ(k.nama)+'\',\''+k.tipe+'\',\''+escQ(k.nomor_rekening||'')+'\')">Edit</button>':'';
    var delBtn=isAdmin?'<button class="btn-sm btn-sm-del" onclick="deletePosKas(\''+k.id+'\')">Hapus</button>':'';
    return '<div class="kas-manage-card"><div style="display:flex;align-items:center;gap:10px">'
      +'<div class="kas-icon">'+(icons[k.tipe]||'💰')+'</div>'
      +'<div><div class="kas-name">'+k.nama+'</div><div class="kas-tipe">'+k.tipe.toUpperCase()+(k.nomor_rekening?' · '+k.nomor_rekening:'')+'</div></div></div>'
      +'<div style="display:flex;gap:4px">'+editBtn+delBtn+'</div></div>';
  }).join('');
}

function openSheetKas() {
  var kst = document.getElementById('kas-sheet-title'); if (kst) kst.textContent='Tambah Posisi Kas';
  var ekid = document.getElementById('edit-kas-id'); if (ekid) ekid.value='';
  var knama = document.getElementById('kas-nama'); if (knama) knama.value='';
  var knor = document.getElementById('kas-norek'); if (knor) knor.value='';
  setKasTipe('tunai'); openSheet('kas');
}

function editPosKas(id, nama, tipe, norek) {
  var kst = document.getElementById('kas-sheet-title'); if (kst) kst.textContent='Edit Posisi Kas';
  var ekid = document.getElementById('edit-kas-id'); if (ekid) ekid.value=id;
  var knama = document.getElementById('kas-nama'); if (knama) knama.value=nama;
  var knor = document.getElementById('kas-norek'); if (knor) knor.value=norek;
  setKasTipe(tipe); openSheet('kas');
}

function setKasTipe(t) {
  currentKasTipe=t;
  var kt = document.getElementById('kas-tipe-tunai'); if (kt) kt.className='tipe-btn'+(t==='tunai'?' active':'');
  var kb = document.getElementById('kas-tipe-bank'); if (kb) kb.className='tipe-btn'+(t==='bank'?' active':'');
  var ke = document.getElementById('kas-tipe-ewallet'); if (ke) ke.className='tipe-btn'+(t==='ewallet'?' active':'');
}

async function submitKas() {
  var editId=document.getElementById('edit-kas-id').value;
  var nama=document.getElementById('kas-nama').value.trim();
  var norek=document.getElementById('kas-norek').value.trim();
  if (!nama) { showToast('Nama wajib diisi','red'); return; }
  var btn=document.getElementById('btn-submit-kas'); if (btn) { btn.disabled=true; btn.textContent='Menyimpan...'; }
  var payload={nama:nama,tipe:currentKasTipe,nomor_rekening:norek||null};
  var r=editId?await db.from('posisi_kas').update(payload).eq('id',editId):await db.from('posisi_kas').insert(Object.assign(payload,{aktif:true,urutan:99}));
  if (btn) { btn.disabled=false; btn.textContent='Simpan Posisi Kas'; }
  if (!r.error) { closeSheet('kas'); await loadKas(); loadPosKasPage(); populateKasSelect(); renderKasBreakdown(); showToast('Posisi kas disimpan','green'); }
  else showToast('Gagal: '+r.error.message,'red');
}

async function deletePosKas(id) {
  if (!confirm('Hapus posisi kas ini?')) return;
  var r=await db.from('posisi_kas').update({aktif:false}).eq('id',id);
  if (!r.error) { await loadKas(); loadPosKasPage(); showToast('Posisi kas dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

async function loadUsers() {
  var el = document.getElementById('users-list');
  if (!el) return;
  var r=await db.from('profiles').select('*').order('nama');
  var list=r.data||[];
  el.innerHTML=list.map(function(p){
    var roles={admin:'Admin',bendahara:'Bendahara',input_only:'Input Only',viewer:'Viewer'};
    var optHTML=Object.keys(roles).map(function(rk){ return '<option value="'+rk+'" '+(p.role===rk?'selected':'')+'>'+roles[rk]+'</option>'; }).join('');
    return '<div class="user-manage-card">'
      +'<div><div class="user-manage-name">'+p.nama+'</div><div class="user-manage-email">'+p.email+'</div></div>'
      +'<select class="form-input" style="width:130px;padding:6px" onchange="updateUserRole(\''+p.id+'\',this.value)">'+optHTML+'</select></div>';
  }).join('');
}

async function updateUserRole(uid, role) {
  var r=await db.from('profiles').update({role:role}).eq('id',uid);
  if(!r.error) { showToast('Hak akses diperbarui','green'); if(uid===currentUser.id) { await loadProfile(currentUser); updateProfilePage(); } }
  else showToast('Gagal memperbarui','red');
}

// EKSPOR LAPORAN
function setEksporPeriod(p) {
  currentPeriod=p;
  var epb = document.getElementById('eperiod-bulan'); if (epb) epb.className='tipe-btn'+(p==='bulan'?' active':'');
  var eps = document.getElementById('eperiod-semua'); if (eps) eps.className='tipe-btn'+(p==='semua'?' active':'');
  var ebox = document.getElementById('ekspor-bulan-box'); if (ebox) ebox.style.display=p==='bulan'?'grid':'none';
}

function eksporPDF() {
  var data=allTrx, judulPeriode='Semua Periode';
  if (currentPeriod==='bulan') {
    var bulan=parseInt(document.getElementById('ekspor-bulan').value);
    var tahun=parseInt(document.getElementById('ekspor-tahun').value);
    data=allTrx.filter(function(t){
      var d=new Date(t.tanggal);
      return d.getMonth()===bulan&&d.getFullYear()===tahun;
    });
    judulPeriode=BULAN_NAMA[bulan]+' '+tahun;
  }
  if (!data.length) { showToast('Tidak ada data untuk periode ini','yellow'); return; }
  var sorted=data.slice().sort(function(a,b){ return new Date(a.tanggal)-new Date(b.tanggal); });
  var saldo=0;
  var rows=sorted.map(function(t,i){
    var masuk=t.jenis==='masuk'?t.nominal:0, keluar=t.jenis==='keluar'?t.nominal:0;
    saldo+=masuk-keluar;
    var tgl=new Date(t.tanggal).toLocaleDateString('id',{day:'2-digit',month:'2-digit',year:'numeric'});
    return '<tr style="border-bottom:1px solid #e5e7eb;background:'+(i%2===0?'white':'#f8fafc')+'">'
      +'<td style="padding:7px 6px;text-align:center;font-size:12px">'+(i+1)+'</td>'
      +'<td style="padding:7px 6px;font-size:12px">'+tgl+'</td>'
      +'<td style="padding:7px 6px;font-size:12px">'+(t.keterangan||'-')+'</td>'
      +'<td style="padding:7px 6px;font-size:12px">'+(t.kategori?t.kategori.nama:'-')+'</td>'
      +'<td style="padding:7px 6px;text-align:right;font-size:12px;color:'+(masuk?'#15803d':'#text')+'">'+(masuk?formatRp(masuk):'-')+'</td>'
      +'<td style="padding:7px 6px;text-align:right;font-size:12px;color:'+(keluar?'#b91c1c':'#text')+'">'+(keluar?formatRp(keluar):'-')+'</td>'
      +'<td style="padding:7px 6px;text-align:right;font-size:12px;font-weight:600">'+formatRp(saldo)+'</td></tr>';
  }).join('');
  
  var win=window.open('','_blank');
  win.document.write('<html><head><title>Laporan Kas</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"><style>body{font-family:"Plus Jakarta Sans",sans-serif;padding:20px;color:#1e293b}</style></head><body>'
    +'<div style="text-align:center;margin-bottom:25px"><div style="font-size:22px;font-weight:700;letter-spacing:-0.5px">LAPORAN ARUS KAS INTERNAL</div><div style="font-size:14px;color:#64748b;margin-top:4px">Periode: '+judulPeriode+'</div></div>'
    +'<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr style="background:#0f1923;color:white;text-align:left">'
    +'<th style="padding:10px 6px;font-size:12px;text-align:center;width:40px">NO</th><th style="padding:10px 6px;font-size:12px;width:90px">TANGGAL</th><th style="padding:10px 6px;font-size:12px">KETERANGAN</th><th style="padding:10px 6px;font-size:12px;width:110px">KATEGORI</th><th style="padding:10px 6px;font-size:12px;text-align:right;width:110px">MASUK</th><th style="padding:10px 6px;font-size:12px;text-align:right;width:110px">KELUAR</th><th style="padding:10px 6px;font-size:12px;text-align:right;width:120px">SALDO RUNNING</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></body></html>');
  win.document.close();
  setTimeout(function(){ win.print(); }, 500);
}

// UTILS
function formatRp(v) { return 'Rp ' + Math.round(v).toLocaleString('id-ID'); }
function escQ(s) { return (s||'').replace(/'/g, "\\'"); }
function renderPagerHTML(cur, total, size, prevCmd, nextCmd) {
  var max=Math.ceil(total/size); if(max<=1) return '';
  return '<div class="pager-row"><button class="pager-btn" '+(cur===0?'disabled':'')+' onclick="'+prevCmd+'">◀</button>'
    +'<span class="pager-info">Halaman '+(cur+1)+' dari '+max+'</span>'
    +'<button class="pager-btn" '+(cur>=max-1?'disabled':'')+' onclick="'+nextCmd+'">▶</button></div>';
}
function showToast(m,c) {
  var t=document.createElement('div'); t.className='toast '+ (c||'green'); t.textContent=m; document.body.appendChild(t);
  setTimeout(function(){ t.classList.add('show'); },10);
  setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ t.remove(); },300); },3000);
}
