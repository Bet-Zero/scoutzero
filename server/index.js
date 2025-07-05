import express from 'express';
import { exportRosterToPng } from './exportRoster.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.get('/api/exportRoster/:rosterId', async (req, res) => {
  const { rosterId } = req.params;
  const url = `${FRONTEND_URL}/roster-export/${rosterId}`;
  try {
    const pngBuffer = await exportRosterToPng(url);
    res.set('Content-Type', 'image/png');
    res.send(pngBuffer);
  } catch (err) {
    console.error('Export failed', err);
    res.status(500).send('Failed to export roster');
  }
});

app.listen(PORT, () => {
  console.log(`Export server listening on port ${PORT}`);
});
