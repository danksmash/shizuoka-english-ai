import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';

const key = process.env.AZURE_SPEECH_KEY || '';
const region = (process.env.AZURE_SPEECH_REGION || 'japaneast').trim().toLowerCase();
const outputDir = process.env.AZURE_GATE4_OUTPUT_DIR || 'azure-gate4-artifacts';
const concurrency = Math.max(1, Math.min(6, Number(process.env.AZURE_GATE4_CONCURRENCY || 4)));
const timeoutMs = Math.max(3000, Number(process.env.AZURE_GATE4_TIMEOUT_MS || 15000));

if (!key) throw new Error('AZURE_SPEECH_KEY is not configured.');
if (region !== 'japaneast') throw new Error(`Gate 4 requires japaneast, got ${region}`);

const base = `https://${region}.tts.speech.microsoft.com`;
const voicesUrl = `${base}/cognitiveservices/voices/list`;
const synthUrl = `${base}/cognitiveservices/v1`;

const nativeLocaleById: Record<string, string> = {
  emma_usa: 'en-US',
  oliver_uk: 'en-GB',
  liam_australia: 'en-AU',
  minji_korea: 'ko-KR',
  pavel_belarus: 'be-BY',
  lukas_germany: 'de-DE',
  aina_malaysia: 'en-MY',
  dimas_indonesia: 'id-ID',
  bence_hungary: 'hu-HU',
  yuting_taiwan: 'zh-TW',
  zofia_poland: 'pl-PL',
  matas_lithuania: 'lt-LT',
  ananya_india: 'en-IN',
  xinyi_china: 'zh-CN',
  linh_vietnam: 'vi-VN',
  rahul_bangladesh: 'bn-BD',
  nadeesha_srilanka: 'si-LK',
  suman_nepal: 'ne-NP',
  amara_nigeria: 'en-NG',
  andrei_romania: 'ro-RO',
};

const regionalEnglishFallbacks: Record<string, string[]> = {
  emma_usa: ['en-US', 'en-CA'],
  oliver_uk: ['en-GB', 'en-IE'],
  liam_australia: ['en-AU', 'en-NZ'],
  minji_korea: ['en-SG', 'en-HK', 'en-US'],
  pavel_belarus: ['en-GB', 'en-IE', 'en-US'],
  lukas_germany: ['en-GB', 'en-IE', 'en-US'],
  aina_malaysia: ['en-MY', 'en-SG', 'en-AU'],
  dimas_indonesia: ['en-SG', 'en-MY', 'en-AU'],
  bence_hungary: ['en-GB', 'en-IE', 'en-US'],
  yuting_taiwan: ['en-HK', 'en-SG', 'en-US'],
  zofia_poland: ['en-GB', 'en-IE', 'en-US'],
  matas_lithuania: ['en-GB', 'en-IE', 'en-US'],
  ananya_india: ['en-IN', 'en-SG', 'en-GB'],
  xinyi_china: ['en-HK', 'en-SG', 'en-US'],
  linh_vietnam: ['en-SG', 'en-AU', 'en-US'],
  rahul_bangladesh: ['en-IN', 'en-SG', 'en-GB'],
  nadeesha_srilanka: ['en-IN', 'en-SG', 'en-GB'],
  suman_nepal: ['en-IN', 'en-SG', 'en-GB'],
  amara_nigeria: ['en-NG', 'en-ZA', 'en-GB'],
  andrei_romania: ['en-GB', 'en-IE', 'en-US'],
};

const evaluationSentences = [
  "Hello! Nice to meet you. I'm happy to talk with you today.",
  'I like music, sports, and spending time with my friends.',
  'What do you like to do after school?',
  'Sorry, could you say that again, please?',
  'That sounds interesting. Tell me more about it.',
] as const;

type AzureVoice = {
  Name?: string;
  DisplayName?: string;
  LocalName?: string;
  ShortName?: string;
  Gender?: string;
  Locale?: string;
  LocaleName?: string;
  VoiceType?: string;
  Status?: string;
  SecondaryLocaleList?: string[];
  StyleList?: string[];
};

type Candidate = {
  label: 'A' | 'B';
  shortName: string;
  displayName: string;
  gender: string;
  voiceLocale: string;
  synthesisLocale: string;
  selectionClass: 'native-multilingual' | 'exact-english-locale' | 'regional-english-proxy' | 'general-english-fallback';
  rationale: string;
};

type PersonaManifest = {
  personaId: string;
  name: string;
  country: string;
  gender: string;
  currentVoiceLang: string;
  nativeLocale: string;
  candidates: Candidate[];
};

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char] || char));
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function secondaryEnglishLocales(voice: AzureVoice): string[] {
  return Array.isArray(voice.SecondaryLocaleList)
    ? voice.SecondaryLocaleList.filter((locale) => /^en-/i.test(String(locale)))
    : [];
}

function englishSynthesisLocale(voice: AzureVoice, preferred: string[]): string | null {
  const locale = String(voice.Locale || '');
  if (/^en-/i.test(locale)) return locale;
  const secondary = secondaryEnglishLocales(voice);
  for (const pref of preferred) {
    const exact = secondary.find((item) => item.toLowerCase() === pref.toLowerCase());
    if (exact) return exact;
  }
  return secondary[0] || null;
}

function normalizeGender(value: string) {
  return value.trim().toLowerCase();
}

async function getVoices(): Promise<AzureVoice[]> {
  const response = await fetch(voicesUrl, {
    headers: { 'Ocp-Apim-Subscription-Key': key },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`voices/list failed: HTTP ${response.status}`);
  const voices = await response.json() as AzureVoice[];
  if (!Array.isArray(voices) || voices.length === 0) throw new Error('voices/list returned no voices');
  return voices;
}

function scoreVoice(params: {
  voice: AzureVoice;
  personaId: string;
  currentVoiceLang: string;
  nativeLocale: string;
  regional: string[];
  used: Set<string>;
}) {
  const { voice, currentVoiceLang, nativeLocale, regional, used } = params;
  const shortName = String(voice.ShortName || '');
  const voiceLocale = String(voice.Locale || '');
  const synthesisLocale = englishSynthesisLocale(voice, [currentVoiceLang, ...regional, 'en-US', 'en-GB']);
  if (!shortName || !synthesisLocale) return null;

  let score = 0;
  let selectionClass: Candidate['selectionClass'] = 'general-english-fallback';
  let rationale = 'English-capable neural voice used as a fallback candidate.';

  if (voiceLocale.toLowerCase() === nativeLocale.toLowerCase() && !/^en-/i.test(voiceLocale)) {
    score += 180;
    selectionClass = 'native-multilingual';
    rationale = `Native-locale voice ${voiceLocale} explicitly lists English as a secondary locale.`;
  } else if (voiceLocale.toLowerCase() === nativeLocale.toLowerCase() && /^en-/i.test(voiceLocale)) {
    score += 170;
    selectionClass = 'exact-english-locale';
    rationale = `Direct English locale match for the persona country (${voiceLocale}).`;
  } else if (voiceLocale.toLowerCase() === currentVoiceLang.toLowerCase()) {
    score += 145;
    selectionClass = 'exact-english-locale';
    rationale = `Matches the app's current English locale setting (${currentVoiceLang}).`;
  } else {
    const index = regional.findIndex((item) => item.toLowerCase() === voiceLocale.toLowerCase());
    if (index >= 0) {
      score += 120 - index * 8;
      selectionClass = 'regional-english-proxy';
      rationale = `Regional English proxy (${voiceLocale}); not treated as an authentic national accent.`;
    } else if (/^en-/i.test(voiceLocale)) {
      score += 70;
      rationale = `General English fallback (${voiceLocale}); not treated as an authentic national accent.`;
    } else {
      score += 35;
    }
  }

  if (/multilingual/i.test(shortName)) score += 12;
  if (/Neural/i.test(String(voice.VoiceType || 'Neural'))) score += 6;
  if (used.has(shortName)) score -= 1000;
  score += Math.max(0, 20 - shortName.length / 10);

  return { score, synthesisLocale, selectionClass, rationale };
}

function selectCandidates(voices: AzureVoice[]): PersonaManifest[] {
  const used = new Set<string>();
  const targetProfiles = TARGET_20_AI_STUDENT_IDS.map((id) => {
    const profile = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
    if (!profile) throw new Error(`Missing target persona: ${id}`);
    return profile;
  });

  if (targetProfiles.length !== 20) throw new Error(`Expected 20 personas, got ${targetProfiles.length}`);

  const manifests: PersonaManifest[] = [];
  for (const profile of targetProfiles) {
    const personaId = profile.id;
    const nativeLocale = nativeLocaleById[personaId] || profile.voiceLang;
    const regional = regionalEnglishFallbacks[personaId] || [profile.voiceLang, 'en-US', 'en-GB'];
    const desiredGender = normalizeGender(profile.gender);

    const scored = voices
      .filter((voice) => normalizeGender(String(voice.Gender || '')) === desiredGender)
      .map((voice) => {
        const result = scoreVoice({
          voice,
          personaId,
          currentVoiceLang: profile.voiceLang,
          nativeLocale,
          regional,
          used,
        });
        return result ? { voice, ...result } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.score - a.score || String(a.voice.ShortName).localeCompare(String(b.voice.ShortName)));

    if (scored.length < 2) throw new Error(`Could not find two English-capable ${profile.gender} voices for ${personaId}`);

    const picked = scored.slice(0, 2).map((row, index): Candidate => {
      const shortName = String(row.voice.ShortName);
      used.add(shortName);
      return {
        label: index === 0 ? 'A' : 'B',
        shortName,
        displayName: String(row.voice.DisplayName || row.voice.LocalName || shortName),
        gender: String(row.voice.Gender || ''),
        voiceLocale: String(row.voice.Locale || ''),
        synthesisLocale: row.synthesisLocale,
        selectionClass: row.selectionClass,
        rationale: row.rationale,
      };
    });

    manifests.push({
      personaId,
      name: profile.name,
      country: profile.country,
      gender: profile.gender,
      currentVoiceLang: profile.voiceLang,
      nativeLocale,
      candidates: picked,
    });
  }

  const allNames = manifests.flatMap((row) => row.candidates.map((candidate) => candidate.shortName));
  if (new Set(allNames).size !== 40) {
    throw new Error(`Gate 4 requires 40 distinct candidate voices; got ${new Set(allNames).size}`);
  }
  return manifests;
}

async function synthesize(candidate: Candidate, text: string) {
  const ssml = `<speak version="1.0" xml:lang="${escapeXml(candidate.synthesisLocale)}"><voice name="${escapeXml(candidate.shortName)}">${escapeXml(text)}</voice></speak>`;
  const response = await fetch(synthUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'shizuoka-english-ai-gate4-candidate-evaluation',
    },
    body: ssml,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${candidate.shortName}: HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!/audio\/(mpeg|mp3)/i.test(contentType)) throw new Error(`${candidate.shortName}: unexpected content type ${contentType}`);
  if (bytes.length < 500) throw new Error(`${candidate.shortName}: MP3 too small (${bytes.length} bytes)`);
  return bytes;
}

async function runPool<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function buildEvaluationHtml(manifest: PersonaManifest[]) {
  const safeManifest = JSON.stringify(manifest).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Azure Voice Gate 4 A/B Evaluation</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;margin:24px;line-height:1.55;background:#fafafa;color:#111}h1{font-size:24px}.note{background:#fff;border:1px solid #ddd;padding:14px;border-radius:10px;margin-bottom:18px}.card{background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}.candidate{border:1px solid #e2e2e2;border-radius:10px;padding:12px}.candidate h3{margin-top:0}.clip{display:flex;gap:8px;align-items:center;margin:7px 0}.clip audio{width:100%;max-width:360px}.choice{margin-top:12px;padding-top:10px;border-top:1px solid #eee}.choice label{margin-right:16px}.meta{font-size:12px;color:#555}.actions{position:sticky;bottom:0;background:#fff;border:1px solid #ccc;border-radius:10px;padding:12px;margin-top:24px}textarea{width:100%;height:180px;margin-top:10px}@media(max-width:800px){.pair{grid-template-columns:1fr}}
</style>
</head>
<body>
<h1>Gate 4：Azure Voice候補 A/B評価</h1>
<div class="note">各PersonaについてAとBを聞き比べ、<b>自然さ → 小学生にとっての聞き取りやすさ → Persona間の区別しやすさ</b>の順で選んでください。国籍らしさは最優先ではありません。「どちらも不自然」の場合は再候補を生成します。</div>
<div id="root"></div>
<div class="actions"><button id="make">結果CSVを作成</button><textarea id="out" placeholder="ここに結果が表示されます"></textarea></div>
<script>
const manifest=${safeManifest};
const sentences=${JSON.stringify(evaluationSentences)};
const root=document.getElementById('root');
function playSeries(personaId,label){const audios=[...document.querySelectorAll('audio[data-persona="'+personaId+'"][data-label="'+label+'"]')];let i=0;const next=()=>{if(i>=audios.length)return;const a=audios[i++];a.currentTime=0;a.play();a.onended=next;};next();}
manifest.forEach((p)=>{const card=document.createElement('section');card.className='card';card.innerHTML='<h2>'+p.name+' — '+p.country+'</h2><div class="pair"></div><div class="choice"><b>選択：</b><label><input type="radio" name="pick-'+p.personaId+'" value="A"> A</label><label><input type="radio" name="pick-'+p.personaId+'" value="B"> B</label><label><input type="radio" name="pick-'+p.personaId+'" value="RETRY"> どちらも不自然</label> <input type="text" id="comment-'+p.personaId+'" placeholder="任意コメント" /></div>';
 const pair=card.querySelector('.pair');
 p.candidates.forEach((c)=>{const box=document.createElement('div');box.className='candidate';let clips='';sentences.forEach((s,i)=>{const n=String(i+1).padStart(2,'0');const src='audio/'+p.personaId+'/'+c.label+'/'+n+'.mp3';clips+='<div class="clip"><span>'+n+'</span><audio controls preload="none" data-persona="'+p.personaId+'" data-label="'+c.label+'" src="'+src+'"></audio></div>';});box.innerHTML='<h3>候補 '+c.label+'</h3><button type="button" data-play="'+c.label+'">5文を連続再生</button>'+clips+'<details><summary>技術情報</summary><div class="meta">'+c.shortName+' / voice locale '+c.voiceLocale+' / synthesis '+c.synthesisLocale+'<br>'+c.rationale+'</div></details>';box.querySelector('[data-play]').onclick=()=>playSeries(p.personaId,c.label);pair.appendChild(box);});root.appendChild(card);});
document.getElementById('make').onclick=()=>{const rows=[['persona_id','name','country','choice','comment']];manifest.forEach((p)=>{const checked=document.querySelector('input[name="pick-'+p.personaId+'"]:checked');const comment=document.getElementById('comment-'+p.personaId).value||'';rows.push([p.personaId,p.name,p.country,checked?checked.value:'',comment]);});const esc=(v)=>'"'+String(v).replaceAll('"','""')+'"';document.getElementById('out').value=rows.map(r=>r.map(esc).join(',')).join('\n');};
</script>
</body>
</html>`;
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
const voices = await getVoices();
const manifest = selectCandidates(voices);

const tasks: Array<{ persona: PersonaManifest; candidate: Candidate; sentence: string; sentenceIndex: number }> = [];
for (const persona of manifest) {
  for (const candidate of persona.candidates) {
    for (let index = 0; index < evaluationSentences.length; index += 1) {
      tasks.push({ persona, candidate, sentence: evaluationSentences[index], sentenceIndex: index });
    }
  }
}
if (tasks.length !== 200) throw new Error(`Expected 200 clips, got ${tasks.length}`);

const hashes = new Map<string, string[]>();
const failures: string[] = [];
await runPool(tasks, async (task) => {
  try {
    const bytes = await synthesize(task.candidate, task.sentence);
    const clipNo = String(task.sentenceIndex + 1).padStart(2, '0');
    const rel = path.join('audio', task.persona.personaId, task.candidate.label, `${clipNo}.mp3`);
    const file = path.join(outputDir, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const list = hashes.get(hash) || [];
    list.push(rel.replaceAll('\\', '/'));
    hashes.set(hash, list);
  } catch (error) {
    failures.push(`${task.persona.personaId}/${task.candidate.label}/${task.sentenceIndex + 1}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

if (failures.length) throw new Error(`Gate 4 synthesis failures (${failures.length}):\n${failures.slice(0, 10).join('\n')}`);

const duplicateGroups = [...hashes.entries()].filter(([, files]) => files.length > 1).map(([sha256, files]) => ({ sha256, files }));
for (const persona of manifest) {
  for (let i = 0; i < evaluationSentences.length; i += 1) {
    const n = String(i + 1).padStart(2, '0');
    const a = await fs.readFile(path.join(outputDir, 'audio', persona.personaId, 'A', `${n}.mp3`));
    const b = await fs.readFile(path.join(outputDir, 'audio', persona.personaId, 'B', `${n}.mp3`));
    const ha = createHash('sha256').update(a).digest('hex');
    const hb = createHash('sha256').update(b).digest('hex');
    if (ha === hb) throw new Error(`A/B audio identical for ${persona.personaId} sentence ${n}`);
  }
}

const manifestJson = {
  generatedAt: new Date().toISOString(),
  gate: 4,
  region,
  targetPersonaCount: manifest.length,
  candidateVoiceCount: manifest.flatMap((p) => p.candidates).length,
  evaluationSentenceCount: evaluationSentences.length,
  clipCount: tasks.length,
  allCandidateVoiceNamesUnique: new Set(manifest.flatMap((p) => p.candidates.map((c) => c.shortName))).size === 40,
  duplicateAudioHashGroups: duplicateGroups,
  evaluationPriority: ['naturalness', 'child_intelligibility', 'persona_distinguishability', 'stability', 'nationality_likeness_last'],
  wordingForResearch: 'Different synthetic English voice profiles reflecting regional English varieties and International English; not claims of authentic national accents.',
  personas: manifest,
};

const csvRows = [['persona_id','name','country','gender','candidate','voice_name','voice_locale','synthesis_locale','selection_class','rationale']];
for (const persona of manifest) {
  for (const candidate of persona.candidates) {
    csvRows.push([persona.personaId, persona.name, persona.country, persona.gender, candidate.label, candidate.shortName, candidate.voiceLocale, candidate.synthesisLocale, candidate.selectionClass, candidate.rationale]);
  }
}

await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifestJson, null, 2));
await fs.writeFile(path.join(outputDir, 'candidate-voices.csv'), csvRows.map((row) => row.map(csvCell).join(',')).join('\n'));
await fs.writeFile(path.join(outputDir, 'evaluation.html'), buildEvaluationHtml(manifest));
await fs.writeFile(path.join(outputDir, 'README.txt'), [
  'Azure Speech Gate 4 candidate evaluation package',
  '',
  '1. Unzip this artifact.',
  '2. Open evaluation.html in a browser.',
  '3. For each of 20 personas, compare Candidate A and B using the five common sentences.',
  '4. Choose A, B, or "both unnatural".',
  '5. Click "結果CSVを作成" and copy the CSV back into ChatGPT.',
  '',
  'Evaluation priority: naturalness > child intelligibility > persona distinguishability > stability > nationality-likeness.',
  'Do not interpret a selected voice as an authentic national accent.',
].join('\n'));

console.log(`# Azure Speech Gate 4 candidate generation`);
console.log(`- Region: ${region}`);
console.log(`- voices/list: ${voices.length}`);
console.log(`- Personas: ${manifest.length}`);
console.log(`- Candidate voices: ${manifest.flatMap((p) => p.candidates).length} (40 unique voice names)`);
console.log(`- Evaluation clips: ${tasks.length}`);
console.log(`- Duplicate audio hash groups: ${duplicateGroups.length}`);
for (const persona of manifest) {
  console.log(`- ${persona.personaId}: A=${persona.candidates[0].shortName} (${persona.candidates[0].voiceLocale}->${persona.candidates[0].synthesisLocale}), B=${persona.candidates[1].shortName} (${persona.candidates[1].voiceLocale}->${persona.candidates[1].synthesisLocale})`);
}
