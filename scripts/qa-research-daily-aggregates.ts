import assert from 'node:assert/strict';
import {
  buildResearchDailyContribution,
  researchDailyContributionKey,
  syncResearchDailyAggregateContribution,
} from '../src/server/researchDailyAggregates';

const base = {
  sessionId: 'session-1', researchId: 'R001', classId: '5-1', localDate: '2026-10-07',
  personaId: 'emma_usa', personaCountry: 'United States', assignedPartnerCountry: 'United States',
  actualDurationSeconds: 180, totalTurns: 8, totalChildWords: 42,
  reflection: { understoodPartner: 3, conveyedIdeas: 4, noticedLanguageCulture: 2 },
  updatedAt: '2026-10-07T01:00:00.000Z',
};

const contribution = buildResearchDailyContribution(base);
assert.equal(contribution.totalChildWords, 42);
assert.equal(contribution.reflectionConveyed, 4);
assert.equal('sessionId' in contribution, false, 'daily aggregate values must not duplicate raw session identifiers');
assert.equal(researchDailyContributionKey('session-1'), researchDailyContributionKey('session-1'));
assert.notEqual(researchDailyContributionKey('session-1'), researchDailyContributionKey('session-2'));

const calls: Array<{ type: string; collection: string; id: string; path: string; value?: unknown }> = [];
const writer = {
  patch: async (collection: string, id: string, path: string, value: unknown) => { calls.push({ type:'patch', collection, id, path, value }); },
  remove: async (collection: string, id: string, path: string) => { calls.push({ type:'remove', collection, id, path }); },
};

await syncResearchDailyAggregateContribution(null, base, writer);
await syncResearchDailyAggregateContribution(base, { ...base, totalChildWords: 50, reflection: { ...base.reflection, conveyedIdeas: 3 } }, writer);
assert.equal(calls.length, 2, 'repeat saves overwrite the same contribution instead of incrementing');
assert.equal(calls[0].path, calls[1].path);
assert.equal((calls[1].value as any).totalChildWords, 50);

await syncResearchDailyAggregateContribution(base, { ...base, localDate:'2026-10-08' }, writer);
assert.equal(calls.at(-2)?.type, 'remove');
assert.equal(calls.at(-2)?.id, '2026-10-07');
assert.equal(calls.at(-1)?.type, 'patch');
assert.equal(calls.at(-1)?.id, '2026-10-08');

assert.throws(() => buildResearchDailyContribution({ ...base, localDate:'bad' }), /LOCAL_DATE_INVALID/);
console.log('Research daily aggregate shadow-write QA: PASS');
