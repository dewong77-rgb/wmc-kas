// WMC KAS - rekap.js
var rekapPage = 0;
var rekapBulan = 0;
var rekapTahun = 0;

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

  // Stats per anggota + divisi
  var stats = {};
  var divisiStats = {};
  var divisiAnggotaStats = {};

  allAnggota.forEach(function(a) {
    var divisi = a.jabatan || 'Tanpa Divisi';
    if (!divisiStats[divisi]) { divisiStats[divisi] = { anggotaSet: {}, pernahIkutSet: {}, hadirFisikSet: {}, hadir: 0, pinjam: 0 }; divisiAnggotaStats[divisi] = {}; }
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

      if (!stats[aid]) stats[aid] = { nama: nama, divisi: divisi, total: 0, fullboard: 0, perjadin: 0, pinjam: 0 };
      stats[aid].total++;
      if (k.tipe === 'fullboard') stats[aid].fullboard++;
      else if (k.tipe === 'perjadin') stats[aid].perjadin++;
      if (isPinjam) stats[aid].pinjam++;

      if (!divisiStats[divisi]) { divisiStats[divisi] = { anggotaSet: {}, pernahIkutSet: {}, hadirFisikSet: {}, hadir: 0, pinjam: 0 }; divisiAnggotaStats[divisi] = {}; }
      divisiStats[divisi].anggotaSet[aid] = true;
      divisiStats[divisi].pernahIkutSet[aid] = true;
      if (!isPinjam) divisiStats[divisi].hadirFisikSet[aid] = true;
      if (isPinjam) divisiStats[divisi].pinjam++;
      else divisiStats[divisi].hadir++;

      if (!divisiAnggotaStats[divisi]) divisiAnggotaStats[divisi] = {};
      if (!divisiAnggotaStats[divisi][aid]) divisiAnggotaStats[divisi][aid] = { nama: nama, hadir: 0, pinjam: 0 };
      if (isPinjam) divisiAnggotaStats[divisi][aid].pinjam++;
      else divisiAnggotaStats[divisi][aid].hadir++;
    });
  });

  // Per bulan
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

  // Breakdown per tim
  var divisiList = Object.keys(divisiStats).sort(function(a, b) { return divisiStats[b].hadir - divisiStats[a].hadir; });

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

    var anggotaList = Object.keys(ds.anggotaSet).map(function(aid) {
      var a = das[aid] || { nama: (allAnggota.filter(function(x){ return x.id===aid; })[0] || {}).nama || '?', hadir: 0, pinjam: 0 };
      return { aid: aid, nama: a.nama, hadir: a.hadir, pinjam: a.pinjam, total: a.hadir + a.pinjam };
    });

    var topHadir = anggotaList.filter(function(a){ return a.hadir > 0; }).sort(function(a,b){ return b.hadir - a.hadir; });
    var bottomHadir = anggotaList.filter(function(a){ return a.hadir > 0; }).sort(function(a,b){ return a.hadir - b.hadir; });
    var hanyaPinjam = anggotaList.filter(function(a){ return a.total > 0 && a.hadir === 0; });
    var belumIkut = anggotaList.filter(function(a){ return a.total === 0; });

    var infoHTML = '';
    if (topHadir.length > 0) infoHTML += '<div style="font-size:11px;margin-top:6px"><span style="color:var(--green)">🏆 Paling aktif: </span><span style="color:var(--text)">' + topHadir[0].nama + ' (' + topHadir[0].hadir + 'x hadir)</span></div>';
    if (bottomHadir.length > 0 && bottomHadir[0].aid !== (topHadir[0] || {}).aid) infoHTML += '<div style="font-size:11px;margin-top:4px"><span style="color:var(--text2)">🔻 Paling sedikit hadir: </span><span style="color:var(--text)">' + bottomHadir[0].nama + ' (' + bottomHadir[0].hadir + 'x hadir)</span></div>';
    if (hanyaPinjam.length > 0) infoHTML += '<div style="font-size:11px;margin-top:4px"><span style="color:var(--yellow)">◌ Hanya pinjam nama: </span><span style="color:var(--text)">' + hanyaPinjam.map(function(a){ return a.nama; }).join(', ') + '</span></div>';
    if (belumIkut.length > 0) infoHTML += '<div style="font-size:11px;margin-top:4px"><span style="color:var(--red)">✗ Belum pernah ikut: </span><span style="color:var(--text)">' + belumIkut.map(function(a){ return a.nama; }).join(', ') + '</span></div>';

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
        ? '<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:4px"><div style="width:' + pctHadir + '%;background:var(--green)"></div><div style="width:' + pctPinjam + '%;background:var(--yellow)"></div><div style="flex:1;background:var(--border)"></div></div>'
          + '<div style="display:flex;gap:12px;font-size:11px;color:var(--text2);margin-bottom:2px"><span style="color:var(--green)">' + ds.hadir + ' hadir (' + pctHadir + '%)</span><span style="color:var(--yellow)">' + ds.pinjam + ' pinjam nama (' + pctPinjam + '%)</span></div>'
          + infoHTML
        : '<div style="font-size:11px;color:var(--text3)">Belum ada kegiatan di periode ini</div>' + infoHTML)
      + '</div>';
  }).join('');

  var ringkasanHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:16px">'
    + '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Ringkasan Kegiatan</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'
    + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--accent)">' + filtered.length + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Total Kegiatan</div></div>'
    + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green)">' + filtered.filter(function(k){return k.tipe==='fullboard';}).length + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Fullboard</div></div>'
    + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--purple)">' + filtered.filter(function(k){return k.tipe==='perjadin';}).length + '</div><div style="font-size:10px;color:var(--text3);margin-top:2px">Perjadin</div></div>'
    + '</div>'
    + '<div style="display:flex;gap:12px;font-size:11px;color:var(--text3);margin-bottom:8px"><span>📊 Kontribusi per tim:</span><span style="color:var(--green)">■ Hadir</span><span style="color:var(--yellow)">■ Pinjam Nama</span></div>'
    + timHTML
    + (bulanList.length > 1
      ? '<div style="font-size:11px;color:var(--text3);margin-top:12px;margin-bottom:6px">Per bulan:</div>'
        + bulanList.map(function(b){
            return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><div style="font-size:11px;color:var(--text2);min-width:90px">' + b.label + '</div><div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:6px;background:var(--accent);border-radius:3px;width:' + Math.round((b.count/maxBulan)*100) + '%"></div></div><div style="font-size:11px;font-weight:700;color:var(--text);min-width:16px;text-align:right">' + b.count + '</div></div>';
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
    rankHTML = '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Ranking Keikutsertaan <span style="color:var(--text3);font-weight:400;font-size:11px">(' + sorted.length + ' anggota)</span></div>'
      + slice.map(function(a, i) {
          var gr = start + i;
          var medal = gr < 3 ? medals[gr] : (gr + 1) + '.';
          var hadirFisik = a.total - a.pinjam;
          var pinjamText = a.pinjam > 0 ? (hadirFisik === 0 ? ' · <span style="color:var(--red)">selalu pinjam nama</span>' : ' · <span style="color:var(--yellow)">' + a.pinjam + 'x pinjam</span>') : '';
          var divisiTag = a.divisi ? '<span style="background:var(--bg2);border-radius:10px;padding:1px 8px;font-size:10px;color:var(--text3);margin-left:6px">' + a.divisi + '</span>' : '';
          return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="openDetailAnggota(\'' + escQ(a.nama) + '\')">'
            + '<div style="font-size:18px;width:28px;text-align:center;flex-shrink:0">' + medal + '</div>'
            + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">' + a.nama + divisiTag + '</div>'
            + '<div style="font-size:11px;color:var(--text2);margin-top:2px"><span style="color:var(--accent)">' + a.fullboard + ' fullboard</span> · <span style="color:var(--green)">' + a.perjadin + ' perjadin</span>' + pinjamText + '</div></div>'
            + '<div style="display:flex;align-items:center;gap:6px"><div style="font-size:20px;font-weight:800;font-family:var(--mono);color:var(--text)">' + a.total + '</div><div style="font-size:11px;color:var(--text3)">›</div></div>'
            + '</div>';
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
    + '</div>'
    + (histori.length ? histori.map(function(h) {
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
      }).join('') : '<div style="color:var(--text3);text-align:center;padding:24px">Belum ada kegiatan</div>');
  document.getElementById('detail-title').textContent = nama;
  document.getElementById('detail-content').innerHTML = content;
  document.getElementById('detail-bukti-wrap').style.display = 'none';
  document.getElementById('btn-edit-trx').style.display = 'none';
  document.getElementById('btn-delete-trx').style.display = 'none';
  openSheet('detail');
}
