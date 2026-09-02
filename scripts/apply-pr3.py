from pathlib import Path

server_path = Path('server.ts')
s = server_path.read_text()
old = "import { GOOGLE_TTS_VOICES } from './src/data/personaResearch';\n"
new = old + "import { azureTtsConfigured, synthesizeAzureTts } from './src/server/azureTts';\n"
assert old in s and "azureTtsConfigured" not in s
s = s.replace(old, new, 1)

old = "    ttsProvider: 'google-chirp3-hd',\n"
new = "    ttsProvider: 'azure-speech',\n    ttsFallback: 'google-chirp3-hd',\n    azureTtsConfigured: azureTtsConfigured(),\n"
assert old in s
s = s.replace(old, new, 1)

old = """  try {
    const { audio, cache } = await cachedGoogleTts(text, aiStudentId, speakingRate);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=900');
    res.setHeader('X-TTS-Provider', 'google-chirp3-hd');
    res.setHeader('X-TTS-Cache', cache);
    res.setHeader('X-TTS-Effective-Rate', speakingRate.toFixed(2));
    res.setHeader('X-TTS-Latency-Ms', String(Date.now() - requestStart));
    return res.send(audio);
  } catch (error: any) {
    console.error('Google TTS failed', { message: error?.message, aiStudentId });
    return res.status(503).json({ success: false, error: 'TTS unavailable' });
  }
"""
new = """  try {
    try {
      const azure = await synthesizeAzureTts(text, aiStudentId, speakingRate);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'private, max-age=900');
      res.setHeader('X-TTS-Provider', 'azure-speech');
      res.setHeader('X-TTS-Cache', 'MISS');
      res.setHeader('X-TTS-Effective-Rate', azure.effectiveRate.toFixed(2));
      res.setHeader('X-TTS-Latency-Ms', String(Date.now() - requestStart));
      return res.send(azure.audio);
    } catch (azureError: any) {
      console.error('Azure TTS failed; trying Google Chirp fallback', { message: azureError?.message, aiStudentId });
      const { audio, cache } = await cachedGoogleTts(text, aiStudentId, speakingRate);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'private, max-age=900');
      res.setHeader('X-TTS-Provider', 'google-chirp3-hd');
      res.setHeader('X-TTS-Fallback-From', 'azure-speech');
      res.setHeader('X-TTS-Cache', cache);
      res.setHeader('X-TTS-Effective-Rate', speakingRate.toFixed(2));
      res.setHeader('X-TTS-Latency-Ms', String(Date.now() - requestStart));
      return res.send(audio);
    }
  } catch (error: any) {
    console.error('All server TTS providers failed', { message: error?.message, aiStudentId });
    return res.status(503).json({ success: false, error: 'TTS unavailable' });
  }
"""
assert old in s
s = s.replace(old, new, 1)
server_path.write_text(s)

deploy_path = Path('.github/workflows/cloud-run-deploy.yml')
s = deploy_path.read_text()
old = '--update-secrets ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest'
new = '--update-secrets ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,AZURE_SPEECH_KEY=AZURE_SPEECH_KEY:latest'
assert old in s
s = s.replace(old, new, 1)
s = s.replace("grep -q '\"ttsProvider\":\"google-chirp3-hd\"'", "grep -q '\"ttsProvider\":\"azure-speech\"'", 1)
s = s.replace('name: Production Google TTS voice check', 'name: Production Azure primary voice check', 1)
s = s.replace('Google TTS is not active for $student yet (HTTP $status). Device TTS fallback remains available.', 'Server TTS failed for $student (HTTP $status). Device TTS fallback remains available.', 1)
s = s.replace("grep -qi 'x-tts-provider: google-chirp3-hd' \"$tts_headers\"", "grep -qi 'x-tts-provider: azure-speech' \"$tts_headers\"", 1)
deploy_path.write_text(s)

qa = Path('scripts/qa-azure-primary.ts')
qa.write_text("""import fs from 'node:fs';
const server=fs.readFileSync('server.ts','utf8');
const deploy=fs.readFileSync('.github/workflows/cloud-run-deploy.yml','utf8');
const must=[
  \"import { azureTtsConfigured, synthesizeAzureTts } from './src/server/azureTts';\",
  \"ttsProvider: 'azure-speech'\",
  \"ttsFallback: 'google-chirp3-hd'\",
  \"const azure = await synthesizeAzureTts(text, aiStudentId, speakingRate);\",
  \"X-TTS-Fallback-From\",
];
for(const x of must){if(!server.includes(x)) throw new Error('missing '+x);}
if(!deploy.includes('AZURE_SPEECH_KEY=AZURE_SPEECH_KEY:latest')) throw new Error('deployment secret missing');
if(!deploy.includes(\"x-tts-provider: azure-speech\")) throw new Error('production Azure assertion missing');
if(server.includes(\"ttsProvider: 'google-chirp3-hd'\")) throw new Error('health still reports Google primary');
console.log('Azure primary QA passed');
""")
