// WMC KAS - anggota.js
var anggotaPage = 0;
var searchAnggota = '';

function setAnggotaTab(el, tab) {
  document.querySelectorAll('#page-anggota .filter-row .filter-chip').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  currentAnggotaTab = tab;
  ['rekap','kegiatan','data','log'].forEach(function(t) {
    document.getElementById('anggota-tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'kegiatan') { kegiatanPage = 0; renderKegiatanList(); }
  if (tab === 'data') { anggotaPage = 0; renderDataAnggota(); }
  if (tab === 'rekap') { rekapPage = 0; renderRekapAnggota(); }
  if (tab === 'log') loadLogList();
}

// DATA ANGGOTA
function renderDataAnggota() {
  var isAdmin = currentProfile && currentProfile.role === 'admin';
  var el = document.getElementById('data-anggota-list');

  var divisiMap = {};
  allAnggota.forEach(function(a) {
    var div = a.jabatan || 'Tanpa Divisi';
    if (!divisiMap[div]) divisiMap[div] = 0;
    divisiMap[div]++;
  });

  var divisiHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:12px">'
    + '<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Komposisi Tim (' + allAnggota.length + ' anggota)</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
    + Object.keys(divisiMap).sort().map(function(d) {
        return '<div style="background:var(--bg2);border-radius:20px;padding:4px 12px;font-size:12px;cursor:pointer" onclick="filterByDivisi(\'' + escQ(d) + '\')">'
          + '<span style="color:var(--text2)">' + d + '</span>'
          + ' <span style="font-weight:800;color:var(--accent)">' + divisiMap[d] + '</span>'
          + '</div>';
      }).join('')
    + '</div></div>';

  var searchBar = '<div style="position:relative;margin-bottom:12px">'
    + '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:14px;pointer-events:none">🔍</span>'
    + '<input type="search" placeholder="Cari nama atau divisi..." value="' + escQ(searchAnggota) + '" oninput="onSearchAnggota(this.value)" style="width:100%;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px 10px 38px;color:var(--text);font-family:var(--font);font-size:14px;outline:none">'
    + (searchAnggota ? '<div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;color:var(--text3);font-size:16px" onclick="onSearchAnggota(\'\')">✕</div>' : '')
    + '</div>';

  var filtered = allAnggota.filter(function(a) {
    if (!searchAnggota) return true;
    return a.nama.toLowerCase().indexOf(searchAnggota.toLowerCase()) >= 0
      || (a.jabatan || '').toLowerCase().indexOf(searchAnggota.toLowerCase()) >= 0;
  });

  if (!filtered.length) {
    el.innerHTML = divisiHTML + searchBar + '<div style="color:var(--text3);font-size:13px;padding:16px 0;text-align:center">Tidak ditemukan</div>';
    return;
  }

  var start = anggotaPage * PAGE_SIZE;
  var slice = filtered.slice(start, start + PAGE_SIZE);
  var maxP = Math.ceil(filtered.length / PAGE_SIZE) - 1;

  el.innerHTML = divisiHTML + searchBar + slice.map(function(a) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px">'
      + '<div class="anggota-avatar" style="width:38px;height:38px;border-radius:10px;font-size:15px;flex-shrink:0">' + a.nama.charAt(0).toUpperCase() + '</div>'
      + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">' + a.nama + '</div>'
      + '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + (a.jabatan || '-') + (a.kontak ? ' · ' + a.kontak : '') + '</div></div>'
      + (isAdmin ? '<div style="display:flex;gap:6px;flex-shrink:0">'
        + '<button class="btn-sm btn-sm-edit" onclick="editAnggota(\'' + a.id + '\',\'' + escQ(a.nama) + '\',\'' + escQ(a.jabatan || '') + '\',\'' + escQ(a.kontak || '') + '\',\'' + escQ(a.email || '') + '\',\'' + escQ(a.catatan || '') + '\')">Edit</button>'
        + '<button class="btn-sm btn-sm-del" onclick="deleteAnggota(\'' + a.id + '\')">Hapus</button>'
        + '</div>' : '')
      + '</div>';
  }).join('')
  + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 100px">'
  + '<button class="pager-btn" ' + (anggotaPage === 0 ? 'disabled' : '') + ' onclick="anggotaPage=Math.max(0,anggotaPage-1);renderDataAnggota()">← Sebelumnya</button>'
  + '<span style="font-size:13px;color:var(--text2)">' + (anggotaPage+1) + ' / ' + (maxP+1) + ' (' + filtered.length + ')</span>'
  + '<button class="pager-btn" ' + (anggotaPage >= maxP ? 'disabled' : '') + ' onclick="anggotaPage=Math.min('+maxP+',anggotaPage+1);renderDataAnggota()">Berikutnya →</button>'
  + '</div>';
}

function onSearchAnggota(val) { searchAnggota = val; anggotaPage = 0; renderDataAnggota(); }
function filterByDivisi(divisi) { searchAnggota = divisi; anggotaPage = 0; renderDataAnggota(); }

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
  var payload = {
    nama: nama,
    jabatan: document.getElementById('anggota-jabatan').value.trim() || null,
    kontak: document.getElementById('anggota-kontak').value.trim() || null,
    email: document.getElementById('anggota-email').value.trim() || null,
    catatan: document.getElementById('anggota-catatan').value.trim() || null
  };
  var btn = document.getElementById('btn-submit-anggota'); btn.disabled = true; btn.textContent = 'Menyimpan...';
  var r = editId ? await db.from('anggota').update(payload).eq('id', editId) : await db.from('anggota').insert(payload);
  btn.disabled = false; btn.textContent = 'Simpan Anggota';
  if (!r.error) { closeSheet('anggota'); await loadAnggota(); renderDataAnggota(); renderRekapAnggota(); showToast('Anggota disimpan', 'green'); }
  else showToast('Gagal: ' + r.error.message, 'red');
}

async function deleteAnggota(id) {
  if (!window.confirm('Hapus anggota ini?')) return;
  var r = await db.from('anggota').delete().eq('id', id);
  if (!r.error) { await loadAnggota(); renderDataAnggota(); showToast('Anggota dihapus', 'green'); }
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
