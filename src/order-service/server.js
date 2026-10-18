const express = require('express');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3000;
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3001';

app.use(express.json());

// -------------------------------------------------------------
// PROMETHEUS METRICS SETUP
// -------------------------------------------------------------
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register]
});

const ordersCreatedCounter = new client.Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created successfully',
  registers: [register]
});

// Middleware to track request duration and metrics
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;
    const route = req.route ? req.route.path : req.path;
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
  });
  next();
});

// In-memory orders store
let isReady = true;
const orders = [];

// -------------------------------------------------------------
// KUBERNETES PROBE ENDPOINTS
// -------------------------------------------------------------
// Liveness probe: checks if container process is running
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Readiness probe: checks if application is ready to accept user traffic
app.get('/ready', (req, res) => {
  if (isReady) {
    res.status(200).json({ status: 'READY' });
  } else {
    res.status(503).json({ status: 'NOT_READY' });
  }
});

// Prometheus Scrape Endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// -------------------------------------------------------------
// APPLICATION BUSINESS LOGIC
// -------------------------------------------------------------
app.get('/api/orders', (req, res) => {
  res.json({
    success: true,
    count: orders.length,
    data: orders
  });
});

app.post('/api/orders', (req, res) => {
  const { item, quantity, customerEmail } = req.body;

  if (!item || !quantity) {
    return res.status(400).json({ error: 'Item and quantity are required' });
  }

  // Simulate CPU computation for HPA load testing
  let hash = 0;
  for (let i = 0; i < 150000; i++) {
    hash = (hash + (i * 3)) % 1000000;
  }

  const order = {
    id: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    item,
    quantity: parseInt(quantity, 10),
    customerEmail: customerEmail || 'customer@example.com',
    status: 'CONFIRMED',
    createdAt: new Date().toISOString()
  };

  orders.push(order);
  ordersCreatedCounter.inc();

  // Async dispatch notification (mocked)
  console.log(`[OrderService] Order created: ${order.id} for ${order.item} (x${order.quantity})`);

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    order
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'order-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    endpoints: ['/api/orders', '/metrics', '/healthz', '/ready']
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[OrderService] Listening on port ${PORT}`);
});

// Graceful Shutdown handling for Kubernetes SIGTERM
process.on('SIGTERM', () => {
  console.log('[OrderService] SIGTERM received. Initiating graceful shutdown...');
  isReady = false; // Immediately fail readiness probe so k8s stops routing new traffic
  server.close(() => {
    console.log('[OrderService] Closed remaining active connections. Exiting cleanly.');
    process.exit(0);
  });
  // Force exit after 10s timeout
  setTimeout(() => {
    console.error('[OrderService] Shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 10000);
});

module.exports = app;
