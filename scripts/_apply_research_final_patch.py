from pathlib import Path


def replace_once(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:100]!r}')
    p.write_text(text.replace(old,new,1))

# Capture AI latency as a non-content learning-environment event.
replace_once('src/dataContract.ts',
"  'vocab_audio_play','speech_rate_change','ai_request_failure',",
"  'vocab_audio_play','speech_rate_change','ai_response_latency_ms','ai_request_failure',")

# Apply the research-only anonymization layer to turn exports. Contextually mask
# the common "I'm <name>" response when the previous AI turn explicitly asks a name.
replace_once('src/server/researchExport.ts',
"import type { ChatMessage, VisualVocabularyItem } from '../types';",
"import type { ChatMessage, VisualVocabularyItem } from '../types';\nimport { maskTextForResearchExport } from '../utils/privacy';")
replace_once('src/server/researchExport.ts',
"      const flags = turnFlags(message);\n      const local = tokyoParts(message.timestamp);\n      turnRows.push({",
"      const flags = turnFlags(message);\n      const local = tokyoParts(message.timestamp);\n      const previousText = index > 0 ? history[index - 1]?.englishText || '' : '';\n      let researchEnglish = maskTextForResearchExport(message.englishText || '');\n      let researchJapanese = maskTextForResearchExport(message.japaneseText || '');\n      if (message.sender === 'child' && /what(?:'|’)s your name|what is your name/i.test(previousText)) {\n        researchEnglish = researchEnglish.replace(/^\\s*(i(?:'|’)m|i am)\\s+.{1,40}?(?=\\s+(?:and|but|how|what|where|when|i|my)\\b|[,.!?]|$)/i, '$1 [name omitted]');\n        researchJapanese = researchJapanese.replace(/^\\s*(私は|わたしは|僕は|ぼくは)\\s*[^。！？,.]{1,30}?(です|だよ)(?=[。！？,.]|$)/, '$1 [name omitted] $2');\n      }\n      turnRows.push({")
replace_once('src/server/researchExport.ts',
"        english_text_anonymized: message.englishText || '',\n        japanese_translation: message.japaneseText || '',",
"        english_text_anonymized: researchEnglish,\n        japanese_translation: researchJapanese,")

# Preserve a completed dialogue even when reflection is never submitted. The same
# session ID is safely upserted with reflection later. Reflection waits for the
# initial snapshot promise so the no-reflection write cannot overwrite it.
replace_once('src/App.tsx',
"  const systemEventsRef = useRef<ResearchSystemEvent[]>([]);",
"  const systemEventsRef = useRef<ResearchSystemEvent[]>([]);\n  const initialSessionSaveRef = useRef<Promise<void> | null>(null);")
replace_once('src/App.tsx',
"    setLearningCode(code); setSessionId(newSessionId()); sessionStartedAtRef.current = startedAt; sessionEndedAtRef.current = 0;\n    systemEventsRef.current = [{ type: 'session_start', timestamp: startedAt }];",
"    setLearningCode(code); setSessionId(newSessionId()); sessionStartedAtRef.current = startedAt; sessionEndedAtRef.current = 0;\n    initialSessionSaveRef.current = null;\n    systemEventsRef.current = [{ type: 'session_start', timestamp: startedAt }];")
replace_once('src/App.tsx',
"    const controller = new AbortController(); chatAbortControllerRef.current = controller;\n    try {",
"    const controller = new AbortController(); chatAbortControllerRef.current = controller;\n    const aiRequestStartedAt = Date.now();\n    try {")
replace_once('src/App.tsx',
"      const resData = await response.json();\n      if (!dialogueActiveRef.current || controller.signal.aborted || chatAbortControllerRef.current !== controller) return;",
"      const resData = await response.json();\n      recordResearchEvent('ai_response_latency_ms', String(Math.max(0, Date.now() - aiRequestStartedAt)));\n      if (!dialogueActiveRef.current || controller.signal.aborted || chatAbortControllerRef.current !== controller) return;")
replace_once('src/App.tsx',
"    const finalMessages=[...currentHistory,farewellMsg]; setMessages(finalMessages); messagesRef.current=finalMessages; setIsSpeaking(true); setMood('happy'); setIsLoadingFeedback(true);",
"    const finalMessages=[...currentHistory,farewellMsg]; setMessages(finalMessages); messagesRef.current=finalMessages; setIsSpeaking(true); setMood('happy'); setIsLoadingFeedback(true);\n    if (learningDataEnabled && learningCode && sessionId) {\n      const snapshotPayload = {\n        sessionId, learningCode, aiStudentId: currentProf.selectedAiStudentId, topic: currentProf.selectedTopic,\n        targetDurationMinutes: currentProf.selectedDurationMinutes, startedAt: sessionStartedAtRef.current,\n        endedAt: sessionEndedAtRef.current || Date.now(), history: finalMessages, encounteredVocab: encounteredVocabRef.current, systemEvents: systemEventsRef.current,\n      };\n      initialSessionSaveRef.current = fetch(apiUrl('/api/sessions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshotPayload) })\n        .then(async (response) => { if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data?.error || 'SNAPSHOT_SAVE_FAILED'); } })\n        .catch((error) => { console.warn('Initial research session snapshot unavailable:', error); });\n    } else {\n      initialSessionSaveRef.current = null;\n    }")
replace_once('src/App.tsx',
"    setIsSavingReflection(true); setReflectionSaveMessage('');\n    if (learningDataEnabled && learningCode && sessionId) {",
"    setIsSavingReflection(true); setReflectionSaveMessage('');\n    if (initialSessionSaveRef.current) { await initialSessionSaveRef.current; initialSessionSaveRef.current = null; }\n    if (learningDataEnabled && learningCode && sessionId) {")
replace_once('src/App.tsx',
"setLearningCode('');setSessionId('');setReflectionSaveMessage('');};",
"setLearningCode('');setSessionId('');initialSessionSaveRef.current=null;setReflectionSaveMessage('');};")

# Strengthen research QA for direct identifiers, context-sensitive names,
# missing-reflection records, latency logging, and initial snapshot persistence.
replace_once('scripts/qa-research-integrated.ts',
"import { analyzeChildCommunication, parseResearchSystemEvents } from '../src/dataContract';",
"import { analyzeChildCommunication, parseResearchSystemEvents } from '../src/dataContract';\nimport { maskTextForResearchExport } from '../src/utils/privacy';\nimport fs from 'node:fs';")
replace_once('scripts/qa-research-integrated.ts',
"const evening = {\n  ...clustered[0], researchId: 'R200001', classId: '5-2', sessionId: 'session_evening',\n  startedAt: '2026-09-01T09:30:00.000Z', endedAt: '2026-09-01T09:33:00.000Z',\n};",
"const evening = {\n  ...clustered[0], researchId: 'R200001', classId: '5-2', sessionId: 'session_evening',\n  startedAt: '2026-09-01T09:30:00.000Z', endedAt: '2026-09-01T09:33:00.000Z', reflection: null,\n};")
replace_once('scripts/qa-research-integrated.ts',
"assert.equal(eveningRow.usage_context_inferred, 'out_of_school_hours');",
"assert.equal(eveningRow.usage_context_inferred, 'out_of_school_hours');\nassert.equal(eveningRow.data_quality_flag, 'missing_reflection');")
replace_once('scripts/qa-research-integrated.ts',
"const parsedEvents = parseResearchSystemEvents([\n  { type: 'mic_start', timestamp: base, value: 'microphone' },",
"const maskedResearch = maskTextForResearchExport('My name is Jonah Smith. I am 11 years old. I go to Kitahama Elementary School. My code is A7M4. My birthday is May 10.');\nfor (const secret of ['Jonah Smith','11 years old','Kitahama Elementary School','A7M4','May 10']) assert.equal(maskedResearch.includes(secret), false, `research export must mask ${secret}`);\nassert.equal(maskTextForResearchExport('I like soccer because it is fun.'), 'I like soccer because it is fun.');\n\nconst nameContextData = buildResearchDataSets([{...clustered[0], sessionId:'session_name_context', history:[\n  {id:'ai-name',sender:'ai',englishText:\"What's your name?\",japaneseText:'名前は何ですか。',timestamp:base},\n  {id:'child-name',sender:'child',englishText:\"I'm Jonah. I like soccer.\",japaneseText:'私はジョナです。サッカーが好きです。',timestamp:base+1000},\n]}]);\nconst nameTurn = nameContextData.turns.find((row) => row.speaker === 'child')!;\nassert.equal(String(nameTurn.english_text_anonymized).includes('Jonah'), false, 'name response after explicit name question must be masked');\nassert.ok(String(nameTurn.english_text_anonymized).includes('I like soccer'), 'non-identifying remainder must be preserved');\n\nconst parsedEvents = parseResearchSystemEvents([\n  { type: 'mic_start', timestamp: base, value: 'microphone' },\n  { type: 'ai_response_latency_ms', timestamp: base + 1, value: '420' },")
replace_once('scripts/qa-research-integrated.ts',
"assert.equal(parsedEvents.length, 1, 'only whitelisted events with valid timestamps may be stored');",
"assert.equal(parsedEvents.length, 2, 'only whitelisted events with valid timestamps may be stored');\nconst appSource = fs.readFileSync('src/App.tsx','utf8');\nassert.ok(appSource.includes('initialSessionSaveRef'), 'dialogue-end snapshot persistence must exist');\nassert.ok(appSource.includes('Initial research session snapshot unavailable'), 'snapshot failure handling must exist');\nassert.ok(appSource.includes(\"recordResearchEvent('ai_response_latency_ms'\"), 'AI response latency must be captured');")

print('final research completeness patch applied')
