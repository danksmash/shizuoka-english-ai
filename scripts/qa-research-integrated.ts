import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildResearchDataSets } from '../src/server/researchExport';
import { maskTextForResearchExport } from '../src/utils/privacy';

const base = Date.parse('2026-09-01T01:00:00Z');
const clustered = Array.from({ length: 8 }, (_, index) => ({
  schemaVersion: 4,
  researchSchemaVersion: 'research-2026-v1',
  researchId: `R${100001 + index}`,
  studentId: `S${100001 + index}`,
  classId: '5-1',
  sessionId: `session_class_${index}`,
  aiStudentId: 'emma_usa',
  personaId: 'emma_usa',
  topic: 'favorites',
  targetDurationMinutes: 3,
  actualDurationSeconds: 180,
  startedAt: new Date(base + index * 15_000).toISOString(),
  endedAt: new Date(base + index * 15_000 + 180_000).toISOString(),
  assignedPartnerId: 'PARTNER-01',
  assignedPartnerCountry: 'United States',
  assignmentAnnouncedAt: '2026-09-02T00:00:00.000Z',
  history: [
    { id: `a${index}`, sender: 'ai', englishText: 'I like soccer. How about you?', japaneseText: '私はサッカーが好きです。あなたは？', timestamp: base + index * 15_000 },
    { id: `c${index}`, sender: 'child', englishText: 'I like soccer. How about you?', japaneseText: '私はサッカーが好きです。あなたは？', timestamp: base + index * 15_000 + 30_000 },
    { id: `c2${index}`, sender: 'child', englishText: 'Pardon? I like it because it is fun.', japaneseText: 'もう一度お願いします。楽しいので好きです。', timestamp: base + index * 15_000 + 60_000 },
  ],
  reflection: { conveyedIdeas: 3, understoodPartner: 3, noticedLanguageCulture: 3 },
  systemEvents: [
    { type: 'session_start', timestamp: base + index * 15_000 },
    { type: 'session_finish', timestamp: base + index * 15_000 + 179_000 },
  ],
}));

const data = buildResearchDataSets(clustered as any);
assert.equal(data.sessions.length, 8);
assert.ok(data.turns.length > data.sessions.length, 'utterance rows must be preserved for later ownership/responsiveness coding');
const first = data.sessions.find((row) => row.session_id === 'session_class_0')!;
assert.equal(first.local_date, '2026-09-01');
assert.equal(first.local_start_time, '10:00:00');
assert.equal(first.same_class_starts_5min, 8);
assert.equal(first.usage_context_inferred, 'group_like');
assert.equal(first.assigned_partner_id, 'PARTNER-01');
assert.equal(first.assigned_partner_country, 'United States');
assert.equal(first.assignment_announced_at, '2026-09-02T00:00:00.000Z');
assert.equal(first.child_repair_count, 1);
assert.equal(first.child_reason_expression_count, 1);
assert.ok(!('studentId' in first));
assert.ok(!('learningId' in first));

const solo = buildResearchDataSets([{
  ...clustered[0], researchId:'RSOLO', studentId:'SSOLO', classId:'5-2', sessionId:'solo',
  startedAt:'2026-09-05T01:00:00.000Z', endedAt:'2026-09-05T01:03:00.000Z',
}] as any).sessions[0];
assert.equal(solo.same_class_starts_5min, 1);
assert.equal(solo.same_class_starts_10min, 1);
assert.equal(solo.usage_context_inferred, 'individual_like');

const noClass = buildResearchDataSets([{ ...clustered[0], sessionId:'no_class', classId:'' }] as any).sessions[0];
assert.equal(noClass.usage_context_inferred, 'unknown');

const unordered = buildResearchDataSets([
  { ...clustered[0], sessionId:'seq_b', researchId:'RSEQ', lifetimeSessionNumber:99, dailySessionNumber:99, startedAt:'2026-09-02T01:00:00.000Z', endedAt:'2026-09-02T01:03:00.000Z' },
  { ...clustered[0], sessionId:'seq_a', researchId:'RSEQ', lifetimeSessionNumber:42, dailySessionNumber:42, startedAt:'2026-09-01T01:00:00.000Z', endedAt:'2026-09-01T01:03:00.000Z' },
] as any);
assert.equal(unordered.sessions.find((row) => row.session_id === 'seq_a')?.lifetime_session_number, 1);
assert.equal(unordered.sessions.find((row) => row.session_id === 'seq_b')?.lifetime_session_number, 2);

const masked = maskTextForResearchExport('My name is Jonah Smith. I go to Kitahama Elementary School. My code is A7M4.');
for (const secret of ['Jonah Smith','Kitahama Elementary School','A7M4']) assert.equal(masked.includes(secret), false, `research export must mask ${secret}`);
assert.equal(maskTextForResearchExport('I like soccer because it is fun.'), 'I like soccer because it is fun.');

const source = fs.readFileSync('src/server/researchExport.ts','utf8');
assert.equal(source.includes('SCHOOL_START_MINUTE'), false, 'fixed school-hour boundaries must not classify use context');
assert.equal(source.includes('SCHOOL_END_MINUTE'), false, 'fixed school-hour boundaries must not classify use context');
assert.ok(source.includes("'group_like' | 'individual_like' | 'unknown'"));

const management = fs.readFileSync('src/server/managementPage.ts','utf8');
assert.equal(management.includes('教師用管理'), false, 'deleted teacher management UI must not return');
assert.ok(management.includes('告知前／告知後セッション'));
assert.ok(management.includes('担当国Persona選択率'));
assert.ok(management.includes('個別利用らしいセッション'));

console.log('Integrated research dataset QA: PASS');
