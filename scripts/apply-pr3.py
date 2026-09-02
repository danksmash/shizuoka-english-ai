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
      const azure = await synthesizeAzureTts(text, aiStudentId, speakingRate, 3_500);
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
server_path.write_text(s.replace(old, new, 1))

speech_path = Path('src/utils/speech.ts')
t = speech_path.read_text()
t = t.replace(" * Text to Speech with Google Cloud Chirp 3 HD as the primary voice.\n * The original device voice remains as a fallback so a TTS outage cannot stop a lesson.\n", " * Text to Speech using the server-selected cloud provider.\n * PR3 order is Azure Speech -> Google Chirp 3 HD -> device fallback.\n", 1)
old = "  onProvider?: (provider: 'google-chirp3-hd' | 'device-fallback', effectiveRate: number) => void\n"
new = "  onProvider?: (provider: 'azure-speech' | 'google-chirp3-hd' | 'device-fallback', effectiveRate: number) => void\n"
assert old in t
t = t.replace(old, new, 1)
old = "      onProvider?.('google-chirp3-hd', Number(response.headers.get('X-TTS-Effective-Rate') || rate));\n"
new = "      const cloudProvider = response.headers.get('X-TTS-Provider') === 'azure-speech' ? 'azure-speech' : 'google-chirp3-hd';\n      onProvider?.(cloudProvider, Number(response.headers.get('X-TTS-Effective-Rate') || rate));\n"
assert old in t
t = t.replace(old, new, 1)
t = t.replace("      console.warn('Google Cloud TTS unavailable; using device TTS fallback:', error);", "      console.warn('Cloud TTS unavailable; using device TTS fallback:', error);", 1)
speech_path.write_text(t)

Path('scripts/qa-azure-primary.ts').write_text("""import fs from 'node:fs';
const server=fs.readFileSync('server.ts','utf8');
const speech=fs.readFileSync('src/utils/speech.ts','utf8');
for(const x of [\"azureTtsConfigured, synthesizeAzureTts\",\"ttsProvider: 'azure-speech'\",\"ttsFallback: 'google-chirp3-hd'\",\"synthesizeAzureTts(text, aiStudentId, speakingRate, 3_500)\",\"X-TTS-Fallback-From\"]){if(!server.includes(x)) throw new Error('missing '+x);}
if(!speech.includes(\"provider: 'azure-speech' | 'google-chirp3-hd' | 'device-fallback'\")) throw new Error('client provider union missing Azure');
if(!speech.includes(\"response.headers.get('X-TTS-Provider') === 'azure-speech'\")) throw new Error('client provider provenance missing');
console.log('Azure primary QA passed');
""")
