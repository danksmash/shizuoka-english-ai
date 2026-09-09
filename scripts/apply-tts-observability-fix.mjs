import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(path, from, to) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one match, found ${count}: ${from.slice(0,120)}`);
  write(path, source.replace(from, to));
}
function replaceAllExact(path, from, to, expectedCount) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== expectedCount) throw new Error(`${path}: expected ${expectedCount} matches, found ${count}: ${from.slice(0,120)}`);
  write(path, source.split(from).join(to));
}

// 1) Expose the server-selected provider metadata to the GitHub Pages origin.
replaceOnce(
  'server.ts',
  "    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');\n",
  "    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');\n    res.setHeader('Access-Control-Expose-Headers', 'X-TTS-Provider, X-TTS-Fallback-From, X-TTS-Fallback-Reason, X-TTS-Effective-Rate, X-TTS-Latency-Ms, X-TTS-Cache');\n"
);

replaceOnce(
  'server.ts',
  "app.post('/api/tts', async (req, res) => {\n",
  `function classifyAzureTtsFallbackReason(error: unknown): string {\n  const message = error instanceof Error ? error.message : String(error || '');\n  if (/abort|aborted|timeout/i.test(message)) return 'timeout';\n  if (/AZURE_TTS_HTTP_429/i.test(message)) return 'http_429';\n  if (/AZURE_TTS_HTTP_(401|403)/i.test(message)) return 'auth';\n  if (/AZURE_TTS_HTTP_5\\d\\d/i.test(message)) return 'azure_5xx';\n  if (/AZURE_SPEECH_(NOT_CONFIGURED|REGION_MISMATCH)|UNKNOWN_AZURE_TTS_PERSONA/i.test(message)) return 'configuration';\n  if (/UNEXPECTED_CONTENT_TYPE|AUDIO_TOO_SMALL/i.test(message)) return 'invalid_audio';\n  if (/fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(message)) return 'network';\n  return 'unknown';\n}\n\napp.post('/api/tts', async (req, res) => {\n`
);

replaceOnce(
  'server.ts',
  "    } catch (azureError: any) {\n      console.error('Azure TTS failed; trying Google Chirp fallback', { message: azureError?.message, aiStudentId });\n      const { audio, cache } = await cachedGoogleTts(text, aiStudentId, speakingRate);\n",
  "    } catch (azureError: any) {\n      const fallbackReason = classifyAzureTtsFallbackReason(azureError);\n      console.error('Azure TTS failed; trying Google Chirp fallback', { reason: fallbackReason, message: azureError?.message, aiStudentId });\n      const { audio, cache } = await cachedGoogleTts(text, aiStudentId, speakingRate);\n"
);
replaceOnce(
  'server.ts',
  "      res.setHeader('X-TTS-Fallback-From', 'azure-speech');\n      res.setHeader('X-TTS-Cache', cache);\n",
  "      res.setHeader('X-TTS-Fallback-From', 'azure-speech');\n      res.setHeader('X-TTS-Fallback-Reason', fallbackReason);\n      res.setHeader('X-TTS-Cache', cache);\n"
);

// 2) Never infer Chirp merely because a custom response header is unreadable.
replaceOnce(
  'src/utils/speech.ts',
  "  onProvider?: (provider: 'azure-speech' | 'google-chirp3-hd' | 'device-fallback', effectiveRate: number) => void\n",
  "  onProvider?: (provider: 'azure-speech' | 'google-chirp3-hd' | 'device-fallback' | 'not_observed', effectiveRate: number, telemetry?: { fallbackFrom?: string; fallbackReason?: string; latencyMs?: number; cache?: string }) => void\n"
);
replaceOnce(
  'src/utils/speech.ts',
  "      onProvider?.('device-fallback', Math.max(0.75, Math.min(1.25, customRate || student.voiceRate || 1.0)));\n",
  "      onProvider?.('device-fallback', Math.max(0.75, Math.min(1.25, customRate || student.voiceRate || 1.0)), { fallbackReason: 'cloud_unavailable' });\n"
);
replaceOnce(
  'src/utils/speech.ts',
  "      const cloudProvider = response.headers.get('X-TTS-Provider') === 'azure-speech' ? 'azure-speech' : 'google-chirp3-hd';\n      onProvider?.(cloudProvider, Number(response.headers.get('X-TTS-Effective-Rate') || rate));\n",
  `      const rawProvider = response.headers.get('X-TTS-Provider');\n      const cloudProvider = rawProvider === 'azure-speech'\n        ? 'azure-speech'\n        : rawProvider === 'google-chirp3-hd'\n          ? 'google-chirp3-hd'\n          : 'not_observed';\n      const latencyHeader = Number(response.headers.get('X-TTS-Latency-Ms'));\n      onProvider?.(cloudProvider, Number(response.headers.get('X-TTS-Effective-Rate') || rate), {\n        fallbackFrom: response.headers.get('X-TTS-Fallback-From') || undefined,\n        fallbackReason: response.headers.get('X-TTS-Fallback-Reason') || undefined,\n        latencyMs: Number.isFinite(latencyHeader) ? latencyHeader : undefined,\n        cache: response.headers.get('X-TTS-Cache') || undefined,\n      });\n`
);

// 3) Persist provider/fallback telemetry in the existing research system-event stream.
replaceOnce(
  'src/dataContract.ts',
  "  'ai_model','ai_input_tokens','ai_output_tokens','ai_cache_read_tokens','ai_cache_creation_tokens','tts_provider','tts_effective_rate',\n",
  "  'ai_model','ai_input_tokens','ai_output_tokens','ai_cache_read_tokens','ai_cache_creation_tokens','tts_provider','tts_effective_rate',\n  'tts_fallback_from','tts_fallback_reason','tts_latency_ms','tts_cache',\n"
);

const oldCallback = "(provider, effectiveRate) => { effectiveTtsRateRef.current = effectiveRate; recordResearchEvent('tts_provider', provider); recordResearchEvent('tts_effective_rate', effectiveRate.toFixed(2)); }";
const newCallback = "(provider, effectiveRate, telemetry) => { effectiveTtsRateRef.current = effectiveRate; recordResearchEvent('tts_provider', provider); recordResearchEvent('tts_effective_rate', effectiveRate.toFixed(2)); if (telemetry?.fallbackFrom) recordResearchEvent('tts_fallback_from', telemetry.fallbackFrom); if (telemetry?.fallbackReason) recordResearchEvent('tts_fallback_reason', telemetry.fallbackReason); if (Number.isFinite(telemetry?.latencyMs)) recordResearchEvent('tts_latency_ms', String(Math.round(telemetry!.latencyMs!))); if (telemetry?.cache) recordResearchEvent('tts_cache', telemetry.cache); }";
replaceAllExact('src/App.tsx', oldCallback, newCallback, 2);

// 4) Derive session-level TTS condition fields from observed runtime events.
replaceOnce(
  'src/server/persistence.ts',
  "  const ttsRuntime = resolveTtsRuntimeMetadata(args.aiStudentId, latestEvent('tts_provider'));\n  const document = {\n",
  `  const ttsRuntime = resolveTtsRuntimeMetadata(args.aiStudentId, latestEvent('tts_provider'));\n  const ttsProviderEvents = events.filter((event) => event.type === 'tts_provider').map((event) => String(event.value || '')).filter(Boolean);\n  const distinctTtsProviders = Array.from(new Set(ttsProviderEvents));\n  const ttsActualProvider = distinctTtsProviders.length === 0 ? 'not_observed' : distinctTtsProviders.length === 1 ? distinctTtsProviders[0] : 'mixed';\n  const ttsFallbackCount = events.filter((event) => event.type === 'tts_fallback_from' && event.value === 'azure-speech').length;\n  const ttsLatencyRaw = Number(latestEvent('tts_latency_ms'));\n  const ttsProviderObserved = ttsActualProvider === 'not_observed' ? 0 : 1;\n  const ttsProviderDeviation: number | '' = ttsActualProvider === 'not_observed' ? '' : ttsActualProvider === 'azure-speech' ? 0 : 1;\n  const document = {\n`
);
replaceOnce(
  'src/server/persistence.ts',
  "    ttsProvider: ttsRuntime.provider, ttsVoiceName: ttsRuntime.voiceName, ttsLanguageCode: ttsRuntime.languageCode, personaVoiceGender: personaMeta.voiceGender, personaVoicePitch: personaMeta.voicePitch, personaDefaultVoiceRate: personaMeta.defaultVoiceRate,\n",
  `    ttsProvider: ttsRuntime.provider, ttsVoiceName: ttsRuntime.voiceName, ttsLanguageCode: ttsRuntime.languageCode,\n    ttsPrimaryProvider: 'azure-speech', ttsActualProvider, ttsProviderObserved, ttsProviderEventCount: ttsProviderEvents.length,\n    ttsFallbackCount, ttsFallbackFrom: latestEvent('tts_fallback_from'), ttsFallbackReason: latestEvent('tts_fallback_reason'),\n    ttsLatencyMs: Number.isFinite(ttsLatencyRaw) && ttsLatencyRaw >= 0 ? Math.round(ttsLatencyRaw) : 0, ttsProviderDeviation,\n    personaVoiceGender: personaMeta.voiceGender, personaVoicePitch: personaMeta.voicePitch, personaDefaultVoiceRate: personaMeta.defaultVoiceRate,\n`
);

// 5) Carry the reproducibility-critical audio condition into the raw research row.
replaceOnce(
  'src/server/researchExport.ts',
  "      tts_provider: session.ttsProvider || '', tts_voice_name: session.ttsVoiceName || persona.voiceName, tts_language_code: session.ttsLanguageCode || persona.voiceLanguageCode,\n",
  `      tts_provider: session.ttsProvider || '', tts_voice_name: session.ttsVoiceName || persona.voiceName, tts_language_code: session.ttsLanguageCode || persona.voiceLanguageCode,\n      tts_primary_provider: session.ttsPrimaryProvider || 'azure-speech', tts_actual_provider: session.ttsActualProvider || session.ttsProvider || 'not_observed',\n      tts_provider_observed: session.ttsProviderObserved ?? (session.ttsProvider && session.ttsProvider !== 'not_observed' ? 1 : 0),\n      tts_provider_event_count: session.ttsProviderEventCount ?? 0, tts_fallback_count: session.ttsFallbackCount ?? 0,\n      tts_fallback_reason: session.ttsFallbackReason || '', tts_provider_deviation: session.ttsProviderDeviation ?? '',\n`
);

// 6) Add only analysis-critical TTS condition fields to the formal five-file export.
replaceOnce('src/server/researchDashboard.ts', "export const RESEARCH_EXPORT_SCHEMA_VERSION = 'research-2026-v2';", "export const RESEARCH_EXPORT_SCHEMA_VERSION = 'research-2026-v3';");
replaceOnce(
  'src/server/researchDashboard.ts',
  "    'speech_rate_change_count','student_selected_speech_rate',\n    'schema_version','research_schema_version','app_version','build',\n",
  "    'speech_rate_change_count','student_selected_speech_rate',\n    'tts_primary_provider','tts_actual_provider','tts_provider_observed','tts_provider_event_count','tts_fallback_count','tts_fallback_reason','tts_provider_deviation',\n    'schema_version','research_schema_version','app_version','build',\n"
);
replaceOnce(
  'src/server/researchDashboard.ts',
  "  student_selected_speech_rate:'児童が選択したAI音声の再生速度',\n",
  `  student_selected_speech_rate:'児童が選択したAI音声の再生速度',\n  tts_primary_provider:'本研究で意図したPrimary TTS provider',\n  tts_actual_provider:'当該sessionで観測されたTTS provider。複数providerの場合はmixed',\n  tts_provider_observed:'TTS providerを少なくとも1回観測できた場合1',\n  tts_provider_event_count:'当該sessionで記録されたTTS providerイベント数',\n  tts_fallback_count:'Azure Speechから別providerへfallbackした回数',\n  tts_fallback_reason:'最後に観測されたAzure Speech fallback理由',\n  tts_provider_deviation:'PrimaryのAzureのみなら0、fallback・device・mixedなら1、観測不能は空欄',\n`
);
replaceOnce(
  'src/server/researchDashboard.ts',
  "  student_selected_speech_rate:'0.75–1.25',\n",
  "  student_selected_speech_rate:'0.75–1.25',\n  tts_primary_provider:'azure-speech',\n  tts_actual_provider:'azure-speech | google-chirp3-hd | device-fallback | mixed | not_observed',\n  tts_provider_observed:'0 | 1', tts_provider_deviation:'0 | 1 | blank',\n  tts_fallback_reason:'timeout | http_429 | auth | azure_5xx | configuration | invalid_audio | network | unknown | cloud_unavailable | blank',\n"
);
replaceOnce(
  'src/server/researchDashboard.ts',
  "  'speech_rate_change_count','student_selected_speech_rate','schema_version','session_completed','turn_sequence','speaker_turn_number',\n",
  "  'speech_rate_change_count','student_selected_speech_rate','tts_provider_observed','tts_provider_event_count','tts_fallback_count','tts_provider_deviation','schema_version','session_completed','turn_sequence','speaker_turn_number',\n"
);

// 7) Make the existing Azure-primary QA current, mandatory, and regression-focused.
write('scripts/qa-azure-primary.ts', `import fs from 'node:fs';\n\nconst server = fs.readFileSync('server.ts', 'utf8');\nconst speech = fs.readFileSync('src/utils/speech.ts', 'utf8');\nconst dataContract = fs.readFileSync('src/dataContract.ts', 'utf8');\nconst app = fs.readFileSync('src/App.tsx', 'utf8');\nconst workflow = fs.readFileSync('.github/workflows/cloud-run-deploy.yml', 'utf8');\n\nfor (const required of [\n  \"ttsProvider: 'azure-speech'\",\n  \"ttsFallback: 'google-chirp3-hd'\",\n  \"synthesizeAzureTts(text, aiStudentId, speakingRate, 3_500)\",\n  'Access-Control-Expose-Headers',\n  'X-TTS-Provider',\n  'X-TTS-Fallback-From',\n  'X-TTS-Fallback-Reason',\n  'X-TTS-Effective-Rate',\n  'X-TTS-Latency-Ms',\n]) if (!server.includes(required)) throw new Error('server TTS observability missing: ' + required);\n\nif (!speech.includes(\"'device-fallback' | 'not_observed'\")) throw new Error('client not_observed provider state missing');\nif (!speech.includes(\"rawProvider === 'google-chirp3-hd'\")) throw new Error('client must explicitly recognize Chirp');\nif (!speech.includes(\": 'not_observed'\")) throw new Error('unreadable provider header must become not_observed');\nif (speech.includes(\"response.headers.get('X-TTS-Provider') === 'azure-speech' ? 'azure-speech' : 'google-chirp3-hd'\")) throw new Error('silent Azure-to-Chirp misclassification regression');\n\nfor (const eventType of ['tts_fallback_from','tts_fallback_reason','tts_latency_ms','tts_cache']) if (!dataContract.includes(eventType)) throw new Error('research event missing: ' + eventType);\nfor (const marker of ['telemetry?.fallbackFrom','telemetry?.fallbackReason','telemetry?.latencyMs']) if (!app.includes(marker)) throw new Error('App TTS telemetry persistence missing: ' + marker);\nif (!workflow.includes('Access-Control-Expose-Headers')) throw new Error('production CORS smoke is missing');\nconsole.log('Azure primary + CORS provider observability QA: PASS');\n`);

replaceOnce(
  'package.json',
  '    "qa:tts-runtime-metadata": "tsx scripts/qa-tts-runtime-metadata.ts",\n',
  '    "qa:tts-runtime-metadata": "tsx scripts/qa-tts-runtime-metadata.ts",\n    "qa:azure-primary": "tsx scripts/qa-azure-primary.ts",\n'
);
replaceOnce(
  'package.json',
  'npm run qa:azure-voice-profile && npm run qa:tts-runtime-metadata && npm run qa:reflection',
  'npm run qa:azure-voice-profile && npm run qa:azure-primary && npm run qa:tts-runtime-metadata && npm run qa:reflection'
);

// 8) Production deployment must test browser-visible CORS metadata, not only server-side headers.
replaceOnce(
  '.github/workflows/cloud-run-deploy.yml',
  '          API_URL="https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app"\n          # Voice Profile v3 keeps 1.00 as the reviewed baseline while the\n',
  `          API_URL="https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app"\n          cors_headers=$(mktemp)\n          cors_status=$(curl --silent --show-error --max-time 20 -D "$cors_headers" -o /dev/null -w '%{http_code}' \\\n            -X OPTIONS "$API_URL/api/tts" \\\n            -H 'Origin: https://danksmash.github.io' \\\n            -H 'Access-Control-Request-Method: POST')\n          test "$cors_status" = "204"\n          grep -qi 'access-control-allow-origin: https://danksmash.github.io' "$cors_headers"\n          grep -qi 'access-control-expose-headers:.*x-tts-provider' "$cors_headers"\n          grep -qi 'access-control-expose-headers:.*x-tts-fallback-reason' "$cors_headers"\n          rm -f "$cors_headers"\n          # Voice Profile v3 keeps 1.00 as the reviewed baseline while the\n`
);

// 9) Formal export QA: TTS reproducibility fields are now intentional, while provider-specific voice names remain excluded.
replaceOnce(
  'scripts/qa-research-export-complete.ts',
  " assignedPartnerId:'P1',assignedPartnerCountry:'United States',assignmentAnnouncedAt:announced,studentSelectedSpeechRate:1,\n",
  " assignedPartnerId:'P1',assignedPartnerCountry:'United States',assignmentAnnouncedAt:announced,studentSelectedSpeechRate:1,\n ttsProvider:'azure-speech',ttsPrimaryProvider:'azure-speech',ttsActualProvider:'azure-speech',ttsProviderObserved:1,ttsProviderEventCount:2,ttsFallbackCount:0,ttsFallbackReason:'',ttsProviderDeviation:0,\n"
);
replaceOnce(
  'scripts/qa-research-export-complete.ts',
  "for(const required of ['assigned_partner_id','assigned_partner_country','assignment_announced_at','same_class_starts_5min','same_class_starts_10min','usage_context_inferred'])assert.ok(RESEARCH_EXPORT_HEADERS.sessions.includes(required));\n",
  "for(const required of ['assigned_partner_id','assigned_partner_country','assignment_announced_at','same_class_starts_5min','same_class_starts_10min','usage_context_inferred','tts_primary_provider','tts_actual_provider','tts_provider_observed','tts_provider_event_count','tts_fallback_count','tts_fallback_reason','tts_provider_deviation'])assert.ok(RESEARCH_EXPORT_HEADERS.sessions.includes(required));\n"
);
replaceOnce(
  'scripts/qa-research-export-complete.ts',
  "for(const removed of ['ai_model','ai_input_tokens','accent_circle','world_englishes_circle','tts_provider','tts_voice_name','school_hours_flag','weekday_flag','classification_rule_version'])assert.equal(RESEARCH_EXPORT_HEADERS.sessions.includes(removed),false,removed+' must not be formal research data');\n",
  "for(const removed of ['ai_model','ai_input_tokens','accent_circle','world_englishes_circle','tts_provider','tts_voice_name','tts_language_code','school_hours_flag','weekday_flag','classification_rule_version'])assert.equal(RESEARCH_EXPORT_HEADERS.sessions.includes(removed),false,removed+' must not be formal research data');\n"
);
replaceOnce(
  'scripts/qa-research-export-complete.ts',
  "const beforeRow=data.sessions.find(r=>r.session_id==='before')!;assert.equal(beforeRow.research_schema_version,RESEARCH_EXPORT_SCHEMA_VERSION);assert.equal(beforeRow.assigned_partner_country,'United States');assert.equal(beforeRow.help_open_count,1);assert.equal(beforeRow.vocab_bank_open_count,1);\n",
  "const beforeRow=data.sessions.find(r=>r.session_id==='before')!;assert.equal(beforeRow.research_schema_version,RESEARCH_EXPORT_SCHEMA_VERSION);assert.equal(beforeRow.assigned_partner_country,'United States');assert.equal(beforeRow.help_open_count,1);assert.equal(beforeRow.vocab_bank_open_count,1);assert.equal(beforeRow.tts_primary_provider,'azure-speech');assert.equal(beforeRow.tts_actual_provider,'azure-speech');assert.equal(beforeRow.tts_provider_observed,1);assert.equal(beforeRow.tts_provider_deviation,0);\n"
);

console.log('TTS observability patch applied successfully.');
