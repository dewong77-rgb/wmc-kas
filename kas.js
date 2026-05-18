// WMC KAS - kas.js
var activeFilter = 'all';
var currentTrxPage = 0;
var selectedKatId = null;
var currentJenis = 'masuk';
var editingTrxId = null;
var pendingBuktiFile = null;
var selectedColor = '#22d172';
var currentKatJenis = 'masuk';
var currentKasTipe = 'tunai';
var COLORS = ['#22d172','#3b9eff','#ff5f5f','#fbbf24','#a78bfa','#f472b6','#34d399','#60a5fa','#fb923c','#e879f9','#4ade80','#38bdf8'];

// DASHBOARD
var dashBulan = -1;
var dashTahun = -1;

function renderDashboard() {
  var years = {};
  allTrx.forEach(function(t) { years[new Date(t.tanggal).getFullYear()] = true; });
  var yearList = Object.keys(years).sort(function(a,b){ return b-a; });
  if (dashTahun === -1 && yearList.length) dashTahun = parseInt(yearList[0]);

  var filterHTML = '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">'
    + '<button class="filter-chip' + (dashBulan === -1 && dashTahun === -1 ? ' active' : '') + '" onclick="setDashFilter(-1,-1)">Semua</button>'
    + '<select id="dash-sel-bulan" style="background:var(--surface);border:1.5px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);font-size:13px;font-family:var(--font);outline:none" onchange="onDashFilterChange()">'
    + '<option value="-1">Pilih Bulan</option>'
    + BULAN_NAMA.map(function(b,i){ return '<option value="'+i+'"'+(dashBulan===i?' selected':'')+'>'+b+'</option>'; }).join('')
    + '</select>'
    + '<select id="dash-sel-tahun" style="background:var(--surface);border:1.5px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);font-size:13px;font-family:var(--font);outline:none" onchange="onDashFilterChange()">'
    + '<option value="-1">Pilih Tahun</option>'
    + yearList.map(function(y){ return '<option value="'+y+'"'+(dashTahun===parseInt(y)?' selected':'')+'>'+y+'</option>'; }).join('')
    + '</select>'
    + '</div>';
  document.getElementById('dash-filter-wrap').innerHTML = filterHTML;

  var trxFiltered = allTrx.filter(function(t) {
    if (dashBulan === -1 && dashTahun === -1) return true;
    var d = new Date(t.tanggal);
    var matchB = dashBulan === -1 || d.getMonth() === dashBulan;
    var matchT = dashTahun === -1 || d.getFullYear() === dashTahun;
    return matchB && matchT;
  });

  var periodLabel = dashBulan === -1 && dashTahun === -1 ? 'Semua Periode'
    : (dashBulan >= 0 ? BULAN_NAMA[dashBulan] + ' ' : '') + (dashTahun > 0 ? dashTahun : '');

  var totalMasuk = 0, totalKeluar = 0;
  trxFiltered.forEach(function(t) {
    if (t.jenis === 'masuk') totalMasuk += t.nominal; else totalKeluar += t.nominal;
  });
  var saldoKeseluruhan = 0;
  allTrx.forEach(function(t){ saldoKeseluruhan += t.jenis === 'masuk' ? t.nominal : -t.nominal; });

  document.getElementById('saldo-total').textContent = formatRp(saldoKeseluruhan);
  document.getElementById('saldo-total').style.color = saldoKeseluruhan >= 0 ? 'white' : 'var(--red)';
  document.getElementById('masuk-bulan').textContent = formatRp(totalMasuk);
  document.getElementById('keluar-bulan').textContent = formatRp(totalKeluar);
  var net = totalMasuk - totalKeluar;
  document.getElementById('net-bulan').textContent = formatRp(net);
  document.getElementById('net-bulan').style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('trx-count').textContent = trxFiltered.length + ' transaksi';
  var labelEl = document.getElementById('dash-periode-label');
  if (labelEl) labelEl.textContent = periodLabel;

  renderPieChart(totalMasuk, totalKeluar);
  renderTopKategori(trxFiltered);
  renderTopKegiatan(trxFiltered);
}

function setDashFilter(bulan, tahun) { dashBulan = bulan; dashTahun = tahun; renderDashboard(); }
function onDashFilterChange() {
  var b = document.getElementById('dash-sel-bulan');
  var t = document.getElementById('dash-sel-tahun');
  dashBulan = b ? parseInt(b.value) : -1;
  dashTahun = t ? parseInt(t.value) : -1;
  renderDashboard();
}

function renderPieChart(totalMasuk, totalKeluar) {
  var total = totalMasuk + totalKeluar;
  if (!total) {
    document.getElementById('pie-svg').innerHTML = '<circle cx="55" cy="55" r="38" fill="none" stroke="#2a3f55" stroke-width="16"/>';
    document.getElementById('pie-legend').innerHTML = '<div style="color:var(--text3);font-size:13px">Belum ada data</div>';
    return;
  }
  var pM = totalMasuk / total, pK = totalKeluar / total;
  var r = 38, cx = 55, cy = 55, sw = 16, circ = 2 * Math.PI * r;
  document.getElementById('pie-svg').innerHTML =
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#22d172" stroke-width="' + sw + '" stroke-dasharray="' + (pM * circ) + ' ' + circ + '" stroke-dashoffset="' + (circ * 0.25) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" />'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#ff5f5f" stroke-width="' + sw + '" stroke-dasharray="' + (pK * circ) + ' ' + circ + '" stroke-dashoffset="' + (-(pM * circ) + circ * 0.25) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" />'
    + '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" fill="#e8eef5" font-size="11" font-family="Plus Jakarta Sans" font-weight="700">' + Math.round(pM * 100) + '%</text>'
    + '<text x="' + cx + '" y="' + (cy + 10) + '" text-anchor="middle" fill="#8fa3b8" font-size="9" font-family="Plus Jakarta Sans">Masuk</text>';
  document.getElementById('pie-legend').innerHTML =
    '<div class="pie-leg-item"><div class="pie-leg-dot" style="background:var(--green)"></div><div class="pie-leg-label">Pemasukan</div><div><span class="pie-leg-val" style="color:var(--green)">' + formatRp(totalMasuk) + '</span><span class="pie-leg-pct">' + Math.round(pM * 100) + '%</span></div></div>'
    + '<div class="pie-leg-item"><div class="pie-leg-dot" style="background:var(--red)"></div><div class="pie-leg-label">Pengeluaran</div><div><span class="pie-leg-val" style="color:var(--red)">' + formatRp(totalKeluar) + '</span><span class="pie-leg-pct">' + Math.round(pK * 100) + '%</span></div></div>'
    + '<div class="pie-leg-item" style="border-top:1px solid var(--border);padding-top:10px"><div class="pie-leg-dot" style="background:var(--accent)"></div><div class="pie-leg-label">Saldo Bersih</div><div><span class="pie-leg-val" style="color:' + (totalMasuk >= totalKeluar ? 'var(--green)' : 'var(--red)') + '">' + formatRp(totalMasuk - totalKeluar) + '</span></div></div>';
}

function renderTopKategori(trxFiltered) {
  function topKat(jenis, elId, emptyMsg) {
    var map = {};
    trxFiltered.filter(function(t) { return t.jenis === jenis; }).forEach(function(t) {
      var nama = t.kategori ? t.kategori.nama : 'Lain-lain';
      var warna = t.kategori ? t.kategori.warna : (jenis === 'masuk' ? '#22d172' : '#ff5f5f');
      if (!map[nama]) map[nama] = { nama: nama, warna: warna, total: 0 };
      map[nama].total += t.nominal;
    });
    var sorted = Object.values(map).sort(function(a, b) { return b.total - a.total; }).slice(0, 4);
    if (!sorted.length) { document.getElementById(elId).innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">' + emptyMsg + '</div>'; return; }
    var maxVal = sorted[0].total;
    document.getElementById(elId).innerHTML = sorted.map(function(k, i) {
      return '<div class="top-kat-item"><div class="top-kat-rank">' + (i + 1) + '</div><div class="top-kat-info"><div class="top-kat-name">' + k.nama + '</div><div class="top-kat-bar-wrap"><div class="top-kat-bar" style="width:' + Math.round((k.total / maxVal) * 100) + '%;background:' + k.warna + '"></div></div></div><div class="top-kat-val" style="color:' + k.warna + '">' + formatRp(k.total) + '</div></div>';
    }).join('');
  }
  topKat('masuk', 'top-masuk', 'Tidak ada pemasukan');
  topKat('keluar', 'top-keluar', 'Tidak ada pengeluaran');
}

function renderTopKegiatan(trxFiltered) {
  var el = document.getElementById('top-kegiatan');
  if (!el) return;
  var map = {};
  trxFiltered.filter(function(t){ return t.jenis === 'masuk' && t.kegiatan_id; }).forEach(function(t) {
    var keg = t.kegiatan ? t.kegiatan.nama : t.kegiatan_id;
    if (!map[keg]) map[keg] = { nama: keg, total: 0 };
    map[keg].total += t.nominal;
  });
  var sorted = Object.values(map).sort(function(a,b){ return b.total - a.total; });
  if (!sorted.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">Tidak ada pemasukan terkait kegiatan</div>'; return; }
  var maxVal = sorted[0].total;
  el.innerHTML = sorted.slice(0, 5).map(function(k, i) {
    return '<div class="top-kat-item"><div class="top-kat-rank">' + (i + 1) + '</div>'
      + '<div class="top-kat-info"><div class="top-kat-name">' + k.nama + '</div>'
      + '<div class="top-kat-bar-wrap"><div class="top-kat-bar" style="width:' + Math.round((k.total / maxVal) * 100) + '%;background:var(--green)"></div></div></div>'
      + '<div class="top-kat-val" style="color:var(--green)">' + formatRp(k.total) + '</div></div>';
  }).join('');
}

// TRANSAKSI
function trxHTML(t) {
  var katNama = t.kategori ? t.kategori.nama : '-';
  var tgl = new Date(t.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
  var kegNama = t.kegiatan ? ' · 📅 ' + t.kegiatan.nama : '';
  var posNama = t.pos_anggaran ? ' · 📊 ' + t.pos_anggaran.nama : '';
  return '<div class="trx-item" onclick="openDetail(\'' + t.id + '\')">'
    + '<div class="trx-dot ' + t.jenis + '"></div>'
    + '<div class="trx-info"><div class="trx-ket">' + (t.keterangan || katNama) + '</div><div class="trx-meta">' + tgl + ' · ' + katNama + kegNama + posNama + (t.bukti_url ? ' · 📎' : '') + '</div></div>'
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
  var trxPage = typeof currentTrxPage !== 'undefined' ? currentTrxPage : 0;
  var start = trxPage * 10;
  var slice = filtered.slice(start, start + 10);
  var maxP = Math.ceil(filtered.length / 10) - 1;
  document.getElementById('trx-all').innerHTML = filtered.length
    ? slice.map(trxHTML).join('')
      + (filtered.length > 10
        ? '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 20px">'
          + '<button class="pager-btn" ' + (trxPage === 0 ? 'disabled' : '') + ' onclick="currentTrxPage=Math.max(0,currentTrxPage-1);renderTrxList()">← Sebelumnya</button>'
          + '<span style="font-size:13px;color:var(--text2)">' + (trxPage+1) + ' / ' + (maxP+1) + ' (' + filtered.length + ')</span>'
          + '<button class="pager-btn" ' + (trxPage >= maxP ? 'disabled' : '') + ' onclick="currentTrxPage=Math.min('+maxP+',currentTrxPage+1);renderTrxList()">Berikutnya →</button>'
          + '</div>'
        : '')
    : '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Tidak ada transaksi</div></div>';
}

function setFilter(el, val) {
  document.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  activeFilter = val;
  currentTrxPage = 0;
  renderTrxList(document.getElementById('trx-search').value);
}

function openDetail(id) {
  var t = null;
  for (var i = 0; i < allTrx.length; i++) { if (allTrx[i].id === id) { t = allTrx[i]; break; } }
  if (!t) return;
  var tgl = new Date(t.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'long', year: 'numeric' });
  var sc = { lunas: 'green', pending: 'yellow', batal: 'red' };
  document.getElementById('detail-title').textContent = t.jenis === 'masuk' ? 'Uang Masuk' : 'Uang Keluar';
  document.getElementById('detail-content').innerHTML =
    '<div class="detail-row"><div class="detail-key">Nominal</div><div class="detail-val" style="font-family:var(--mono);font-size:20px;color:' + (t.jenis === 'masuk' ? 'var(--green)' : 'var(--red)') + '">' + (t.jenis === 'masuk' ? '+' : '-') + formatRp(t.nominal) + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Tanggal</div><div class="detail-val">' + tgl + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Kategori</div><div class="detail-val">' + (t.kategori ? t.kategori.nama : '-') + '</div></div>'
    + '<div class="detail-row"><div class="detail-key">Posisi Kas</div><div class="detail-val">' + (t.posisi_kas ? t.posisi_kas.nama : '-') + '</div></div>'
    + (t.pos_anggaran ? '<div class="detail-row"><div class="detail-key">Pos Anggaran</div><div class="detail-val" style="color:' + t.pos_anggaran.warna + '">' + t.pos_anggaran.nama + '</div></div>' : '')
    + (t.kegiatan ? '<div class="detail-row"><div class="detail-key">Kegiatan</div><div class="detail-val">' + t.kegiatan.nama + '</div></div>' : '')
    + '<div class="detail-row"><div class="detail-key">Status</div><div class="detail-val"><span class="badge ' + (sc[t.status] || 'green') + '">' + t.status + '</span></div></div>'
    + '<div class="detail-row"><div class="detail-key">Keterangan</div><div class="detail-val">' + (t.keterangan || '-') + '</div></div>';
  var buktiWrap = document.getElementById('detail-bukti-wrap');
  var buktiImg = document.getElementById('detail-bukti-img');
  var delBuktiBtn = document.getElementById('btn-del-bukti');
  if (t.bukti_url) {
    buktiWrap.style.display = 'block'; buktiImg.src = t.bukti_url;
    delBuktiBtn.style.display = currentProfile && currentProfile.role === 'admin' ? 'block' : 'none';
    delBuktiBtn.onclick = function() { deleteBukti(t.id, t.bukti_url); };
  } else { buktiWrap.style.display = 'none'; }
  var canEdit = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'bendahara');
  var canDel = currentProfile && currentProfile.role === 'admin';
  var eb = document.getElementById('btn-edit-trx');
  var db2 = document.getElementById('btn-delete-trx');
  eb.style.display = canEdit ? 'block' : 'none';
  db2.style.display = canDel ? 'block' : 'none';
  eb.onclick = function() { closeSheet('detail'); openEditTrx(id); };
  db2.onclick = function() { deleteTrx(id); };

  // Tombol alokasi — hanya untuk masuk dan admin
  var btnAlokasi = document.getElementById('btn-alokasi-trx');
  if (btnAlokasi) {
    var sudahAlokasi = allAlokasiMasuk.some(function(a){ return a.transaksi_id === t.id; });
    btnAlokasi.style.display = (t.jenis === 'masuk' && canEdit && allPosAnggaran.length > 0) ? 'block' : 'none';
    btnAlokasi.textContent = sudahAlokasi ? '📊 Edit Alokasi' : '📊 Alokasi ke Pos';
    btnAlokasi.onclick = function() { closeSheet('detail'); openSheetAlokasi(t.id, t.nominal); };
  }

  openSheet('detail');
}

async function deleteBukti(trxId, buktiUrl) {
  if (!confirm('Hapus bukti?')) return;
  var path = buktiUrl.split('/bukti-transaksi/')[1];
  if (path) await db.storage.from('bukti-transaksi').remove([decodeURIComponent(path)]);
  await db.from('transaksi').update({ bukti_url: null }).eq('id', trxId);
  closeSheet('detail'); await loadTrx(); renderDashboard(); showToast('Bukti dihapus', 'green');
}

function openEditTrx(id) {
  var t = null;
  for (var i = 0; i < allTrx.length; i++) { if (allTrx[i].id === id) { t = allTrx[i]; break; } }
  if (!t) return;
  editingTrxId = id;
  document.getElementById('trx-sheet-title').textContent = 'Edit Transaksi';
  document.getElementById('edit-trx-id').value = id;
  setJenis(t.jenis);
  document.getElementById('trx-nominal-display').value = parseInt(t.nominal).toLocaleString('id-ID');
  document.getElementById('trx-nominal-raw').value = t.nominal;
  document.getElementById('trx-tanggal').value = t.tanggal;
  document.getElementById('trx-status').value = t.status;
  document.getElementById('trx-ket').value = t.keterangan || '';
  selectedKatId = t.kategori_id; renderKatGrid(); populateKasSelect();
  document.getElementById('trx-kas').value = t.posisi_kas_id || '';
  if (t.jenis === 'masuk') {
    populateKegiatanSelect(t.kegiatan_id || '');
    var kegWrap = document.getElementById('trx-kegiatan-wrap');
    if (kegWrap) kegWrap.style.display = 'block';
    var posWrap = document.getElementById('trx-pos-wrap');
    if (posWrap) posWrap.style.display = 'none';
  } else {
    populatePosSelect(t.pos_id || '');
    var kegWrap2 = document.getElementById('trx-kegiatan-wrap');
    if (kegWrap2) kegWrap2.style.display = 'none';
    var posWrap2 = document.getElementById('trx-pos-wrap');
    if (posWrap2) posWrap2.style.display = 'block';
  }
  var curWrap = document.getElementById('current-bukti-wrap');
  if (t.bukti_url) { curWrap.style.display = 'block'; document.getElementById('current-bukti-img').src = t.bukti_url; }
  else { curWrap.style.display = 'none'; }
  pendingBuktiFile = null;
  document.getElementById('bukti-preview').style.display = 'none';
  document.getElementById('bukti-filename').style.display = 'none';
  document.getElementById('bukti-error').style.display = 'none';
  var overlay = document.getElementById('overlay-trx');
  var sheet = document.getElementById('sheet-trx');
  overlay.classList.add('show');
  setTimeout(function() { sheet.classList.add('show'); }, 10);
}

async function deleteTrx(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  var r = await db.from('transaksi').update({ status: 'batal' }).eq('id', id);
  if (!r.error) { closeSheet('detail'); await loadTrx(); renderDashboard(); renderTrxList(); showToast('Transaksi dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

function resetTrxForm() {
  if (editingTrxId) return;
  document.getElementById('trx-sheet-title').textContent = 'Transaksi Baru';
  document.getElementById('edit-trx-id').value = '';
  document.getElementById('trx-nominal-display').value = '';
  document.getElementById('trx-nominal-raw').value = '';
  document.getElementById('trx-ket').value = '';
  document.getElementById('trx-status').value = 'lunas';
  document.getElementById('trx-tanggal').value = new Date().toISOString().split('T')[0];
  document.getElementById('bukti-preview').style.display = 'none';
  document.getElementById('bukti-filename').style.display = 'none';
  document.getElementById('bukti-error').style.display = 'none';
  document.getElementById('current-bukti-wrap').style.display = 'none';
  document.getElementById('bukti-file').value = '';
  pendingBuktiFile = null;
  selectedKatId = null;
  var kegSel = document.getElementById('trx-kegiatan');
  if (kegSel) kegSel.value = '';
  var posSel = document.getElementById('trx-pos');
  if (posSel) posSel.value = '';
  setJenis('masuk');
}

function setJenis(jenis) {
  currentJenis = jenis;
  document.getElementById('jenis-masuk').className = 'jenis-btn' + (jenis === 'masuk' ? ' active masuk' : '');
  document.getElementById('jenis-keluar').className = 'jenis-btn' + (jenis === 'keluar' ? ' active keluar' : '');
  document.getElementById('btn-submit-trx').className = 'btn-submit ' + (jenis === 'masuk' ? 'green' : 'red');
  if (!editingTrxId) selectedKatId = null;
  renderKatGrid();

  // Kegiatan — hanya masuk
  var kegWrap = document.getElementById('trx-kegiatan-wrap');
  if (kegWrap) {
    kegWrap.style.display = jenis === 'masuk' ? 'block' : 'none';
    if (jenis === 'masuk') populateKegiatanSelect();
  }

  // Pos anggaran — hanya keluar
  var posWrap = document.getElementById('trx-pos-wrap');
  if (posWrap) {
    posWrap.style.display = jenis === 'keluar' ? 'block' : 'none';
    if (jenis === 'keluar') populatePosSelect();
  }
}

function populateKegiatanSelect(selectedId) {
  var sel = document.getElementById('trx-kegiatan');
  if (!sel) return;
  var sorted = allKegiatan.slice().sort(function(a, b) {
    var da = a.tanggal_surat ? new Date(a.tanggal_surat) : new Date(a.tanggal_mulai);
    var db2 = b.tanggal_surat ? new Date(b.tanggal_surat) : new Date(b.tanggal_mulai);
    return db2 - da;
  });
  sel.innerHTML = '<option value="">Tidak terkait kegiatan</option>'
    + sorted.map(function(k) {
        var tgl = new Date(k.tanggal_mulai).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
        return '<option value="' + k.id + '"' + (selectedId === k.id ? ' selected' : '') + '>' + k.nama + ' · ' + tgl + '</option>';
      }).join('');
  sel.onchange = function() {
    var ketEl = document.getElementById('trx-ket');
    if (!sel.value) return;
    var k = allKegiatan.filter(function(x){ return x.id === sel.value; })[0];
    if (k && ketEl && !ketEl.value) ketEl.value = k.nama;
  };
}

function populatePosSelect(selectedId) {
  var sel = document.getElementById('trx-pos');
  if (!sel) return;
  sel.innerHTML = '<option value="">Tidak terkait pos anggaran</option>'
    + allPosAnggaran.map(function(p) {
        return '<option value="' + p.id + '"' + (selectedId === p.id ? ' selected' : '') + '>' + p.nama + '</option>';
      }).join('');
}

function renderKatGrid() {
  var filtered = allKategori.filter(function(k) { return k.jenis === currentJenis; });
  document.getElementById('kat-grid').innerHTML = filtered.length
    ? filtered.map(function(k) {
        return '<div class="kat-chip' + (selectedKatId === k.id ? ' selected' : '') + '" onclick="selectKat(\'' + k.id + '\')">' + k.nama + '</div>';
      }).join('')
    : '<div style="color:var(--text3);font-size:12px;padding:8px 0;grid-column:span 3">Belum ada kategori.</div>';
}
function selectKat(id) { selectedKatId = id; renderKatGrid(); }

function populateKasSelect() {
  document.getElementById('trx-kas').innerHTML = '<option value="">Pilih posisi kas...</option>'
    + allKas.map(function(k) { return '<option value="' + k.id + '">' + k.nama + '</option>'; }).join('');
}

function previewBukti(input) {
  var errEl = document.getElementById('bukti-error');
  var fnEl = document.getElementById('bukti-filename');
  var prevEl = document.getElementById('bukti-preview');
  errEl.style.display = 'none'; fnEl.style.display = 'none'; prevEl.style.display = 'none';
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > MAX_BUKTI_SIZE) {
    errEl.textContent = 'File terlalu besar. Maks 200KB. Ukuran: ' + Math.round(file.size / 1024) + 'KB';
    errEl.style.display = 'block'; input.value = ''; pendingBuktiFile = null; return;
  }
  pendingBuktiFile = file;
  fnEl.textContent = file.name + ' (' + Math.round(file.size / 1024) + 'KB)'; fnEl.style.display = 'block';
  if (file.type.startsWith('image/')) {
    var reader = new FileReader();
    reader.onload = function(e) { prevEl.src = e.target.result; prevEl.style.display = 'block'; };
    reader.readAsDataURL(file);
  }
}

async function uploadBukti(trxId) {
  if (!pendingBuktiFile) return null;
  var ext = pendingBuktiFile.name.split('.').pop();
  var path = trxId + '/' + Date.now() + '.' + ext;
  var r = await db.storage.from('bukti-transaksi').upload(path, pendingBuktiFile, { upsert: true });
  if (r.error) { showToast('Gagal upload bukti', 'red'); return null; }
  return db.storage.from('bukti-transaksi').getPublicUrl(path).data.publicUrl;
}

async function submitTrx() {
  var editId = document.getElementById('edit-trx-id').value;
  var nominal = parseFloat(document.getElementById('trx-nominal-raw').value);
  var tanggal = document.getElementById('trx-tanggal').value;
  var kasId = document.getElementById('trx-kas').value;
  var ket = document.getElementById('trx-ket').value.trim();
  var status = document.getElementById('trx-status').value;
  if (!nominal || nominal <= 0) { showToast('Nominal harus diisi', 'red'); return; }
  if (!tanggal) { showToast('Tanggal harus diisi', 'red'); return; }
  if (!kasId) { showToast('Pilih posisi kas', 'red'); return; }
  if (!selectedKatId) { showToast('Pilih kategori', 'red'); return; }
  if (pendingBuktiFile && pendingBuktiFile.size > MAX_BUKTI_SIZE) { showToast('File bukti terlalu besar', 'red'); return; }

  var btn = document.getElementById('btn-submit-trx');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  var kegiatanId = document.getElementById('trx-kegiatan') ? document.getElementById('trx-kegiatan').value || null : null;
  var posId = document.getElementById('trx-pos') ? document.getElementById('trx-pos').value || null : null;

  var payload = {
    jenis: currentJenis, nominal: nominal, tanggal: tanggal,
    posisi_kas_id: kasId, kategori_id: selectedKatId, keterangan: ket, status: status,
    kegiatan_id: currentJenis === 'masuk' ? kegiatanId : null,
    pos_id: currentJenis === 'keluar' ? posId : null
  };

  var r, trxId;
  if (editId) {
    r = await db.from('transaksi').update(payload).eq('id', editId).select().single(); trxId = editId;
  } else {
    payload.input_oleh = currentUser.id;
    r = await db.from('transaksi').insert(payload).select().single(); trxId = r.data ? r.data.id : null;
  }
  if (r.error) { showToast('Gagal: ' + r.error.message, 'red'); btn.disabled = false; btn.textContent = 'Simpan Transaksi'; return; }
  if (pendingBuktiFile && trxId) {
    btn.textContent = 'Upload bukti...';
    var buktiUrl = await uploadBukti(trxId);
    if (buktiUrl) await db.from('transaksi').update({ bukti_url: buktiUrl }).eq('id', trxId);
  }
  btn.disabled = false; btn.textContent = 'Simpan Transaksi'; pendingBuktiFile = null;
  editingTrxId = null;
  closeSheet('trx'); await loadTrx(); renderDashboard(); renderTrxList();

  // Jika pemasukan baru dan ada pos anggaran, tawarkan alokasi
  if (currentJenis === 'masuk' && !editId && allPosAnggaran.length > 0 && trxId) {
    setTimeout(function() {
      openSheetAlokasi(trxId, nominal);
    }, 500);
  }

  showToast(editId ? 'Transaksi diperbarui' : 'Transaksi tersimpan', 'green');
}

// KATEGORI
function renderKategoriPage() {
  var masuk = allKategori.filter(function(k) { return k.jenis === 'masuk'; });
  var keluar = allKategori.filter(function(k) { return k.jenis === 'keluar'; });
  function katItem(k) {
    var isAdmin = currentProfile && currentProfile.role === 'admin';
    return '<div class="kat-manage-item">'
      + '<div class="kat-color-dot" style="background:' + k.warna + '"></div>'
      + '<div class="kat-manage-name">' + k.nama + '</div>'
      + (isAdmin ? '<button class="btn-sm btn-sm-edit" onclick="editKat(\'' + k.id + '\',\'' + escQ(k.nama) + '\',\'' + k.jenis + '\',\'' + k.warna + '\')">Edit</button>' : '')
      + (isAdmin ? '<button class="btn-sm btn-sm-del" onclick="deleteKat(\'' + k.id + '\')">Hapus</button>' : '')
      + '</div>';
  }
  document.getElementById('kat-masuk-list').innerHTML = masuk.map(katItem).join('') || '<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada</div>';
  document.getElementById('kat-keluar-list').innerHTML = keluar.map(katItem).join('') || '<div style="color:var(--text3);font-size:13px;padding:8px 0">Belum ada</div>';
}
function openSheetKat(jenis) { document.getElementById('kat-sheet-title').textContent = 'Tambah Kategori'; document.getElementById('edit-kat-id').value = ''; document.getElementById('kat-nama').value = ''; currentKatJenis = jenis || 'masuk'; selectedColor = '#22d172'; setKatJenis(currentKatJenis); buildColorGrid(); openSheet('kat'); }
function editKat(id, nama, jenis, warna) { document.getElementById('kat-sheet-title').textContent = 'Edit Kategori'; document.getElementById('edit-kat-id').value = id; document.getElementById('kat-nama').value = nama; currentKatJenis = jenis; selectedColor = warna; setKatJenis(jenis); buildColorGrid(); openSheet('kat'); }
function setKatJenis(jenis) { currentKatJenis = jenis; document.getElementById('kat-jenis-masuk').className = 'jenis-btn' + (jenis === 'masuk' ? ' active masuk' : ''); document.getElementById('kat-jenis-keluar').className = 'jenis-btn' + (jenis === 'keluar' ? ' active keluar' : ''); }
function buildColorGrid() { var el = document.getElementById('color-grid'); if (!el) return; el.innerHTML = COLORS.map(function(c) { return '<div class="color-dot' + (selectedColor === c ? ' selected' : '') + '" style="background:' + c + '" onclick="selectColor(\'' + c + '\')"></div>'; }).join(''); }
function selectColor(c) { selectedColor = c; buildColorGrid(); }
async function submitKat() {
  var editId = document.getElementById('edit-kat-id').value;
  var nama = document.getElementById('kat-nama').value.trim();
  if (!nama) { showToast('Nama wajib diisi', 'red'); return; }
  var btn = document.getElementById('btn-submit-kat'); btn.disabled = true; btn.textContent = 'Menyimpan...';
  var payload = { nama: nama, jenis: currentKatJenis, warna: selectedColor };
  var r = editId ? await db.from('kategori').update(payload).eq('id', editId) : await db.from('kategori').insert(Object.assign(payload, { aktif: true, urutan: 99 }));
  btn.disabled = false; btn.textContent = 'Simpan Kategori';
  if (!r.error) { closeSheet('kat'); await loadKategori(); renderKategoriPage(); showToast('Kategori disimpan', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}
async function deleteKat(id) {
  if (!confirm('Hapus kategori ini?')) return;
  var r = await db.from('kategori').update({ aktif: false }).eq('id', id);
  if (!r.error) { await loadKategori(); renderKategoriPage(); showToast('Kategori dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

// POSISI KAS
async function loadPosKasPage() {
  await loadKas();
  var icons = { tunai: '💵', bank: '🏦', ewallet: '📱' };
  document.getElementById('poskas-list').innerHTML = allKas.length
    ? allKas.map(function(k) {
        return '<div class="admin-item"><div class="admin-item-icon">' + (icons[k.tipe] || '💰') + '</div><div class="admin-item-info"><div class="admin-item-name">' + k.nama + '</div><div class="admin-item-sub">' + k.tipe.toUpperCase() + (k.nomor_rekening ? ' · ' + k.nomor_rekening : '') + '</div></div><div class="admin-item-actions"><button class="btn-sm btn-sm-edit" onclick="editKas(\'' + k.id + '\',\'' + escQ(k.nama) + '\',\'' + k.tipe + '\',\'' + escQ(k.nomor_rekening || '') + '\')">Edit</button><button class="btn-sm btn-sm-del" onclick="deletePosKas(\'' + k.id + '\')">Hapus</button></div></div>';
      }).join('')
    : '<div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-text">Belum ada posisi kas</div></div>';
}
function openSheetKas() { document.getElementById('kas-sheet-title').textContent = 'Tambah Posisi Kas'; document.getElementById('edit-kas-id').value = ''; document.getElementById('kas-nama').value = ''; document.getElementById('kas-norek').value = ''; currentKasTipe = 'tunai'; setKasTipe('tunai'); openSheet('kas'); }
function editKas(id, nama, tipe, norek) { document.getElementById('kas-sheet-title').textContent = 'Edit Posisi Kas'; document.getElementById('edit-kas-id').value = id; document.getElementById('kas-nama').value = nama; document.getElementById('kas-norek').value = norek; currentKasTipe = tipe; setKasTipe(tipe); openSheet('kas'); }
function setKasTipe(tipe) { currentKasTipe = tipe; ['tunai','bank','ewallet'].forEach(function(t) { document.getElementById('kas-tipe-' + t).className = 'tipe-btn' + (tipe === t ? ' active' : ''); }); }
async function submitKas() {
  var editId = document.getElementById('edit-kas-id').value;
  var nama = document.getElementById('kas-nama').value.trim();
  var norek = document.getElementById('kas-norek').value.trim();
  if (!nama) { showToast('Nama wajib diisi', 'red'); return; }
  var btn = document.getElementById('btn-submit-kas'); btn.disabled = true; btn.textContent = 'Menyimpan...';
  var payload = { nama: nama, tipe: currentKasTipe, nomor_rekening: norek || null };
  var r = editId ? await db.from('posisi_kas').update(payload).eq('id', editId) : await db.from('posisi_kas').insert(Object.assign(payload, { aktif: true, urutan: 99 }));
  btn.disabled = false; btn.textContent = 'Simpan Posisi Kas';
  if (!r.error) { closeSheet('kas'); await loadKas(); loadPosKasPage(); populateKasSelect(); showToast('Posisi kas disimpan', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}
async function deletePosKas(id) {
  if (!confirm('Hapus posisi kas ini?')) return;
  var r = await db.from('posisi_kas').update({ aktif: false }).eq('id', id);
  if (!r.error) { await loadKas(); loadPosKasPage(); showToast('Posisi kas dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}
