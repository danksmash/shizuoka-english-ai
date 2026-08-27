from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

# 1) speech.ts: replace incremental resultIndex accumulation with overlap-safe
# reconstruction from the current event.results snapshot.
speech_path = Path('src/utils/speech.ts')
speech = speech_path.read_text()

helper_marker = "export function createSpeechRecognitionInstance(\n"
helper = r'''export function rebuildSpeechRecognitionSnapshot(
  results: Array<{ transcript: string; isFinal: boolean }>
): { combinedRaw: string; formatted: string; hasFinal: boolean } {
  const pieces = results
    .map((item) => ({ transcript: String(item.transcript || '').trim(), isFinal: Boolean(item.isFinal) }))
    .filter((item) => item.transcript.length > 0);

  let combinedRaw = '';

  for (const item of pieces) {
    const piece = item.transcript;
    if (!combinedRaw) {
      combinedRaw = piece;
      continue;
    }

    const combinedLower = combinedRaw.toLowerCase();
    const pieceLower = piece.toLowerCase();

    // Android Chrome can expose progressive hypotheses such as
    // "My" -> "My name" -> "My name is" as separate result entries.
    // Treat the longer progressive hypothesis as a replacement, not an append.
    if (pieceLower === combinedLower || pieceLower.startsWith(`${combinedLower} `)) {
      combinedRaw = piece;
      continue;
    }
    if (combinedLower.endsWith(pieceLower)) continue;

    // Merge a repeated word-boundary overlap without duplicating it.
    const combinedWords = combinedRaw.split(/\s+/);
    const pieceWords = piece.split(/\s+/);
    let overlap = 0;
    const maxOverlap = Math.min(combinedWords.length, pieceWords.length);
    for (let size = maxOverlap; size >= 1; size -= 1) {
      const tail = combinedWords.slice(-size).join(' ').toLowerCase();
      const head = pieceWords.slice(0, size).join(' ').toLowerCase();
      if (tail === head) {
        overlap = size;
        break;
      }
    }
    combinedRaw = [combinedRaw, pieceWords.slice(overlap).join(' ')].filter(Boolean).join(' ');
  }

  const formatted = formatSpeechText(combinedRaw);
  return {
    combinedRaw,
    formatted,
    hasFinal: pieces.some((item) => item.isFinal),
  };
}

'''
if 'export function rebuildSpeechRecognitionSnapshot' not in speech:
    speech = replace_once(speech, helper_marker, helper + helper_marker, 'insert snapshot helper')

pattern = re.compile(
    r"    // Keep finalized speech across events, while replacing \(not accumulating\).*?"
    r"    // eslint-disable-next-line @typescript-eslint/no-explicit-any\n"
    r"    recognition\.onerror =",
    re.S,
)
replacement = r'''    // Rebuild the current recognition snapshot on every event. This avoids
    // carrying stale Android interim hypotheses across events while preserving
    // normal finalized + current interim speech on other browsers.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      try {
        const resultsArray: Array<{ transcript: string; isFinal: boolean }> = [];
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (!item || !item[0]) continue;
          resultsArray.push({
            transcript: String(item[0].transcript || ''),
            isFinal: Boolean(item.isFinal),
          });
        }

        const { formatted, combinedRaw, hasFinal } = rebuildSpeechRecognitionSnapshot(resultsArray);
        onResult(formatted || combinedRaw, hasFinal);
      } catch (e) {
        console.warn('Speech onresult error:', e);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror ='''
speech, n = pattern.subn(replacement, speech, count=1)
if n != 1:
    raise SystemExit(f'speech onresult replacement: expected 1 match, found {n}')
speech_path.write_text(speech)

# 2) App.tsx: preserve the existing UX on all normal paths. Only when Android
# unexpectedly ends recognition with text do we keep isRecording=true so the
# existing second tap sends the preserved transcript.
app_path = Path('src/App.tsx')
app = app_path.read_text()

app = replace_once(
    app,
    "const apiUrl = (path: string) => `${API_BASE_URL}${path}`;\n",
    "const apiUrl = (path: string) => `${API_BASE_URL}${path}`;\nconst IS_ANDROID_DEVICE = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);\n",
    'Android device constant',
)

app = replace_once(
    app,
    "  const recognitionRef = useRef<any>(null);\n",
    "  const recognitionRef = useRef<any>(null);\n  const speechStopRequestedRef = useRef(false);\n",
    'speech stop ref',
)

old_stop = """  const stopRecordingInternal = () => {\n    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) { console.warn('Recognition stop error', e); } }\n    recognitionRef.current = null;\n    setIsRecording(false); setIsListening(false);\n  };\n"""
new_stop = """  const stopRecordingInternal = () => {\n    speechStopRequestedRef.current = true;\n    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) { console.warn('Recognition stop error', e); } }\n    recognitionRef.current = null;\n    setIsRecording(false); setIsListening(false);\n  };\n"""
app = replace_once(app, old_stop, new_stop, 'intentional stop guard')

app = replace_once(
    app,
    "    liveTranscriptRef.current=''; setSpeechTranscript(''); setIsRecording(true); setIsListening(true);\n",
    "    liveTranscriptRef.current=''; setSpeechTranscript(''); speechStopRequestedRef.current=false; setIsRecording(true); setIsListening(true);\n",
    'reset stop guard on start',
)

old_end = "      () => { setIsRecording(false); setIsListening(false); }\n"
new_end = """      () => {\n        recognitionRef.current = null;\n        setIsListening(false);\n        const wasIntentionalStop = speechStopRequestedRef.current;\n        speechStopRequestedRef.current = false;\n        if (IS_ANDROID_DEVICE && !wasIntentionalStop && liveTranscriptRef.current.trim()) {\n          // Android Chrome may end SpeechRecognition after a short pause even\n          // though the child did not tap stop. Keep the existing recording UI\n          // and transcript so the next tap follows the normal send path.\n          setIsRecording(true);\n          setMicHintMessage('聞き取りが止まりました。もう1度タップすると、この英語をAIに送ります。');\n        } else {\n          setIsRecording(false);\n        }\n      }\n"""
app = replace_once(app, old_end, new_end, 'Android unexpected onend handler')
app_path.write_text(app)

# 3) Extend speech QA with Android progressive-hypothesis regression cases and
# a static guard that the Android unexpected-onend preservation remains wired.
qa_path = Path('scripts/test_speech_accumulation_qa.ts')
qa = qa_path.read_text()
qa = replace_once(
    qa,
    "import { accumulateSpeechResults, formatSpeechText } from '../src/utils/speech';\n",
    "import { readFileSync } from 'node:fs';\nimport { accumulateSpeechResults, formatSpeechText, rebuildSpeechRecognitionSnapshot } from '../src/utils/speech';\n",
    'QA imports',
)

insert_before = "  console.log('================================================================');\n  console.log('      ALL SPEECH ACCUMULATION & FORMATTING TESTS PASSED 100%    ');\n"
qa_extra = r'''  // -------------------------------------------------------------
  // TEST 4: ANDROID PROGRESSIVE HYPOTHESIS DEDUPLICATION
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: ANDROID PROGRESSIVE HYPOTHESIS DEDUPLICATION ---');
  const androidProgressive = rebuildSpeechRecognitionSnapshot([
    { transcript: 'My', isFinal: false },
    { transcript: 'My name', isFinal: false },
    { transcript: 'My name is', isFinal: false },
    { transcript: 'My name is Ken', isFinal: true },
  ]);
  if (androidProgressive.formatted !== 'My name is Ken.') {
    throw new Error(`Android progressive duplication regression: ${androidProgressive.formatted}`);
  }
  console.log(`  ✓ Progressive hypotheses collapse correctly: "${androidProgressive.formatted}"`);

  const normalFinalPlusInterim = rebuildSpeechRecognitionSnapshot([
    { transcript: 'I like soccer', isFinal: true },
    { transcript: 'and dogs', isFinal: false },
  ]);
  if (normalFinalPlusInterim.formatted !== 'I like soccer and dogs.') {
    throw new Error(`Final + interim preservation regression: ${normalFinalPlusInterim.formatted}`);
  }
  console.log(`  ✓ Normal finalized + interim speech is preserved: "${normalFinalPlusInterim.formatted}"`);

  // -------------------------------------------------------------
  // TEST 5: ANDROID UNEXPECTED ONEND PRESERVATION GUARD
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: ANDROID UNEXPECTED ONEND PRESERVATION GUARD ---');
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const requiredGuards = [
    "const IS_ANDROID_DEVICE",
    "speechStopRequestedRef",
    "IS_ANDROID_DEVICE && !wasIntentionalStop && liveTranscriptRef.current.trim()",
    "setIsRecording(true)",
  ];
  for (const guard of requiredGuards) {
    if (!appSource.includes(guard)) throw new Error(`Missing Android onend guard: ${guard}`);
  }
  console.log('  ✓ Android unexpected onend keeps recognized speech on the existing send path');

'''
qa = replace_once(qa, insert_before, qa_extra + insert_before, 'QA Android tests')
qa_path.write_text(qa)

print('Android speech stabilization patch applied successfully.')
