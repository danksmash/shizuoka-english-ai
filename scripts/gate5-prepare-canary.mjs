import fs from 'node:fs/promises';

const serverPath = 'server.ts';
let source = await fs.readFile(serverPath, 'utf8');

const importAnchor = "import { managementPageHtml } from './src/server/managementPage';";
const azureImport = "import { synthesizeAzureTts } from './src/server/azureTts';";
if (!source.includes(importAnchor)) throw new Error('Gate 5 import anchor not found');
if (!source.includes(azureImport)) {
  source = source.replace(importAnchor, `${importAnchor}\n${azureImport}`);
}

const endpointMarker = "app.post('/api/chat', async (req, res) => {";
if (!source.includes(endpointMarker)) throw new Error('Gate 5 endpoint anchor not found');

const canaryEndpoint = String.raw`
app.post('/api/tts/azure-canary', async (req, res) => {
  if (process.env.AZURE_CANARY_ENABLED !== 'true') return res.sendStatus(404);
  const expectedToken = process.env.AZURE_CANARY_TOKEN || '';
  if (!expectedToken || req.header('x-azure-canary-token') !== expectedToken) return res.sendStatus(403);

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ success: false, error: 'Rate limited' });

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const aiStudentId = typeof req.body?.aiStudentId === 'string' ? req.body.aiStudentId : '';
  const requestedRate = Number(req.body?.speakingRate || 1.0);
  if (!text || text.length > 300 || !isAIStudentId(aiStudentId)) {
    return res.status(400).json({ success: false, error: 'Invalid Azure canary TTS request' });
  }

  const started = Date.now();
  try {
    const result = await synthesizeAzureTts(text, aiStudentId, requestedRate);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-TTS-Provider', result.provider);
    res.setHeader('X-TTS-Voice', result.voiceName);
    res.setHeader('X-TTS-Effective-Rate', result.effectiveRate.toFixed(2));
    res.setHeader('X-TTS-Latency-Ms', String(Date.now() - started));
    return res.send(result.audio);
  } catch (error) {
    console.error('Azure canary TTS failed', { message: error instanceof Error ? error.message : String(error), aiStudentId });
    return res.status(503).json({ success: false, error: 'Azure canary TTS unavailable' });
  }
});

`;

if (!source.includes("'/api/tts/azure-canary'")) {
  source = source.replace(endpointMarker, `${canaryEndpoint}${endpointMarker}`);
}

await fs.writeFile(serverPath, source);
console.log('Gate 5 canary patch: PASS (isolated Azure endpoint added in runner workspace only)');
