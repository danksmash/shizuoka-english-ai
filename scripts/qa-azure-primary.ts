import fs from 'node:fs';
const server=fs.readFileSync('server.ts','utf8');
const speech=fs.readFileSync('src/utils/speech.ts','utf8');
const must=[
  "import { azureTtsConfigured, synthesizeAzureTts } from './src/server/azureTts';",
  "ttsProvider: 'azure-speech'",
  "ttsFallback: 'google-chirp3-hd'",
  "const azure = await synthesizeAzureTts(text, aiStudentId, speakingRate, 3_500);",
  "X-TTS-Fallback-From",
];
for(const x of must){if(!server.includes(x)) throw new Error('missing '+x);}
if(server.includes("ttsProvider: 'google-chirp3-hd'")) throw new Error('health still reports Google primary');
if(!speech.includes("provider: 'azure-speech' | 'google-chirp3-hd' | 'device-fallback'")) throw new Error('client provider union missing Azure');
if(!speech.includes("response.headers.get('X-TTS-Provider') === 'azure-speech'")) throw new Error('client provider provenance missing');
console.log('Azure primary QA passed');
