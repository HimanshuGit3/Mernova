import express from 'express';

export function createApp() {
  const app = express();
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });
  return app;
}
