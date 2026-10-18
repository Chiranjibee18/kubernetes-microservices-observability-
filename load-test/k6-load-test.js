import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Test Scenario to trigger Kubernetes Horizontal Pod Autoscaler (HPA)
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Warm-up ramp
    { duration: '1m', target: 100 },  // High load to trigger HPA CPU threshold (>60%)
    { duration: '2m', target: 150 },  // Sustained spike (scales from 2 to 6+ pods)
    { duration: '30s', target: 0 },   // Cool-down to test stabilization window
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate must remain below 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export default function () {
  const payload = JSON.stringify({
    item: 'DevOps-Masterclass-Cloud-Key',
    quantity: Math.floor(Math.random() * 5) + 1,
    customerEmail: `tester-${__VU}@k6-bench.local`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/orders`, payload, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
    'order created': (r) => JSON.parse(r.body).success === true,
  });

  sleep(0.1);
}
