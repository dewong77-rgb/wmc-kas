// WMC KAS - admin.js
var currentPeriod = 'bulan';

// ANGGARAN
function renderAnggaranPage() {
  var years = {};
  allAnggaran.forEach(function(a) { years[a.tahun] = true; });
  var yearList = Object.keys(years).sort(function(a, b) { return b - a; });
  var fr = document.getElementById('anggaran-filter-row');
  fr.innerHTML = '<button class="filter-chip active" onclick="setAnggaranFilter(this,\'semua\')">Semua</button>'
    + yearList.map(function(y) { return '<button class="filter-chip" onclick="setAnggaranFilter(this,\'' + y + '\')">' + y + '</button>'; }).join('');
  renderAnggaranList('semua');
}

function setAnggaranFilter(el, val) {
  document.querySelectorAll('#anggaran-filter-row .filter-chip').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  renderAnggaranList(val);
}

function renderAnggaranList(filter) {
  var filtered = filter === 'semua' ? allAnggaran : allAnggaran.filter(function(a) { return String(a.tahun) === String(filter); });
  if (!filtered.length) { document.getElementById('anggaran-list').innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">Belum ada anggaran</div></div>'; return; }
  document.getElementById('anggaran-list').innerHTML = filtered.map(function(a) {
    var realisasi = allTrx.filter(function(t) {
      if (t.jenis !== 'keluar') return false;
      var d = new Date(t.tanggal);
      var mB = a.bulan ? (d.getMonth() + 1) === a.bulan : true;
      var mT = d.getFullYear() === a.tahun;
      var mK = a.kategori_id ? t.kategori_id === a.kategori_id : true;
      return mB && mT && mK;
    }).reduce(function(s, t) { return s + t.nominal; }, 0);
    var pct = Math.min(100, Math.round((realisasi / a.nominal_target) * 100));
    var isAlert = pct >= 80;
    var barColor = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
    var periode = a.bulan ? BULAN_NAMA[a.bulan - 1] + ' ' + a.tahun : 'Tahun ' + a.tahun;
    var hapusBtn = currentProfile && currentProfile.role === 'admin'
      ? '<div style="margin-top:10px"><button class="btn-sm btn-sm-del" onclick="deleteAnggaran(\'' + a.id + '\')">Hapus</button></div>' : '';
    return '<div class="anggaran-item">'
      + '<div class="anggaran-header"><div><div class="anggaran-nama">' + a.nama + (isAlert ? '<span class="alert-badge">⚠️ ' + pct + '%</span>' : '') + '</div><div class="anggaran-periode">' + periode + (a.kategori ? ' · ' + a.kategori.nama : '') + '</div></div><div class="anggaran-target">' + formatRp(a.nominal_target) + '</div></div>'
      + '<div class="progress-wrap"><div class="progress-bar" style="width:' + pct + '%;background:' + barColor + '"></div></div>'
      + '<div class="anggaran-footer"><div class="anggaran-realisasi" style="color:' + barColor + '">Terpakai: ' + formatRp(realisasi) + '</div><div class="anggaran-sisa">Sisa: ' + formatRp(Math.max(0, a.nominal_target - realisasi)) + '</div></div>'
      + hapusBtn + '</div>';
  }).join('');
}

function openSheetAnggaran() {
  document.getElementById('anggaran-sheet-title').textContent = 'Tambah Anggaran';
  document.getElementById('edit-anggaran-id').value = '';
  document.getElementById('anggaran-nama').value = '';
  document.getElementById('anggaran-nominal-display').value = '';
  document.getElementById('anggaran-nominal-raw').value = '';
  document.getElementById('anggaran-catatan').value = '';
  var sel = document.getElementById('anggaran-kat');
  sel.innerHTML = '<option value="">Semua kategori (keluar)</option>'
    + allKategori.filter(function(k) { return k.jenis === 'keluar'; }).map(function(k) { return '<option value="' + k.id + '">' + k.nama + '</option>'; }).join('');
  document.getElementById('anggaran-bulan').value = new Date().getMonth() + 1;
  openSheet('anggaran');
}

async function submitAnggaran() {
  var nama = document.getElementById('anggaran-nama').value.trim();
  var nominal = parseFloat(document.getElementById('anggaran-nominal-raw').value);
  var bulan = parseInt(document.getElementById('anggaran-bulan').value);
  var tahun = parseInt(document.getElementById('anggaran-tahun').value);
  var katId = document.getElementById('anggaran-kat').value || null;
  var catatan = document.getElementById('anggaran-catatan').value.trim();
  if (!nama) { showToast('Nama anggaran wajib diisi', 'red'); return; }
  if (!nominal || nominal <= 0) { showToast('Target nominal wajib diisi', 'red'); return; }
  var btn = document.getElementById('btn-submit-anggaran'); btn.disabled = true; btn.textContent = 'Menyimpan...';
  var r = await db.from('anggaran').insert({ nama: nama, kategori_id: katId, nominal_target: nominal, bulan: bulan, tahun: tahun, catatan: catatan, created_by: currentUser.id });
  btn.disabled = false; btn.textContent = 'Simpan Anggaran';
  if (!r.error) { closeSheet('anggaran'); await loadAnggaran(); renderAnggaranPage(); showToast('Anggaran disimpan', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}

async function deleteAnggaran(id) {
  if (!window.confirm('Hapus anggaran ini?')) return;
  var r = await db.from('anggaran').delete().eq('id', id);
  if (!r.error) { await loadAnggaran(); renderAnggaranPage(); showToast('Anggaran dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

// PENGGUNA
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

// EKSPOR PDF
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
    + 'th:nth-child(5),th:nth-child(6),th:nth-child(7){text-align:right}'
    + '.summary{display:flex;gap:16px}'
    + '.sum-box{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}'
    + '.sum-label{font-size:11px;color:#6b7280;margin-bottom:4px}'
    + '.sum-val{font-size:16px;font-weight:800}'
    + '.footer{margin-top:24px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}'
    + '</style></head><body>'
    + '<div class="header"><div class="logo">PT WIDYA MANDALA CENDEKIA</div>'
    + '<div style="font-size:13px;color:#6b7280">Laporan Buku Kas · ' + judulPeriode + '</div>'
    + '<div style="font-size:12px;color:#9ca3af">Dicetak: ' + tglC + '</div></div>'
    + '<table><thead><tr><th>No</th><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr></thead>'
    + '<tbody>' + rows.join('') + '</tbody></table>'
    + '<div class="summary">'
    + '<div class="sum-box"><div class="sum-label">Total Masuk</div><div class="sum-val" style="color:#15803d">Rp ' + tM.toLocaleString('id-ID') + '</div></div>'
    + '<div class="sum-box"><div class="sum-label">Total Keluar</div><div class="sum-val" style="color:#dc2626">Rp ' + tK.toLocaleString('id-ID') + '</div></div>'
    + '<div class="sum-box"><div class="sum-label">Saldo Akhir</div><div class="sum-val" style="color:' + (sA >= 0 ? '#1e40af' : '#dc2626') + '">Rp ' + Math.abs(sA).toLocaleString('id-ID') + '</div></div>'
    + '</div>'
    + '<div class="footer">WMC Kas v2.4 · PT Widya Mandala Cendekia · ' + sorted.length + ' transaksi</div>'
    + '</body></html>';
  var win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.onload = function() { win.print(); };
  showToast('Membuka preview PDF...', 'green');
}
