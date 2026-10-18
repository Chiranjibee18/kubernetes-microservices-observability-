const express = require('express');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const notificationsSentCounter = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications processed and dispatched',
  labelNames: ['channel'],
  registers: [register]
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'notification-service' });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'READY' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.post('/api/notify', (req, res) => {
  const { orderId, recipient, channel } = req.body;
  const deliveryChannel = channel || 'email';

  console.log(`[NotificationService] Sending ${deliveryChannel} notification for order ${orderId} to ${recipient}`);
  notificationsSentCounter.labels(deliveryChannel).inc();

  res.status(200).json({
    success: true,
    message: `Notification dispatched via ${deliveryChannel}`,
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ service: 'notification-service', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`[NotificationService] Listening on port ${PORT}`);
});
