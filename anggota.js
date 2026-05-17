// WMC KAS - anggota.js
var anggotaPage = 0;
var kegiatanPage = 0;
var rekapPage = 0;
var editingKegiatanId = null;
var pesertaStatus = {};
var currentKegiatanTipe = 'fullboard';
var rekapBulan = 0;
var rekapTahun = 0;
var searchAnggota = '';
var searchKegiatan = '';
var filterKegiatanBulan = 0;
var filterKegiatanTahun = 0;

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

// =====================
// REKAP
// =====================
function renderRekapAnggota() {
  var el = document.getElementById('rekap-list');

  var years = {};
  allKegiatan.forEach(function(k) {
    var tgl = k.tanggal_surat || k.tanggal_mulai;
    if (tgl) years[new Date(tgl).getFullYear()] = true;
  });
  var yearList = Object.keys(years).sort(function(a,b){ return b-a; });

  var filterHTML = '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">'
    + '<select id="rekap-sel-bulan" style="background:var(--surface);border:1.5px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);font-size:13px;font-family:var(--font);outline:none" onchange="onRekapFilterChange()">'
    + '<option value="0">Semua Bulan</option>'
    + BULAN_NAMA.map(function(b,i){ return '<option value="'+(i+1)+'"'+(rekapBulan===i+1?' selected':'')+'>'+b+'</option>'; }).join('')
    + '</select>'
    + '<select id="rekap-sel-tahun" style="background:var(--surface);border:1.5px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);font-size:13px;font-family:var(--font);outline:none" onchange="onRekapFilterChange()">'
    + '<option value="0">Semua Tahun</option>'
    + yearList.map(function(y){ return '<option value="'+y+'"'+(rekapTahun===parseInt(y)?' selected':'')+'>'+y+'</option>'; }).join('')
    + '</select>'
    + '</div>';

  var filtered = allKegiatan.filter(function(k) {
    if (rekapBulan === 0 && rekapTahun === 0) return true;
    var tgl = k.tanggal_surat ? new Date(k.tanggal_surat) : (k.tanggal_mulai ? new Date(k.tanggal_mulai) : null);
    if (!tgl) return false;
    var matchBulan = rekapBulan === 0 || (tgl.getMonth() + 1) === rekapBulan;
    var matchTahun = rekapTahun === 0 || tgl.getFullYear() === rekapTahun;
    return matchBulan && matchTahun;
  });

  // Stats per anggota
  var stats = {};

  // Stats per divisi dengan tracking per anggota
  // anggotaStats[divisi][aid] = { nama, hadir, pinjam }
  var divisiStats = {};
  var divisiAnggotaStats = {};

  // Inisialisasi dari allAnggota
  allAnggota.forEach(function(a) {
    var divisi = a.jabatan || 'Tanpa Divisi';
    if (!divisiStats[divisi]) {
      divisiStats[divisi] = { anggotaSet: {}, pernahIkutSet: {}, hadirFisikSet: {}, hadir: 0, pinjam: 0 };
      divisiAnggotaStats[divisi] = {};
    }
    divisiStats[divisi].anggotaSet[a.id] = true;
    divisiAnggotaStats[divisi][a.id] = { nama: a.nama, hadir: 0, pinjam: 0 };
  });

  filtered.forEach(function(k) {
    if (!k.kegiatan_peserta) return;
    k.kegiatan_peserta.forEach(function(p) {
      var aid = p.anggota_id;
      var nama = p.anggota ? p.anggota.nama : 'Unknown';
      var anggotaData = allAnggota.filter(function(a){ return a.id === aid; })[0];
      var divisi = anggotaData ? (anggotaData.jabatan || 'Tanpa Divisi') : 'Tanpa Divisi';
      var isPinjam = p.status_kehadiran === 'pinjam_nama';

      // Stats per anggota global
      if (!stats[aid]) stats[aid] = { nama: nama, divisi: divisi, total: 0, fullboard: 0, perjadin: 0, pinjam: 0 };
      stats[aid].total++;
      if (k.tipe === 'fullboard') stats[aid].fullboard++;
      else if (k.tipe === 'perjadin') stats[aid].perjadin++;
      if (isPinjam) stats[aid].pinjam++;

      // Stats per divisi
      if (!divisiStats[divisi]) {
        divisiStats[divisi] = { anggotaSet: {}, pernahIkutSet: {}, hadirFisikSet: {}, hadir: 0, pinjam: 0 };
        divisiAnggotaStats[divisi] = {};
      }
      divisiStats[divisi].anggotaSet[aid] = true;
      divisiStats[divisi].pernahIkutSet[aid] = true;
      if (!isPinjam) divisiStats[divisi].hadirFisikSet[aid] = true;
      if (isPinjam) divisiStats[divisi].pinjam++;
      else divisiStats[divisi].hadir++;

      // Stats per anggota dalam divisi
      if (!divisiAnggotaStats[divisi]) divisiAnggotaStats[divisi] = {};
      if (!divisiAnggotaStats[divisi][aid]) divisiAnggotaStats[divisi][aid] = { nama: nama, hadir: 0, pinjam: 0 };
      if (isPinjam) divisiAnggotaStats[divisi][aid].pinjam++;
      else divisiAnggotaStats[divisi][aid].hadir++;
    });
  });

  // Ringkasan per bulan
  var kegByBulan = {};
  filtered.forEach(function(k) {
    var tgl = k.tanggal_surat ? new Date(k.tanggal_surat) : (k.tanggal_mulai ? new Date(k.tanggal_mulai) : null);
    if (!tgl) return;
    var key = BULAN_NAMA[tgl.getMonth()] + ' ' + tgl.getFullYear();
    if (!kegByBulan[key]) kegByBulan[key] = { label: key, count: 0 };
    kegByBulan[key].count++;
  });
  var bulanList = Object.values(kegByBulan).sort(function(a,b){ return b.count - a.count; });
  var maxBulan = bulanList.length ? bulanList[0].count : 1;

  var totalPinjam = Object.values(stats).reduce(function(s,a){ return s + a.pinjam; }, 0);
  var totalHadir = Object.values(stats).reduce(function(s,a){ return s + (a.total - a.pinjam); }, 0);

  // Breakdown per tim
  var divisiList = Object.keys(divisiStats).sort(function(a, b) {
    return divisiStats[b].hadir - divisiStats[a].hadir;
  });

  var timHTML = divisiList.map(function(d) {
    var ds = divisiStats[d];
    var das = divisiAnggotaStats[d] || {};
    var jmlAnggota = Object.keys(ds.anggotaSet).length;
    var jmlPernahIkut = Object.keys(ds.pernahIkutSet || {}).length;
    var jmlHadirFisik = Object.keys(ds.hadirFisikSet || {}).length;
    var jmlBelumIkut = jmlAnggota - jmlPernahIkut;
    var jmlHanyaPinjam = jmlPernahIkut - jmlHadirFisik;
    var totalKegiatan = ds.hadir + ds.pinjam;
    var pctHadir = totalKegiatan > 0 ? Math.round((ds.hadir / totalKegiatan) * 100) : 0;
    var pctPinjam = totalKegiatan > 0 ? Math.round((ds.pinjam / totalKegiatan) * 100) : 0;

    // Cari top hadir, hanya pinjam, belum ikut
    var anggotaList = Object.keys(ds.anggotaSet).map(function(aid) {
      var a = das[aid] || { nama: (allAnggota.filter(function(x){ return x.id===aid; })[0] || {}).nama || '?', hadir: 0, pinjam: 0 };
      return { aid: aid, nama: a.nama, hadir: a.hadir, pinjam: a.pinjam, total: a.hadir + a.pinjam };
    });

    // Paling sering hadir fisik
    var topHadir = anggotaList.filter(function(a){ return a.hadir > 0; }).sort(function(a,b){ return b.hadir - a.hadir; });
    // Paling sedikit hadir (tapi pernah ikut, minimal 1 hadir)
    var bottomHadir = anggotaList.filter(function(a){ return a.hadir > 0; }).sort(function(a,b){ return a.hadir - b.hadir; });
    // Hanya pinjam nama (ikut tapi tidak pernah hadir fisik)
    var hanyaPinjam = anggotaList.filter(function(a){ return a.total > 0 && a.hadir === 0; });
    // Belum pernah ikut sama sekali
    var belumIkut = anggotaList.filter(function(a){ return a.total === 0; });

    // Info anggota tambahan
    var infoHTML = '';
    if (topHadir.length > 0) {
      var topNama = topHadir[0].nama + ' (' + topHadir[0].hadir + 'x hadir)';
      infoHTML += '<div style="font-size:11px;margin-top:6px"><span style="color:var(--green)">🏆 Paling aktif: </span><span style="color:var(--text)">' + topNama + '</span></div>';
    }
    if (bottomHadir.length > 0 && bottomHadir[0].aid !== (topHadir[0] || {}).aid) {
      var botNama = bottomHadir[0].nama + ' (' + bottomHadir[0].hadir + 'x hadir)';
      infoHTML += '<div style="font-size:11px;margin-top:4px"><span style="color:var(--text2)">🔻 Paling sedikit hadir: </span><span style="color:var(--text)">' + botNama + '</span></div>';
    }
    if (hanyaPinjam.length > 0) {
      var namaPinjam = hanyaPinjam.map(function(a){ return a.nama; }).join(', ');
      infoHTML += '<div style="font-size:11px;margin-top:4px"><span style="color:var(--yellow)">◌ Hanya pinjam nama: </span><span style="color:var(--text)">' + namaPinjam + '</span></div>';
    }
    if (belumIkut.length > 0) {
      var namaBelum = belumIkut.map(function(a){ return a.nama; }).join(', ');
      infoHTML += '<div style="font-size:11px;margin-top:4px"><span style="color:var(--red)">✗ Belum pernah ikut: </span><span style="color:var(--text)">' + namaBelum + '</span></div>';
    }

    return '<div style="padding:12px 0;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'
      + '<div style="font-size:13px;font-weight:700">' + d + '</div>'
      + '<div style="font-size:12px;color:var(--text2)">' + totalKegiatan + 'x ikut</div>'
      + '</div>'
      + '<div style="font-size:11px;margin-bottom:6px;display:flex;flex-wrap:wrap;gap:8px">'
      + '<span style="color:var(--text2)">' + jmlAnggota + ' anggota</span>'
      + '<span style="color:var(--green)">✓ ' + jmlHadirFisik + ' hadir fisik</span>'
      + (jmlHanyaPinjam > 0 ? '<span style="color:var(--yellow)">◌ ' + jmlHanyaPinjam + ' hanya pinjam nama</span>' : '')
      + (jmlBelumIkut > 0 ? '<span style="color:var(--red)">✗ ' + jmlBelumIkut + ' belum ikut</span>' : '<span style="color:var(--green)">semua sudah ikut</span>')
      + '</div>'
      + (totalKegiatan > 0
        ? '<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:4px">'
          + '<div style="width:' + pctHadir + '%;background:var(--green)"></div>'
          + '<div style="width:' + pctPinjam + '%;background:var(--yellow)"></div>'
          + '<div style="flex:1;background:var(--border)"></div>'
          + '</div>'
          + '<div style="display:flex;gap:12px;font-size:11px;color:var(--text2);margin-bottom:2px">'
          + '<span style="color:var(--green)">' + ds.hadir + ' hadir (' + pctHadir + '%)</span>'
          + '<span style="color:var(--yellow)">' + ds.pinjam + ' pinjam nama (' + pctPinjam + '%)</span>'
          + '</div>'
          + infoHTML
        : '<div style="font-size:11px;color:var(--text3)">Belum ada kegiatan di periode ini</div>'
          + infoHTML)
      + '</div>';
  }).join('');

  var ringkasanHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:16px">'
    + '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Ringkasan Kegiatan</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">'
    + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--accent)">' + filtered.length + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Total Kegiatan</div></div>'
    + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green)">' + filtered.filter(function(k){return k.tipe==='fullboard';}).length + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Fullboard</div></div>'
    + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--purple)">' + filtered.filter(function(k){return k.tipe==='perjadin';}).length + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Perjadin</div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'
    + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--text)">' + allAnggota.length + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Total Anggota</div></div>'
    + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green)">' + totalHadir + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Total Hadir</div></div>'
    + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--yellow)">' + totalPinjam + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Pinjam Nama</div></div>'
    + '</div>'
    + '<div style="display:flex;gap:12px;font-size:11px;color:var(--text3);margin-bottom:8px">'
    + '<span>📊 Kontribusi per tim:</span>'
    + '<span style="color:var(--green)">■ Hadir</span>'
    + '<span style="color:var(--yellow)">■ Pinjam Nama</span>'
    + '</div>'
    + timHTML
    + (bulanList.length > 1
      ? '<div style="font-size:11px;color:var(--text3);margin-top:12px;margin-bottom:6px">Per bulan:</div>'
        + bulanList.map(function(b){
            return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
              + '<div style="font-size:11px;color:var(--text2);min-width:90px">' + b.label + '</div>'
              + '<div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:6px;background:var(--accent);border-radius:3px;width:' + Math.round((b.count/maxBulan)*100) + '%"></div></div>'
              + '<div style="font-size:11px;font-weight:700;color:var(--text);min-width:16px;text-align:right">' + b.count + '</div>'
              + '</div>';
          }).join('')
      : '')
    + '</div>';

  // Ranking anggota
  var sorted = Object.values(stats).sort(function(a, b) { return b.total - a.total; });
  var rankHTML = '';
  if (!sorted.length) {
    rankHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 0;text-align:center">Belum ada data untuk periode ini</div>';
  } else {
    var medals = ['🥇','🥈','🥉'];
    var start = rekapPage * PAGE_SIZE;
    var slice = sorted.slice(start, start + PAGE_SIZE);
    var maxP = Math.ceil(sorted.length / PAGE_SIZE) - 1;
    rankHTML = '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">'
      + 'Ranking Keikutsertaan <span style="color:var(--text3);font-weight:400;font-size:11px">(' + sorted.length + ' anggota)</span></div>'
      + slice.map(function(a, i) {
          var gr = start + i;
          var medal = gr < 3 ? medals[gr] : (gr + 1) + '.';
          var hadirFisik = a.total - a.pinjam;
          var pinjamText = a.pinjam > 0
            ? (hadirFisik === 0 ? ' · <span style="color:var(--red)">selalu pinjam nama</span>' : ' · <span style="color:var(--yellow)">' + a.pinjam + 'x pinjam</span>')
            : '';
          var divisiTag = a.divisi ? '<span style="background:var(--bg2);border-radius:10px;padding:1px 8px;font-size:10px;color:var(--text3);margin-left:6px">' + a.divisi + '</span>' : '';
          return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="openDetailAnggota(\'' + escQ(a.nama) + '\')">'
            + '<div style="font-size:18px;width:28px;text-align:center;flex-shrink:0">' + medal + '</div>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:14px;font-weight:700">' + a.nama + divisiTag + '</div>'
            + '<div style="font-size:11px;color:var(--text2);margin-top:2px">'
            + '<span style="color:var(--accent)">' + a.fullboard + ' fullboard</span>'
            + ' · <span style="color:var(--green)">' + a.perjadin + ' perjadin</span>'
            + pinjamText + '</div></div>'
            + '<div style="display:flex;align-items:center;gap:6px">'
            + '<div style="font-size:20px;font-weight:800;font-family:var(--mono);color:var(--text)">' + a.total + '</div>'
            + '<div style="font-size:11px;color:var(--text3)">›</div>'
            + '</div></div>';
        }).join('')
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 100px">'
      + '<button class="pager-btn" ' + (rekapPage === 0 ? 'disabled' : '') + ' onclick="rekapPage=Math.max(0,rekapPage-1);renderRekapAnggota()">← Sebelumnya</button>'
      + '<span style="font-size:13px;color:var(--text2)">' + (rekapPage+1) + ' / ' + (maxP+1) + '</span>'
      + '<button class="pager-btn" ' + (rekapPage >= maxP ? 'disabled' : '') + ' onclick="rekapPage=Math.min('+maxP+',rekapPage+1);renderRekapAnggota()">Berikutnya →</button>'
      + '</div>';
  }

  el.innerHTML = filterHTML + ringkasanHTML + rankHTML;
}

function onRekapFilterChange() {
  var b = document.getElementById('rekap-sel-bulan');
  var t = document.getElementById('rekap-sel-tahun');
  rekapBulan = b ? parseInt(b.value) : 0;
  rekapTahun = t ? parseInt(t.value) : 0;
  rekapPage = 0;
  renderRekapAnggota();
}

// Detail histori per anggota
function openDetailAnggota(nama) {
  var histori = [];
  allKegiatan.forEach(function(k) {
    if (!k.kegiatan_peserta) return;
    k.kegiatan_peserta.forEach(function(p) {
      if (p.anggota && p.anggota.nama === nama) {
        histori.push({ nama_kegiatan: k.nama, tipe: k.tipe, tanggal: k.tanggal_mulai, lokasi: k.lokasi, status: p.status_kehadiran || 'hadir' });
      }
    });
  });
  histori.sort(function(a,b){ return new Date(b.tanggal) - new Date(a.tanggal); });
  var tipeClass = { fullboard:'tipe-fullboard', perjadin:'tipe-perjadin', rapat:'tipe-rapat', lainnya:'tipe-lainnya' };
  var totalHadir = histori.filter(function(h){ return h.status !== 'pinjam_nama'; }).length;
  var totalPinjam = histori.filter(function(h){ return h.status === 'pinjam_nama'; }).length;
  var content = '<div style="display:flex;gap:12px;margin-bottom:16px">'
    + '<div style="flex:1;background:var(--bg2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--accent)">' + histori.length + '</div><div style="font-size:11px;color:var(--text3)">Total</div></div>'
    + '<div style="flex:1;background:var(--bg2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--green)">' + totalHadir + '</div><div style="font-size:11px;color:var(--text3)">Hadir Fisik</div></div>'
    + '<div style="flex:1;background:var(--bg2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--yellow)">' + totalPinjam + '</div><div style="font-size:11px;color:var(--text3)">Pinjam Nama</div></div>'
    + '</div>';
  content += histori.length ? histori.map(function(h) {
    var tgl = new Date(h.tanggal).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
    var isPinjam = h.status === 'pinjam_nama';
    return '<div style="padding:12px 0;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
      + '<div class="kegiatan-tipe ' + (tipeClass[h.tipe] || '') + '">' + h.tipe + '</div>'
      + '<div style="flex:1;font-size:14px;font-weight:600">' + h.nama_kegiatan + '</div>'
      + '<div style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:' + (isPinjam ? 'var(--yellow-dim)' : 'var(--green-dim)') + ';color:' + (isPinjam ? 'var(--yellow)' : 'var(--green)') + '">' + (isPinjam ? 'Pinjam Nama' : 'Hadir') + '</div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--text2)">' + tgl + (h.lokasi ? ' · ' + h.lokasi : '') + '</div>'
      + '</div>';
  }).join('') : '<div style="color:var(--text3);text-align:center;padding:24px">Belum ada kegiatan</div>';
  document.getElementById('detail-title').textContent = nama;
  document.getElementById('detail-content').innerHTML = content;
  document.getElementById('detail-bukti-wrap').style.display = 'none';
  document.getElementById('btn-edit-trx').style.display = 'none';
  document.getElementById('btn-delete-trx').style.display = 'none';
  openSheet('detail');
}

// =====================
// DATA ANGGOTA
// =====================
function renderDataAnggota() {
  var isAdmin = currentProfile && currentProfile.role === 'admin';
  var el = document.getElementById('data-anggota-list');
  var divisiMap = {};
  allAnggota.forEach(function(a) { var div = a.jabatan || 'Tanpa Divisi'; if (!divisiMap[div]) divisiMap[div] = 0; divisiMap[div]++; });
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
    return a.nama.toLowerCase().indexOf(searchAnggota.toLowerCase()) >= 0 || (a.jabatan || '').toLowerCase().indexOf(searchAnggota.toLowerCase()) >= 0;
  });
  if (!filtered.length) { el.innerHTML = divisiHTML + searchBar + '<div style="color:var(--text3);font-size:13px;padding:16px 0;text-align:center">Tidak ditemukan</div>'; return; }
  var start = anggotaPage * PAGE_SIZE;
  var slice = filtered.slice(start, start + PAGE_SIZE);
  var maxP = Math.ceil(filtered.length / PAGE_SIZE) - 1;
  el.innerHTML = divisiHTML + searchBar + slice.map(function(a) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px">'
      + '<div class="anggota-avatar" style="width:38px;height:38px;border-radius:10px;font-size:15px;flex-shrink:0">' + a.nama.charAt(0).toUpperCase() + '</div>'
      + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">' + a.nama + '</div><div style="font-size:12px;color:var(--text2);margin-top:2px">' + (a.jabatan || '-') + (a.kontak ? ' · ' + a.kontak : '') + '</div></div>'
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
  var payload = { nama: nama, jabatan: document.getElementById('anggota-jabatan').value.trim() || null, kontak: document.getElementById('anggota-kontak').value.trim() || null, email: document.getElementById('anggota-email').value.trim() || null, catatan: document.getElementById('anggota-catatan').value.trim() || null };
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

// =====================
// KEGIATAN
// =====================
function renderKegiatanList() {
  var tipeClass = { fullboard:'tipe-fullboard', perjadin:'tipe-perjadin', rapat:'tipe-rapat', lainnya:'tipe-lainnya' };
  var canEdit = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'bendahara');
  var el = document.getElementById('kegiatan-list');
  var years = {};
  allKegiatan.forEach(function(k) { var tgl = k.tanggal_surat || k.tanggal_mulai; if (tgl) years[new Date(tgl).getFullYear()] = true; });
  var yearList = Object.keys(years).sort(function(a,b){ return b-a; });
  var searchBar = '<div style="margin-bottom:12px">'
    + '<div style="position:relative;margin-bottom:8px">'
    + '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:14px;pointer-events:none">🔍</span>'
    + '<input type="search" placeholder="Cari nama kegiatan..." value="' + escQ(searchKegiatan) + '" oninput="onSearchKegiatan(this.value)" style="width:100%;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px 10px 38px;color:var(--text);font-family:var(--font);font-size:14px;outline:none">'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<select id="keg-sel-bulan" style="background:var(--surface);border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;font-family:var(--font);outline:none" onchange="onFilterKegiatanChange()">'
    + '<option value="0">Semua Bulan</option>'
    + BULAN_NAMA.map(function(b,i){ return '<option value="'+(i+1)+'"'+(filterKegiatanBulan===i+1?' selected':'')+'>'+b+'</option>'; }).join('')
    + '</select>'
    + '<select id="keg-sel-tahun" style="background:var(--surface);border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;font-family:var(--font);outline:none" onchange="onFilterKegiatanChange()">'
    + '<option value="0">Semua Tahun</option>'
    + yearList.map(function(y){ return '<option value="'+y+'"'+(filterKegiatanTahun===parseInt(y)?' selected':'')+'>'+y+'</option>'; }).join('')
    + '</select>'
    + '</div></div>';
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
  if (!filtered.length) { el.innerHTML = searchBar + '<div style="color:var(--text3);font-size:13px;padding:16px 0;text-align:center">Tidak ada kegiatan ditemukan</div>'; return; }
  var start = kegiatanPage * PAGE_SIZE;
  var slice = filtered.slice(start, start + PAGE_SIZE);
  var maxP = Math.ceil(filtered.length / PAGE_SIZE) - 1;
  el.innerHTML = searchBar + slice.map(function(k) {
    var jp = k.kegiatan_peserta ? k.kegiatan_peserta.length : 0;
    var jh = k.kegiatan_peserta ? k.kegiatan_peserta.filter(function(p){ return p.status_kehadiran !== 'pinjam_nama'; }).length : 0;
    var jpin = k.kegiatan_peserta ? k.kegiatan_peserta.filter(function(p){ return p.status_kehadiran === 'pinjam_nama'; }).length : 0;
    var tglMulai = new Date(k.tanggal_mulai).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
    var tglSurat = k.tanggal_surat ? new Date(k.tanggal_surat).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    var namaList = k.kegiatan_peserta ? k.kegiatan_peserta.map(function(p){ var nm = p.anggota ? p.anggota.nama : '?'; return p.status_kehadiran === 'pinjam_nama' ? '<span style="color:var(--yellow)">' + nm + '*</span>' : nm; }).join(', ') : '';
    var pinjamText = jpin > 0 ? ' · <span style="color:var(--yellow)">' + jpin + ' pinjam nama</span>' : '';
    return '<div class="kegiatan-item">'
      + '<div class="kegiatan-header"><div class="kegiatan-nama">' + k.nama + '</div><div class="kegiatan-tipe ' + (tipeClass[k.tipe] || '') + '">' + k.tipe + '</div></div>'
      + (k.nomor_surat ? '<div style="font-size:11px;color:var(--accent);margin-bottom:4px">📄 ' + k.nomor_surat + (tglSurat ? ' · ' + tglSurat : '') + '</div>' : '')
      + '<div class="kegiatan-meta">Pelaksanaan: ' + tglMulai + (k.lokasi ? ' · ' + k.lokasi : '') + (k.bendahara ? ' · PIC: ' + k.bendahara.nama : '') + '</div>'
      + (namaList ? '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;line-height:1.6">' + namaList + '</div>' : '')
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<span style="font-size:12px;color:var(--text2)">' + jp + ' peserta · ' + jh + ' hadir' + pinjamText + '</span>'
      + (k.link_surat ? '<a href="' + k.link_surat + '" target="_blank" style="font-size:12px;color:var(--accent);text-decoration:none;font-weight:600">📎 Buka Surat Tugas</a>' : '')
      + '</div>'
      + (canEdit ? '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn-sm btn-sm-edit" onclick="editKegiatan(\'' + k.id + '\')">Edit</button><button class="btn-sm btn-sm-del" onclick="deleteKegiatan(\'' + k.id + '\')">Hapus</button></div>' : '')
      + '</div>';
  }).join('')
  + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 100px">'
  + '<button class="pager-btn" ' + (kegiatanPage === 0 ? 'disabled' : '') + ' onclick="kegiatanPage=Math.max(0,kegiatanPage-1);renderKegiatanList()">← Sebelumnya</button>'
  + '<span style="font-size:13px;color:var(--text2)">' + (kegiatanPage+1) + ' / ' + (maxP+1) + ' (' + filtered.length + ')</span>'
  + '<button class="pager-btn" ' + (kegiatanPage >= maxP ? 'disabled' : '') + ' onclick="kegiatanPage=Math.min('+maxP+',kegiatanPage+1);renderKegiatanList()">Berikutnya →</button>'
  + '</div>';
}

function onSearchKegiatan(val) { searchKegiatan = val; kegiatanPage = 0; renderKegiatanList(); }
function onFilterKegiatanChange() {
  var b = document.getElementById('keg-sel-bulan');
  var t = document.getElementById('keg-sel-tahun');
  filterKegiatanBulan = b ? parseInt(b.value) : 0;
  filterKegiatanTahun = t ? parseInt(t.value) : 0;
  kegiatanPage = 0;
  renderKegiatanList();
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
  showToast(editingKegiatanId ? 'Kegiatan diperbarui' : 'Kegiatan disimpan', 'green');
  loadKegiatan();
}

async function deleteKegiatan(id) {
  if (!window.confirm('Hapus kegiatan ini?')) return;
  await db.from('kegiatan_peserta').delete().eq('kegiatan_id', id);
  var r = await db.from('kegiatan').delete().eq('id', id);
  if (!r.error) { loadKegiatan(); showToast('Kegiatan dihapus', 'green'); }
  else showToast('Gagal menghapus', 'red');
}

// =====================
// LOG LOGIN
// =====================
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
