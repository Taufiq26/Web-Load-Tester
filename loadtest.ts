import http from 'k6/http';
import { check, sleep } from 'k6';

// @ts-ignore
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

export let options = {
  vus: 50, // Virtual Users (Simulasi x user barengan)
  duration: '30s', // Durasi pengujian
};

export default function () {
  // 1. Tes Landing Page (Frontend)
  let resLanding = http.get('https://kbpayuk.com');
  check(resLanding, { 'Landing Page status 200': (r) => r.status === 200 });

  sleep(1); // Jeda antar request agar tidak seperti DDoS
}

export function handleSummary(data: any) {
  const metrics = data.metrics;

  // Helper to format values
  const fmt = (val: number, unit = '') => val.toFixed(2) + unit;
  const trend = (m: any) => `avg=${fmt(m.avg)}ms min=${fmt(m.min)}ms med=${fmt(m.med)}ms max=${fmt(m.max)}ms p(90)=${fmt(m['p(90)'])}ms p(95)=${fmt(m['p(95)'])}ms`;

  const stdout = `
  █ TOTAL RESULTS 

    checks_total.......: ${metrics.checks?.values.passes + metrics.checks?.values.fails || 0}
    checks_succeeded...: ${((metrics.checks?.values.rate || 0) * 100).toFixed(2)}%
    checks_failed......: ${((1 - (metrics.checks?.values.rate || 1)) * 100).toFixed(2)}%

    ${(data.root_group.checks || []).map((c: any) => `${c.fails > 0 ? '✗' : '✓'} ${c.name} (passes: ${c.passes}, fails: ${c.fails})`).join('\n    ')}

    HTTP
    http_req_duration..............: ${trend(metrics.http_req_duration.values)}
      { expected_response:true }...: ${trend(metrics['http_req_duration{expected_response:true}'].values)}
    http_req_waiting...............: ${trend(metrics.http_req_waiting.values)}
    http_req_connecting............: ${trend(metrics.http_req_connecting.values)}
    http_req_tls_handshaking.......: ${trend(metrics.http_req_tls_handshaking.values)}
    http_req_blocked...............: ${trend(metrics.http_req_blocked.values)}
    http_req_sending...............: ${trend(metrics.http_req_sending.values)}
    http_req_receiving.............: ${trend(metrics.http_req_receiving.values)}
    http_req_failed................: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}% (${metrics.http_req_failed.values.passes} out of ${metrics.http_req_failed.values.passes + metrics.http_req_failed.values.fails})
    http_reqs......................: ${metrics.http_reqs.values.count} (${fmt(metrics.http_reqs.values.rate, '/s')})

    EXECUTION
    iteration_duration.............: ${trend(metrics.iteration_duration.values)}
    iterations.....................: ${metrics.iterations.values.count} (${fmt(metrics.iterations.values.rate, '/s')})
    vus............................: ${metrics.vus.values.value} (min=${metrics.vus.values.min}, max=${metrics.vus.values.max})
    vus_max........................: ${metrics.vus_max.values.value}

    NETWORK
    data_received..................: ${(metrics.data_received.values.count / 1024 / 1024).toFixed(2)} MB (${(metrics.data_received.values.rate / 1024 / 1024).toFixed(2)} MB/s)
    data_sent......................: ${(metrics.data_sent.values.count / 1024).toFixed(2)} kB (${(metrics.data_sent.values.rate / 1024).toFixed(2)} kB/s)
  `;

  return {
    'summary.json': JSON.stringify(data),
    'stdout': stdout,
  };
}