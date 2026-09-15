from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"target not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# 1) Shared 300-character ceiling, matching canonical research storage.
replace_once(
    'src/dataContract.ts',
    "export const DIALOGUE_DURATIONS_MINUTES = [1, 2, 3, 5] as const satisfies readonly DialogueDurationMinutes[];\n",
    "export const DIALOGUE_DURATIONS_MINUTES = [1, 2, 3, 5] as const satisfies readonly DialogueDurationMinutes[];\nexport const MAX_CHILD_UTTERANCE_CHARS = 300;\n",
)
replace_once(
    'src/dataContract.ts',
    "const englishText = typeof item.englishText === 'string' ? item.englishText.trim().slice(0, 300) : '';",
    "const englishText = typeof item.englishText === 'string' ? item.englishText.trim().slice(0, MAX_CHILD_UTTERANCE_CHARS) : '';",
)

# 2) Client: use shared ceiling and keep ASR restart diagnostics out of research events.
replace_once(
    'src/App.tsx',
    "import type { ReflectionAnswers, ResearchSystemEvent, ResearchSystemEventType } from './dataContract';",
    "import { MAX_CHILD_UTTERANCE_CHARS, type ReflectionAnswers, type ResearchSystemEvent, type ResearchSystemEventType } from './dataContract';",
)
replace_once(
    'src/App.tsx',
    "const CONTEXTUAL_ASR_ENABLED = import.meta.env.VITE_CONTEXTUAL_ASR_ENABLED !== 'false';\n",
    "const CONTEXTUAL_ASR_ENABLED = import.meta.env.VITE_CONTEXTUAL_ASR_ENABLED !== 'false';\nconst ASR_DIAGNOSTICS_ENABLED = import.meta.env.DEV || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('asrDebug') === '1');\n",
)
replace_once(
    'src/App.tsx',
    "if (trimmed.length > 100) { setMicHintMessage('文が少し長いです！もう少し短い英語で話してみてね。'); setTimeout(() => setMicHintMessage(''), 4000); return; }",
    "if (trimmed.length > MAX_CHILD_UTTERANCE_CHARS) { setMicHintMessage('一度に話せる長さを少し超えました。少し短く分けて話してみてね。'); setTimeout(() => setMicHintMessage(''), 4000); return; }",
)
replace_once(
    'src/App.tsx',
    "onRestart: (count) => { recordResearchEvent('asr_restart', String(count)); setIsRecording(true); setIsListening(true); },\n      onBiasStatus:",
    "onRestart: () => { setIsRecording(true); setIsListening(true); },\n      onDiagnostic: ASR_DIAGNOSTICS_ENABLED ? (event) => { console.debug('[ASR QA]', event); } : undefined,\n      onBiasStatus:",
)

# 3) Server: same ceiling for current message and retained dialogue context.
replace_once(
    'server.ts',
    "import { calculateCanonicalStats, canonicalizeHistory, isAIStudentId, isDialogueDuration, isDialogueTopic, isValidLearningCode, normalizeLearningCode, validateSessionSaveInput } from './src/dataContract';",
    "import { MAX_CHILD_UTTERANCE_CHARS, calculateCanonicalStats, canonicalizeHistory, isAIStudentId, isDialogueDuration, isDialogueTopic, isValidLearningCode, normalizeLearningCode, validateSessionSaveInput } from './src/dataContract';",
)
replace_once(
    'server.ts',
    "if (trimmedMessage.length > 100) {",
    "if (trimmedMessage.length > MAX_CHILD_UTTERANCE_CHARS) {",
)
replace_once(
    'server.ts',
    "`${msg.sender === 'ai' ? persona.name : 'Student'}: ${sanitizeStudentInput(msg.englishText || '').slice(0, 100)}`",
    "`${msg.sender === 'ai' ? persona.name : 'Student'}: ${sanitizeStudentInput(msg.englishText || '').slice(0, MAX_CHILD_UTTERANCE_CHARS)}`",
)

# 4) Stable SpeechRecognition: diagnostics only; do not change recognition behavior.
replace_once(
    'src/utils/stableSpeechRecognition.ts',
    "export interface StableSpeechRecognitionOptions {\n",
    "export interface StableSpeechDiagnosticEvent {\n  type: 'unexpected-end' | 'restart-attempt' | 'restart-ready';\n  restartCount: number;\n  timestampMs: number;\n  elapsedMs?: number;\n}\n\nexport interface StableSpeechRecognitionOptions {\n",
)
replace_once(
    'src/utils/stableSpeechRecognition.ts',
    "  onRestart?: (count: number) => void;\n  onBiasStatus?: (applied: boolean, phraseCount: number) => void;",
    "  onRestart?: (count: number) => void;\n  onDiagnostic?: (event: StableSpeechDiagnosticEvent) => void;\n  onBiasStatus?: (applied: boolean, phraseCount: number) => void;",
)
replace_once(
    'src/utils/stableSpeechRecognition.ts',
    "  let contextualBiasDisabled = false;\n",
    "  let contextualBiasDisabled = false;\n  let restartBeganAt = 0;\n",
)
replace_once(
    'src/utils/stableSpeechRecognition.ts',
    "      nextRecognition.onstart = () => {\n        if (cancelled || stopFinished) return;\n        if (isRestart) options.onRestart?.(restartCount);\n        options.onStart?.();\n      };",
    "      nextRecognition.onstart = () => {\n        if (cancelled || stopFinished) return;\n        if (isRestart) {\n          const now = Date.now();\n          options.onDiagnostic?.({\n            type: 'restart-ready',\n            restartCount,\n            timestampMs: now,\n            elapsedMs: restartBeganAt ? Math.max(0, now - restartBeganAt) : undefined,\n          });\n          options.onRestart?.(restartCount);\n        }\n        options.onStart?.();\n      };",
)
replace_once(
    'src/utils/stableSpeechRecognition.ts',
    "        if (latestSnapshot.rawBestText.trim()) {\n          committedRaw = latestSnapshot.rawBestText.trim();",
    "        const unexpectedEndAt = Date.now();\n        options.onDiagnostic?.({\n          type: 'unexpected-end',\n          restartCount: restartCount + 1,\n          timestampMs: unexpectedEndAt,\n        });\n\n        if (latestSnapshot.rawBestText.trim()) {\n          committedRaw = latestSnapshot.rawBestText.trim();",
)
replace_once(
    'src/utils/stableSpeechRecognition.ts',
    "        recognition = null;\n        window.setTimeout(() => {\n          if (recordingIntent && !stopRequested && !cancelled && !stopFinished) startRecognizer(true);\n        }, 120);",
    "        recognition = null;\n        restartBeganAt = unexpectedEndAt;\n        window.setTimeout(() => {\n          if (recordingIntent && !stopRequested && !cancelled && !stopFinished) {\n            const now = Date.now();\n            options.onDiagnostic?.({\n              type: 'restart-attempt',\n              restartCount,\n              timestampMs: now,\n              elapsedMs: Math.max(0, now - restartBeganAt),\n            });\n            startRecognizer(true);\n          }\n        }, 120);",
)

# 5) Regression QA: prove restart preserves speech, diagnostics stay transient, and 300 chars align end-to-end.
qa = Path('scripts/qa-stable-speech-recognition.ts')
text = qa.read_text()
text = text.replace(
    "import {\n  buildStableSpeechSnapshot,\n  collapseProgressiveSpeechUnits,\n  createStableSpeechRecognitionSession,\n} from '../src/utils/stableSpeechRecognition';\n",
    "import {\n  buildStableSpeechSnapshot,\n  collapseProgressiveSpeechUnits,\n  createStableSpeechRecognitionSession,\n} from '../src/utils/stableSpeechRecognition';\nimport { MAX_CHILD_UTTERANCE_CHARS } from '../src/dataContract';\n",
    1,
)
marker = "  const fallbackSnapshot = await fallbackSession.requestStop();\n  assert.equal(fallbackSnapshot.bestText, 'I live in Hamamatsu.', 'fallback stop must preserve recognized speech');\n"
insert = marker + "\n  FakeSpeechRecognition.instances = [];\n  FakeSpeechRecognition.lastInstance = null;\n  let restartUpdate = '';\n  const restartCounts: number[] = [];\n  const diagnosticEvents: Array<{ type: string; restartCount: number; elapsedMs?: number }> = [];\n  const restartSession = createStableSpeechRecognitionSession({\n    onUpdate: (snapshot) => { restartUpdate = snapshot.bestText; },\n    onError: (error) => { throw new Error(`unexpected restart-path recognition error: ${error}`); },\n    onRestart: (count) => { restartCounts.push(count); },\n    onDiagnostic: (event) => { diagnosticEvents.push(event); },\n  });\n  assert.ok(restartSession, 'restart continuity session must be creatable');\n  assert.equal(restartSession.start(), true, 'restart continuity session must start');\n  const firstRestartRecognizer = FakeSpeechRecognition.lastInstance;\n  assert.ok(firstRestartRecognizer, 'first restart-path recognizer must exist');\n  const firstRestartResult: any = [{ transcript: 'I like soccer', confidence: 0.9 }];\n  firstRestartResult.isFinal = true;\n  firstRestartRecognizer.onresult?.({ results: [firstRestartResult] });\n  assert.equal(restartUpdate, 'I like soccer.', 'speech before an unexpected recognizer end must be retained');\n  firstRestartRecognizer.onend?.();\n\n  await new Promise((resolve) => setTimeout(resolve, 150));\n  const secondRestartRecognizer = FakeSpeechRecognition.lastInstance;\n  assert.ok(secondRestartRecognizer, 'recognizer must restart after an unexpected end');\n  assert.notEqual(secondRestartRecognizer, firstRestartRecognizer, 'restart must use a fresh recognizer instance');\n  assert.deepEqual(restartCounts, [1], 'restart callback must report the first restart once');\n  const secondRestartResult: any = [{ transcript: 'I play soccer with my friends', confidence: 0.88 }];\n  secondRestartResult.isFinal = true;\n  secondRestartRecognizer.onresult?.({ results: [secondRestartResult] });\n  assert.ok(restartUpdate.includes('I like soccer'), 'speech recognized before restart must remain in the combined transcript');\n  assert.ok(restartUpdate.includes('I play soccer with my friends'), 'speech recognized after restart must append to the combined transcript');\n  assert.ok(diagnosticEvents.some((event) => event.type === 'unexpected-end'), 'QA diagnostics must expose unexpected recognizer end');\n  assert.ok(diagnosticEvents.some((event) => event.type === 'restart-attempt'), 'QA diagnostics must expose restart attempt timing');\n  assert.ok(diagnosticEvents.some((event) => event.type === 'restart-ready'), 'QA diagnostics must expose restart-ready timing');\n  const readyDiagnostic = diagnosticEvents.find((event) => event.type === 'restart-ready');\n  assert.ok((readyDiagnostic?.elapsedMs ?? -1) >= 120, 'restart-ready diagnostic must include elapsed time from unexpected end');\n  const restartedSnapshot = await restartSession.requestStop();\n  assert.ok(restartedSnapshot.bestText.includes('I like soccer'), 'final restarted snapshot must keep pre-restart speech');\n  assert.ok(restartedSnapshot.bestText.includes('I play soccer with my friends'), 'final restarted snapshot must keep post-restart speech');\n"
if marker not in text:
    raise SystemExit('QA insertion marker not found')
text = text.replace(marker, insert, 1)
source_marker = "assert.ok(appSource.includes('speechInterimTranscript'), 'App must retain interim speech separately');\n"
source_insert = source_marker + "assert.equal(appSource.includes(\"recordResearchEvent('asr_restart'\"), false, 'ASR restarts must not be persisted as research system events');\nassert.ok(appSource.includes('ASR_DIAGNOSTICS_ENABLED'), 'ASR diagnostics must be opt-in for development or ?asrDebug=1');\nassert.ok(appSource.includes('MAX_CHILD_UTTERANCE_CHARS'), 'App must use the shared child utterance ceiling');\nassert.equal(MAX_CHILD_UTTERANCE_CHARS, 300, 'shared child utterance ceiling must match canonical 300-character storage');\nconst serverSource = readFileSync('server.ts', 'utf8');\nassert.ok(serverSource.includes('trimmedMessage.length > MAX_CHILD_UTTERANCE_CHARS'), 'server chat guard must use the shared child utterance ceiling');\nassert.ok(serverSource.includes("slice(0, MAX_CHILD_UTTERANCE_CHARS)"), 'server dialogue context must retain the same child utterance ceiling');\n"
if source_marker not in text:
    raise SystemExit('QA source marker not found')
text = text.replace(source_marker, source_insert, 1)
qa.write_text(text)

print('speech continuity patch applied')
