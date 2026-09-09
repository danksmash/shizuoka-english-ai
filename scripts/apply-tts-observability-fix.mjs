import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(path, from, to) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one match, found ${count}: ${from.slice(0, 140)}`);
  write(path, source.replace(from, to));
}

// New sessions get an explicit provenance version. Older Pilot B sessions lack this
// marker and must never be reinterpreted as reliable Chirp observations.
replaceOnce(
  'src/server/persistence.ts',
  "    ttsPrimaryProvider: 'azure-speech', ttsActualProvider, ttsProviderObserved, ttsProviderEventCount: ttsProviderEvents.length,\n",
  "    ttsTelemetryVersion: 'cors-visible-v1', ttsPrimaryProvider: 'azure-speech', ttsActualProvider, ttsProviderObserved, ttsProviderEventCount: ttsProviderEvents.length,\n"
);

replaceOnce(
  'src/server/researchExport.ts',
  "    const persona = getPersonaResearchMetadata(String(session.personaId || session.aiStudentId || ''));\n\n    sessionRows.push({\n",
  `    const persona = getPersonaResearchMetadata(String(session.personaId || session.aiStudentId || ''));\n    const ttsTelemetryVersion = String(session.ttsTelemetryVersion || '');\n    const ttsTelemetryReliable = ttsTelemetryVersion === 'cors-visible-v1';\n\n    sessionRows.push({\n`
);
replaceOnce(
  'src/server/researchExport.ts',
  "      tts_primary_provider: session.ttsPrimaryProvider || 'azure-speech', tts_actual_provider: session.ttsActualProvider || session.ttsProvider || 'not_observed',\n      tts_provider_observed: session.ttsProviderObserved ?? (session.ttsProvider && session.ttsProvider !== 'not_observed' ? 1 : 0),\n      tts_provider_event_count: session.ttsProviderEventCount ?? 0, tts_fallback_count: session.ttsFallbackCount ?? 0,\n      tts_fallback_reason: session.ttsFallbackReason || '', tts_provider_deviation: session.ttsProviderDeviation ?? '',\n",
  `      tts_telemetry_version: ttsTelemetryReliable ? ttsTelemetryVersion : 'legacy_unreliable',\n      tts_primary_provider: session.ttsPrimaryProvider || 'azure-speech',\n      tts_actual_provider: ttsTelemetryReliable ? (session.ttsActualProvider || 'not_observed') : 'not_observed',\n      tts_provider_observed: ttsTelemetryReliable ? (session.ttsProviderObserved ?? 0) : 0,\n      tts_provider_event_count: ttsTelemetryReliable ? (session.ttsProviderEventCount ?? 0) : 0,\n      tts_fallback_count: ttsTelemetryReliable ? (session.ttsFallbackCount ?? 0) : 0,\n      tts_fallback_reason: ttsTelemetryReliable ? (session.ttsFallbackReason || '') : '',\n      tts_provider_deviation: ttsTelemetryReliable ? (session.ttsProviderDeviation ?? '') : '',\n`
);

replaceOnce(
  'src/server/researchDashboard.ts',
  "    'tts_primary_provider','tts_actual_provider','tts_provider_observed','tts_provider_event_count','tts_fallback_count','tts_fallback_reason','tts_provider_deviation',\n",
  "    'tts_telemetry_version','tts_primary_provider','tts_actual_provider','tts_provider_observed','tts_provider_event_count','tts_fallback_count','tts_fallback_reason','tts_provider_deviation',\n"
);
replaceOnce(
  'src/server/researchDashboard.ts',
  "  tts_primary_provider:'本研究で意図したPrimary TTS provider',\n",
  "  tts_telemetry_version:'TTS provider観測方式の版。Pilot B等の旧CORS不具合期間はlegacy_unreliable',\n  tts_primary_provider:'本研究で意図したPrimary TTS provider',\n"
);
replaceOnce(
  'src/server/researchDashboard.ts',
  "  tts_primary_provider:'azure-speech',\n",
  "  tts_telemetry_version:'cors-visible-v1 | legacy_unreliable',\n  tts_primary_provider:'azure-speech',\n"
);

// Strengthen formal-export regression checks so misleading legacy Pilot B telemetry
// can never silently become a valid actual-provider value.
replaceOnce(
  'scripts/qa-research-export-complete.ts',
  " ttsProvider:'azure-speech',ttsPrimaryProvider:'azure-speech',ttsActualProvider:'azure-speech',ttsProviderObserved:1,ttsProviderEventCount:2,ttsFallbackCount:0,ttsFallbackReason:'',ttsProviderDeviation:0,\n",
  " ttsTelemetryVersion:'cors-visible-v1',ttsProvider:'azure-speech',ttsPrimaryProvider:'azure-speech',ttsActualProvider:'azure-speech',ttsProviderObserved:1,ttsProviderEventCount:2,ttsFallbackCount:0,ttsFallbackReason:'',ttsProviderDeviation:0,\n"
);
replaceOnce(
  'scripts/qa-research-export-complete.ts',
  "const raw=[make('before',before),make('after',after),make('other',after+3600000,{researchId:'R2',studentId:'S2',classId:'6-2',aiStudentId:'rahul_bangladesh',personaId:'rahul_bangladesh',personaCountry:'Bangladesh',assignedPartnerId:'P2',assignedPartnerCountry:'India',reflection:null,systemEvents:[{type:'session_start',timestamp:after+3600000},{type:'ai_request_failure',timestamp:after+3610000,value:'503'},{type:'mic_error',timestamp:after+3620000,value:'network'},{type:'tts_provider',timestamp:after+3625000,value:'device-fallback'},{type:'session_finish',timestamp:after+3659000}]})];\n",
  "const raw=[make('before',before),make('after',after),make('other',after+3600000,{researchId:'R2',studentId:'S2',classId:'6-2',aiStudentId:'rahul_bangladesh',personaId:'rahul_bangladesh',personaCountry:'Bangladesh',assignedPartnerId:'P2',assignedPartnerCountry:'India',ttsTelemetryVersion:undefined,ttsProvider:'google-chirp3-hd',ttsActualProvider:undefined,ttsProviderObserved:undefined,ttsProviderEventCount:undefined,ttsFallbackCount:undefined,ttsFallbackReason:undefined,ttsProviderDeviation:undefined,reflection:null,systemEvents:[{type:'session_start',timestamp:after+3600000},{type:'ai_request_failure',timestamp:after+3610000,value:'503'},{type:'mic_error',timestamp:after+3620000,value:'network'},{type:'tts_provider',timestamp:after+3625000,value:'google-chirp3-hd'},{type:'session_finish',timestamp:after+3659000}]})];\n"
);
replaceOnce(
  'scripts/qa-research-export-complete.ts',
  "for(const required of ['assigned_partner_id','assigned_partner_country','assignment_announced_at','same_class_starts_5min','same_class_starts_10min','usage_context_inferred','tts_primary_provider','tts_actual_provider','tts_provider_observed','tts_provider_event_count','tts_fallback_count','tts_fallback_reason','tts_provider_deviation'])assert.ok(RESEARCH_EXPORT_HEADERS.sessions.includes(required));\n",
  "for(const required of ['assigned_partner_id','assigned_partner_country','assignment_announced_at','same_class_starts_5min','same_class_starts_10min','usage_context_inferred','tts_telemetry_version','tts_primary_provider','tts_actual_provider','tts_provider_observed','tts_provider_event_count','tts_fallback_count','tts_fallback_reason','tts_provider_deviation'])assert.ok(RESEARCH_EXPORT_HEADERS.sessions.includes(required));\n"
);
replaceOnce(
  'scripts/qa-research-export-complete.ts',
  "const beforeRow=data.sessions.find(r=>r.session_id==='before')!;assert.equal(beforeRow.research_schema_version,RESEARCH_EXPORT_SCHEMA_VERSION);assert.equal(beforeRow.assigned_partner_country,'United States');assert.equal(beforeRow.help_open_count,1);assert.equal(beforeRow.vocab_bank_open_count,1);assert.equal(beforeRow.tts_primary_provider,'azure-speech');assert.equal(beforeRow.tts_actual_provider,'azure-speech');assert.equal(beforeRow.tts_provider_observed,1);assert.equal(beforeRow.tts_provider_deviation,0);\n",
  "const beforeRow=data.sessions.find(r=>r.session_id==='before')!;assert.equal(beforeRow.research_schema_version,RESEARCH_EXPORT_SCHEMA_VERSION);assert.equal(beforeRow.assigned_partner_country,'United States');assert.equal(beforeRow.help_open_count,1);assert.equal(beforeRow.vocab_bank_open_count,1);assert.equal(beforeRow.tts_telemetry_version,'cors-visible-v1');assert.equal(beforeRow.tts_primary_provider,'azure-speech');assert.equal(beforeRow.tts_actual_provider,'azure-speech');assert.equal(beforeRow.tts_provider_observed,1);assert.equal(beforeRow.tts_provider_deviation,0);const legacyRow=data.sessions.find(r=>r.session_id==='other')!;assert.equal(legacyRow.tts_telemetry_version,'legacy_unreliable');assert.equal(legacyRow.tts_actual_provider,'not_observed');assert.equal(legacyRow.tts_provider_observed,0);assert.equal(legacyRow.tts_fallback_count,0);assert.equal(legacyRow.tts_provider_deviation,'');\n"
);

// Keep the Azure voice-rate contract protected while also testing the new CORS/provenance layer.
write('scripts/qa-azure-primary.ts', `import fs from 'node:fs';\n\nconst server = fs.readFileSync('server.ts', 'utf8');\nconst speech = fs.readFileSync('src/utils/speech.ts', 'utf8');\nconst azureTts = fs.readFileSync('src/server/azureTts.ts', 'utf8');\nconst dataContract = fs.readFileSync('src/dataContract.ts', 'utf8');\nconst app = fs.readFileSync('src/App.tsx', 'utf8');\nconst persistence = fs.readFileSync('src/server/persistence.ts', 'utf8');\n\nfor (const required of [\n  \"ttsProvider: 'azure-speech'\",\n  \"ttsFallback: 'google-chirp3-hd'\",\n  \"synthesizeAzureTts(text, aiStudentId, speakingRate, 3_500)\",\n  'Access-Control-Expose-Headers',\n  'X-TTS-Provider',\n  'X-TTS-Fallback-From',\n  'X-TTS-Fallback-Reason',\n  'X-TTS-Effective-Rate',\n  'X-TTS-Latency-Ms',\n]) if (!server.includes(required)) throw new Error('server TTS observability missing: ' + required);\n\nif (!speech.includes(\"'device-fallback' | 'not_observed'\")) throw new Error('client not_observed provider state missing');\nif (!speech.includes(\"rawProvider === 'google-chirp3-hd'\")) throw new Error('client must explicitly recognize Chirp');\nif (!speech.includes(\": 'not_observed'\")) throw new Error('unreadable provider header must become not_observed');\nif (speech.includes(\"response.headers.get('X-TTS-Provider') === 'azure-speech' ? 'azure-speech' : 'google-chirp3-hd'\")) throw new Error('silent Azure-to-Chirp misclassification regression');\n\nfor (const eventType of ['tts_fallback_from','tts_fallback_reason','tts_latency_ms','tts_cache']) if (!dataContract.includes(eventType)) throw new Error('research event missing: ' + eventType);\nfor (const marker of ['telemetry?.fallbackFrom','telemetry?.fallbackReason','telemetry?.latencyMs']) if (!app.includes(marker)) throw new Error('App TTS telemetry persistence missing: ' + marker);\nif (!persistence.includes(\"ttsTelemetryVersion: 'cors-visible-v1'\")) throw new Error('TTS telemetry provenance version missing');\n\n// Preserve the reviewed Voice Profile v3 student rate control.\nif (!azureTts.includes('Math.max(0.75, Math.min(1.25, rate))')) throw new Error('Azure 0.75-1.25 rate clamp missing');\nif (!azureTts.includes('<prosody rate=\\"${rate.toFixed(2)}\\">')) throw new Error('Azure SSML prosody rate control missing');\nif (!azureTts.includes('effectiveRate: rate')) throw new Error('Azure effective rate provenance missing');\n\nconsole.log('Azure primary + Voice Profile v3 + CORS provider observability QA: PASS');\n`);

console.log('Legacy TTS telemetry protection patch applied successfully.');
