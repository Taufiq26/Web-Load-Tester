import fs from 'fs';
import puppeteer from 'puppeteer';
import path from 'path';

async function generateReport() {
    const summaryPath = path.join(process.cwd(), 'summary.json');
    if (!fs.existsSync(summaryPath)) {
        console.error('Error: summary.json not found. Run k6 first.');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const metrics = data.metrics;

    // --- HELPER FUNCTIONS ---
    const getStatus = (value: number, thresholds: { warn: number, fail: number }, higherIsBetter = false) => {
        if (higherIsBetter) {
            if (value >= thresholds.warn) return { icon: '✅', label: 'BAIK', color: '#10b981', bg: '#ecfdf5' };
            if (value >= thresholds.fail) return { icon: '⚠️', label: 'PERLU PERHATIAN', color: '#f59e0b', bg: '#fffbeb' };
            return { icon: '❌', label: 'BAHAYA', color: '#ef4444', bg: '#fef2f2' };
        } else {
            if (value <= thresholds.warn) return { icon: '✅', label: 'BAIK', color: '#10b981', bg: '#ecfdf5' };
            if (value <= thresholds.fail) return { icon: '⚠️', label: 'PERLU PERHATIAN', color: '#f59e0b', bg: '#fffbeb' };
            return { icon: '❌', label: 'BAHAYA', color: '#ef4444', bg: '#fef2f2' };
        }
    };

    const formatMs = (val: number) => val < 1 ? val.toFixed(3) + 'ms' : val.toFixed(1) + 'ms';

    // --- METRIC ANALYSIS LOGIC ---
    const sections = [
        {
            id: 'duration',
            title: 'Total Response Time (http_req_duration)',
            metric: metrics.http_req_duration,
            thresholds: { warn: 800, fail: 2000 },
            desc: 'Waktu total dari awal request sampai data terakhir diterima. Ini adalah performa yang dirasakan user secara langsung.',
            advice: (val: number) => val <= 800 ? 'Sangat responsif.' : 'Mulai terasa lambat. Pertimbangkan optimasi query atau resource.'
        },
        {
            id: 'waiting',
            title: 'Backend Process Time (http_req_waiting)',
            metric: metrics.http_req_waiting,
            thresholds: { warn: 400, fail: 1000 },
            desc: 'Time to First Byte (TTFB). Seberapa cepat server memproses logika internal sebelum mulai mengirim data.',
            advice: (val: number) => val <= 400 ? 'Backend sehat.' : 'Backend bottleneck. Cek beban database atau efisiensi kode.'
        },
        {
            id: 'connecting',
            title: 'Network Handshake (http_req_connecting)',
            metric: metrics.http_req_connecting,
            thresholds: { warn: 50, fail: 200 },
            desc: 'Waktu untuk membangun koneksi TCP. Mengukur stabilitas jalur jaringan.',
            advice: (val: number) => val <= 50 ? 'Jaringan stabil.' : 'Delay jaringan tinggi. Cek lokasi server atau firewall.'
        },
        {
            id: 'tls',
            title: 'SSL/TLS Handshaking (http_req_tls_handshaking)',
            metric: metrics.http_req_tls_handshaking,
            thresholds: { warn: 100, fail: 300 },
            desc: 'Waktu untuk negosiasi enkripsi SSL/TLS. Mengukur efisiensi protokol keamanan.',
            advice: (val: number) => val <= 100 ? 'SSL optimal.' : 'SSL mahal. Pertimbangkan upgrade CPU server atau optimasi TLS config.'
        },
        {
            id: 'blocked',
            title: 'Request Blocked (http_req_blocked)',
            metric: metrics.http_req_blocked,
            thresholds: { warn: 50, fail: 250 },
            desc: 'Waktu request menunggu koneksi tersedia (antre di browser/k6).',
            advice: (val: number) => val <= 50 ? 'Tidak ada bottleneck lokal.' : 'Request mengantre. Cek concurrent connection limit.'
        },
        {
            id: 'receiving',
            title: 'Data Transfer In (http_req_receiving)',
            metric: metrics.http_req_receiving,
            thresholds: { warn: 100, fail: 500 },
            desc: 'Waktu untuk menerima payload data dari server. Bergantung pada ukuran konten.',
            advice: (val: number) => val <= 100 ? 'Ukuran data efisien.' : 'Payload besar. Gunakan kompresi Gzip/Brotli atau pecah asset.'
        },
        {
            id: 'sending',
            title: 'Data Transfer Out (http_req_sending)',
            metric: metrics.http_req_sending,
            thresholds: { warn: 50, fail: 200 },
            desc: 'Waktu untuk mengirim data request ke server.',
            advice: (val: number) => val <= 50 ? 'Koneksi upload lancar.' : 'Delay upload terdeteksi.'
        },
        {
            id: 'iteration',
            title: 'End-to-End Cycle (iteration_duration)',
            metric: metrics.iteration_duration,
            thresholds: { warn: 1500, fail: 4000 },
            desc: 'Waktu total satu siklus skrip per user (termasuk delay/sleep).',
            advice: (val: number) => val <= 1500 ? 'Siklus efisien.' : 'Siklus lambat.'
        }
    ];

    const failRate = metrics.http_req_failed.values.rate * 100;
    const successStatus = getStatus(failRate, { warn: 0.1, fail: 1.0 });

    const checkRate = metrics.checks ? (metrics.checks.values.passes / (metrics.checks.values.passes + metrics.checks.values.fails)) * 100 : 100;
    const checkStatus = getStatus(checkRate, { warn: 100, fail: 95 }, true);

    // --- HTML TEMPLATE ---
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif; line-height: 1.5; color: #334155; margin: 0; padding: 40px; background: #fff; }
            .container { max-width: 900px; margin: auto; }
            
            .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 3px solid #f1f5f9; padding-bottom: 30px; margin-bottom: 40px; }
            .header h1 { margin: 0; font-size: 32px; color: #0f172a; font-weight: 800; letter-spacing: -0.02em; }
            .badge-main { padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; text-transform: uppercase; }

            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
            .summary-card { border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; background: #f8fafc; }
            .summary-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
            .summary-value { font-size: 22px; font-weight: 800; color: #1e293b; }

            h2 { font-size: 22px; color: #0f172a; margin: 40px 0 20px 0; display: flex; align-items: center; gap: 12px; }
            h2::after { content: ""; flex: 1; height: 1px; background: #e2e8f0; }

            .analysis-row { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
            .analysis-header { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
            .analysis-title { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1e293b; }
            .status-text { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; }

            .analysis-body { padding: 20px; }
            .analysis-desc { font-size: 14px; color: #475569; margin-bottom: 12px; }
            .analysis-result { font-size: 14px; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
            
            .analysis-stats { display: flex; gap: 24px; margin-top: 15px; font-size: 12px; color: #64748b; }
            .stat-box b { color: #0f172a; }

            .footer { margin-top: 60px; text-align: center; color: #94a3b8; font-size: 12px; padding-top: 30px; border-top: 1px solid #f1f5f9; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 20px; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
            th { text-align: left; background: #f8fafc; padding: 12px 16px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #334155; }
            .metric-name { font-weight: 600; color: #0f172a; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div>
                    <h1>Load Test Analysis</h1>
                    <div style="color: #64748b; margin-top: 8px; font-size: 14px;">Target: <b>kbpayuk.com</b> | Report ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
                </div>
                <div style="text-align: right;">
                    <div class="badge-main" style="background: ${durationStatusMain().bg}; color: ${durationStatusMain().color}">${durationStatusMain().label}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">${new Date().toLocaleString('id-ID')}</div>
                </div>
            </div>

            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-label">Requests</div>
                    <div class="summary-value">${metrics.http_reqs.values.count}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Success Rate</div>
                    <div class="summary-value">${(100 - failRate).toFixed(2)}%</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">p(95) Duration</div>
                    <div class="summary-value">${metrics.http_req_duration.values['p(95)'].toFixed(0)}ms</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Concurrent VUs</div>
                    <div class="summary-value">${metrics.vus ? metrics.vus.values.max : 'Config'}</div>
                </div>
            </div>

            <h2>Analisis Setiap Metrik</h2>

            ${sections.map(s => {
        const p95 = s.metric.metric === 'iteration_duration' ? s.metric.values['p(95)'] : s.metric.values['p(95)'];
        const status = getStatus(p95, s.thresholds);
        return `
                <div class="analysis-row" style="background: ${status.bg}15; border-color: ${status.color}30">
                    <div class="analysis-header" style="background: ${status.bg}">
                        <div class="analysis-title">${status.icon} ${s.title}</div>
                        <div class="status-text" style="color: white; background: ${status.color}">${status.label}</div>
                    </div>
                    <div class="analysis-body">
                        <div class="analysis-desc">${s.desc}</div>
                        <div class="analysis-result">
                            <b>Analisis Hasil:</b> p(95) menunjukkan <b>${formatMs(p95)}</b>. ${s.advice(p95)}
                        </div>
                        <div class="analysis-stats">
                            <div class="stat-box">Minimal: <b>${formatMs(s.metric.values.min)}</b></div>
                            <div class="stat-box">Median: <b>${formatMs(s.metric.values.med)}</b></div>
                            <div class="stat-box">Rata-rata: <b>${formatMs(s.metric.values.avg)}</b></div>
                            <div class="stat-box">Maksimal: <b>${formatMs(s.metric.values.max)}</b></div>
                        </div>
                    </div>
                </div>`;
    }).join('')}

            <div class="analysis-row" style="background: ${successStatus.bg}15; border-color: ${successStatus.color}30">
                <div class="analysis-header" style="background: ${successStatus.bg}">
                    <div class="analysis-title">${successStatus.icon} Error Validation (http_req_failed)</div>
                    <div class="status-text" style="color: white; background: ${successStatus.color}">${successStatus.label}</div>
                </div>
                <div class="analysis-body">
                    <div class="analysis-desc">Mengukur keandalan sistem dalam melayani request tanpa error.</div>
                    <div class="analysis-result">
                        <b>Analisis:</b> Tingkat kegagalan adalah <b>${failRate.toFixed(2)}%</b>. 
                        ${failRate === 0 ? 'Sangat baik, server melayani seluruh beban dengan sempurna.' : 'Ada beberapa request yang gagal, cek error log server.'}
                    </div>
                </div>
            </div>

            <div class="analysis-row" style="background: ${checkStatus.bg}15; border-color: ${checkStatus.color}30">
                <div class="analysis-header" style="background: ${checkStatus.bg}">
                    <div class="analysis-title">${checkStatus.icon} Content Validation (checks)</div>
                    <div class="status-text" style="color: white; background: ${checkStatus.color}">${checkStatus.label}</div>
                </div>
                <div class="analysis-body">
                    <div class="analysis-desc">Memastikan isi data yang diterima benar (misal: Status 200).</div>
                    <div class="analysis-result">
                        <b>Analisis:</b> <b>${checkRate.toFixed(2)}%</b> validasi lolos. 
                    </div>
                </div>
            </div>

            <h2>Raw Metric Data</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Avg</th>
                        <th>Min</th>
                        <th>Med</th>
                        <th>Max</th>
                        <th>p(95)</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(metrics).filter(m => metrics[m].type === 'trend').map(m => `
                    <tr>
                        <td class="metric-name">${m}</td>
                        <td>${formatMs(metrics[m].values.avg)}</td>
                        <td>${formatMs(metrics[m].values.min)}</td>
                        <td>${formatMs(metrics[m].values.med)}</td>
                        <td>${formatMs(metrics[m].values.max)}</td>
                        <td>${formatMs(metrics[m].values['p(95)'])}</td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <div class="footer">
                Antigravity Performance Reporter &bull; k6 Summary Data &bull; v1.2
            </div>
        </div>
    </body>
    </html>
    `;

    function durationStatusMain() {
        return getStatus(metrics.http_req_duration.values['p(95)'], { warn: 800, fail: 2000 });
    }

    // --- CONVERT TO PDF ---
    console.log('Generating PDF...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    await page.pdf({
        path: 'loadtest_report.pdf',
        format: 'A4',
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
        printBackground: true
    });

    await browser.close();
    console.log('✅ PDF Report generated: loadtest_report.pdf');
}

generateReport().catch(console.error);
