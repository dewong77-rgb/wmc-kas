// WMC KAS - app.js v2.4 (Perbaikan Navigasi & Toleransi Role)
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
  if (typeof supabase === 'undefined') {
    showToast('Library Supabase tidak terload!', 'red');
    return false;
  }
  if (SUPABASE_URL.indexOf('nanti') >= 0 || SUPABASE_KEY.indexOf('nanti') >= 0) {
    showToast('Konfigurasi Supabase URL/Key belum diisi!', 'orange');
    return false;
  }
  try {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return true;
  } catch(e) {
    showToast('Gagal init Supabase: ' + e.message, 'red');
    return false;
  }
}

async function initAuth() {
  db.auth.onAuthStateChange(async function(event, session) {
    if (session && session.user) {
      await loadProfile(session.user);
      showApp();
    } else {
      showAuth();
    }
  });
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
  // Log login untuk memantau data role yang masuk dari database
  db.from('log_login').insert({ 
    user_id: currentUser.id, 
    user_nama: currentProfile.nama, 
    user_role: currentProfile.role, 
    user_agent: navigator.userAgent.substring(0,200) 
  });
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  if (currentProfile) document.getElementById('header-user').textContent = currentProfile.nama;
  
  updateProfilePage();
  loadAll();
  
  // PERBAIKAN UTAMA: Memicu inisialisasi halaman dashboard dan pengaturan visibilitas FAB saat login
  goPage('dashboard');
}

function updateProfilePage() {
  if (!currentProfile || !currentProfile.role) return;
  
  var elAvatar = document.getElementById('profile-avatar');
  var elName = document.getElementById('profile-name');
  var elRole = document.getElementById('profile-role');
  
  if (elAvatar) elAvatar.textContent = currentProfile.nama.charAt(0).toUpperCase();
  if (elName) elName.textContent = currentProfile.nama;
  
  // PERBAIKAN: Normalisasi string role agar aman dari kapitalisasi dan spasi gaib
  var cleanRole = currentProfile.role.toString().toLowerCase().trim();
  
  var roles = { admin: 'Admin', bendahara: 'Bendahara', input_only: 'Input Only', viewer: 'Viewer' };
  if (elRole) elRole.textContent = roles[cleanRole] || currentProfile.role;
  
  // Evaluasi hak akses menggunakan string yang sudah dinormalisasi
  var isAdmin = cleanRole === 'admin';
  var canEdit = isAdmin || cleanRole === 'bendahara';
  
  document.querySelectorAll('.admin-only').forEach(function(el) { el.style.display = isAdmin ? 'flex' : 'none'; });
  document.querySelectorAll('.ekspor-menu').forEach(function(el) { el.style.display = canEdit ? 'flex' : 'none'; });
  
  var btnKeg = document.getElementById('btn-add-kegiatan');
  if (btnKeg) btnKeg.style.display = canEdit ? 'block' : 'none';
  var btnAng = document.getElementById('btn-add-anggaran');
  if (btnAng) btnAng.style.display = isAdmin ? 'block' : 'none';
}

async function loadAll() {
  await Promise.all([loadKategori(), loadKas(), loadTrx(), loadAnggota(), loadAnggaran()]);
  renderDashboard(); 
  renderTrxList(); 
  populateKasSelect();
  loadKegiatan();
}

// NAVIGATION
function goPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  
  var page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  currentPage = name;
  
  var navMap = { dashboard: 0, transaksi: 1, anggaran: 2, anggota: 3, profil: 4 };
  var navItems = document.querySelectorAll('.nav-item');
  if (navMap[name] !== undefined && navItems[navMap[name]]) {
    navItems[navMap[name]].classList.add('active');
  }
  
  var noFab = ['profil', 'kategori', 'pengguna', 'poskas', 'ekspor'];
  var fab = document.getElementById('fab');
  if (fab) {
    fab.style.display = noFab.indexOf(name) < 0 ? 'flex' : 'none';
  }
  
  if (name === 'dashboard') renderDashboard();
  if (name === 'transaksi') renderTrxList();
  if (name === 'anggaran') renderAnggaranPage();
  if (name === 'anggota') loadAnggotaPage();
  if (name === 'profil') loadProfilPage();
}

// DASHBOARD
function renderDashboard() {
  var totalMasuk = 0, totalKeluar = 0;
  allTrx.forEach(function(t) {
    if (t.jenis === 'masuk') totalMasuk += t.nominal;
    else totalKeluar += t.nominal;
  });
  var saldo = totalMasuk - totalKeluar;
  
  var elSaldo = document.getElementById('dash-saldo');
  var elMasuk = document.getElementById('dash-masuk');
  var elKeluar = document.getElementById('dash-keluar');
  
  if (elSaldo) elSaldo.textContent = formatRupiah(saldo);
  if (elMasuk) elMasuk.textContent = formatRupiah(totalMasuk);
  if (elKeluar) elKeluar.textContent = formatRupiah(totalKeluar);
  
  renderKasBreakdown();
  renderTrxTerakhir();
}

function renderKasBreakdown() {
  var container = document.getElementById('kas-breakdown-list');
  if (!container) return;
  container.innerHTML = '';
  
  allKas.forEach(function(k) {
    var total = 0;
    allTrx.forEach(function(t) {
      if (t.kas_id === k.id) {
        if (t.jenis === 'masuk') total += t.nominal;
        else total -= t.nominal;
      }
    });
    
    var icon = k.tipe === 'bank' ? '🏦' : (k.tipe === 'ewallet' ? '📱' : '💵');
    var div = document.createElement('div');
    div.className = 'kas-card-mini';
    div.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span>'+icon+'</span><div><div style="font-weight:600;font-size:13px">'+k.nama+'</div>'+(k.nomor_rekening?'<div style="font-size:11px;color:var(--text2)">'+k.nomor_rekening+'</div>':'')+'</div></div><div style="font-weight:700;font-size:13px;color:'+(total<0?'var(--red)':'var(--text)')+'">'+formatRupiah(total)+'</div>';
    container.appendChild(div);
  });
}

function renderTrxTerakhir() {
  var container = document.getElementById('dash-trx-terakhir');
  if (!container) return;
  container.innerHTML = '';
  
  var list = allTrx.slice(0, 5);
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">Belum ada transaksi</div>';
    return;
  }
  
  list.forEach(function(t) {
    var kat = allKategori.find(function(c) { return c.id === t.kategori_id; });
    var kas = allKas.find(function(c) { return c.id === t.kas_id; });
    var katNama = kat ? kat.nama : 'Tanpa Kategori';
    var katColor = kat ? kat.warna : '#34d399';
    var kasNama = kas ? kas.nama : 'Kas';
    
    var div = document.createElement('div');
    div.className = 'trx-item';
    div.innerHTML = '<div style="display:flex;align-items:center;gap:12px"><div class="trx-icon-box" style="background:'+katColor+'20;color:'+katColor+'">'+(t.jenis==='masuk'?'↓':'↑')+'</div><div><div style="font-weight:600;font-size:14px">'+t.keterangan+'</div><div style="font-size:12px;color:var(--text2)">'+katNama+' • '+kasNama+'</div></div></div><div style="text-align:right"><div style="font-weight:700;font-size:14px;color:'+(t.jenis==='masuk'?'var(--green)':'var(--red)')+'">'+(t.jenis==='masuk'?'+':'-')+formatRupiah(t.nominal)+'</div><div style="font-size:11px;color:var(--text3)">'+formatDate(t.tanggal)+'</div></div>';
    container.appendChild(div);
  });
}

// DATA LOADERS
async function loadKategori() {
  var r = await db.from('kategori').select('*').eq('aktif', true).order('urutan');
  if (!r.error) allKategori = r.data || [];
}
async function loadKas() {
  var r = await db.from('posisi_kas').select('*').eq('aktif', true).order('urutan');
  if (!r.error) allKas = r.data || [];
}
async function loadTrx() {
  var r = await db.from('transaksi').select('*').order('tanggal', { ascending: false });
  if (!r.error) allTrx = r.data || [];
}
async function loadAnggota() {
  var r = await db.from('profiles').select('*').order('nama');
  if (!r.error) allAnggota = r.data || [];
}
async function loadAnggaran() {
  var r = await db.from('anggaran').select('*').order('tahun', { ascending: false });
  if (!r.error) allAnggaran = r.data || [];
}

function loadProfilPage() {
  updateProfilePage();
}

// ANGGOTA
function loadAnggotaPage() {
  if (currentAnggotaTab === 'rekap') renderAnggotaRekap();
  else renderAnggotaDaftar();
}

function renderAnggotaDaftar() {
  var container = document.getElementById('anggota-daftar-list');
  if (!container) return;
  container.innerHTML = '';
  
  var start = anggotaPage * PAGE_SIZE;
  var end = start + PAGE_SIZE;
  var paged = allAnggota.slice(start, end);
  
  if (paged.length === 0) {
    container.innerHTML = '<div class="empty-state">Tidak ada anggota</div>';
    return;
  }
  
  var cleanUserRole = currentProfile && currentProfile.role ? currentProfile.role.toString().toLowerCase().trim() : '';
  var isAdmin = cleanUserRole === 'admin';
  
  paged.forEach(function(m) {
    var div = document.createElement('div');
    div.className = 'anggota-card';
    
    var roles = { admin: 'Admin', bendahara: 'Bendahara', input_only: 'Input Only', viewer: 'Viewer' };
    var roleLabel = roles[m.role.toString().toLowerCase().trim()] || m.role;
    var actionHtml = '';
    
    if (isAdmin && m.id !== currentUser.id) {
      actionHtml = '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<select class="form-input" style="padding:4px 8px;font-size:12px" onchange="changeUserRole(\''+m.id+'\', this.value)">' +
          '<option value="viewer" '+(m.role==='viewer'?'selected':'')+'>Viewer</option>' +
          '<option value="input_only" '+(m.role==='input_only'?'selected':'')+'>Input Only</option>' +
          '<option value="bendahara" '+(m.role==='bendahara'?'selected':'')+'>Bendahara</option>' +
          '<option value="admin" '+(m.role==='admin'?'selected':'')+'>Admin</option>' +
        '</select>' +
        '<button class="btn-danger" style="padding:4px 8px;font-size:12px" onclick="deleteUser(\''+m.id+'\')">Hapus</button>' +
      '</div>';
    }
    
    div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<div><div style="font-weight:600">'+m.nama+'</div><div style="font-size:12px;color:var(--text2)">'+m.email+'</div></div>' +
      '<div class="badge-role">'+roleLabel+'</div>' +
    '</div>' + actionHtml;
    
    container.appendChild(div);
  });
  
  if (typeof renderAnggotaNav === 'function') renderAnggotaNav();
}

async function changeUserRole(userId, newRole) {
  var r = await db.from('profiles').update({ role: newRole }).eq('id', userId);
  if (!r.error) {
    showToast('Role berhasil diperbarui', 'green');
    await loadAnggota();
    renderAnggotaDaftar();
  } else {
    showToast('Gagal memperbarui role: ' + r.error.message, 'red');
  }
}

// ANGGARAN
function renderAnggaranPage() {
  var years={};
  allAnggaran.forEach(function(a){ years[a.tahun]=true; });
  var yearList=Object.keys(years).sort(function(a,b){ return b-a; });
  var fr=document.getElementById('anggaran-filter-row');
  if (fr) {
    fr.innerHTML='<button class="filter-chip active" onclick="setAnggaranFilter(this,\'semua\')">Semua</button>';
    yearList.forEach(function(y){
      fr.innerHTML+='<button class="filter-chip" onclick="setAnggaranFilter(this,\''+y+'\')">'+y+'</button>';
    });
  }
  renderAnggaranList('semua');
}

function renderAnggaranList(filterYear) {
  var container=document.getElementById('anggaran-list');
  if(!container)return;
  container.innerHTML='';
  var filtered=allAnggaran;
  if(filterYear!=='semua'){
    filtered=allAnggaran.filter(function(a){return String(a.tahun)===String(filterYear);});
  }
  if(filtered.length===0){
    container.innerHTML='<div class="empty-state">Belum ada data anggaran</div>';
    return;
  }
  filtered.forEach(function(a){
    var div=document.createElement('div');
    div.className='anggaran-card';
    if (typeof openSheet === 'function') {
      div.onclick=function(){ openSheet('anggaran',a); };
    }
    div.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-weight:700;font-size:16px;color:var(--accent)">'+a.nama+'</div><div class="badge-tahun">'+a.tahun+'</div></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:'+Math.min(100,(a.terpakai/a.plafon)*100)+'%"></div></div><div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px"><span style="color:var(--text2)">Terpakai: <b>'+formatRupiah(a.terpakai)+'</b></span><span style="color:var(--text3)">Plafon: '+formatRupiah(a.plafon)+'</span></div>';
    container.appendChild(div);
  });
}

// SUBMIT POSISI KAS WITH SAFETY CHECK
async function submitKas() {
  var editIdEl = document.getElementById('edit-kas-id');
  var editId = editIdEl ? editIdEl.value : '';
  var namaEl = document.getElementById('kas-nama');
  var nama = namaEl ? namaEl.value.trim() : '';
  var norekEl = document.getElementById('kas-norek');
  var norek = norekEl ? norekEl.value.trim() : '';
  
  if (!nama) { showToast('Nama wajib diisi','red'); return; }
  
  var btn=document.getElementById('btn-submit-kas'); 
  if (btn) { btn.disabled=true; btn.textContent='Menyimpan...'; }
  
  var payload={nama:nama,tipe:currentKasTipe,nomor_rekening:norek||null};
  var r=editId?await db.from('posisi_kas').update(payload).eq('id',editId):await db.from('posisi_kas').insert(Object.assign(payload,{aktif:true,urutan:99}));
  
  if (btn) { btn.disabled=false; btn.textContent='Simpan Posisi Kas'; }
  
  if (!r.error) { 
    closeSheet('kas'); 
    await loadKas(); 
    if (typeof loadPosKasPage === 'function') loadPosKasPage(); 
    populateKasSelect(); 
    renderKasBreakdown(); 
    showToast('Posisi kas disimpan','green'); 
  } else {
    showToast('Gagal: '+r.error.message,'red');
  }
}

async function deletePosKas(id) {
  if (!confirm('Hapus posisi kas ini?')) return;
  var r=await db.from('posisi_kas').update({aktif:false}).eq('id',id);
  if (!r.error) { 
    await loadKas(); 
    if (typeof loadPosKasPage === 'function') loadPosKasPage(); 
    showToast('Posisi kas dihapus','green'); 
  } else {
    showToast('Gagal menghapus','red');
  }
}

// UTILS
function formatRupiah(val) {
  if (isNaN(val)) return 'Rp 0';
  var sign = val < 0 ? '-' : '';
  return sign + 'Rp ' + Math.abs(val).toLocaleString('id-ID');
}

function formatDate(str) {
  if (!str) return '';
  var d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.getDate() + ' ' + BULAN_NAMA[d.getMonth()] + ' ' + d.getFullYear();
}

function showToast(msg, color) {
  var toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '80px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    toast.style.transition = 'all 0.3s ease';
    document.body.appendChild(toast);
  }
  var bg = color === 'green' ? '#22d172' : (color === 'red' ? '#ff5f5f' : (color === 'orange' ? '#fbbf24' : '#1e2d3d'));
  toast.style.background = bg;
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(function() { toast.style.opacity = '0'; }, 3000);
}

function openSheet(type, data) {
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

window.onload = function() {
  if (initDB()) {
    initAuth();
  }
};
