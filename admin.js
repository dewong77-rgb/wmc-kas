// WMC KAS - admin.js
var currentPeriod = 'bulan';
var editingPosId = null;
var COLORS_POS = ['#3b9eff','#22d172','#ff5f5f','#fbbf24','#a78bfa','#f472b6','#34d399','#60a5fa','#fb923c','#e879f9'];
var selectedPosColor = '#3b9eff';
var draftAlokasi = []; // { pos_id, nama, warna, nominal, pct }

// =====================
// POS ANGGARAN
// =====================
function renderPosAnggaranPage() {
  var isAdmin = currentProfile && currentProfile.role === 'admin';
  var el = document.getElementById('anggaran-list');
  if (!el) return;

  // Hitung saldo per pos dari alokasi konfirmasi dikurangi pengeluaran
  var saldoPos = {};
  allPosAnggaran.forEach(function(p) { saldoPos[p.id] = 0; });

  // Pemasukan yang sudah dikonfirmasi
  allAlokasiMasuk.filter(function(a){ return a.status === 'konfirmasi'; }).forEach(function(a) {
    if (saldoPos[a.pos_id] !== undefined) saldoPos[a.pos_id] += a.nominal;
  });

  // Pengeluaran yang dikaitkan ke pos
  allTrx.filter(function(t){ return t.jenis === 'keluar' && t.pos_id; }).forEach(function(t) {
    if (saldoPos[t.pos_id] !== undefined) saldoPos[t.pos_id] -= t.nominal;
  });

  // Total alokasi masuk belum dikonfirmasi
  var draftBelum = allAlokasiMasuk.filter(function(a){ return a.status === 'draft'; });

  // Header ringkasan
  var totalMasukPos = Object.values(saldoPos).reduce(function(s,v){ return s + (v > 0 ? v : 0); }, 0);
  var totalPct = allPosAnggaran.reduce(function(s,p){ return s + (p.persentase || 0); }, 0);

  var headerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:16px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    + '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em">Pos Anggaran</div>'
    + (isAdmin ? '<button class="btn-sm btn-sm-edit" onclick="openSheetPos()">+ Tambah Pos</button>' : '')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    + '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--green)">' + formatRp(totalMasukPos) + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Total Saldo Pos</div></div>'
    + '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:' + (Math.round(totalPct) === 100 ? 'var(--green)' : 'var(--yellow)') + '">' + Math.round(totalPct) + '%</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Total Alokasi</div></div>'
    + '</div>'
    + (Math.round(totalPct) !== 100 ? '<div style="font-size:11px;color:var(--yellow);margin-top:8px">⚠️ Total persentase belum 100% — sisa ' + (100 - Math.round(totalPct)) + '% belum teralokasi</div>' : '')
    + '</div>';

  // List pos
  var posHTML = allPosAnggaran.length ? allPosAnggaran.map(function(p) {
    var saldo = saldoPos[p.id] || 0;
    var totalMasuk = allAlokasiMasuk.filter(function(a){ return a.pos_id === p.id && a.status === 'konfirmasi'; }).reduce(function(s,a){ return s+a.nominal; }, 0);
    var totalKeluar = allTrx.filter(function(t){ return t.jenis === 'keluar' && t.pos_id === p.id; }).reduce(function(s,t){ return s+t.nominal; }, 0);
    var pctPakai = totalMasuk > 0 ? Math.min(100, Math.round((totalKeluar / totalMasuk) * 100)) : 0;
    var barColor = pctPakai >= 90 ? 'var(--red)' : pctPakai >= 70 ? 'var(--yellow)' : 'var(--green)';
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
      + '<div style="width:12px;height:12px;border-radius:50%;background:' + p.warna + ';flex-shrink:0"></div>'
      + '<div style="flex:1"><div style="font-size:14px;font-weight:700">' + p.nama + '</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + p.persentase + '% alokasi' + (p.deskripsi ? ' · ' + p.deskripsi : '') + '</div></div>'
      + '<div style="font-size:16px;font-weight:800;font-family:var(--mono);color:' + (saldo >= 0 ? 'var(--green)' : 'var(--red)') + '">' + formatRp(saldo) + '</div>'
      + '</div>'
      + (totalMasuk > 0
        ? '<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:6px"><div style="height:6px;background:' + barColor + ';width:' + pctPakai + '%"></div></div>'
          + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2)">'
          + '<span>Masuk: <span style="color:var(--green)">' + formatRp(totalMasuk) + '</span></span>'
          + '<span>Keluar: <span style="color:var(--red)">' + formatRp(totalKeluar) + '</span></span>'
          + '</div>'
        : '<div style="font-size:11px;color:var(--text3)">Belum ada alokasi masuk</div>')
      + (isAdmin ? '<div style="display:flex;gap:6px;margin-top:10px">'
        + '<button class="btn-sm btn-sm-edit" onclick="editPos(\'' + p.id + '\',\'' + escQ(p.nama) + '\',\'' + escQ(p.deskripsi||'') + '\',' + p.persentase + ',\'' + p.warna + '\')">Edit</button>'
        + '<button class="btn-sm btn-sm-del" onclick="deletePos(\'' + p.id + '\')">Hapus</button>'
        + '</div>' : '')
      + '</div>';
  }).join('') : '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">Belum ada pos anggaran</div><div class="empty-sub">Tambah pos untuk mulai mengalokasikan pemasukan</div></div>';

  // Draft alokasi belum dikonfirmasi
  var draftHTML = '';
  if (draftBelum.length > 0) {
    // Kelompokkan per transaksi
    var byTrx = {};
    draftBelum.forEach(function(a) {
      if (!byTrx[a.transaksi_id]) byTrx[a.transaksi_id] = { trx: a.transaksi, items: [] };
      byTrx[a.transaksi_id].items.push(a);
    });
    draftHTML = '<div style="background:var(--yellow-dim);border:1px solid var(--yellow);border-radius:var(--radius);padding:14px;margin-bottom:16px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--yellow);margin-bottom:10px">⏳ Draft Alokasi Menunggu Konfirmasi</div>'
      + Object.keys(byTrx).map(function(trxId) {
          var grup = byTrx[trxId];
          var trx = grup.trx;
          var tgl = trx ? new Date(trx.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
          return '<div style="background:var(--surface);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px">'
            + '<div style="font-size:13px;font-weight:600;margin-bottom:8px">' + (trx ? trx.keterangan || formatRp(trx.nominal) : '-') + ' · ' + tgl + '</div>'
            + grup.items.map(function(a){
                return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">'
                  + '<span style="color:var(--text2)">' + (a.pos_anggaran ? a.pos_anggaran.nama : '-') + '</span>'
                  + '<span style="font-weight:700;color:var(--green)">' + formatRp(a.nominal) + '</span>'
                  + '</div>';
              }).join('')
            + '<div style="display:flex;gap:8px;margin-top:10px">'
            + '<button class="btn-sm btn-sm-edit" onclick="konfirmasiAlokasi(\'' + trxId + '\')">✓ Konfirmasi</button>'
            + '<button class="btn-sm btn-sm-del" onclick="hapusDraftAlokasi(\'' + trxId + '\')">Batal</button>'
            + '</div></div>';
        }).join('')
      + '</div>';
  }

  el.innerHTML = headerHTML + draftHTML + posHTML;
}

// SHEET POS
function openSheetPos() {
  editingPosId = null;
  document.getElementById('pos-sheet-title').textContent = 'Tambah Pos Anggaran';
  document.getElementById('edit-pos-id').value = '';
  document.getElementById('pos-nama').value = '';
  document.getElementById('pos-deskripsi').value = '';
  document.getElementById('pos-pct').value = '';
  selectedPosColor = '#3b9eff';
  buildPosColorGrid();
  openSheet('pos');
}

function editPos(id, nama, deskripsi, pct, warna) {
  editingPosId = id;
  document.getElementById('pos-sheet-title').textContent = 'Edit Pos Anggaran';
  document.getElementById('edit-pos-id').value = id;
  document.getElementById('pos-nama').value = nama;
  document.getElementById('pos-deskripsi').value = deskripsi;
  document.getElementById('pos-pct').value = pct;
  selectedPosColor = warna;
  buildPosColorGrid();
  openSheet('pos');
}

function buildPosColorGrid() {
  var el = document.getElementById('pos-color-grid');
  if (!el) return;
  el.innerHTML = COLORS_POS.map(function(c) {
    return '<div style="width:32px;height:32px;border-radius:50%;background:' + c + ';cursor:pointer;border:3px solid ' + (selectedPosColor === c ? 'white' : 'transparent') + ';transition:all 0.15s" onclick="selectPosColor(\'' + c + '\')"></div>';
  }).join('');
}

function selectPosColor(c) { selectedPosColor = c; buildPosColorGrid(); }

async function submitPos() {
  var editId = document.getElementById('edit-pos-id').value;
  var nama = document.getElementById('pos-nama').value.trim();
  var deskripsi = document.getElementById('pos-deskripsi').value.trim();
  var pct = parseFloat(document.getElementById('pos-pct').value);
  if (!nama) { showToast('Nama pos wajib diisi', 'red'); return; }
  if (isNaN(pct) || pct < 0 || pct > 100) { showToast('Persentase harus 0-100', 'red'); return; }
  var btn = document.getElementById('btn-submit-pos'); btn.disabled = true; btn.textContent = 'Menyimpan...';
  var payload = { nama: nama, deskripsi: deskripsi || null, persentase: pct, warna: selectedPosColor, aktif: true, urutan: 99 };
  var r = editId ? await db.from('pos_anggaran').update(payload).eq('id', editId) : await db.from('pos_anggaran').insert(payload);
  btn.disabled = false; btn.textContent = 'Simpan Pos';
  if (!r.error) { closeSheet('pos'); await loadPosAnggaran(); renderPosAnggaranPage(); showToast('Pos disimpan', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}

async function deletePos(id) {
  if (!window.confirm('Hapus pos ini? Semua alokasi terkait akan terhapus.')) return;
  await db.from('alokasi_masuk').delete().eq('pos_id', id);
  var r = await db.from('pos_anggaran').delete().eq('id', id);
  if (!r.error) { await loadPosAnggaran(); await loadAlokasiMasuk(); renderPosAnggaranPage(); showToast('Pos dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

// ALOKASI MASUK
function openSheetAlokasi(trxId, nominal) {
  if (!allPosAnggaran.length) { showToast('Tambah pos anggaran dulu', 'yellow'); return; }
  document.getElementById('alokasi-trx-id').value = trxId;

  // Hitung draft otomatis berdasarkan persentase
  var totalPct = allPosAnggaran.reduce(function(s,p){ return s + (p.persentase || 0); }, 0);
  draftAlokasi = allPosAnggaran.map(function(p) {
    var nom = Math.round(nominal * (p.persentase / 100));
    return { pos_id: p.id, nama: p.nama, warna: p.warna, nominal: nom, pct: p.persentase };
  });

  renderDraftAlokasi(nominal);
  document.getElementById('alokasi-total-label').textContent = 'dari ' + formatRp(nominal);
  openSheet('alokasi');
}

function renderDraftAlokasi(totalNominal) {
  var totalDraft = draftAlokasi.reduce(function(s,d){ return s + d.nominal; }, 0);
  var selisih = totalNominal - totalDraft;
  document.getElementById('alokasi-list').innerHTML = draftAlokasi.map(function(d, i) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">'
      + '<div style="width:10px;height:10px;border-radius:50%;background:' + d.warna + ';flex-shrink:0"></div>'
      + '<div style="flex:1;font-size:13px;font-weight:600">' + d.nama + ' <span style="color:var(--text3);font-weight:400">(' + d.pct + '%)</span></div>'
      + '<div class="nominal-wrap" style="width:140px">'
      + '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--text2)">Rp</span>'
      + '<input type="number" value="' + d.nominal + '" min="0" style="width:100%;background:var(--bg2);border:1.5px solid var(--border);border-radius:6px;padding:6px 8px 6px 28px;color:var(--text);font-family:var(--mono);font-size:13px;outline:none" onchange="updateDraftNominal(' + i + ',this.value,' + totalNominal + ')">'
      + '</div></div>';
  }).join('');
  var selisihEl = document.getElementById('alokasi-selisih');
  if (selisihEl) {
    selisihEl.textContent = selisih === 0 ? '✓ Pas' : (selisih > 0 ? 'Sisa: ' + formatRp(selisih) : 'Kelebihan: ' + formatRp(Math.abs(selisih)));
    selisihEl.style.color = selisih === 0 ? 'var(--green)' : 'var(--yellow)';
  }
}

function updateDraftNominal(idx, val, totalNominal) {
  draftAlokasi[idx].nominal = Math.round(parseFloat(val) || 0);
  renderDraftAlokasi(totalNominal);
}

async function submitAlokasi() {
  var trxId = document.getElementById('alokasi-trx-id').value;
  if (!trxId) return;
  var btn = document.getElementById('btn-submit-alokasi'); btn.disabled = true; btn.textContent = 'Menyimpan...';
  // Hapus draft lama kalau ada
  await db.from('alokasi_masuk').delete().eq('transaksi_id', trxId).eq('status', 'draft');
  var rows = draftAlokasi.filter(function(d){ return d.nominal > 0; }).map(function(d) {
    return { transaksi_id: trxId, pos_id: d.pos_id, nominal: d.nominal, status: 'draft' };
  });
  if (!rows.length) { showToast('Minimal satu pos harus punya nominal', 'red'); btn.disabled = false; btn.textContent = 'Simpan Draft'; return; }
  var r = await db.from('alokasi_masuk').insert(rows);
  btn.disabled = false; btn.textContent = 'Simpan Draft';
  if (!r.error) { closeSheet('alokasi'); await loadAlokasiMasuk(); renderPosAnggaranPage(); showToast('Draft alokasi disimpan', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}

async function konfirmasiAlokasi(trxId) {
  if (!window.confirm('Konfirmasi alokasi ini? Tidak bisa dibatalkan setelah dikonfirmasi.')) return;
  var r = await db.from('alokasi_masuk')
    .update({ status: 'konfirmasi', dikonfirmasi_oleh: currentUser.id, dikonfirmasi_at: new Date().toISOString() })
    .eq('transaksi_id', trxId).eq('status', 'draft');
  if (!r.error) { await loadAlokasiMasuk(); renderPosAnggaranPage(); showToast('Alokasi dikonfirmasi', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}

async function hapusDraftAlokasi(trxId) {
  if (!window.confirm('Batalkan draft alokasi ini?')) return;
  var r = await db.from('alokasi_masuk').delete().eq('transaksi_id', trxId).eq('status', 'draft');
  if (!r.error) { await loadAlokasiMasuk(); renderPosAnggaranPage(); showToast('Draft dibatalkan', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}

// =====================
// PENGGUNA
// =====================
async function loadUsers() {
  var r = await db.from('profiles').select('*').order('created_at');
  var users = r.data || [];
  var roleColor = { admin: 'var(--accent)', bendahara: 'var(--green)', input_only: 'var(--yellow)', viewer: 'var(--text3)' };
  var roleLabel = { admin: 'Admin', bendahara: 'Bendahara', input_only: 'Input Only', viewer: 'Viewer' };
  document.getElementById('user-list').innerHTML = users.length ? users.map(function(u) {
    return '<div class="admin-item">'
      + '<div class="admin-item-icon">' + u.nama.charAt(0).toUpperCase() + '</div>'
      + '<div class="admin-item-info"><div class="admin-item-name">' + u.nama + '</div><div class="admin-item-sub">' + u.email + '</div><div style="font-size:11px;font-weight:700;color:' + (roleColor[u.role] || 'var(--text2)') + ';margin-top:3px">' + (roleLabel[u.role] || u.role) + '</div></div>'
      + '<div class="admin-item-actions"><button class="btn-sm btn-sm-edit" onclick="editUser(\'' + u.id + '\',\'' + escQ(u.nama) + '\',\'' + u.email + '\',\'' + u.role + '\')">Edit</button>'
      + (u.id !== currentUser.id ? '<button class="btn-sm btn-sm-del" onclick="deleteUser(\'' + u.id + '\')">Hapus</button>' : '')
      + '</div></div>';
  }).join('') : '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Belum ada pengguna</div></div>';
}

function openSheetUser() {
  document.getElementById('user-sheet-title').textContent = 'Tambah Pengguna';
  ['edit-user-id','user-nama','user-email','user-pass'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('user-role').value = 'viewer';
  document.getElementById('user-email').disabled = false;
  openSheet('user');
}

function editUser(id, nama, email, role) {
  document.getElementById('user-sheet-title').textContent = 'Edit Pengguna';
  document.getElementById('edit-user-id').value = id;
  document.getElementById('user-nama').value = nama;
  document.getElementById('user-email').value = email;
  document.getElementById('user-email').disabled = true;
  document.getElementById('user-pass').value = '';
  document.getElementById('user-role').value = role;
  openSheet('user');
}

async function submitUser() {
  var editId = document.getElementById('edit-user-id').value;
  var nama = document.getElementById('user-nama').value.trim();
  var role = document.getElementById('user-role').value;
  if (!nama) { showToast('Nama wajib diisi', 'red'); return; }
  var btn = document.getElementById('btn-submit-user'); btn.disabled = true; btn.textContent = 'Menyimpan...';
  if (!editId) { showToast('Buat akun lewat Supabase Dashboard, lalu edit role di sini', 'yellow'); btn.disabled = false; btn.textContent = 'Simpan Pengguna'; closeSheet('user'); return; }
  var r = await db.from('profiles').update({ nama: nama, role: role }).eq('id', editId);
  btn.disabled = false; btn.textContent = 'Simpan Pengguna';
  if (!r.error) { closeSheet('user'); loadUsers(); showToast('Pengguna diperbarui', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}

async function deleteUser(id) {
  if (!window.confirm('Hapus pengguna ini?')) return;
  var r = await db.from('profiles').delete().eq('id', id);
  if (!r.error) { loadUsers(); showToast('Pengguna dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

// =====================
// EKSPOR PDF
// =====================
function setPeriod(p) {
  currentPeriod = p;
  document.getElementById('period-bulan').className = 'period-btn' + (p === 'bulan' ? ' active' : '');
  document.getElementById('period-semua').className = 'period-btn' + (p === 'semua' ? ' active' : '');
  document.getElementById('period-bulan-form').style.display = p === 'bulan' ? 'block' : 'none';
}

function eksporPDF() {
  var data = allTrx, judulPeriode = 'Semua Periode';
  if (currentPeriod === 'bulan') {
    var bulan = parseInt(document.getElementById('ekspor-bulan').value);
    var tahun = parseInt(document.getElementById('ekspor-tahun').value);
    data = allTrx.filter(function(t) { var d = new Date(t.tanggal); return d.getMonth() === bulan && d.getFullYear() === tahun; });
    judulPeriode = BULAN_NAMA[bulan] + ' ' + tahun;
  }
  if (!data.length) { showToast('Tidak ada data untuk periode ini', 'yellow'); return; }
  var sorted = data.slice().sort(function(a, b) { return new Date(a.tanggal) - new Date(b.tanggal); });
  var saldo = 0;
  var rows = sorted.map(function(t, i) {
    var masuk = t.jenis === 'masuk' ? t.nominal : 0, keluar = t.jenis === 'keluar' ? t.nominal : 0;
    saldo += masuk - keluar;
    var tgl = new Date(t.tanggal).toLocaleDateString('id', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return '<tr style="border-bottom:1px solid #e5e7eb;background:' + (i % 2 === 0 ? 'white' : '#f8fafc') + '">'
      + '<td style="padding:7px 6px;text-align:center;font-size:12px">' + (i + 1) + '</td>'
      + '<td style="padding:7px 6px;font-size:12px">' + tgl + '</td>'
      + '<td style="padding:7px 6px;font-size:12px">' + (t.keterangan || '-') + '</td>'
      + '<td style="padding:7px 6px;font-size:12px">' + (t.kategori ? t.kategori.nama : '-') + '</td>'
      + '<td style="padding:7px 6px;font-size:12px">' + (t.pos_anggaran ? t.pos_anggaran.nama : '-') + '</td>'
      + '<td style="padding:7px 6px;text-align:right;font-size:12px;color:' + (masuk ? '#15803d' : '#9ca3af') + '">' + (masuk ? 'Rp ' + masuk.toLocaleString('id-ID') : '-') + '</td>'
      + '<td style="padding:7px 6px;text-align:right;font-size:12px;color:' + (keluar ? '#dc2626' : '#9ca3af') + '">' + (keluar ? 'Rp ' + keluar.toLocaleString('id-ID') : '-') + '</td>'
      + '<td style="padding:7px 6px;text-align:right;font-size:12px;font-weight:600;color:' + (saldo >= 0 ? '#1e40af' : '#dc2626') + '">Rp ' + Math.abs(saldo).toLocaleString('id-ID') + '</td>'
      + '</tr>';
  });
  var tM = sorted.reduce(function(s, t) { return t.jenis === 'masuk' ? s + t.nominal : s; }, 0);
  var tK = sorted.reduce(function(s, t) { return t.jenis === 'keluar' ? s + t.nominal : s; }, 0);
  var sA = tM - tK;
  var tglC = new Date().toLocaleDateString('id', { day: 'numeric', month: 'long', year: 'numeric' });
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Buku Kas WMC</title>'
    + '<style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#111}'
    + '.header{text-align:center;margin-bottom:24px;border-bottom:2px solid #1e40af;padding-bottom:16px}'
    + '.logo{font-size:22px;font-weight:800;color:#1e40af}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:24px}'
    + 'th{background:#1e40af;color:white;padding:10px 6px;font-size:12px;text-align:left}'
    + 'th:nth-child(6),th:nth-child(7),th:nth-child(8){text-align:right}'
    + '.summary{display:flex;gap:16px}'
    + '.sum-box{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}'
    + '.sum-label{font-size:11px;color:#6b7280;margin-bottom:4px}'
    + '.sum-val{font-size:16px;font-weight:800}'
    + '.footer{margin-top:24px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}'
    + '</style></head><body>'
    + '<div class="header"><div class="logo">PT WIDYA MANDALA CENDEKIA</div>'
    + '<div style="font-size:13px;color:#6b7280">Laporan Buku Kas · ' + judulPeriode + '</div>'
    + '<div style="font-size:12px;color:#9ca3af">Dicetak: ' + tglC + '</div></div>'
    + '<table><thead><tr><th>No</th><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Pos</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr></thead>'
    + '<tbody>' + rows.join('') + '</tbody></table>'
    + '<div class="summary">'
    + '<div class="sum-box"><div class="sum-label">Total Masuk</div><div class="sum-val" style="color:#15803d">Rp ' + tM.toLocaleString('id-ID') + '</div></div>'
    + '<div class="sum-box"><div class="sum-label">Total Keluar</div><div class="sum-val" style="color:#dc2626">Rp ' + tK.toLocaleString('id-ID') + '</div></div>'
    + '<div class="sum-box"><div class="sum-label">Saldo Akhir</div><div class="sum-val" style="color:' + (sA >= 0 ? '#1e40af' : '#dc2626') + '">Rp ' + Math.abs(sA).toLocaleString('id-ID') + '</div></div>'
    + '</div>'
    + '<div class="footer">WMC Kas · PT Widya Mandala Cendekia · ' + sorted.length + ' transaksi</div>'
    + '</body></html>';
  var win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.onload = function() { win.print(); };
  showToast('Membuka preview PDF...', 'green');
}
