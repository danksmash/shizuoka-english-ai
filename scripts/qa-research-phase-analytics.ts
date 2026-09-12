import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PHASE_BUNDLE_MANIFEST_SCHEMA_VERSION,
  PHASE_CODEBOOK_ROWS,
  PHASE_RESEARCH_EXPORT_SCHEMA_VERSION,
  PHASE_SESSION_EXPORT_HEADERS,
  augmentSessionRowsWithPhase,
  buildPhaseComparison,
  withResearchPhaseAnalyticsRuntime,
} from '../src/server/researchPhaseAnalyticsRuntime';
import { managementPageHtmlWithStudyPhase } from '../src/server/researchPhaseRuntime';
import type { StudyScheduleRecord } from '../src/server/studySchedulePersistence';

const schedule: StudyScheduleRecord = {
  classId: '5-1', revision: 3,
  appStartDate: '2026-09-17', nationalityRevealDate: '2026-10-01', videoViewDate: '2026-10-08', exchangeDate: '2026-10-15',
  updatedAt: '2026-09-12T00:00:00.000Z', updatedBy: 'qa', history: [],
};

const started = (date: string, hour = 1) => Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
const rawSession = (sessionId: string, researchId: string, studentId: string, localDate: string, aiStudentId: string) => {
  const start = started(localDate);
  return {
    schemaVersion: 4, researchSchemaVersion: 'research-2026-v1', sessionId, researchId, studentId, classId: '5-1',
    aiStudentId, topic: 'favorites', targetDurationMinutes: 2, actualDurationSeconds: 120,
    startedAt: new Date(start).toISOString(), endedAt: new Date(start + 120000).toISOString(),
    assignedPartnerId: `${researchId}-partner`, assignedPartnerCountry: 'United States', assignmentAnnouncedAt: '2026-10-01T00:00:00.000Z',
    appVersion: '1.0.7', build: 'qa', studentSelectedSpeechRate: 1,
    history: [
      { id: `${sessionId}-a`, sender: 'ai', englishText: 'What do you like?', japaneseText: '何が好きですか。', timestamp: start },
      { id: `${sessionId}-c`, sender: 'child', englishText: 'I like soccer.', japaneseText: 'サッカーが好きです。', timestamp: start + 30000 },
    ],
    reflection: { scaleVersion: '4point-v1', conveyedIdeas: 3, understoodPartner: 3, noticedLanguageCulture: 3 },
    systemEvents: [{ type: 'session_start', timestamp: start }, { type: 'session_finish', timestamp: start + 119000 }],
  };
};

const raw = [
  rawSession('r1-p1-match', 'R1', 'S1', '2026-09-17', 'emma_usa'),
  rawSession('r2-p1-no', 'R2', 'S2', '2026-09-18', 'rahul_bangladesh'),
  rawSession('r1-p2-match', 'R1', 'S1', '2026-10-01', 'emma_usa'),
  rawSession('r1-p2-no', 'R1', 'S1', '2026-10-02', 'rahul_bangladesh'),
  rawSession('r2-p2-match', 'R2', 'S2', '2026-10-03', 'emma_usa'),
  rawSession('r1-p3-match', 'R1', 'S1', '2026-10-08', 'emma_usa'),
  rawSession('r2-p3-no', 'R2', 'S2', '2026-10-09', 'rahul_bangladesh'),
  rawSession('r1-p4-match', 'R1', 'S1', '2026-10-15', 'emma_usa'),
];

const comparison = buildPhaseComparison(raw as any, [schedule], { dataScope: 'main', personaId: 'emma_usa', studyPhase: 'phase2' });
assert.equal(comparison.applicable, true);
assert.equal(comparison.phases[0].sessions, 2, 'Persona filter must not collapse Phase comparison');
assert.equal(comparison.phases[1].sessions, 3, 'StudyPhase filter must not collapse Phase comparison');
assert.equal(comparison.phases[0].participantMeanSharePercent, 50);
assert.equal(comparison.phases[0].sessionSharePercent, 50);
assert.equal(comparison.phases[1].participantMeanSharePercent, 75);
assert.equal(comparison.phases[1].sessionSharePercent, 66.7);
assert.equal(comparison.phases[2].participantMeanSharePercent, 50);
assert.equal(comparison.phases[3].participantMeanSharePercent, 100);
assert.ok(comparison.phase1Note?.includes('担当国を知りません'));

const notApplicable = buildPhaseComparison(raw as any, [schedule], { dataScope: 'test' });
assert.equal(notApplicable.applicable, false);
assert.ok(notApplicable.reason.includes('本研究'));

const augmented = augmentSessionRowsWithPhase([
  { class_id: '5-1', local_date: '2026-09-17', persona_country: 'United States', assigned_partner_country: 'USA', research_schema_version: 'research-2026-v4' },
  { class_id: '5-1', local_date: '2026-10-01', persona_country: 'Bangladesh', assigned_partner_country: 'United States', research_schema_version: 'research-2026-v4' },
  { class_id: '5-1', local_date: '2026-10-08', persona_country: '', assigned_partner_country: 'United States', research_schema_version: 'research-2026-v4' },
], [schedule]);
assert.equal(augmented[0].study_phase, 'phase1');
assert.equal(augmented[0].assigned_country_persona_eligible, 1);
assert.equal(augmented[0].assigned_country_persona_match, 1);
assert.equal(augmented[1].study_phase, 'phase2');
assert.equal(augmented[1].assigned_country_persona_match, 0);
assert.equal(augmented[2].study_phase, 'phase3');
assert.equal(augmented[2].assigned_country_persona_eligible, 0);
assert.equal(augmented[2].assigned_country_persona_match, '');
assert.ok(augmented.every((row) => row.research_schema_version === PHASE_RESEARCH_EXPORT_SCHEMA_VERSION));

for (const field of ['study_phase', 'assigned_country_persona_eligible', 'assigned_country_persona_match']) {
  assert.ok(PHASE_SESSION_EXPORT_HEADERS.includes(field));
  assert.ok(PHASE_CODEBOOK_ROWS.some((row) => row.variable === field));
}
assert.equal(PHASE_RESEARCH_EXPORT_SCHEMA_VERSION, 'research-2026-v5');
assert.equal(PHASE_BUNDLE_MANIFEST_SCHEMA_VERSION, 7);

let capturedHtml = '';
const wrapped = withResearchPhaseAnalyticsRuntime('/management', ((_req: any, res: any) => res.send(managementPageHtmlWithStudyPhase())) as any);
const res: any = { send(body: any) { capturedHtml = String(body); return body; } };
wrapped({} as any, res, (() => {}) as any);
assert.ok(capturedHtml.includes('Phase別セッション数'));
assert.ok(capturedHtml.includes('担当国Persona選択率（Phase別）'));
assert.ok(capturedHtml.includes('個別利用らしいセッション（推定）'));
assert.ok(capturedHtml.includes('担当国Persona選択率のPhase別変化'));
assert.ok(capturedHtml.includes('id="chartPhaseCountry"'));
assert.ok(capturedHtml.includes('id="iBefore" hidden'), 'legacy ids must remain hidden so the base renderer cannot break');
assert.equal(capturedHtml.includes('<h3>告知前／告知後セッション</h3>'), false);
assert.equal(capturedHtml.includes('<h3>告知後・担当国Persona選択率</h3>'), false);

const source = fs.readFileSync('src/server/researchPhaseAnalyticsRuntime.ts', 'utf8');
assert.ok(source.includes('study_schedule_snapshot'));
assert.ok(source.includes("phase_comparison_filter_exclusions: ['personaId', 'studyPhase']"));
assert.ok(source.includes('assignment_country_provenance'));
const entry = fs.readFileSync('server-entry.ts', 'utf8');
assert.ok(entry.includes('withResearchPhaseAnalyticsRuntime'));

console.log('Research Phase analytics dashboard QA: PASS');
