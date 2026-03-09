const configSection = document.getElementById('config-section');
const loadingSection = document.getElementById('loading-section');
const resultsSection = document.getElementById('results-section');
const submitBtn = document.getElementById('submit-btn');

document.getElementById('test-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const url = document.getElementById('url').value;
  const vus = document.getElementById('vus').value;
  const durationInput = document.getElementById('duration').value;
  const durationSeconds = parseInt(durationInput);
  const durationK6 = durationSeconds + 's';

  // Show loading
  configSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  resultsSection.classList.add('hidden');

  const progressStop = startProgressBar(durationSeconds);

  try {
    const response = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, vus, duration: durationK6 })
    });

    const result = await response.json();
    if (result.success) {
      renderResults(result.data, url, vus, durationK6);
    } else {
      alert('Pengujian gagal: ' + (result.error || 'Terjadi kesalahan sistem'));
      configSection.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
    alert('Gagal menghubungi server');
    configSection.classList.remove('hidden');
  } finally {
    progressStop();
    loadingSection.classList.add('hidden');
  }
});

function startProgressBar(seconds) {
  const progressBar = document.getElementById('progress-bar');
  const progressPercent = document.getElementById('progress-percent');

  // Reset
  progressBar.style.width = '0%';
  progressPercent.innerText = '0%';

  const startTime = Date.now();
  const durationMs = seconds * 1000;

  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    let percent = (elapsed / durationMs) * 100;

    // Cap at 99% until real finish
    if (percent > 99) percent = 99;

    progressBar.style.width = percent + '%';
    progressPercent.innerText = Math.round(percent) + '%';
  }, 100);

  return () => {
    clearInterval(interval);
    progressBar.style.width = '100%';
    progressPercent.innerText = '100%';
  };
}

function renderResults(data, url, vus, duration) {
  const metrics = data.metrics;
  resultsSection.classList.remove('hidden');

  // Display Test Info
  document.getElementById('test-info').innerHTML = `Target: <b>${url}</b> | VUs: <b>${vus}</b> | Durasi: <b>${duration}</b>`;

  // Stats
  const p95 = metrics.http_req_duration.values['p(95)'];
  const failRate = metrics.http_req_failed.values.rate * 100;
  const totalReqs = metrics.http_reqs.values.count;
  const rps = metrics.http_reqs.values.rate.toFixed(2);

  document.getElementById('stat-requests').innerText = totalReqs;
  document.getElementById('stat-success').innerText = (100 - failRate).toFixed(2) + '%';
  document.getElementById('stat-duration').innerText = p95.toFixed(0) + 'ms';
  document.getElementById('stat-rps').innerText = rps + ' rps';

  // Status Badge & Exec Summary Color
  const status = getStatus(p95, { warn: 800, fail: 2000 });
  const badge = document.getElementById('status-badge');
  badge.innerText = status.label;
  badge.style.backgroundColor = status.color;
  badge.style.color = 'white';

  const execBox = document.getElementById('exec-summary-box');
  execBox.style.borderLeftColor = status.color;

  // Executive Summary Text
  const checkRate = metrics.checks ? (metrics.checks.values.passes / (metrics.checks.values.passes + metrics.checks.values.fails)) * 100 : 100;
  let summaryText = "";
  if (failRate === 0 && checkRate === 100 && p95 <= 800) {
    summaryText = `Sistem menunjukkan performa yang <b>Sangat Baik</b>. Dibawah beban aktif, website tetap stabil dengan tingkat keberhasilan 100% dan waktu respon yang sangat cepat (${p95.toFixed(0)}ms). Tidak ditemukan bottleneck pada infrastruktur maupun backend.`;
  } else if (failRate > 1 || checkRate < 95 || p95 > 2000) {
    summaryText = `Sistem berada dalam kondisi <b>Kritis</b>. Ditemukan masalah signifikan pada ${failRate > 1 ? 'tingkat kegagalan request' : p95 > 2000 ? 'latensi respon' : 'validasi konten'}. Pengguna akan merasakan gangguan nyata atau kegagalan saat mengakses layanan pada beban ini.`;
  } else {
    summaryText = `Sistem berjalan <b>Cukup Stabil</b> namun memerlukan perhatian. Meskipun tingkat keberhasilan tinggi, terdapat indikasi perlambatan pada beberapa metrik (p95: ${p95.toFixed(0)}ms).`;
  }
  document.getElementById('exec-summary-text').innerHTML = summaryText;

  // Detailed Metrics
  const sections = [
    { title: 'Total Response Time', m: metrics.http_req_duration, t: { warn: 800, fail: 2000 }, d: 'Waktu total respon yang dirasakan user.' },
    { title: 'Backend Processing', m: metrics.http_req_waiting, t: { warn: 400, fail: 1000 }, d: 'Waktu tunggu respon pertama (TTFB).' },
    { title: 'Network Handshake', m: metrics.http_req_connecting, t: { warn: 50, fail: 200 }, d: 'Waktu membangun koneksi TCP.' },
    { title: 'SSL/TLS Negotiation', m: metrics.http_req_tls_handshaking, t: { warn: 100, fail: 300 }, d: 'Waktu negosiasi enkripsi SSL/TLS.' },
    { title: 'Request Blocked', m: metrics.http_req_blocked, t: { warn: 50, fail: 250 }, d: 'Waktu request menunggu koneksi tersedia.' },
    { title: 'Data Transfer In', m: metrics.http_req_receiving, t: { warn: 100, fail: 500 }, d: 'Waktu untuk menerima data dari server.' },
    { title: 'Data Transfer Out', m: metrics.http_req_sending, t: { warn: 50, fail: 200 }, d: 'Waktu untuk mengirim data ke server.' },
    { title: 'End-to-End Cycle', m: metrics.iteration_duration, t: { warn: 1500, fail: 4000 }, d: 'Waktu total satu siklus skrip per user.' }
  ];

  const metricsContainer = document.getElementById('metrics-detailed');
  metricsContainer.innerHTML = '<h2 style="margin-top: 40px; margin-bottom: 24px;">🔍 Analisis Detail Metrik</h2>';

  // Add Flex Container for metrics
  const gridDiv = document.createElement('div');
  gridDiv.style.display = 'grid';
  gridDiv.style.gridTemplateColumns = 'repeat(auto-fill, minmax(400px, 1fr))';
  gridDiv.style.gap = '20px';
  metricsContainer.appendChild(gridDiv);

  sections.forEach(s => {
    const val = s.m.values['p(95)'];
    const st = getStatus(val, s.t);
    const html = `
            <div class="metric-item" style="border-top: 4px solid ${st.color}; margin-bottom:0;">
                <div class="metric-title-row">
                    <span class="metric-name">${st.icon} ${s.title}</span>
                    <span class="status-label" style="background:${st.color}">${st.label}</span>
                </div>
                <p class="metric-desc">${s.d}</p>
                <div class="metric-advice"><b>Hasil p(95):</b> ${val.toFixed(1)}ms</div>
                <div class="metric-stats">
                    <span>Min: <b>${s.m.values.min.toFixed(1)}ms</b></span>
                    <span>Med: <b>${s.m.values.med.toFixed(1)}ms</b></span>
                    <span>Max: <b>${s.m.values.max.toFixed(1)}ms</b></span>
                </div>
            </div>
        `;
    gridDiv.innerHTML += html;
  });

  // Error & Checks Analysis
  const errorHtml = `
        <div class="metric-item" style="border-top: 4px solid ${getStatus(failRate, { warn: 0.1, fail: 1 }).color}; grid-column: 1 / -1; margin-top:20px;">
            <div class="metric-title-row">
                <span class="metric-name">🛡️ Error & Validation</span>
                <span class="status-label" style="background:${getStatus(failRate, { warn: 0.1, fail: 1 }).color}">${getStatus(failRate, { warn: 0.1, fail: 1 }).label}</span>
            </div>
            <p class="metric-desc">Mengukur keandalan sistem dan validasi konten.</p>
            <div class="metric-advice">
                <b>Gagal:</b> ${failRate.toFixed(2)}% | <b>Validasi:</b> ${checkRate.toFixed(2)}%
            </div>
        </div>
    `;
  gridDiv.innerHTML += errorHtml;

  // Option to show form again
  const btnContainer = document.createElement('div');
  btnContainer.style.textAlign = 'center';
  btnContainer.style.width = '100%';

  const startAgainBtn = document.createElement('button');
  startAgainBtn.innerText = '🔄 Uji Website Lain';
  startAgainBtn.style.marginTop = '40px';
  startAgainBtn.style.maxWidth = '300px';
  startAgainBtn.style.margin = '40px auto';
  startAgainBtn.onclick = () => {
    configSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  btnContainer.appendChild(startAgainBtn);
  metricsContainer.appendChild(btnContainer);
}

function getStatus(value, thresholds) {
  if (value <= thresholds.warn) return { icon: '✅', label: 'BAIK', color: '#10b981' };
  if (value <= thresholds.fail) return { icon: '⚠️', label: 'PERLU PERHATIAN', color: '#f59e0b' };
  return { icon: '❌', label: 'KRITIS', color: '#ef4444' };
}
