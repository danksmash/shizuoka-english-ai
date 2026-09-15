from pathlib import Path
import re


def load(path: str) -> str:
    return Path(path).read_text()


def save(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_if_present(text: str, old: str, new: str) -> str:
    return text.replace(old, new, 1) if old in text else text


# dataContract.ts
path = 'src/dataContract.ts'
text = load(path)
anchor = "export const DIALOGUE_DURATIONS_MINUTES = [1, 2, 3, 5] as const satisfies readonly DialogueDurationMinutes[];\n"
if 'export const MAX_CHILD_UTTERANCE_CHARS = 300;' not in text:
    if anchor not in text:
        raise SystemExit('dataContract duration anchor missing')
    text = text.replace(anchor, anchor + 'export const MAX_CHILD_UTTERANCE_CHARS = 300;\n', 1)
text = re.sub(r"item\.englishText\.trim\(\)\.slice\(0,\s*300\)", "item.englishText.trim().slice(0, MAX_CHILD_UTTERANCE_CHARS)", text, count=1)
save(path, text)

# App.tsx
path = 'src/App.tsx'
text = load(path)
text = replace_if_present(
    text,
    "import type { ReflectionAnswers, ResearchSystemEvent, ResearchSystemEventType } from './dataContract';",
    "import { MAX_CHILD_UTTERANCE_CHARS, type ReflectionAnswers, type ResearchSystemEvent, type ResearchSystemEventType } from './dataContract';",
)
if 'MAX_CHILD_UTTERANCE_CHARS' not in text.split('\n', 50)[0:50].__str__():
    if "from './dataContract';" not in text:
        raise SystemExit('App dataContract import missing')
if 'const ASR_DIAGNOSTICS_ENABLED =' not in text:
    anchor = "const CONTEXTUAL_ASR_ENABLED = import.meta.env.VITE_CONTEXTUAL_ASR_ENABLED !== 'false';\n"
    if anchor not in text:
        raise SystemExit('App contextual ASR anchor missing')
    text = text.replace(anchor, anchor + "const ASR_DIAGNOSTICS_ENABLED = import.meta.env.DEV || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('asrDebug') === '1');\n", 1)
text = re.sub(
    r"if \(trimmed\.length > 100\) \{ setMicHintMessage\('[^']*'\); setTimeout\(\(\) => setMicHintMessage\(''\), 4000\); return; \}",
    "if (trimmed.length > MAX_CHILD_UTTERANCE_CHARS) { setMicHintMessage('一度に話せる長さを少し超えました。少し短く分けて話してみてね。'); setTimeout(() => setMicHintMessage(''), 4000); return; }",
    text,
    count=1,
)
text, restart_subs = re.subn(
    r"onRestart:\s*\(count\)\s*=>\s*\{\s*recordResearchEvent\('asr_restart',\s*String\(count\)\);\s*setIsRecording\(true\);\s*setIsListening\(true\);\s*\},",
    "onRestart: () => { setIsRecording(true); setIsListening(true); },\n      onDiagnostic: ASR_DIAGNOSTICS_ENABLED ? (event) => { console.debug('[ASR QA]', event); } : undefined,",
    text,
    count=1,
)
if restart_subs == 0 and "recordResearchEvent('asr_restart'" in text:
    raise SystemExit('App asr_restart research-event path could not be removed')
save(path, text)

# server.ts
path = 'server.ts'
text = load(path)
old_import = "import { calculateCanonicalStats, canonicalizeHistory, isAIStudentId, isDialogueDuration, isDialogueTopic, isValidLearningCode, normalizeLearningCode, validateSessionSaveInput } from './src/dataContract';"
new_import = "import { MAX_CHILD_UTTERANCE_CHARS, calculateCanonicalStats, canonicalizeHistory, isAIStudentId, isDialogueDuration, isDialogueTopic, isValidLearningCode, normalizeLearningCode, validateSessionSaveInput } from './src/dataContract';"
text = replace_if_present(text, old_import, new_import)
text = text.replace('if (trimmedMessage.length > 100) {', 'if (trimmedMessage.length > MAX_CHILD_UTTERANCE_CHARS) {', 1)
text = re.sub(
    r"sanitizeStudentInput\(msg\.englishText \|\| ''\)\.slice\(0,\s*100\)",
    "sanitizeStudentInput(msg.englishText || '').slice(0, MAX_CHILD_UTTERANCE_CHARS)",
    text,
    count=1,
)
save(path, text)

# stableSpeechRecognition.ts -- diagnostics only; recognition behavior is intentionally unchanged.
path = 'src/utils/stableSpeechRecognition.ts'
text = load(path)
if 'export interface StableSpeechDiagnosticEvent' not in text:
    anchor = 'export interface StableSpeechRecognitionOptions {\n'
    diagnostic = "export interface StableSpeechDiagnosticEvent {\n  type: 'unexpected-end' | 'restart-attempt' | 'restart-ready';\n  restartCount: number;\n  timestampMs: number;\n  elapsedMs?: number;\n}\n\n"
    if anchor not in text:
        raise SystemExit('stable speech options anchor missing')
    text = text.replace(anchor, diagnostic + anchor, 1)
if 'onDiagnostic?: (event: StableSpeechDiagnosticEvent) => void;' not in text:
    anchor = '  onRestart?: (count: number) => void;\n'
    if anchor not in text:
        raise SystemExit('stable speech onRestart anchor missing')
    text = text.replace(anchor, anchor + '  onDiagnostic?: (event: StableSpeechDiagnosticEvent) => void;\n', 1)
if 'let restartBeganAt = 0;' not in text:
    anchor = '  let contextualBiasDisabled = false;\n'
    if anchor not in text:
        raise SystemExit('stable speech bias anchor missing')
    text = text.replace(anchor, anchor + '  let restartBeganAt = 0;\n', 1)
old_onstart = "      nextRecognition.onstart = () => {\n        if (cancelled || stopFinished) return;\n        if (isRestart) options.onRestart?.(restartCount);\n        options.onStart?.();\n      };"
new_onstart = "      nextRecognition.onstart = () => {\n        if (cancelled || stopFinished) return;\n        if (isRestart) {\n          const now = Date.now();\n          options.onDiagnostic?.({\n            type: 'restart-ready',\n            restartCount,\n            timestampMs: now,\n            elapsedMs: restartBeganAt ? Math.max(0, now - restartBeganAt) : undefined,\n          });\n          options.onRestart?.(restartCount);\n        }\n        options.onStart?.();\n      };"
text = replace_if_present(text, old_onstart, new_onstart)
if "type: 'unexpected-end'" not in text[text.find('nextRecognition.onend'):]:
    anchor = "        if (latestSnapshot.rawBestText.trim()) {\n          committedRaw = latestSnapshot.rawBestText.trim();"
    insert = "        const unexpectedEndAt = Date.now();\n        options.onDiagnostic?.({\n          type: 'unexpected-end',\n          restartCount: restartCount + 1,\n          timestampMs: unexpectedEndAt,\n        });\n\n" + anchor
    if anchor not in text:
        raise SystemExit('stable speech unexpected-end anchor missing')
    text = text.replace(anchor, insert, 1)
old_restart = "        recognition = null;\n        window.setTimeout(() => {\n          if (recordingIntent && !stopRequested && !cancelled && !stopFinished) startRecognizer(true);\n        }, 120);"
new_restart = "        recognition = null;\n        restartBeganAt = unexpectedEndAt;\n        window.setTimeout(() => {\n          if (recordingIntent && !stopRequested && !cancelled && !stopFinished) {\n            const now = Date.now();\n            options.onDiagnostic?.({\n              type: 'restart-attempt',\n              restartCount,\n              timestampMs: now,\n              elapsedMs: Math.max(0, now - restartBeganAt),\n            });\n            startRecognizer(true);\n          }\n        }, 120);"
text = replace_if_present(text, old_restart, new_restart)
save(path, text)

# QA additions.
path = 'scripts/qa-stable-speech-recognition.ts'
text = load(path)
if "import { MAX_CHILD_UTTERANCE_CHARS } from '../src/dataContract';" not in text:
    anchor = "} from '../src/utils/stableSpeechRecognition';\n"
    if anchor not in text:
        raise SystemExit('QA import anchor missing')
    text = text.replace(anchor, anchor + "import { MAX_CHILD_UTTERANCE_CHARS } from '../src/dataContract';\n", 1)
if 'restart continuity session must be creatable' not in text:
    marker = "  const fallbackSnapshot = await fallbackSession.requestStop();\n  assert.equal(fallbackSnapshot.bestText, 'I live in Hamamatsu.', 'fallback stop must preserve recognized speech');\n"
    if marker not in text:
        raise SystemExit('QA fallback marker missing')
    addition = "\n  FakeSpeechRecognition.instances = [];\n  FakeSpeechRecognition.lastInstance = null;\n  let restartUpdate = '';\n  const restartCounts: number[] = [];\n  const diagnosticEvents: Array<{ type: string; restartCount: number; elapsedMs?: number }> = [];\n  const restartSession = createStableSpeechRecognitionSession({\n    onUpdate: (snapshot) => { restartUpdate = snapshot.bestText; },\n    onError: (error) => { throw new Error(`unexpected restart-path recognition error: ${error}`); },\n    onRestart: (count) => { restartCounts.push(count); },\n    onDiagnostic: (event) => { diagnosticEvents.push(event); },\n  });\n  assert.ok(restartSession, 'restart continuity session must be creatable');\n  assert.equal(restartSession.start(), true, 'restart continuity session must start');\n  const firstRestartRecognizer = FakeSpeechRecognition.lastInstance;\n  assert.ok(firstRestartRecognizer, 'first restart-path recognizer must exist');\n  const firstRestartResult: any = [{ transcript: 'I like soccer', confidence: 0.9 }];\n  firstRestartResult.isFinal = true;\n  firstRestartRecognizer.onresult?.({ results: [firstRestartResult] });\n  assert.equal(restartUpdate, 'I like soccer.', 'speech before an unexpected recognizer end must be retained');\n  firstRestartRecognizer.onend?.();\n  await new Promise((resolve) => setTimeout(resolve, 150));\n  const secondRestartRecognizer = FakeSpeechRecognition.lastInstance;\n  assert.ok(secondRestartRecognizer, 'recognizer must restart after an unexpected end');\n  assert.notEqual(secondRestartRecognizer, firstRestartRecognizer, 'restart must use a fresh recognizer instance');\n  assert.deepEqual(restartCounts, [1], 'restart callback must report the first restart once');\n  const secondRestartResult: any = [{ transcript: 'I play soccer with my friends', confidence: 0.88 }];\n  secondRestartResult.isFinal = true;\n  secondRestartRecognizer.onresult?.({ results: [secondRestartResult] });\n  assert.ok(restartUpdate.includes('I like soccer'), 'speech recognized before restart must remain in the combined transcript');\n  assert.ok(restartUpdate.includes('I play soccer with my friends'), 'speech recognized after restart must append to the combined transcript');\n  assert.ok(diagnosticEvents.some((event) => event.type === 'unexpected-end'), 'QA diagnostics must expose unexpected recognizer end');\n  assert.ok(diagnosticEvents.some((event) => event.type === 'restart-attempt'), 'QA diagnostics must expose restart attempt timing');\n  assert.ok(diagnosticEvents.some((event) => event.type === 'restart-ready'), 'QA diagnostics must expose restart-ready timing');\n  const readyDiagnostic = diagnosticEvents.find((event) => event.type === 'restart-ready');\n  assert.ok((readyDiagnostic?.elapsedMs ?? -1) >= 120, 'restart-ready diagnostic must include elapsed time from unexpected end');\n  const restartedSnapshot = await restartSession.requestStop();\n  assert.ok(restartedSnapshot.bestText.includes('I like soccer'), 'final restarted snapshot must keep pre-restart speech');\n  assert.ok(restartedSnapshot.bestText.includes('I play soccer with my friends'), 'final restarted snapshot must keep post-restart speech');\n"
    text = text.replace(marker, marker + addition, 1)
if 'ASR restarts must not be persisted as research system events' not in text:
    marker = "assert.ok(appSource.includes('speechInterimTranscript'), 'App must retain interim speech separately');\n"
    if marker not in text:
        raise SystemExit('QA App source marker missing')
    addition = "assert.equal(appSource.includes(\"recordResearchEvent('asr_restart'\"), false, 'ASR restarts must not be persisted as research system events');\nassert.ok(appSource.includes('ASR_DIAGNOSTICS_ENABLED'), 'ASR diagnostics must be opt-in for development or ?asrDebug=1');\nassert.ok(appSource.includes('MAX_CHILD_UTTERANCE_CHARS'), 'App must use the shared child utterance ceiling');\nassert.equal(MAX_CHILD_UTTERANCE_CHARS, 300, 'shared child utterance ceiling must match canonical 300-character storage');\nconst serverSource = readFileSync('server.ts', 'utf8');\nassert.ok(serverSource.includes('trimmedMessage.length > MAX_CHILD_UTTERANCE_CHARS'), 'server chat guard must use the shared child utterance ceiling');\nassert.ok(serverSource.includes('slice(0, MAX_CHILD_UTTERANCE_CHARS)'), 'server dialogue context must retain the same child utterance ceiling');\n"
    text = text.replace(marker, marker + addition, 1)
save(path, text)

# Final state checks before running TypeScript/QA.
checks = {
    'src/dataContract.ts': ['MAX_CHILD_UTTERANCE_CHARS = 300', 'slice(0, MAX_CHILD_UTTERANCE_CHARS)'],
    'src/App.tsx': ['trimmed.length > MAX_CHILD_UTTERANCE_CHARS', 'ASR_DIAGNOSTICS_ENABLED', 'onDiagnostic: ASR_DIAGNOSTICS_ENABLED'],
    'server.ts': ['trimmedMessage.length > MAX_CHILD_UTTERANCE_CHARS', "sanitizeStudentInput(msg.englishText || '').slice(0, MAX_CHILD_UTTERANCE_CHARS)"],
    'src/utils/stableSpeechRecognition.ts': ["type: 'unexpected-end'", "type: 'restart-attempt'", "type: 'restart-ready'", 'nextRecognition.continuous = true', 'nextRecognition.interimResults = true'],
}
for file_path, needles in checks.items():
    source = load(file_path)
    for needle in needles:
        if needle not in source:
            raise SystemExit(f'final state missing in {file_path}: {needle}')
if "recordResearchEvent('asr_restart'" in load('src/App.tsx'):
    raise SystemExit('asr_restart is still being persisted as a research event')

print('speech continuity v2 patch applied successfully')
