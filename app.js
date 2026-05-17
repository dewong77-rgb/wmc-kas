// WMC KAS - app.js v2.4 (Optimized Version)
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
  // Perbaikan Validasi: Mencegah crash jika URL masih berupa placeholder bawaan
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
  var s = await db.auth.getSession();
  if (s.data.session) { await loadProfile(s.data.session.user); showApp(); }
  db.auth.onAuthStateChange(async function(event, session) {
    if (event === 'SIGNED_IN' && session) { await loadProfile(session.user); showApp(); }
    else if (event === 'SIGNED_OUT') { showAuth(); }
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
function showAuthError(msg) { var el = document.getElementById('auth-error'); el.textContent = msg; el.style.display = 'block'; }
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
  db.from('log_login').insert({ user_id: currentUser.id, user_nama: currentProfile.nama, user_role: currentProfile.role, user_agent: navigator.userAgent.substring(0,200) });
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  if (currentProfile) document.getElementById('header-user').textContent = currentProfile.nama;
  updateProfilePage();
  loadAll();
  goPage('dashboard'); // Perbaikan: Memaksa inisialisasi halaman utama dan tombol FAB saat masuk aplikasi
}
function showAuth() { document.getElementById('auth-screen').style.display = 'flex'; document.getElementById('app').style.display = 'none'; }

function updateProfilePage() {
  if (!currentProfile) return;
  document.getElementById('profile-avatar').textContent = currentProfile.nama.charAt(0).toUpperCase();
  document.getElementById('profile-name').textContent = currentProfile.nama;
  var roles = { admin:'Admin', bendahara:'Bendahara', input_only:'Input Only', viewer:'Viewer' };
  document.getElementById('profile-role').textContent = roles[currentProfile.role] || currentProfile.role;
  var isAdmin = currentProfile.role === 'admin';
  var canEdit = isAdmin || currentProfile.role === 'bendahara';
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
  if (navMap[name] !== undefined) document.querySelectorAll('.nav-item')[navMap[name]].classList.add('active');
  
  // Perbaikan Logika Tampilan FAB berdasarkan Halaman dan Hak Akses Role
  var noFab = ['profil','kategori','pengguna','poskas','ekspor'];
  var canInput = currentProfile && ['admin', 'bendahara', 'input_only'].indexOf(currentProfile.role) >= 0;
  
  if (noFab.indexOf(name) < 0 && canInput) {
    document.getElementById('fab').style.display = 'flex';
  } else {
    document.getElementById('fab').style.display = 'none';
  }
  
  var titles = { dashboard:'WMC Kas', transaksi:'Transaksi', anggaran:'Anggaran', anggota:'Anggota & Kegiatan', profil:'Profil', pengguna:'Pengguna', kategori:'Kategori', poskas:'Posisi Kas', ekspor:'Ekspor Laporan' };
  document.getElementById('header-title').textContent = titles[name] || 'WMC Kas';
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
  await Promise.all([loadKategori(), loadKas(), loadTrx(), loadAnggota(), loadAnggaran()]);
  renderDashboard(); renderTrxList(); populateKasSelect();
  loadKegiatan();
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
  document.getElementById('saldo-total').textContent = formatRp(saldo);
  document.getElementById('saldo-total').style.color = saldo>=0?'white':'var(--red)';
  var now=new Date(), masukBulan=0, keluarBulan=0, countBulan=0;
  allTrx.forEach(function(t){
    var d=new Date(t.tanggal);
    if (d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()) {
      countBulan++; if(t.jenis==='masuk') masukBulan+=t.nominal; else keluarBulan+=t.nominal;
    }
  });
  var net = masukBulan-keluarBulan;
  document.getElementById('masuk-bulan').textContent = formatRp(masukBulan);
  document.getElementById('keluar-bulan').textContent = formatRp(keluarBulan);
  document.getElementById('net-bulan').textContent = formatRp(net);
  document.getElementById('net-bulan').style.color = net>=0?'var(--green)':'var(--red)';
  document.getElementById('trx-count').textContent = allTrx.length+' transaksi';
  renderPieChart(totalMasuk, totalKeluar);
  renderTopKategori();
  renderKasBreakdown();
  var recent = allTrx.slice(0,5);
  document.getElementById('trx-recent').innerHTML = recent.length ? recent.map(trxHTML).join('') : '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada transaksi</div></div>';
}

function renderPieChart(totalMasuk, totalKeluar) {
  var total=totalMasuk+totalKeluar;
  if (!total) { document.getElementById('pie-svg').innerHTML='<circle cx="55" cy="55" r="38" fill="none" stroke="#2a3f55" stroke-width="16"/>'; document.getElementById('pie-legend').innerHTML='<div style="color:var(--text3);font-size:13px">Belum ada data</div>'; return; }
  var pM=totalMasuk/total, pK=totalKeluar/total, r=38, cx=55, cy=55, sw=16, circ=2*Math.PI*r;
  document.getElementById('pie-svg').innerHTML =
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#22d172" stroke-width="'+sw+'" stroke-dasharray="'+(pM*circ)+' '+circ+'" stroke-dashoffset="'+(circ*0.25)+'" transform="rotate(-90 '+cx+' '+cy+')" />'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#ff5f5f" stroke-width="'+sw+'" stroke-dasharray="'+(pK*circ)+' '+circ+'" stroke-dashoffset="'+(-(pM*circ)+circ*0.25)+'" transform="rotate(-90 '+cx+' '+cy+')" />'
    +'<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" fill="#e8eef5" font-size="11" font-family="Plus Jakarta Sans" font-weight="700">'+Math.round(pM*100)+'%</text>'
    +'<text x="'+cx+'" y="'+(cy+10)+'" text-anchor="middle" fill="#8fa3b8" font-size="9" font-family="Plus Jakarta Sans">Masuk</text>';
  document.getElementById('pie-legend').innerHTML =
    '<div class="pie-leg-item"><div class="pie-leg-dot" style="background:var(--green)"></div><div class="pie-leg-label">Pemasukan</div><div><span class="pie-leg-val" style="color:var(--green)">'+formatRp(totalMasuk)+'</span><span class="pie-leg-pct">'+Math.round(pM*100)+'%</span></div></div>'
    +'<div class="pie-leg-item"><div class="pie-leg-dot" style="background:var(--red)"></div><div class="pie-leg-label">Pengeluaran</div><div><span class="pie-leg-val" style="color:var(--red)">'+formatRp(totalKeluar)+'</span><span class="pie-leg-pct">'+Math.round(pK*100)+'%</span></div></div>'
    +'<div class="pie-leg-item" style="border-top:1px solid var(--border);padding-top:10px"><div class="pie-leg-dot" style="background:var(--accent)"></div><div class="pie-leg-label">Saldo Bersih</div><div><span class="pie-leg-val" style="color:'+(totalMasuk>=totalKeluar?'var(--green)':'var(--red)')+'">'+formatRp(totalMasuk-totalKeluar)+'</span></div></div>';
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
    if (!sorted.length) { document.getElementById(elId).innerHTML='<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada transaksi bulan ini</div>'; return; }
    var maxVal=sorted[0].total;
    document.getElementById(elId).innerHTML=sorted.map(function(k,i){
      return '<div class="top-kat-item"><div class="top-kat-rank">'+(i+1)+'</div><div class="top-kat-info"><div class="top-kat-name">'+k.nama+'</div><div class="top-kat-bar-wrap"><div class="top-kat-bar" style="width:'+Math.round((k.total/maxVal)*100)+'%;background:'+k.warna+'"></div></div></div><div class="top-kat-val" style="color:'+k.warna+'">'+formatRp(k.total)+'</div></div>';
    }).join('');
  }
  topKat('masuk','top-masuk'); topKat('keluar','top-keluar');
}

function renderKasBreakdown() {
  if (!allKas.length) { document.getElementById('kas-breakdown').innerHTML='<div style="color:var(--text3);font-size:13px">Tidak ada data kas</div>'; return; }
  var icons={tunai:'💵',bank:'🏦',ewallet:'📱'};
  document.getElementById('kas-breakdown').innerHTML=allKas.map(function(k){
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
  document.getElementById('trx-all').innerHTML=filtered.length?filtered.map(trxHTML).join(''):'<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Tidak ada transaksi</div></div>';
}

function setFilter(el,val) { document.querySelectorAll('.filter-chip').forEach(function(c){ c.classList.remove('active'); }); el.classList.add('active'); activeFilter=val; renderTrxList(document.getElementById('trx-search').value); }

function openDetail(id) {
  var t=null; for(var i=0;i<allTrx.length;i++){ if(allTrx[i].id===id){ t=allTrx[i]; break; } }
  if (!t) return;
  var tgl=new Date(t.tanggal).toLocaleDateString('id',{day:'numeric',month:'long',year:'numeric'});
  var sc={lunas:'green',pending:'yellow',batal:'red'};
  document.getElementById('detail-title').textContent=t.jenis==='masuk'?'Uang Masuk':'Uang Keluar';
  document.getElementById('detail-content').innerHTML=
    '<div class="detail-row"><div class="detail-key">Nominal</div><div class="detail-val" style="font-family:var(--mono);font-size:20px;color:'+(t.jenis==='masuk'?'var(--green)':'var(--red)')+'">'+(t.jenis==='masuk'?'+':'-')+formatRp(t.nominal)+'</div></div>'
    +'<div class="detail-row"><div class="detail-key">Tanggal</div><div class="detail-val">'+tgl+'</div></div>'
    +'<div class="detail-row"><div class="detail-key">Kategori</div><div class="detail-val">'+(t.kategori?t.kategori.nama:'-')+'</div></div>'
    +'<div class="detail-row"><div class="detail-key">Posisi Kas</div><div class="detail-val">'+(t.posisi_kas?t.posisi_kas.nama:'-')+'</div></div>'
    +'<div class="detail-row"><div class="detail-key">Status</div><div class="detail-val"><span class="badge '+(sc[t.status]||'green')+'">'+t.status+'</span></div></div>'
    +'<div class="detail-row"><div class="detail-key">Keterangan</div><div class="detail-val">'+(t.keterangan||'-')+'</div></div>';
  var buktiWrap=document.getElementById('detail-bukti-wrap'), buktiImg=document.getElementById('detail-bukti-img'), delBuktiBtn=document.getElementById('btn-del-bukti');
  if (t.bukti_url) { buktiWrap.style.display='block'; buktiImg.src=t.bukti_url; delBuktiBtn.style.display=currentProfile&&currentProfile.role==='admin'?'block':'none'; delBuktiBtn.onclick=function(){ deleteBukti(t.id,t.bukti_url); }; }
  else { buktiWrap.style.display='none'; }
  var canEdit=currentProfile&&(currentProfile.role==='admin'||currentProfile.role==='bendahara');
  var canDel=currentProfile&&currentProfile.role==='admin';
  var eb=document.getElementById('btn-edit-trx'), db2=document.getElementById('btn-delete-trx');
  eb.style.display=canEdit?'block':'none'; db2.style.display=canDel?'block':'none';
  eb.onclick=function(){ closeSheet('detail'); openEditTrx(id); }; db2.onclick=function(){ deleteTrx(id); };
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
  document.getElementById('trx-sheet-title').textContent='Edit Transaksi';
  document.getElementById('edit-trx-id').value=id;
  setJenis(t.jenis);
  document.getElementById('trx-nominal-display').value=parseInt(t.nominal).toLocaleString('id-ID');
  document.getElementById('trx-nominal-raw').value=t.nominal;
  document.getElementById('trx-tanggal').value=t.tanggal;
  document.getElementById('trx-status').value=t.status;
  document.getElementById('trx-ket').value=t.keterangan||'';
  selectedKatId=t.kategori_id; renderKatGrid(); populateKasSelect();
  document.getElementById('trx-kas').value=t.posisi_kas_id||'';
  var curWrap=document.getElementById('current-bukti-wrap');
  if (t.bukti_url) { curWrap.style.display='block'; document.getElementById('current-bukti-img').src=t.bukti_url; } else { curWrap.style.display='none'; }
  pendingBuktiFile=null;
  document.getElementById('bukti-preview').style.display='none';
  document.getElementById('bukti-filename').style.display='none';
  document.getElementById('bukti-error').style.display='none';
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
  errEl.style.display='none'; fnEl.style.display='none'; prevEl.style.display='none';
  if (!input.files||!input.files[0]) return;
  var file=input.files[0];
  if (file.size>MAX_BUKTI_SIZE) { errEl.textContent='File terlalu besar. Maks 200KB. Ukuran: '+Math.round(file.size/1024)+'KB'; errEl.style.display='block'; input.value=''; pendingBuktiFile=null; return; }
  pendingBuktiFile=file;
  fnEl.textContent=file.name+' ('+Math.round(file.size/1024)+'KB)'; fnEl.style.display='block';
  if (file.type.startsWith('image/')) { var reader=new FileReader(); reader.onload=function(e){ prevEl.src=e.target.result; prevEl.style.display='block'; }; reader.readAsDataURL(file); }
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
      document.getElementById('trx-sheet-title').textContent='Transaksi Baru';
      document.getElementById('edit-trx-id').value='';
      document.getElementById('trx-nominal-display').value='';
      document.getElementById('trx-nominal-raw').value='';
      document.getElementById('trx-ket').value='';
      document.getElementById('trx-status').value='lunas';
      document.getElementById('trx-tanggal').value=new Date().toISOString().split('T')[0];
      document.getElementById('bukti-preview').style.display='none';
      document.getElementById('bukti-filename').style.display='none';
      document.getElementById('bukti-error').style.display='none';
      document.getElementById('current-bukti-wrap').style.display='none';
      document.getElementById('bukti-file').value='';
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
  document.getElementById('jenis-masuk').className='jenis-btn'+(jenis==='masuk'?' active masuk':'');
  document.getElementById('jenis-keluar').className='jenis-btn'+(jenis==='keluar'?' active keluar':'');
  document.getElementById('btn-submit-trx').className='btn-submit '+(jenis==='masuk'?'green':'red');
  if (!editingTrxId) selectedKatId=null;
  renderKatGrid();
}

function renderKatGrid() {
  var filtered=allKategori.filter(function(k){ return k.jenis===currentJenis; });
  document.getElementById('kat-grid').innerHTML=filtered.length?filtered.map(function(k){
    return '<div class="kat-chip'+(selectedKatId===k.id?' selected':'')+'" onclick="selectKat(\''+k.id+'\')">'+k.nama+'</div>';
  }).join(''):'<div style="color:var(--text3);font-size:12px;padding:8px 0;grid-column:span 3">Belum ada kategori.</div>';
}
function selectKat(id) { selectedKatId=id; renderKatGrid(); }
function populateKasSelect() { document.getElementById('trx-kas').innerHTML='<option value="">Pilih posisi kas...</option>'+allKas.map(function(k){ return '<option value="'+k.id+'">'+k.nama+'</option>'; }).join(''); }

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
  var btn=document.getElementById('btn-submit-trx'); btn.disabled=true; btn.textContent='Menyimpan...';
  var payload={jenis:currentJenis,nominal:nominal,tanggal:tanggal,posisi_kas_id:kasId,kategori_id:selectedKatId,keterangan:ket,status:status};
  var r, trxId;
  if (editId) { r=await db.from('transaksi').update(payload).eq('id',editId).select().single(); trxId=editId; }
  else { payload.input_oleh=currentUser.id; r=await db.from('transaksi').insert(payload).select().single(); trxId=r.data?r.data.id:null; }
  if (r.error) { showToast('Gagal: '+r.error.message,'red'); btn.disabled=false; btn.textContent='Simpan Transaksi'; return; }
  if (pendingBuktiFile&&trxId) { btn.textContent='Upload bukti...'; var buktiUrl=await uploadBukti(trxId); if(buktiUrl) await db.from('transaksi').update({bukti_url:buktiUrl}).eq('id',trxId); }
  btn.disabled=false; btn.textContent='Simpan Transaksi'; pendingBuktiFile=null;
  closeSheet('trx'); await loadTrx(); renderDashboard(); renderTrxList();
  showToast(editId?'Transaksi diperbarui':'Transaksi tersimpan','green');
}

// ANGGARAN
function renderAnggaranPage() {
  var years={};
  allAnggaran.forEach(function(a){ years[a.tahun]=true; });
  var yearList=Object.keys(years).sort(function(a,b){ return b-a; });
  var fr=document.getElementById('anggaran-filter-row');
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
  var filtered=filter==='semua'?allAnggaran:allAnggaran.filter(function(a){ return String(a.tahun)===String(filter); });
  if (!filtered.length) { document.getElementById('anggaran-list').innerHTML='<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">Belum ada anggaran</div></div>'; return; }
  document.getElementById('anggaran-list').innerHTML=filtered.map(function(a){
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
      +'hapusBtn'+'</div>';
  }).join('');
}

function openSheetAnggaran() {
  document.getElementById('anggaran-sheet-title').textContent='Tambah Anggaran';
  document.getElementById('edit-anggaran-id').value='';
  document.getElementById('anggaran-nama').value='';
  document.getElementById('anggaran-nominal-display').value='';
  document.getElementById('anggaran-nominal-raw').value='';
  document.getElementById('anggaran-catatan').value='';
  var sel=document.getElementById('anggaran-kat');
  sel.innerHTML='<option value="">Semua kategori (keluar)</option>'
    +allKategori.filter(function(k){ return k.jenis==='keluar'; }).map(function(k){ return '<option value="'+k.id+'">'+k.nama+'</option>'; }).join('');
  document.getElementById('anggaran-bulan').value=new Date().getMonth()+1;
  openSheet('anggaran');
}

async function submitAnggaran() {
  var nama=document.getElementById('anggaran-nama').value.trim();
  var nominal=parseFloat(document.getElementById('anggaran-nominal-raw').value);
  var bulan=parseInt(document.getElementById('anggaran-bulan').value);
  var tahun=parseInt(document.getElementById('anggaran-tahun').value);
  var katId=document.getElementById('anggaran-kat').value||null;
  var catatan=document.getElementById('anggaran-catatan').value.trim();
  if (!nama) { showToast('Nama anggaran wajib diisi','red'); return; }
  if (!nominal||nominal<=0) { showToast('Target nominal wajib diisi','red'); return; }
  var btn=document.getElementById('btn-submit-anggaran'); btn.disabled=true; btn.textContent='Menyimpan...';
  var r=await db.from('anggaran').insert({nama:nama,kategori_id:katId,nominal_target:nominal,bulan:bulan,tahun:tahun,catatan:catatan,created_by:currentUser.id});
  btn.disabled=false; btn.textContent='Simpan Anggaran';
  if (!r.error) { closeSheet('anggaran'); await loadAnggaran(); renderAnggaranPage(); showToast('Anggaran disimpan','green'); }
  else showToast('Gagal: '+r.error.message,'red');
}

async function deleteAnggaran(id) {
  if (!confirm('Hapus anggaran ini?')) return;
  var r = await db.from('anggaran').delete().eq('id', id);
  if (!r.error) { await loadAnggaran(); renderAnggaranPage(); showToast('Anggaran dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

async function submitKas() {
  var editId=document.getElementById('edit-kas-id').value;
  var nama=document.getElementById('kas-nama').value.trim();
  var norek=document.getElementById('kas-norek') ? document.getElementById('kas-norek').value.trim() : null;
  if (!nama) { showToast('Nama wajib diisi','red'); return; }
  var btn=document.getElementById('btn-submit-kas'); btn.disabled=true; btn.textContent='Menyimpan...';
  var payload={nama:nama,tipe:currentKasTipe,nomor_rekening:norek||null};
  var r=editId?await db.from('posisi_kas').update(payload).eq('id',editId):await db.from('posisi_kas').insert(Object.assign(payload,{aktif:true,urutan:99}));
  btn.disabled=false; btn.textContent='Simpan Posisi Kas';
  if (!r.error) { closeSheet('kas'); await loadKas(); loadPosKasPage(); populateKasSelect(); renderKasBreakdown(); showToast('Posisi kas disimpan','green'); }
  else showToast('Gagal: '+r.error.message,'red');
}

async function deletePosKas(id) {
  if (!confirm('Hapus posisi kas ini?')) return;
  var r=await db.from('posisi_kas').update({aktif:false}).eq('id',id);
  if (!r.error) { await loadKas(); loadPosKasPage(); showToast('Posisi kas dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

// UTILS
function formatRp(num) {
  return 'Rp ' + (num || 0).toLocaleString('id-ID');
}

function showToast(msg, type) {
  var toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'green');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 50);
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

function buildColorGrid() {
  var grid = document.getElementById('color-grid');
  if (!grid) return;
  grid.innerHTML = COLORS.map(function(c) {
    return '<div class="color-dot'+(selectedColor===c?' selected':'')+'" style="background:'+c+'" onclick="selectColor(this,\''+c+'\')"></div>';
  }).join('');
}

function selectColor(el, color) {
  document.querySelectorAll('.color-dot').forEach(function(d){ d.classList.remove('selected'); });
  el.classList.add('selected');
  selectedColor = color;
}
