// WMC KAS - kegiatan.js
var kegiatanPage = 0;
var editingKegiatanId = null;
var pesertaStatus = {};
var currentKegiatanTipe = 'fullboard';
var searchKegiatan = '';
var filterKegiatanBulan = 0;
var filterKegiatanTahun = 0;

function renderKegiatanList() {
  var el = document.getElementById('kegiatan-list');
  var years = {};
  allKegiatan.forEach(function(k) {
    var tgl = k.tanggal_surat || k.tanggal_mulai;
    if (tgl) years[new Date(tgl).getFullYear()] = true;
  });
  var yearList = Object.keys(years).sort(function(a,b){ return b-a; });

  // Render search bar + filter sekali saja — tidak ikut re-render saat mengetik
  var searchWrap = document.getElementById('kegiatan-search-wrap');
  if (!searchWrap) {
    el.innerHTML = '<div id="kegiatan-search-wrap" style="margin-bottom:12px">'
      + '<div style="position:relative;margin-bottom:8px">'
      + '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:14px;pointer-events:none">🔍</span>'
      + '<input type="search" id="kegiatan-search-input" placeholder="Cari nama kegiatan..." style="width:100%;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px 10px 38px;color:var(--text);font-family:var(--font);font-size:14px;outline:none">'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">'
      + '<select id="keg-sel-bulan" style="background:var(--surface);border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;font-family:var(--font);outline:none" onchange="onFilterKegiatanChange()">'
      + '<option value="0">Semua Bulan</option>'
      + BULAN_NAMA.map(function(b,i){ return '<option value="'+(i+1)+'"'+(filterKegiatanBulan===i+1?' selected':'')+'>'+b+'</option>'; }).join('')
      + '</select>'
      + '<select id="keg-sel-tahun" style="background:var(--surface);border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;font-family:var(--font);outline:none" onchange="onFilterKegiatanChange()">'
      + '<option value="0">Semua Tahun</option>'
      + yearList.map(function(y){ return '<option value="'+y+'"'+(filterKegiatanTahun===parseInt(y)?' selected':'')+'>'+y+'</option>'; }).join('')
      + '</select>'
      + '</div>'
      + '</div>'
      + '<div id="kegiatan-content"></div>';

    // Pasang event listener ke input — hanya sekali
    document.getElementById('kegiatan-search-input').addEventListener('input', function(e) {
      searchKegiatan = e.target.value;
      kegiatanPage = 0;
      renderKegiatanContent();
    });
  } else {
    // Update option filter kalau tahun baru muncul
    var tahunSel = document.getElementById('keg-sel-tahun');
    if (tahunSel) {
      tahunSel.innerHTML = '<option value="0">Semua Tahun</option>'
        + yearList.map(function(y){ return '<option value="'+y+'"'+(filterKegiatanTahun===parseInt(y)?' selected':'')+'>'+y+'</option>'; }).join('');
    }
  }

  renderKegiatanContent();
}

function renderKegiatanContent() {
  var tipeClass = { fullboard:'tipe-fullboard', perjadin:'tipe-perjadin', rapat:'tipe-rapat', lainnya:'tipe-lainnya' };
  var canEdit = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'bendahara');
  var sorted = allKegiatan.slice().sort(function(a, b) {
    var da = a.tanggal_surat ? new Date(a.tanggal_surat) : new Date(a.tanggal_mulai);
    var db2 = b.tanggal_surat ? new Date(b.tanggal_surat) : new Date(b.tanggal_mulai);
    return db2 - da;
  });
  var filtered = sorted.filter(function(k) {
    if (searchKegiatan && k.nama.toLowerCase().indexOf(searchKegiatan.toLowerCase()) < 0) return false;
    if (filterKegiatanBulan > 0 || filterKegiatanTahun > 0) {
      var tgl = k.tanggal_surat ? new Date(k.tanggal_surat) : new Date(k.tanggal_mulai);
      if (filterKegiatanBulan > 0 && (tgl.getMonth() + 1) !== filterKegiatanBulan) return false;
      if (filterKegiatanTahun > 0 && tgl.getFullYear() !== filterKegiatanTahun) return false;
    }
    return true;
  });
  var contentEl = document.getElementById('kegiatan-content');
  if (!contentEl) return;
  if (!filtered.length) { contentEl.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 0;text-align:center">Tidak ada kegiatan ditemukan</div>'; return; }
  var start = kegiatanPage * PAGE_SIZE;
  var slice = filtered.slice(start, start + PAGE_SIZE);
  var maxP = Math.ceil(filtered.length / PAGE_SIZE) - 1;
  contentEl.innerHTML = slice.map(function(k) {
    var jp = k.kegiatan_peserta ? k.kegiatan_peserta.length : 0;
    var jh = k.kegiatan_peserta ? k.kegiatan_peserta.filter(function(p){ return p.status_kehadiran !== 'pinjam_nama'; }).length : 0;
    var jpin = k.kegiatan_peserta ? k.kegiatan_peserta.filter(function(p){ return p.status_kehadiran === 'pinjam_nama'; }).length : 0;
    var tglMulai = new Date(k.tanggal_mulai).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
    var tglSurat = k.tanggal_surat ? new Date(k.tanggal_surat).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    var namaList = k.kegiatan_peserta ? k.kegiatan_peserta.map(function(p){ var nm = p.anggota ? p.anggota.nama : '?'; return p.status_kehadiran === 'pinjam_nama' ? '<span style="color:var(--yellow)">' + nm + '*</span>' : nm; }).join(', ') : '';
    var pinjamText = jpin > 0 ? ' · <span style="color:var(--yellow)">' + jpin + ' pinjam nama</span>' : '';
    var totalMasuk = allTrx.filter(function(t){ return t.jenis === 'masuk' && t.kegiatan_id === k.id; }).reduce(function(s,t){ return s + t.nominal; }, 0);
    var statusUang = totalMasuk > 0
      ? '<div style="font-size:11px;font-weight:700;color:var(--green);margin-top:6px">✅ Pemasukan sudah diinput · ' + formatRp(totalMasuk) + '</div>'
      : '<div style="font-size:11px;font-weight:700;color:var(--yellow);margin-top:6px">⏳ Belum ada pemasukan diinput</div>';
    return '<div class="kegiatan-item">'
      + '<div class="kegiatan-header"><div class="kegiatan-nama">' + k.nama + '</div><div class="kegiatan-tipe ' + (tipeClass[k.tipe] || '') + '">' + k.tipe + '</div></div>'
      + (k.nomor_surat ? '<div style="font-size:11px;color:var(--accent);margin-bottom:4px">📄 ' + k.nomor_surat + (tglSurat ? ' · ' + tglSurat : '') + '</div>' : '')
      + '<div class="kegiatan-meta">Pelaksanaan: ' + tglMulai + (k.lokasi ? ' · ' + k.lokasi : '') + (k.bendahara ? ' · PIC: ' + k.bendahara.nama : '') + '</div>'
      + (namaList ? '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;line-height:1.6">' + namaList + '</div>' : '')
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<span style="font-size:12px;color:var(--text2)">' + jp + ' peserta · ' + jh + ' hadir' + pinjamText + '</span>'
      + (k.link_surat ? '<a href="' + k.link_surat + '" target="_blank" style="font-size:12px;color:var(--accent);text-decoration:none;font-weight:600">📎 Buka Surat Tugas</a>' : '')
      + '</div>'
      + statusUang
      + (canEdit ? '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn-sm btn-sm-edit" onclick="editKegiatan(\'' + k.id + '\')">Edit</button><button class="btn-sm btn-sm-del" onclick="deleteKegiatan(\'' + k.id + '\')">Hapus</button></div>' : '')
      + '</div>';
  }).join('')
  + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 100px">'
  + '<button class="pager-btn" ' + (kegiatanPage === 0 ? 'disabled' : '') + ' onclick="kegiatanPage=Math.max(0,kegiatanPage-1);renderKegiatanContent()">← Sebelumnya</button>'
  + '<span style="font-size:13px;color:var(--text2)">' + (kegiatanPage+1) + ' / ' + (maxP+1) + ' (' + filtered.length + ')</span>'
  + '<button class="pager-btn" ' + (kegiatanPage >= maxP ? 'disabled' : '') + ' onclick="kegiatanPage=Math.min('+maxP+',kegiatanPage+1);renderKegiatanContent()">Berikutnya →</button>'
  + '</div>';
}
  var contentEl = document.getElementById('kegiatan-content');
  if (!contentEl) return;

  if (!filtered.length) {
    contentEl.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 0;text-align:center">Tidak ada kegiatan ditemukan</div>';
    return;
  }

  var start = kegiatanPage * PAGE_SIZE;
  var slice = filtered.slice(start, start + PAGE_SIZE);
  var maxP = Math.ceil(filtered.length / PAGE_SIZE) - 1;

  contentEl.innerHTML = slice.map(function(k) {
    var jp = k.kegiatan_peserta ? k.kegiatan_peserta.length : 0;
    var jh = k.kegiatan_peserta ? k.kegiatan_peserta.filter(function(p){ return p.status_kehadiran !== 'pinjam_nama'; }).length : 0;
    var jpin = k.kegiatan_peserta ? k.kegiatan_peserta.filter(function(p){ return p.status_kehadiran === 'pinjam_nama'; }).length : 0;
    var tglMulai = new Date(k.tanggal_mulai).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
    var tglSurat = k.tanggal_surat ? new Date(k.tanggal_surat).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    var namaList = k.kegiatan_peserta ? k.kegiatan_peserta.map(function(p){
      var nm = p.anggota ? p.anggota.nama : '?';
      return p.status_kehadiran === 'pinjam_nama' ? '<span style="color:var(--yellow)">' + nm + '*</span>' : nm;
    }).join(', ') : '';
    var pinjamText = jpin > 0 ? ' · <span style="color:var(--yellow)">' + jpin + ' pinjam nama</span>' : '';
    var totalMasukKeg = allTrx.filter(function(t){ return t.jenis === 'masuk' && t.kegiatan_id === k.id; }).reduce(function(s,t){ return s + t.nominal; }, 0);
    var statusUang = totalMasukKeg > 0
    ? '<div style="font-size:11px;font-weight:700;color:var(--green);margin-top:6px">✅ Pemasukan sudah diinput · ' + formatRp(totalMasukKeg) + '</div>'
    : '<div style="font-size:11px;font-weight:700;color:var(--yellow);margin-top:6px">⏳ Belum ada pemasukan diinput</div>';
    return '<div class="kegiatan-item">'
      + '<div class="kegiatan-header"><div class="kegiatan-nama">' + k.nama + '</div><div class="kegiatan-tipe ' + (tipeClass[k.tipe] || '') + '">' + k.tipe + '</div></div>'
      + (k.nomor_surat ? '<div style="font-size:11px;color:var(--accent);margin-bottom:4px">📄 ' + k.nomor_surat + (tglSurat ? ' · ' + tglSurat : '') + '</div>' : '')
      + '<div class="kegiatan-meta">Pelaksanaan: ' + tglMulai + (k.lokasi ? ' · ' + k.lokasi : '') + (k.bendahara ? ' · PIC: ' + k.bendahara.nama : '') + '</div>'
      + (namaList ? '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;line-height:1.6">' + namaList + '</div>' : '')
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<span style="font-size:12px;color:var(--text2)">' + jp + ' peserta · ' + jh + ' hadir' + pinjamText + '</span>'
      + (k.link_surat ? '<a href="' + k.link_surat + '" target="_blank" style="font-size:12px;color:var(--accent);text-decoration:none;font-weight:600">📎 Buka Surat Tugas</a>' : '')
      + '</div>'
      + statusUang
      + (canEdit ? '<div style="display:flex;gap:8px;margin-top:10px">
      + (canEdit ? '<div style="display:flex;gap:8px;margin-top:10px">'
        + '<button class="btn-sm btn-sm-edit" onclick="editKegiatan(\'' + k.id + '\')">Edit</button>'
        + '<button class="btn-sm btn-sm-del" onclick="deleteKegiatan(\'' + k.id + '\')">Hapus</button>'
        + '</div>' : '')
      + '</div>';
  }).join('')
  + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 100px">'
  + '<button class="pager-btn" ' + (kegiatanPage === 0 ? 'disabled' : '') + ' onclick="kegiatanPage=Math.max(0,kegiatanPage-1);renderKegiatanContent()">← Sebelumnya</button>'
  + '<span style="font-size:13px;color:var(--text2)">' + (kegiatanPage+1) + ' / ' + (maxP+1) + ' (' + filtered.length + ')</span>'
  + '<button class="pager-btn" ' + (kegiatanPage >= maxP ? 'disabled' : '') + ' onclick="kegiatanPage=Math.min('+maxP+',kegiatanPage+1);renderKegiatanContent()">Berikutnya →</button>'
  + '</div>';
}

function onSearchKegiatan(val) { searchKegiatan = val; kegiatanPage = 0; renderKegiatanContent(); }

function onFilterKegiatanChange() {
  var b = document.getElementById('keg-sel-bulan');
  var t = document.getElementById('keg-sel-tahun');
  filterKegiatanBulan = b ? parseInt(b.value) : 0;
  filterKegiatanTahun = t ? parseInt(t.value) : 0;
  kegiatanPage = 0;
  renderKegiatanContent();
}

function openSheetKegiatan() {
  editingKegiatanId = null;
  document.getElementById('kegiatan-sheet-title').textContent = 'Tambah Kegiatan';
  ['edit-kegiatan-id','kegiatan-nama','kegiatan-nomor-surat','kegiatan-tanggal-surat','kegiatan-link-surat','kegiatan-mulai','kegiatan-selesai','kegiatan-lokasi','kegiatan-catatan'].forEach(function(id){ document.getElementById(id).value = ''; });
  document.getElementById('kegiatan-mulai').value = new Date().toISOString().split('T')[0];
  currentKegiatanTipe = 'fullboard'; setKegiatanTipe('fullboard');
  populateBendahara(null); buildPesertaChecklist({}); updatePesertaInfo();
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
  document.getElementById('kegiatan-nomor-surat').value = k.nomor_surat || '';
  document.getElementById('kegiatan-tanggal-surat').value = k.tanggal_surat || '';
  document.getElementById('kegiatan-link-surat').value = k.link_surat || '';
  document.getElementById('kegiatan-mulai').value = k.tanggal_mulai;
  document.getElementById('kegiatan-selesai').value = k.tanggal_selesai || '';
  document.getElementById('kegiatan-lokasi').value = k.lokasi || '';
  document.getElementById('kegiatan-catatan').value = k.catatan || '';
  currentKegiatanTipe = k.tipe || 'fullboard'; setKegiatanTipe(currentKegiatanTipe);
  populateBendahara(k.bendahara_id);
  var existing = {};
  (k.kegiatan_peserta || []).forEach(function(p){ existing[p.anggota_id] = p.status_kehadiran || 'hadir'; });
  buildPesertaChecklist(existing); updatePesertaInfo();
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
  var pinjam = Object.values(pesertaStatus).filter(function(s){ return s === 'pinjam_nama'; }).length;
  var label = selected + ' dipilih';
  if (pinjam > 0) label += ' · ' + pinjam + ' pinjam nama';
  document.getElementById('peserta-info-label').textContent = label ? '(' + label + ')' : '';
}

function setKegiatanTipe(tipe) {
  currentKegiatanTipe = tipe;
  ['fullboard','perjadin','rapat','lainnya'].forEach(function(t){ document.getElementById('ktipe-' + t).className = 'tipe-btn' + (tipe === t ? ' active' : ''); });
}

async function submitKegiatan() {
  var nama = document.getElementById('kegiatan-nama').value.trim();
  var mulai = document.getElementById('kegiatan-mulai').value;
  if (!nama) { showToast('Nama kegiatan wajib diisi', 'red'); return; }
  if (!mulai) { showToast('Tanggal mulai wajib diisi', 'red'); return; }
  var pesertaIds = Object.keys(pesertaStatus);
  var payload = {
    nama: nama, tipe: currentKegiatanTipe,
    nomor_surat: document.getElementById('kegiatan-nomor-surat').value.trim() || null,
    tanggal_surat: document.getElementById('kegiatan-tanggal-surat').value || null,
    link_surat: document.getElementById('kegiatan-link-surat').value.trim() || null,
    tanggal_mulai: mulai,
    tanggal_selesai: document.getElementById('kegiatan-selesai').value || null,
    lokasi: document.getElementById('kegiatan-lokasi').value.trim() || null,
    jumlah_hari: 1, iuran_per_hari: 0,
    bendahara_id: document.getElementById('kegiatan-bendahara').value || null,
    catatan: document.getElementById('kegiatan-catatan').value.trim() || null,
    status: 'selesai'
  };
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
    var pesertaList = pesertaIds.map(function(aid){
      return { kegiatan_id: kegiatanId, anggota_id: aid, jumlah_hari: 1, nominal_iuran: 0, sudah_bayar: false, status_kehadiran: pesertaStatus[aid] || 'hadir' };
    });
    await db.from('kegiatan_peserta').insert(pesertaList);
  }
  btn.disabled = false; btn.textContent = 'Simpan Kegiatan';
  closeSheet('kegiatan');
  // Reset kegiatan-search-wrap agar re-render fresh setelah data berubah
  var sw = document.getElementById('kegiatan-search-wrap');
  if (sw) sw.parentNode.removeChild(sw);
  var contentEl = document.getElementById('kegiatan-content');
  if (contentEl) contentEl.parentNode.removeChild(contentEl);
  showToast(editingKegiatanId ? 'Kegiatan diperbarui' : 'Kegiatan disimpan', 'green');
  loadKegiatan();
}

async function deleteKegiatan(id) {
  if (!window.confirm('Hapus kegiatan ini?')) return;
  await db.from('kegiatan_peserta').delete().eq('kegiatan_id', id);
  var r = await db.from('kegiatan').delete().eq('id', id);
  if (!r.error) {
    // Reset search wrap agar re-render fresh
    var sw = document.getElementById('kegiatan-search-wrap');
    if (sw) sw.parentNode.removeChild(sw);
    loadKegiatan();
    showToast('Kegiatan dihapus', 'green');
  }
  else showToast('Gagal menghapus', 'red');
}
