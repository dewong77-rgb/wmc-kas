// WMC KAS - app.js v2.4
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
  var noFab = ['profil','kategori','pengguna','poskas','ekspor'];
  document.getElementById('fab').style.display = noFab.indexOf(name) < 0 ? 'flex' : 'none';
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
      +hapusBtn+'</div>';
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
  var r=await db.from('anggaran').delete().eq('id',id);
  if (!r.error) { await loadAnggaran(); renderAnggaranPage(); showToast('Anggaran dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

// ANGGOTA TABS
function setAnggotaTab(el, tab) {
  document.querySelectorAll('#page-anggota .filter-row .filter-chip').forEach(function(c){ c.classList.remove('active'); });
  el.classList.add('active');
  currentAnggotaTab=tab;
  ['rekap','kegiatan','data','log'].forEach(function(t){ document.getElementById('anggota-tab-'+t).style.display=t===tab?'block':'none'; });
  if (tab==='kegiatan') { kegiatanPage=0; renderKegiatanList(); }
  if (tab==='data') { anggotaPage=0; renderDataAnggota(); }
  if (tab==='log') loadLogList();
}

// PAGINATION HELPER
function renderPagerHTML(page, total, perPage, prevFn, nextFn) {
  var totalPages=Math.ceil(total/perPage);
  if (totalPages<=1) return '';
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;color:var(--text2);font-size:13px">'
    +'<button class="pager-btn" '+(page===0?'disabled':'')+' onclick="'+prevFn+'">← Sebelumnya</button>'
    +'<span>'+(page+1)+' / '+totalPages+'</span>'
    +'<button class="pager-btn" '+(page>=totalPages-1?'disabled':'')+' onclick="'+nextFn+'">Berikutnya →</button>'
    +'</div>';
}

// REKAP ANGGOTA
function renderRekapAnggota() {
  var stats={};
  allKegiatan.forEach(function(k){
    if (!k.kegiatan_peserta) return;
    var tipe=k.tipe;
    k.kegiatan_peserta.forEach(function(p){
      var aid=p.anggota_id, nama=p.anggota?p.anggota.nama:'Unknown';
      if (!stats[aid]) stats[aid]={nama:nama,total:0,fullboard:0,perjadin:0,lainnya:0,pinjam:0};
      stats[aid].total++;
      if (tipe==='fullboard') stats[aid].fullboard++;
      else if (tipe==='perjadin') stats[aid].perjadin++;
      else stats[aid].lainnya++;
      if (p.status_kehadiran==='pinjam_nama') stats[aid].pinjam++;
    });
  });
  var sorted=Object.values(stats).sort(function(a,b){ return b.total-a.total; });
  var el=document.getElementById('rekap-list');
  if (!sorted.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">Belum ada data kegiatan</div><div class="empty-sub">Tambah kegiatan dengan peserta dulu</div></div>'; return; }
  var start=rekapPage*PAGE_SIZE;
  var slice=sorted.slice(start, start+PAGE_SIZE);
  var rankClass=['rank-1','rank-2','rank-3'];
  el.innerHTML=slice.map(function(a, i){
    var gr=start+i;
    var avatarClass=gr<3?rankClass[gr]:'';
    var pinjamText=a.pinjam>0?' · <span style="color:var(--yellow)">'+a.pinjam+'x pinjam nama</span>':'';
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
      +'<div class="anggota-avatar '+avatarClass+'" style="width:38px;height:38px;border-radius:10px;font-size:15px;flex-shrink:0">'+a.nama.charAt(0).toUpperCase()+'</div>'
      +'<div><div style="font-size:14px;font-weight:700">'+a.nama+'</div>'
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
  if (!allAnggota.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Belum ada anggota</div></div>'; return; }
  var start=anggotaPage*PAGE_SIZE;
  var slice=allAnggota.slice(start, start+PAGE_SIZE);
  el.innerHTML=slice.map(function(a){
    var editBtn=isAdmin?'<button class="btn-sm btn-sm-edit" onclick="editAnggota(\''+a.id+'\',\''+escQ(a.nama)+'\',\''+escQ(a.jabatan||'')+'\',\''+escQ(a.kontak||'')+'\',\''+escQ(a.email||'')+'\',\''+escQ(a.catatan||'')+'\')">Edit</button>':'';
    var delBtn=isAdmin?'<button class="btn-sm btn-sm-del" onclick="deleteAnggota(\''+a.id+'\')">Hapus</button>':'';
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px">'
      +'<div class="anggota-avatar" style="width:38px;height:38px;border-radius:10px;font-size:15px;flex-shrink:0">'+a.nama.charAt(0).toUpperCase()+'</div>'
      +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">'+a.nama+'</div>'
      +'<div style="font-size:12px;color:var(--text2);margin-top:2px">'+(a.jabatan||'-')+(a.kontak?' · '+a.kontak:'')+'</div></div>'
      +(isAdmin?'<div style="display:flex;gap:6px;flex-shrink:0">'+editBtn+delBtn+'</div>':'')
      +'</div>';
  }).join('');
  el.innerHTML+=renderPagerHTML(anggotaPage, allAnggota.length, PAGE_SIZE, 'anggotaPage=Math.max(0,anggotaPage-1);renderDataAnggota()', 'anggotaPage=Math.min('+Math.ceil(allAnggota.length/PAGE_SIZE-1)+',anggotaPage+1);renderDataAnggota()');
}

function escQ(s){ return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function openSheetAnggota() {
  document.getElementById('anggota-sheet-title').textContent='Tambah Anggota';
  ['edit-anggota-id','anggota-nama','anggota-jabatan','anggota-kontak','anggota-email','anggota-catatan'].forEach(function(id){ document.getElementById(id).value=''; });
  openSheet('anggota');
}

function editAnggota(id, nama, jabatan, kontak, email, catatan) {
  document.getElementById('anggota-sheet-title').textContent='Edit Anggota';
  document.getElementById('edit-anggota-id').value=id;
  document.getElementById('anggota-nama').value=nama;
  document.getElementById('anggota-jabatan').value=jabatan;
  document.getElementById('anggota-kontak').value=kontak;
  document.getElementById('anggota-email').value=email;
  document.getElementById('anggota-catatan').value=catatan;
  openSheet('anggota');
}

async function submitAnggota() {
  var editId=document.getElementById('edit-anggota-id').value;
  var nama=document.getElementById('anggota-nama').value.trim();
  if (!nama) { showToast('Nama wajib diisi','red'); return; }
  var payload={
    nama:nama,
    jabatan:document.getElementById('anggota-jabatan').value.trim()||null,
    kontak:document.getElementById('anggota-kontak').value.trim()||null,
    email:document.getElementById('anggota-email').value.trim()||null,
    catatan:document.getElementById('anggota-catatan').value.trim()||null
  };
  var btn=document.getElementById('btn-submit-anggota'); btn.disabled=true; btn.textContent='Menyimpan...';
  var r=editId?await db.from('anggota').update(payload).eq('id',editId):await db.from('anggota').insert(payload);
  btn.disabled=false; btn.textContent='Simpan Anggota';
  if (!r.error) { closeSheet('anggota'); await loadAnggota(); renderDataAnggota(); renderRekapAnggota(); showToast('Anggota disimpan','green'); }
  else showToast('Gagal: '+r.error.message,'red');
}

async function deleteAnggota(id) {
  if (!confirm('Hapus anggota ini?')) return;
  var r=await db.from('anggota').delete().eq('id',id);
  if (!r.error) { await loadAnggota(); renderDataAnggota(); showToast('Anggota dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

// KEGIATAN
function renderKegiatanList() {
  var tipeClass={fullboard:'tipe-fullboard',perjadin:'tipe-perjadin',rapat:'tipe-rapat',lainnya:'tipe-lainnya'};
  var canEdit=currentProfile&&(currentProfile.role==='admin'||currentProfile.role==='bendahara');
  var el=document.getElementById('kegiatan-list');
  if (!allKegiatan.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">Belum ada kegiatan</div></div>'; return; }
  var start=kegiatanPage*PAGE_SIZE;
  var slice=allKegiatan.slice(start, start+PAGE_SIZE);
  el.innerHTML=slice.map(function(k){
    var jp=k.kegiatan_peserta?k.kegiatan_peserta.length:0;
    var jh=k.kegiatan_peserta?k.kegiatan_peserta.filter(function(p){ return p.status_kehadiran!=='pinjam_nama'; }).length:0;
    var jpin=k.kegiatan_peserta?k.kegiatan_peserta.filter(function(p){ return p.status_kehadiran==='pinjam_nama'; }).length:0;
    var tgl=new Date(k.tanggal_mulai).toLocaleDateString('id',{day:'numeric',month:'short',year:'numeric'});
    var namaList=k.kegiatan_peserta?k.kegiatan_peserta.map(function(p){
      var nm=p.anggota?p.anggota.nama:'?';
      return p.status_kehadiran==='pinjam_nama'?'<span style="color:var(--yellow)">'+nm+'*</span>':nm;
    }).join(', '):'';
    var editBtns=canEdit?'<div style="display:flex;gap:8px;margin-top:10px"><button class="btn-sm btn-sm-edit" onclick="editKegiatan(\''+k.id+'\')">Edit</button><button class="btn-sm btn-sm-del" onclick="deleteKegiatan(\''+k.id+'\')">Hapus</button></div>':'';
    var pinjamText=jpin>0?' · <span style="color:var(--yellow)">'+jpin+' pinjam nama</span>':'';
    return '<div class="kegiatan-item">'
      +'<div class="kegiatan-header"><div class="kegiatan-nama">'+k.nama+'</div><div class="kegiatan-tipe '+(tipeClass[k.tipe]||'')+'">'+k.tipe+'</div></div>'
      +'<div class="kegiatan-meta">'+tgl+' · '+k.jumlah_hari+' hari'+(k.lokasi?' · '+k.lokasi:'')+(k.bendahara?' · PIC: '+k.bendahara.nama:'')+'</div>'
      +(namaList?'<div style="font-size:11px;color:var(--text2);margin-bottom:8px;line-height:1.6">'+namaList+'</div>':'')
      +'<div class="kegiatan-footer"><span style="color:var(--text2)">'+jp+' peserta · '+jh+' hadir'+pinjamText+'</span></div>'
      +editBtns+'</div>';
  }).join('');
  el.innerHTML+=renderPagerHTML(kegiatanPage, allKegiatan.length, PAGE_SIZE, 'kegiatanPage=Math.max(0,kegiatanPage-1);renderKegiatanList()', 'kegiatanPage=Math.min('+Math.ceil(allKegiatan.length/PAGE_SIZE-1)+',kegiatanPage+1);renderKegiatanList()');
}

function openSheetKegiatan() {
  editingKegiatanId=null;
  document.getElementById('kegiatan-sheet-title').textContent='Tambah Kegiatan';
  document.getElementById('edit-kegiatan-id').value='';
  document.getElementById('kegiatan-nama').value='';
  document.getElementById('kegiatan-mulai').value=new Date().toISOString().split('T')[0];
  document.getElementById('kegiatan-selesai').value='';
  document.getElementById('kegiatan-hari').value='1';
  document.getElementById('kegiatan-lokasi').value='';
  document.getElementById('kegiatan-catatan').value='';
  currentKegiatanTipe='fullboard'; setKegiatanTipe('fullboard');
  populateBendahara(null);
  buildPesertaChecklist({});
  updatePesertaInfo();
  openSheet('kegiatan');
}

function editKegiatan(id) {
  var k=null; for(var i=0;i<allKegiatan.length;i++){ if(allKegiatan[i].id===id){ k=allKegiatan[i]; break; } }
  if (!k) return;
  editingKegiatanId=id;
  document.getElementById('kegiatan-sheet-title').textContent='Edit Kegiatan';
  document.getElementById('edit-kegiatan-id').value=id;
  document.getElementById('kegiatan-nama').value=k.nama;
  document.getElementById('kegiatan-mulai').value=k.tanggal_mulai;
  document.getElementById('kegiatan-selesai').value=k.tanggal_selesai||'';
  document.getElementById('kegiatan-hari').value=k.jumlah_hari||1;
  document.getElementById('kegiatan-lokasi').value=k.lokasi||'';
  document.getElementById('kegiatan-catatan').value=k.catatan||'';
  currentKegiatanTipe=k.tipe||'fullboard'; setKegiatanTipe(currentKegiatanTipe);
  populateBendahara(k.bendahara_id);
  var existing={};
  (k.kegiatan_peserta||[]).forEach(function(p){ existing[p.anggota_id]=p.status_kehadiran||'hadir'; });
  buildPesertaChecklist(existing);
  updatePesertaInfo();
  openSheet('kegiatan');
}

function populateBendahara(selectedId) {
  var bendSel=document.getElementById('kegiatan-bendahara');
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
      +'<div class="peserta-status-btn'+(status==='pinjam_nama'?' pinjam-active':'')+'" onclick="setPesertaStatus(\''+a.id+'\',\'pinjam_nama\')">Pinjam Nama</div>'
      +'</div></div>';
  }).join('');
}

function togglePesertaCheck(id) {
  var el=document.getElementById('pcheck-'+id);
  if (pesertaStatus[id]!==undefined) {
    delete pesertaStatus[id];
    el.style.borderColor='var(--border)'; el.style.background='transparent'; el.textContent='';
    document.getElementById('ptoggle-'+id).style.display='none';
  } else {
    pesertaStatus[id]='hadir';
    el.style.borderColor='var(--green)'; el.style.background='var(--green)'; el.textContent='✓';
    document.getElementById('ptoggle-'+id).style.display='flex';
    setPesertaStatus(id,'hadir');
  }
  updatePesertaInfo();
}

function setPesertaStatus(id, status) {
  pesertaStatus[id]=status;
  var toggle=document.getElementById('ptoggle-'+id);
  if (!toggle) return;
  var btns=toggle.querySelectorAll('.peserta-status-btn');
  btns[0].className='peserta-status-btn'+(status==='hadir'?' hadir-active':'');
  btns[1].className='peserta-status-btn'+(status==='pinjam_nama'?' pinjam-active':'');
}

function updatePesertaInfo() {
  var selected=Object.keys(pesertaStatus).length;
  var pinjam=Object.values(pesertaStatus).filter(function(s){ return s==='pinjam_nama'; }).length;
  var label=selected+' dipilih';
  if (pinjam>0) label+=' · '+pinjam+' pinjam nama';
  document.getElementById('peserta-info-label').textContent=label?'('+label+')':'';
}

function setKegiatanTipe(tipe) {
  currentKegiatanTipe=tipe;
  ['fullboard','perjadin','rapat','lainnya'].forEach(function(t){ document.getElementById('ktipe-'+t).className='tipe-btn'+(tipe===t?' active':''); });
}

async function submitKegiatan() {
  var nama=document.getElementById('kegiatan-nama').value.trim();
  var mulai=document.getElementById('kegiatan-mulai').value;
  if (!nama) { showToast('Nama kegiatan wajib diisi','red'); return; }
  if (!mulai) { showToast('Tanggal mulai wajib diisi','red'); return; }
  var pesertaIds=Object.keys(pesertaStatus);
  var hari=parseInt(document.getElementById('kegiatan-hari').value)||1;
  var payload={
    nama:nama, tipe:currentKegiatanTipe,
    tanggal_mulai:mulai,
    tanggal_selesai:document.getElementById('kegiatan-selesai').value||null,
    lokasi:document.getElementById('kegiatan-lokasi').value.trim()||null,
    jumlah_hari:hari, iuran_per_hari:0,
    bendahara_id:document.getElementById('kegiatan-bendahara').value||null,
    catatan:document.getElementById('kegiatan-catatan').value.trim()||null,
    status:'selesai'
  };
  var btn=document.getElementById('btn-submit-kegiatan'); btn.disabled=true; btn.textContent='Menyimpan...';
  var kegiatanId=editingKegiatanId;
  if (editingKegiatanId) {
    var ru=await db.from('kegiatan').update(payload).eq('id',editingKegiatanId);
    if (ru.error) { showToast('Gagal: '+ru.error.message,'red'); btn.disabled=false; btn.textContent='Simpan Kegiatan'; return; }
    await db.from('kegiatan_peserta').delete().eq('kegiatan_id',editingKegiatanId);
  } else {
    var ri=await db.from('kegiatan').insert(payload).select().single();
    if (ri.error) { showToast('Gagal: '+ri.error.message,'red'); btn.disabled=false; btn.textContent='Simpan Kegiatan'; return; }
    kegiatanId=ri.data.id;
  }
  if (pesertaIds.length&&kegiatanId) {
    var pesertaList=pesertaIds.map(function(aid){
      return {kegiatan_id:kegiatanId, anggota_id:aid, jumlah_hari:hari, nominal_iuran:0, sudah_bayar:false, status_kehadiran:pesertaStatus[aid]||'hadir'};
    });
    await db.from('kegiatan_peserta').insert(pesertaList);
  }
  btn.disabled=false; btn.textContent='Simpan Kegiatan';
  closeSheet('kegiatan');
  showToast(editingKegiatanId?'Kegiatan diperbarui':'Kegiatan disimpan','green');
  loadKegiatan();
}

async function deleteKegiatan(id) {
  if (!confirm('Hapus kegiatan ini?')) return;
  await db.from('kegiatan_peserta').delete().eq('kegiatan_id',id);
  var r=await db.from('kegiatan').delete().eq('id',id);
  if (!r.error) { loadKegiatan(); showToast('Kegiatan dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

// LOG LOGIN
async function loadLogList() {
  if (!currentProfile||currentProfile.role!=='admin') {
    document.getElementById('log-list').innerHTML='<div class="empty-state"><div class="empty-icon">🔐</div><div class="empty-text">Hanya admin yang bisa melihat log ini</div></div>';
    return;
  }
  var r=await db.from('log_login').select('*').order('login_at',{ascending:false}).limit(50);
  var logs=r.data||[];
  var roleColor={admin:'var(--accent)',bendahara:'var(--green)',input_only:'var(--yellow)',viewer:'var(--text3)'};
  var roleLabel={admin:'Admin',bendahara:'Bendahara',input_only:'Input',viewer:'Viewer'};
  document.getElementById('log-list').innerHTML=logs.length?logs.map(function(l){
    var tgl=new Date(l.login_at).toLocaleDateString('id',{day:'numeric',month:'short',year:'numeric'});
    var jam=new Date(l.login_at).toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'});
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">'
      +'<div style="width:32px;height:32px;border-radius:8px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:var(--accent);flex-shrink:0">'+(l.user_nama||'?').charAt(0).toUpperCase()+'</div>'
      +'<div style="flex:1"><div style="font-size:14px;font-weight:600">'+(l.user_nama||'-')+'</div><div style="font-size:11px;color:var(--text3);margin-top:2px">'+tgl+' · '+jam+'</div></div>'
      +'<div style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:10px;background:'+(l.user_role==='admin'?'var(--accent-dim)':l.user_role==='bendahara'?'var(--green-dim)':'var(--bg2)')+';color:'+(roleColor[l.user_role]||'var(--text3)')+'">'+( roleLabel[l.user_role]||l.user_role||'-')+'</div>'
      +'</div>';
  }).join(''):'<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Belum ada log login</div></div>';
}

// EKSPOR PDF
function setPeriod(p) {
  currentPeriod=p;
  document.getElementById('period-bulan').className='period-btn'+(p==='bulan'?' active':'');
  document.getElementById('period-semua').className='period-btn'+(p==='semua'?' active':'');
  document.getElementById('period-bulan-form').style.display=p==='bulan'?'block':'none';
}

function eksporPDF() {
  var data=allTrx, judulPeriode='Semua Periode';
  if (currentPeriod==='bulan') {
    var bulan=parseInt(document.getElementById('ekspor-bulan').value);
    var tahun=parseInt(document.getElementById('ekspor-tahun').value);
    data=allTrx.filter(function(t){ var d=new Date(t.tanggal); return d.getMonth()===bulan&&d.getFullYear()===tahun; });
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
      +'<td style="padding:7px 6px;text-align:right;font-size:12px;color:'+(masuk?'#15803d':'#9ca3af')+'">'+(masuk?'Rp '+masuk.toLocaleString('id-ID'):'-')+'</td>'
      +'<td style="padding:7px 6px;text-align:right;font-size:12px;color:'+(keluar?'#dc2626':'#9ca3af')+'">'+(keluar?'Rp '+keluar.toLocaleString('id-ID'):'-')+'</td>'
      +'<td style="padding:7px 6px;text-align:right;font-size:12px;font-weight:600;color:'+(saldo>=0?'#1e40af':'#dc2626')+'">Rp '+Math.abs(saldo).toLocaleString('id-ID')+'</td>'
      +'</tr>';
  });
  var tM=sorted.reduce(function(s,t){ return t.jenis==='masuk'?s+t.nominal:s; },0);
  var tK=sorted.reduce(function(s,t){ return t.jenis==='keluar'?s+t.nominal:s; },0);
  var sA=tM-tK;
  var tglC=new Date().toLocaleDateString('id',{day:'numeric',month:'long',year:'numeric'});
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Buku Kas WMC</title>'
    +'<style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#111}'
    +'.header{text-align:center;margin-bottom:24px;border-bottom:2px solid #1e40af;padding-bottom:16px}'
    +'.logo{font-size:22px;font-weight:800;color:#1e40af}'
    +'table{width:100%;border-collapse:collapse;margin-bottom:24px}'
    +'th{background:#1e40af;color:white;padding:10px 6px;font-size:12px;text-align:left}'
    +'th:nth-child(5),th:nth-child(6),th:nth-child(7){text-align:right}'
    +'.summary{display:flex;gap:16px}'
    +'.sum-box{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}'
    +'.sum-label{font-size:11px;color:#6b7280;margin-bottom:4px}'
    +'.sum-val{font-size:16px;font-weight:800}'
    +'.footer{margin-top:24px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}'
    +'</style></head><body>'
    +'<div class="header"><div class="logo">PT WIDYA MANDALA CENDEKIA</div>'
    +'<div style="font-size:13px;color:#6b7280">Laporan Buku Kas · '+judulPeriode+'</div>'
    +'<div style="font-size:12px;color:#9ca3af">Dicetak: '+tglC+'</div></div>'
    +'<table><thead><tr><th>No</th><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr></thead>'
    +'<tbody>'+rows.join('')+'</tbody></table>'
    +'<div class="summary">'
    +'<div class="sum-box"><div class="sum-label">Total Masuk</div><div class="sum-val" style="color:#15803d">Rp '+tM.toLocaleString('id-ID')+'</div></div>'
    +'<div class="sum-box"><div class="sum-label">Total Keluar</div><div class="sum-val" style="color:#dc2626">Rp '+tK.toLocaleString('id-ID')+'</div></div>'
    +'<div class="sum-box"><div class="sum-label">Saldo Akhir</div><div class="sum-val" style="color:'+(sA>=0?'#1e40af':'#dc2626')+'">Rp '+Math.abs(sA).toLocaleString('id-ID')+'</div></div>'
    +'</div>'
    +'<div class="footer">WMC Kas v2.4 · PT Widya Mandala Cendekia · '+sorted.length+' transaksi</div>'
    +'</body></html>';
  var win=window.open('','_blank'); win.document.write(html); win.document.close(); win.onload=function(){ win.print(); };
  showToast('Membuka preview PDF...','green');
}

// PENGGUNA
async function loadUsers() {
  var r=await db.from('profiles').select('*').order('created_at');
  var users=r.data||[];
  var roleColor={admin:'var(--accent)',bendahara:'var(--green)',input_only:'var(--yellow)',viewer:'var(--text3)'};
  var roleLabel={admin:'Admin',bendahara:'Bendahara',input_only:'Input Only',viewer:'Viewer'};
  document.getElementById('user-list').innerHTML=users.length?users.map(function(u){
    return '<div class="admin-item">'
      +'<div class="admin-item-icon">'+u.nama.charAt(0).toUpperCase()+'</div>'
      +'<div class="admin-item-info"><div class="admin-item-name">'+u.nama+'</div><div class="admin-item-sub">'+u.email+'</div>'
      +'<div style="font-size:11px;font-weight:700;color:'+(roleColor[u.role]||'var(--text2)')+';margin-top:3px">'+(roleLabel[u.role]||u.role)+'</div></div>'
      +'<div class="admin-item-actions">'
      +'<button class="btn-sm btn-sm-edit" onclick="editUser(\''+u.id+'\',\''+escQ(u.nama)+'\',\''+u.email+'\',\''+u.role+'\')">Edit</button>'
      +(u.id!==currentUser.id?'<button class="btn-sm btn-sm-del" onclick="deleteUser(\''+u.id+'\')">Hapus</button>':'')
      +'</div></div>';
  }).join(''):'<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Belum ada pengguna</div></div>';
}

function openSheetUser() {
  document.getElementById('user-sheet-title').textContent='Tambah Pengguna';
  ['edit-user-id','user-nama','user-email','user-pass'].forEach(function(id){ document.getElementById(id).value=''; });
  document.getElementById('user-role').value='viewer';
  document.getElementById('user-email').disabled=false;
  openSheet('user');
}

function editUser(id, nama, email, role) {
  document.getElementById('user-sheet-title').textContent='Edit Pengguna';
  document.getElementById('edit-user-id').value=id;
  document.getElementById('user-nama').value=nama;
  document.getElementById('user-email').value=email;
  document.getElementById('user-email').disabled=true;
  document.getElementById('user-pass').value='';
  document.getElementById('user-role').value=role;
  openSheet('user');
}

async function submitUser() {
  var editId=document.getElementById('edit-user-id').value;
  var nama=document.getElementById('user-nama').value.trim();
  var role=document.getElementById('user-role').value;
  if (!nama) { showToast('Nama wajib diisi','red'); return; }
  var btn=document.getElementById('btn-submit-user'); btn.disabled=true; btn.textContent='Menyimpan...';
  if (!editId) { showToast('Buat akun lewat Supabase Dashboard, lalu edit role di sini','yellow'); btn.disabled=false; btn.textContent='Simpan Pengguna'; closeSheet('user'); return; }
  var r=await db.from('profiles').update({nama:nama,role:role}).eq('id',editId);
  btn.disabled=false; btn.textContent='Simpan Pengguna';
  if (!r.error) { closeSheet('user'); loadUsers(); showToast('Pengguna diperbarui','green'); }
  else showToast('Gagal: '+r.error.message,'red');
}

async function deleteUser(id) {
  if (!confirm('Hapus pengguna ini?')) return;
  var r=await db.from('profiles').delete().eq('id',id);
  if (!r.error) { loadUsers(); showToast('Pengguna dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

// KATEGORI
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
  document.getElementById('kat-masuk-list').innerHTML=masuk.map(katItem).join('')||'<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada</div>';
  document.getElementById('kat-keluar-list').innerHTML=keluar.map(katItem).join('')||'<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada</div>';
}

function openSheetKat(jenis) { document.getElementById('kat-sheet-title').textContent='Tambah Kategori'; document.getElementById('edit-kat-id').value=''; document.getElementById('kat-nama').value=''; currentKatJenis=jenis||'masuk'; selectedColor='#22d172'; setKatJenis(currentKatJenis); buildColorGrid(); openSheet('kat'); }
function editKat(id, nama, jenis, warna) { document.getElementById('kat-sheet-title').textContent='Edit Kategori'; document.getElementById('edit-kat-id').value=id; document.getElementById('kat-nama').value=nama; currentKatJenis=jenis; selectedColor=warna; setKatJenis(jenis); buildColorGrid(); openSheet('kat'); }
function setKatJenis(jenis) { currentKatJenis=jenis; document.getElementById('kat-jenis-masuk').className='jenis-btn'+(jenis==='masuk'?' active masuk':''); document.getElementById('kat-jenis-keluar').className='jenis-btn'+(jenis==='keluar'?' active keluar':''); }
function buildColorGrid() { var el=document.getElementById('color-grid'); if(!el)return; el.innerHTML=COLORS.map(function(c){ return '<div class="color-dot'+(selectedColor===c?' selected':'')+'" style="background:'+c+'" onclick="selectColor(\''+c+'\')"></div>'; }).join(''); }
function selectColor(c) { selectedColor=c; buildColorGrid(); }

async function submitKat() {
  var editId=document.getElementById('edit-kat-id').value;
  var nama=document.getElementById('kat-nama').value.trim();
  if (!nama) { showToast('Nama wajib diisi','red'); return; }
  var btn=document.getElementById('btn-submit-kat'); btn.disabled=true; btn.textContent='Menyimpan...';
  var payload={nama:nama,jenis:currentKatJenis,warna:selectedColor};
  var r=editId?await db.from('kategori').update(payload).eq('id',editId):await db.from('kategori').insert(Object.assign(payload,{aktif:true,urutan:99}));
  btn.disabled=false; btn.textContent='Simpan Kategori';
  if (!r.error) { closeSheet('kat'); await loadKategori(); renderKategoriPage(); showToast('Kategori disimpan','green'); }
  else showToast('Gagal: '+r.error.message,'red');
}

async function deleteKat(id) {
  if (!confirm('Hapus kategori ini?')) return;
  var r=await db.from('kategori').update({aktif:false}).eq('id',id);
  if (!r.error) { await loadKategori(); renderKategoriPage(); showToast('Kategori dihapus','green'); }
  else showToast('Gagal menghapus','red');
}

// POSISI KAS
async function loadPosKasPage() {
  await loadKas();
  var icons={tunai:'💵',bank:'🏦',ewallet:'📱'};
  document.getElementById('poskas-list').innerHTML=allKas.length?allKas.map(function(k){
    return '<div class="admin-item">'
      +'<div class="admin-item-icon">'+(icons[k.tipe]||'💰')+'</div>'
      +'<div class="admin-item-info"><div class="admin-item-name">'+k.nama+'</div>'
      +'<div class="admin-item-sub">'+k.tipe.toUpperCase()+(k.nomor_rekening?' · '+k.nomor_rekening:'')+'</div></div>'
      +'<div class="admin-item-actions">'
      +'<button class="btn-sm btn-sm-edit" onclick="editKas(\''+k.id+'\',\''+escQ(k.nama)+'\',\''+k.tipe+'\',\''+escQ(k.nomor_rekening||'')+'\')">Edit</button>'
      +'<button class="btn-sm btn-sm-del" onclick="deletePosKas(\''+k.id+'\')">Hapus</button>'
      +'</div></div>';
  }).join(''):'<div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-text">Belum ada posisi kas</div></div>';
}

function openSheetKas() { document.getElementById('kas-sheet-title').textContent='Tambah Posisi Kas'; document.getElementById('edit-kas-id').value=''; document.getElementById('kas-nama').value=''; document.getElementById('kas-norek').value=''; currentKasTipe='tunai'; setKasTipe('tunai'); openSheet('kas'); }
function editKas(id, nama, tipe, norek) { document.getElementById('kas-sheet-title').textContent='Edit Posisi Kas'; document.getElementById('edit-kas-id').value=id; document.getElementById('kas-nama').value=nama; document.getElementById('kas-norek').value=norek; currentKasTipe=tipe; setKasTipe(tipe); openSheet('kas'); }
function setKasTipe(tipe) { currentKasTipe=tipe; ['tunai','bank','ewallet'].forEach(function(t){ document.getElementById('kas-tipe-'+t).className='tipe-btn'+(tipe===t?' active':''); }); }

async function submitKas() {
  var editId=document.getElementById('edit-kas-id').value;
  var nama=document.getElementById('kas-nama').value.trim();
  var norek=document.getElementById('kas-norek').value.trim();
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
function formatRp(num) { if(!num) return 'Rp 0'; return 'Rp '+Math.abs(Math.round(num)).toLocaleString('id-ID'); }
function showToast(msg, type) { type=type||''; var t=document.getElementById('toast'); t.textContent=msg; t.className='toast show '+type; setTimeout(function(){ t.className='toast'; }, 3000); }
