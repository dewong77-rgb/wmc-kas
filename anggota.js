// WMC KAS - anggota.js
var rekapPage = 0;
var anggotaPage = 0;
var kegiatanPage = 0;
var editingKegiatanId = null;
var pesertaStatus = {};
var currentKegiatanTipe = 'fullboard';

function setAnggotaTab(el, tab) {
  document.querySelectorAll('#page-anggota .filter-row .filter-chip').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  currentAnggotaTab = tab;
  ['rekap','kegiatan','data','log'].forEach(function(t) {
    document.getElementById('anggota-tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'kegiatan') { kegiatanPage = 0; renderKegiatanList(); }
  if (tab === 'data') { anggotaPage = 0; renderDataAnggota(); }
  if (tab === 'log') loadLogList();
}

// REKAP
function renderRekapAnggota() {
  var stats = {};
  allKegiatan.forEach(function(k) {
    if (!k.kegiatan_peserta) return;
    k.kegiatan_peserta.forEach(function(p) {
      var aid = p.anggota_id, nama = p.anggota ? p.anggota.nama : 'Unknown';
      if (!stats[aid]) stats[aid] = { nama: nama, total: 0, fullboard: 0, perjadin: 0, pinjam: 0 };
      stats[aid].total++;
      if (k.tipe === 'fullboard') stats[aid].fullboard++;
      else if (k.tipe === 'perjadin') stats[aid].perjadin++;
      if (p.status_kehadiran === 'pinjam_nama') stats[aid].pinjam++;
    });
  });
  var sorted = Object.values(stats).sort(function(a, b) { return b.total - a.total; });
  var el = document.getElementById('rekap-list');
  if (!sorted.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">Belum ada data kegiatan</div></div>';
    return;
  }
  var start = rekapPage * PAGE_SIZE;
  var slice = sorted.slice(start, start + PAGE_SIZE);
  var rankClass = ['rank-1','rank-2','rank-3'];
  el.innerHTML = slice.map(function(a, i) {
    var gr = start + i;
    var ac = gr < 3 ? rankClass[gr] : '';
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
      + '<div class="anggota-avatar ' + ac + '" style="width:38px;height:38px;border-radius:10px;font-size:15px;flex-shrink:0">' + a.nama.charAt(0).toUpperCase() + '</div>'
      + '<div><div style="font-size:14px;font-weight:700">' + a.nama + '</div>'
      + '<div style="font-size:11px;color:var(--text2)">' + a.total + ' kegiatan' + (a.pinjam > 0 ? ' · <span style="color:var(--yellow)">' + a.pinjam + 'x pinjam nama</span>' : '') + '</div>'
      + '</div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
      + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--accent)">' + a.fullboard + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Fullboard</div></div>'
      + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green)">' + a.perjadin + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Perjadin</div></div>'
      + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:' + (a.pinjam > 0 ? 'var(--yellow)' : 'var(--text3)') + '">' + a.pinjam + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Pinjam Nama</div></div>'
      + '</div></div>';
  }).join('');
  var maxP = Math.ceil(sorted.length / PAGE_SIZE) - 1;
  el.innerHTML += renderPagerHTML(rekapPage, sorted.length, PAGE_SIZE,
    'rekapPage=Math.max(0,rekapPage-1);renderRekapAnggota()',
    'rekapPage=Math.min(' + maxP + ',rekapPage+1);renderRekapAnggota()');
}

// DATA ANGGOTA
function renderDataAnggota() {
  var isAdmin = currentProfile && currentProfile.role === 'admin';
  var el = document.getElementById('data-anggota-list');
  if (!allAnggota.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Belum ada anggota</div></div>'; return; }
  var start = anggotaPage * PAGE_SIZE;
  var slice = allAnggota.slice(start, start + PAGE_SIZE);
  el.innerHTML = slice.map(function(a) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px">'
      + '<div class="anggota-avatar" style="width:38px;height:38px;border-radius:10px;font-size:15px;flex-shrink:0">' + a.nama.charAt(0).toUpperCase() + '</div>'
      + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">' + a.nama + '</div><div style="font-size:12px;color:var(--text2);margin-top:2px">' + (a.jabatan || '-') + (a.kontak ? ' · ' + a.kontak : '') + '</div></div>'
      + (isAdmin ? '<div style="display:flex;gap:6px;flex-shrink:0"><button class="btn-sm btn-sm-edit" onclick="editAnggota(\'' + a.id + '\',\'' + escQ(a.nama) + '\',\'' + escQ(a.jabatan || '') + '\',\'' + escQ(a.kontak || '') + '\',\'' + escQ(a.email || '') + '\',\'' + escQ(a.catatan || '') + '\')">Edit</button><button class="btn-sm btn-sm-del" onclick="deleteAnggota(\'' + a.id + '\')">Hapus</button></div>' : '')
      + '</div>';
  }).join('');
  var maxP = Math.ceil(allAnggota.length / PAGE_SIZE) - 1;
  el.innerHTML += renderPagerHTML(anggotaPage, allAnggota.length, PAGE_SIZE,
    'anggotaPage=Math.max(0,anggotaPage-1);renderDataAnggota()',
    'anggotaPage=Math.min(' + maxP + ',anggotaPage+1);renderDataAnggota()');
}

function openSheetAnggota() {
  document.getElementById('anggota-sheet-title').textContent = 'Tambah Anggota';
  ['edit-anggota-id','anggota-nama','anggota-jabatan','anggota-kontak','anggota-email','anggota-catatan'].forEach(function(id) { document.getElementById(id).value = ''; });
  openSheet('anggota');
}
function editAnggota(id, nama, jabatan, kontak, email, catatan) {
  document.getElementById('anggota-sheet-title').textContent = 'Edit Anggota';
  document.getElementById('edit-anggota-id').value = id;
  document.getElementById('anggota-nama').value = nama;
  document.getElementById('anggota-jabatan').value = jabatan;
  document.getElementById('anggota-kontak').value = kontak;
  document.getElementById('anggota-email').value = email;
  document.getElementById('anggota-catatan').value = catatan;
  openSheet('anggota');
}
async function submitAnggota() {
  var editId = document.getElementById('edit-anggota-id').value;
  var nama = document.getElementById('anggota-nama').value.trim();
  if (!nama) { showToast('Nama wajib diisi', 'red'); return; }
  var payload = { nama: nama, jabatan: document.getElementById('anggota-jabatan').value.trim() || null, kontak: document.getElementById('anggota-kontak').value.trim() || null, email: document.getElementById('anggota-email').value.trim() || null, catatan: document.getElementById('anggota-catatan').value.trim() || null };
  var btn = document.getElementById('btn-submit-anggota'); btn.disabled = true; btn.textContent = 'Menyimpan...';
  var r = editId ? await db.from('anggota').update(payload).eq('id', editId) : await db.from('anggota').insert(payload);
  btn.disabled = false; btn.textContent = 'Simpan Anggota';
  if (!r.error) { closeSheet('anggota'); await loadAnggota(); renderDataAnggota(); renderRekapAnggota(); showToast('Anggota disimpan', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}
async function deleteAnggota(id) {
  if (!confirm('Hapus anggota ini?')) return;
  var r = await db.from('anggota').delete().eq('id', id);
  if (!r.error) { await loadAnggota(); renderDataAnggota(); showToast('Anggota dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

// KEGIATAN
function renderKegiatanList() {
  var tipeClass = { fullboard:'tipe-fullboard', perjadin:'tipe-perjadin', rapat:'tipe-rapat', lainnya:'tipe-lainnya' };
  var canEdit = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'bendahara');
  var el = document.getElementById('kegiatan-list');
  if (!allKegiatan.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">Belum ada kegiatan</div></div>'; return; }
  var start = kegiatanPage * PAGE_SIZE;
  var slice = allKegiatan.slice(start, start + PAGE_SIZE);
  el.innerHTML = slice.map(function(k) {
    var jp = k.kegiatan_peserta ? k.kegiatan_peserta.length : 0;
    var jh = k.kegiatan_peserta ? k.kegiatan_peserta.filter(function(p) { return p.status_kehadiran !== 'pinjam_nama'; }).length : 0;
    var jpin = k.kegiatan_peserta ? k.kegiatan_peserta.filter(function(p) { return p.status_kehadiran === 'pinjam_nama'; }).length : 0;
    var tgl = new Date(k.tanggal_mulai).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
    var namaList = k.kegiatan_peserta ? k.kegiatan_peserta.map(function(p) {
      var nm = p.anggota ? p.anggota.nama : '?';
      return p.status_kehadiran === 'pinjam_nama' ? '<span style="color:var(--yellow)">' + nm + '*</span>' : nm;
    }).join(', ') : '';
    return '<div class="kegiatan-item">'
      + '<div class="kegiatan-header"><div class="kegiatan-nama">' + k.nama + '</div><div class="kegiatan-tipe ' + (tipeClass[k.tipe] || '') + '">' + k.tipe + '</div></div>'
      + '<div class="kegiatan-meta">' + tgl + ' · ' + k.jumlah_hari + ' hari' + (k.lokasi ? ' · ' + k.lokasi : '') + (k.bendahara ? ' · PIC: ' + k.bendahara.nama : '') + '</div>'
      + (namaList ? '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;line-height:1.6">' + namaList + '</div>' : '')
      + '<div class="kegiatan-footer"><span style="color:var(--text2)">' + jp + ' peserta · ' + jh + ' hadir' + (jpin > 0 ? ' · <span style="color:var(--yellow)">' + jpin + ' pinjam nama</span>' : '') + '</span></div>'
      + (canEdit ? '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn-sm btn-sm-edit" onclick="editKegiatan(\'' + k.id + '\')">Edit</button><button class="btn-sm btn-sm-del" onclick="deleteKegiatan(\'' + k.id + '\')">Hapus</button></div>' : '')
      + '</div>';
  }).join('');
  var maxP = Math.ceil(allKegiatan.length / PAGE_SIZE) - 1;
  el.innerHTML += renderPagerHTML(kegiatanPage, allKegiatan.length, PAGE_SIZE,
    'kegiatanPage=Math.max(0,kegiatanPage-1);renderKegiatanList()',
    'kegiatanPage=Math.min(' + maxP + ',kegiatanPage+1);renderKegiatanList()');
}

function openSheetKegiatan() {
  editingKegiatanId = null;
  document.getElementById('kegiatan-sheet-title').textContent = 'Tambah Kegiatan';
  document.getElementById('edit-kegiatan-id').value = '';
  document.getElementById('kegiatan-nama').value = '';
  document.getElementById('kegiatan-mulai').value = new Date().toISOString().split('T')[0];
  document.getElementById('kegiatan-selesai').value = '';
  document.getElementById('kegiatan-hari').value = '1';
  document.getElementById('kegiatan-lokasi').value = '';
  document.getElementById('kegiatan-catatan').value = '';
  currentKegiatanTipe = 'fullboard'; setKegiatanTipe('fullboard');
  populateBendahara(null);
  buildPesertaChecklist({});
  updatePesertaInfo();
  openSheet('kegiatan');
}

function editKegiatan(id) {
  var k = null;
  for (var i = 0; i < allKegiatan.length; i++) { if (allKegiatan[i].id === id) { k = allKegiatan[i]; break; } }
  if (!k) return;
  editingKegiatanId = id;
  document.getElementById('kegiatan-sheet-title').textContent = 'Edit Kegiatan';
  document.getElementById('edit-kegiatan-id').value = id;
  document.getElementById('kegiatan-nama').value = k.nama;
  document.getElementById('kegiatan-mulai').value = k.tanggal_mulai;
  document.getElementById('kegiatan-selesai').value = k.tanggal_selesai || '';
  document.getElementById('kegiatan-hari').value = k.jumlah_hari || 1;
  document.getElementById('kegiatan-lokasi').value = k.lokasi || '';
  document.getElementById('kegiatan-catatan').value = k.catatan || '';
  currentKegiatanTipe = k.tipe || 'fullboard'; setKegiatanTipe(currentKegiatanTipe);
  populateBendahara(k.bendahara_id);
  var existing = {};
  (k.kegiatan_peserta || []).forEach(function(p) { existing[p.anggota_id] = p.status_kehadiran || 'hadir'; });
  buildPesertaChecklist(existing);
  updatePesertaInfo();
  openSheet('kegiatan');
}

function populateBendahara(selectedId) {
  var bendSel = document.getElementById('kegiatan-bendahara');
  bendSel.innerHTML = '<option value="">Pilih bendahara...</option>';
  db.from('profiles').select('id,nama,role').in('role', ['admin','bendahara']).then(function(r) {
    (r.data || []).forEach(function(p) {
      var opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.nama + ' (' + p.role + ')';
      if (selectedId && p.id === selectedId) opt.selected = true;
      bendSel.appendChild(opt);
    });
  });
}

function buildPesertaChecklist(preSelected) {
  pesertaStatus = Object.assign({}, preSelected);
  var cl = document.getElementById('peserta-checklist');
  if (!allAnggota.length) { cl.innerHTML = '<div style="color:var(--text3);font-size:13px">Belum ada anggota.</div>'; return; }
  cl.innerHTML = allAnggota.map(function(a) {
    var status = pesertaStatus[a.id], isSelected = status !== undefined;
    var cs = 'width:20px;height:20px;border-radius:5px;border:2px solid ' + (isSelected ? 'var(--green)' : 'var(--border)') + ';background:' + (isSelected ? 'var(--green)' : 'transparent') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:white';
    return '<div class="peserta-item">'
      + '<div style="' + cs + '" id="pcheck-' + a.id + '" onclick="togglePesertaCheck(\'' + a.id + '\')">' + (isSelected ? '✓' : '') + '</div>'
      + '<div class="peserta-nama">' + a.nama + '</div>'
      + '<div class="peserta-status-toggle" id="ptoggle-' + a.id + '" style="display:' + (isSelected ? 'flex' : 'none') + '">'
      + '<div class="peserta-status-btn' + (status === 'hadir' ? ' hadir-active' : '') + '" onclick="setPesertaStatus(\'' + a.id + '\',\'hadir\')">Hadir</div>'
      + '<div class="peserta-status-btn' + (status === 'pinjam_nama' ? ' pinjam-active' : '') + '" onclick="setPesertaStatus(\'' + a.id + '\',\'pinjam_nama\')">Pinjam Nama</div>'
      + '</div></div>';
  }).join('');
}

function togglePesertaCheck(id) {
  var el = document.getElementById('pcheck-' + id);
  if (pesertaStatus[id] !== undefined) {
    delete pesertaStatus[id];
    el.style.borderColor = 'var(--border)'; el.style.background = 'transparent'; el.textContent = '';
    document.getElementById('ptoggle-' + id).style.display = 'none';
  } else {
    pesertaStatus[id] = 'hadir';
    el.style.borderColor = 'var(--green)'; el.style.background = 'var(--green)'; el.textContent = '✓';
    document.getElementById('ptoggle-' + id).style.display = 'flex';
    setPesertaStatus(id, 'hadir');
  }
  updatePesertaInfo();
}

function setPesertaStatus(id, status) {
  pesertaStatus[id] = status;
  var toggle = document.getElementById('ptoggle-' + id);
  if (!toggle) return;
  var btns = toggle.querySelectorAll('.peserta-status-btn');
  btns[0].className = 'peserta-status-btn' + (status === 'hadir' ? ' hadir-active' : '');
  btns[1].className = 'peserta-status-btn' + (status === 'pinjam_nama' ? ' pinjam-active' : '');
}

function updatePesertaInfo() {
  var selected = Object.keys(pesertaStatus).length;
  var pinjam = Object.values(pesertaStatus).filter(function(s) { return s === 'pinjam_nama'; }).length;
  var label = selected + ' dipilih';
  if (pinjam > 0) label += ' · ' + pinjam + ' pinjam nama';
  document.getElementById('peserta-info-label').textContent = label ? '(' + label + ')' : '';
}

function setKegiatanTipe(tipe) {
  currentKegiatanTipe = tipe;
  ['fullboard','perjadin','rapat','lainnya'].forEach(function(t) {
    document.getElementById('ktipe-' + t).className = 'tipe-btn' + (tipe === t ? ' active' : '');
  });
}

async function submitKegiatan() {
  var nama = document.getElementById('kegiatan-nama').value.trim();
  var mulai = document.getElementById('kegiatan-mulai').value;
  if (!nama) { showToast('Nama kegiatan wajib diisi', 'red'); return; }
  if (!mulai) { showToast('Tanggal mulai wajib diisi', 'red'); return; }
  var pesertaIds = Object.keys(pesertaStatus);
  var hari = parseInt(document.getElementById('kegiatan-hari').value) || 1;
  var payload = { nama: nama, tipe: currentKegiatanTipe, tanggal_mulai: mulai, tanggal_selesai: document.getElementById('kegiatan-selesai').value || null, lokasi: document.getElementById('kegiatan-lokasi').value.trim() || null, jumlah_hari: hari, iuran_per_hari: 0, bendahara_id: document.getElementById('kegiatan-bendahara').value || null, catatan: document.getElementById('kegiatan-catatan').value.trim() || null, status: 'selesai' };
  var btn = document.getElementById('btn-submit-kegiatan'); btn.disabled = true; btn.textContent = 'Menyimpan...';
  var kegiatanId = editingKegiatanId;
  if (editingKegiatanId) {
    var ru = await db.from('kegiatan').update(payload).eq('id', editingKegiatanId);
    if (ru.error) { showToast('Gagal: ' + ru.error.message, 'red'); btn.disabled = false; btn.textContent = 'Simpan Kegiatan'; return; }
    await db.from('kegiatan_peserta').delete().eq('kegiatan_id', editingKegiatanId);
  } else {
    var ri = await db.from('kegiatan').insert(payload).select().single();
    if (ri.error) { showToast('Gagal: ' + ri.error.message, 'red'); btn.disabled = false; btn.textContent = 'Simpan Kegiatan'; return; }
    kegiatanId = ri.data.id;
  }
  if (pesertaIds.length && kegiatanId) {
    var pesertaList = pesertaIds.map(function(aid) {
      return { kegiatan_id: kegiatanId, anggota_id: aid, jumlah_hari: hari, nominal_iuran: 0, sudah_bayar: false, status_kehadiran: pesertaStatus[aid] || 'hadir' };
    });
    await db.from('kegiatan_peserta').insert(pesertaList);
  }
  btn.disabled = false; btn.textContent = 'Simpan Kegiatan';
  closeSheet('kegiatan');
  showToast(editingKegiatanId ? 'Kegiatan diperbarui' : 'Kegiatan disimpan', 'green');
  loadKegiatan();
}

async function deleteKegiatan(id) {
  if (!confirm('Hapus kegiatan ini?')) return;
  await db.from('kegiatan_peserta').delete().eq('kegiatan_id', id);
  var r = await db.from('kegiatan').delete().eq('id', id);
  if (!r.error) { loadKegiatan(); showToast('Kegiatan dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

// LOG LOGIN
async function loadLogList() {
  if (!currentProfile || currentProfile.role !== 'admin') {
    document.getElementById('log-list').innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div><div class="empty-text">Hanya admin yang bisa melihat log ini</div></div>';
    return;
  }
  var r = await db.from('log_login').select('*').order('login_at', { ascending: false }).limit(50);
  var logs = r.data || [];
  var roleColor = { admin: 'var(--accent)', bendahara: 'var(--green)', input_only: 'var(--yellow)', viewer: 'var(--text3)' };
  var roleLabel = { admin: 'Admin', bendahara: 'Bendahara', input_only: 'Input', viewer: 'Viewer' };
  document.getElementById('log-list').innerHTML = logs.length ? logs.map(function(l) {
    var tgl = new Date(l.login_at).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
    var jam = new Date(l.login_at).toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' });
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">'
      + '<div style="width:32px;height:32px;border-radius:8px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:var(--accent);flex-shrink:0">' + (l.user_nama || '?').charAt(0).toUpperCase() + '</div>'
      + '<div style="flex:1"><div style="font-size:14px;font-weight:600">' + (l.user_nama || '-') + '</div><div style="font-size:11px;color:var(--text3);margin-top:2px">' + tgl + ' · ' + jam + '</div></div>'
      + '<div style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:10px;background:' + (l.user_role === 'admin' ? 'var(--accent-dim)' : l.user_role === 'bendahara' ? 'var(--green-dim)' : 'var(--bg2)') + ';color:' + (roleColor[l.user_role] || 'var(--text3)') + '">' + (roleLabel[l.user_role] || l.user_role || '-') + '</div>'
      + '</div>';
  }).join('') : '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Belum ada log login</div></div>';
}
