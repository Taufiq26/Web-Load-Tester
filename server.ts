import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/test', (req, res) => {
  const { url, vus, duration } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`Starting test for ${url} with ${vus} VUs for ${duration}`);

  const k6Process = spawn('k6', [
    'run',
    '-e', `URL=${url}`,
    '-e', `VUS=${vus || 10}`,
    '-e', `DURATION=${duration || '10s'}`,
    'loadtest.ts'
  ]);

  let output = '';
  k6Process.stdout.on('data', (data) => {
    output += data.toString();
    // Option to stream logs back via SSE if needed
  });

  k6Process.stderr.on('data', (data) => {
    console.error(`k6 error: ${data}`);
  });

  k6Process.on('close', (code) => {
    console.log(`k6 process exited with code ${code}`);

    // Read the generated summary.json
    const summaryPath = path.join(process.cwd(), 'summary.json');
    if (fs.existsSync(summaryPath)) {
      const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      res.json({
        success: code === 0,
        data: summaryData,
        raw: output
      });
    } else {
      res.status(500).json({ error: 'Failed to generate summary' });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
