import assert from 'node:assert/strict';
import fs from 'node:fs';
import { researcherRouteAllowed } from '../src/server/auth';
import {
  QUESTIONNAIRE_EXPORT_HEADERS,
  QUESTIONNAIRE_INSTRUMENT_VERSION,
  QUESTIONNAIRE_ITEMS,
  QUESTIONNAIRE_SCORING_VERSION,
  buildQuestionnaireCodebookRows,
  buildQuestionnaireExportRows,
  buildQuestionnaireStatistics,
  calculateQuestionnaireScores,
  holmAdjust,
  pairedTTest,
  scoreQuestionnaireResponse,
  serializeQuestionnaireCsv,
  wilcoxonSignedRank,
  type QuestionnaireItemScores,
  type QuestionnaireRecord,
  type QuestionnaireWave,
} from '../src/server/questionnaireResearch';

assert.equal(QUESTIONNAIRE_ITEMS.length, 15, 'instrument must contain exactly 15 items');
assert.deepEqual(QUESTIONNAIRE_ITEMS.slice(0, 5).map((i) => i.scale), Array(5).fill('persistence'));
assert.deepEqual(QUESTIONNAIRE_ITEMS.slice(5, 10).map((i) => i.scale), Array(5).fill('self_regulation'));
assert.deepEqual(QUESTIONNAIRE_ITEMS.slice(10, 15).map((i) => i.scale), Array(5).fill('l2wtc'));
assert.equal(new Set(QUESTIONNAIRE_ITEMS.map((i) => i.sourceId)).size, 15);
assert.equal(QUESTIONNAIRE_INSTRUMENT_VERSION, 'attitude-l2wtc-20260811-v1');

assert.equal(scoreQuestionnaireResponse('よくあてはまる'), 6);
assert.equal(scoreQuestionnaireResponse('あてはまる'), 5);
assert.equal(scoreQuestionnaireResponse('まあまあ あてはまる'), 4);
assert.equal(scoreQuestionnaireResponse('あまり あてはまらない'), 3);
assert.equal(scoreQuestionnaireResponse('あてはまらない'), 2);
assert.equal(scoreQuestionnaireResponse('まったく あてはまらない'), 1);
assert.equal(scoreQuestionnaireResponse(''), null);

const all6 = Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item) => [item.id, 6])) as QuestionnaireItemScores;
const scored = calculateQuestionnaireScores(all6);
assert.equal(scored.attitudeSum, 60);
assert.equal(scored.attitudeMean, 6);
assert.equal(scored.totalSum, 90);
assert.equal(scored.totalMean, 6);
assert.equal(scored.persistenceSum, 30);
assert.equal(scored.selfRegulationSum, 30);
assert.equal(scored.l2wtcSum, 30);

const separatedItems = Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item) => [item.id, item.scale === 'l2wtc' ? 6 : 1])) as QuestionnaireItemScores;
const separatedScores = calculateQuestionnaireScores(separatedItems);
assert.equal(separatedScores.attitudeMean, 1, 'attitude must use only the 10 attitude items');
assert.equal(separatedScores.l2wtcMean, 6);
assert.notEqual(separatedScores.totalMean, separatedScores.attitudeMean, 'legacy all-15 mean must not be used as attitude');

const tt = pairedTTest([1,2,3,4,5], [2,3,4,5,6]);
assert.equal(tt.n, 5);
assert.equal(tt.df, 4);
assert.equal(tt.cohenDz, null, 'zero SD with non-zero constant change must not fabricate dz');
const tt2 = pairedTTest([1,2,3,4,5], [1,3,4,6,6]);
assert.equal(tt2.n, 5);
assert.ok(typeof tt2.p === 'number' && tt2.p >= 0 && tt2.p <= 1);
assert.ok(typeof tt2.cohenDz === 'number');

const wx = wilcoxonSignedRank([1,2,3,4,5], [2,3,4,5,6]);
assert.equal(wx.n, 5);
assert.equal(wx.method, 'exact');
assert.equal(wx.rankBiserial, 1);
assert.ok(typeof wx.p === 'number' && wx.p > 0 && wx.p <= 1);
const wxZeros = wilcoxonSignedRank([1,2,3], [1,2,3]);
assert.equal(wxZeros.n, 0);
assert.equal(wxZeros.p, 1);

assert.deepEqual(holmAdjust([0.01,0.02,0.2]), [0.03,0.04,0.2]);

function itemScores(base: number): QuestionnaireItemScores {
  return Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item, index) => [item.id, Math.max(1, Math.min(6, base + (index % 2)))])) as QuestionnaireItemScores;
}
function record(rid: string, classId: string, wave: QuestionnaireWave, base: number, suffix = ''): QuestionnaireRecord {
  const items = itemScores(base); const scores = calculateQuestionnaireScores(items);
  return {
    responseId:`q-${rid}-${wave}${suffix}`,researchId:rid,classId,gradeLevel:classId.startsWith('5-')?5:6,dataScope:'main',surveyWave:wave,
    surveyDate:wave==='pre_app'?'2026-09-16':wave==='mid_pre_reveal'?'2026-10-01':'2026-10-20',submittedAt:wave==='pre_app'?'2026-09-16T00:00:00.000Z':wave==='mid_pre_reveal'?'2026-10-01T00:00:00.000Z':'2026-10-20T00:00:00.000Z',instrumentVersion:QUESTIONNAIRE_INSTRUMENT_VERSION,
    items,...scores,dataQualityFlag:'complete',importedAt:'2026-09-12T00:00:00.000Z',
  };
}
const records: QuestionnaireRecord[] = [];
for (let i=0;i<12;i+=1) { const rid=`R5-${i}`;records.push(record(rid,'5-1','pre_app',3+(i%2)),record(rid,'5-1','mid_pre_reveal',3+(i%2)),record(rid,'5-1','post_pre_exchange',4+(i%2))); }
for (let i=0;i<10;i+=1) { const rid=`R6-${i}`;records.push(record(rid,'6-1','pre_app',3+(i%2)),record(rid,'6-1','mid_pre_reveal',3+(i%2)),record(rid,'6-1','post_pre_exchange',3+(i%2))); }
records.push(record('R-DUP','5-2','pre_app',3,'a'),record('R-DUP','5-2','pre_app',4,'b'),record('R-DUP','5-2','mid_pre_reveal',4),record('R-DUP','5-2','post_pre_exchange',5));
const stats = buildQuestionnaireStatistics(records);
assert.equal(stats.counts.preUnique,22);
assert.equal(stats.counts.midUnique,23);
assert.equal(stats.counts.postUnique,23);
assert.equal(stats.counts.complete3,22,'duplicate pre wave must be excluded from complete three-wave set');
assert.equal(stats.counts.preMidPaired,22);
assert.equal(stats.counts.midPostPaired,23);
assert.equal(stats.counts.prePostPaired,22);
assert.equal(stats.counts.paired,22,'legacy paired alias remains Pre/Post');
assert.equal(stats.counts.duplicateWaveKeys,1);
assert.equal(stats.rows.length,32,'4 metrics x 8 groups required');
assert.ok(stats.rows.some((row) => row.groupId==='all' && row.metric==='l2wtc'));
assert.ok(stats.rows.some((row) => row.groupId==='all' && row.metric==='attitude'));
assert.equal(stats.rows.some((row) => String(row.metric)==='total'), false, 'legacy all-15 score must not appear as a research outcome');
assert.ok(stats.rows.every((row) => row.tHolmP===null || (row.tHolmP>=0 && row.tHolmP<=1)));
assert.ok(stats.rows.every((row) => row.wilcoxonHolmP===null || (row.wilcoxonHolmP>=0 && row.wilcoxonHolmP<=1)));

const exportRows = buildQuestionnaireExportRows(records,{dataScope:'main',grade:'5',classId:'1'});
assert.ok(exportRows.length>0);
assert.ok(exportRows.every((row) => row.class_id==='5-1'));
assert.ok(exportRows.every((row) => !('learning_id' in row) && !('student_id' in row) && !('learning_code' in row)));
const csv = serializeQuestionnaireCsv(exportRows);
for (const header of QUESTIONNAIRE_EXPORT_HEADERS) assert.ok(csv.includes(`"${header}"`),`missing questionnaire header ${header}`);
assert.ok(!csv.includes('learning_code') && !csv.includes('learning_id') && !csv.includes('student_id'));

const codebook = buildQuestionnaireCodebookRows();
assert.equal(codebook.length, QUESTIONNAIRE_EXPORT_HEADERS.length);
assert.ok(codebook.every((row) => row.file_name==='student_questionnaires.csv'));
assert.ok(codebook.some((row) => row.variable==='q1_1' && String(row.definition).includes('逆転なし')));
assert.ok(codebook.some((row) => row.variable==='survey_wave' && String(row.allowed_values).includes('mid_pre_reveal')));
assert.ok(codebook.some((row) => row.variable==='survey_order' && String(row.allowed_values).includes('1 | 2 | 3')));
assert.ok(codebook.some((row) => row.variable==='attitude_mean' && String(row.definition).includes('10項目')));
assert.ok(codebook.some((row) => row.variable==='total_mean' && String(row.definition).includes('後方互換')));
assert.ok(codebook.some((row) => row.variable==='scoring_version' && row.allowed_values===QUESTIONNAIRE_SCORING_VERSION));
assert.ok(csv.includes('"attitude_mean"') && csv.includes('"scoring_version"'));

assert.equal(researcherRouteAllowed({ path: '/questionnaire/statistics' } as any), true, 'mounted questionnaire statistics route must be researcher-accessible');
assert.equal(researcherRouteAllowed({ path: '/questionnaire/import' } as any), true, 'mounted questionnaire import route must be researcher-accessible');
assert.equal(researcherRouteAllowed({ path: '/api/management/questionnaire/statistics' } as any), true, 'full questionnaire statistics route must be researcher-accessible');
assert.equal(researcherRouteAllowed({ path: '/api/management/questionnaire/import' } as any), true, 'full questionnaire import route must be researcher-accessible');
assert.equal(researcherRouteAllowed({ path: '/questionnaire/analysis' } as any), true, 'mounted questionnaire analysis route must be researcher-accessible');
assert.equal(researcherRouteAllowed({ path: '/api/management/questionnaire/analysis' } as any), true, 'full questionnaire analysis route must be researcher-accessible');
assert.equal(researcherRouteAllowed({ path: '/api/management/questionnaire/lmm-trial' } as any), true, 'trial LMM route must remain researcher-accessible');
assert.equal(researcherRouteAllowed({ path: '/unrelated-sensitive-route' } as any), false, 'researcher allowlist must remain narrow');

const entry = fs.readFileSync('server-entry.ts','utf8');
const runtime = fs.readFileSync('src/server/questionnaireDashboardRuntime.ts','utf8');
const routes = fs.readFileSync('src/server/questionnaireRoutes.ts','utf8');
const page = fs.readFileSync('public/questionnaire-analysis.html','utf8');
const management = fs.readFileSync('src/server/managementPage.ts','utf8');
assert.ok(entry.includes('createQuestionnaireRouter'));
assert.ok(entry.includes('withQuestionnaireResearchRuntime'));
assert.ok(routes.includes("router.post('/questionnaire/statistics'"), 'statistics must use POST because mounted research routers come after the production GET catch-all');
assert.ok(routes.includes("router.post('/questionnaire/analysis'"), 'dedicated questionnaire analysis endpoint must use POST');
assert.ok(!routes.includes("router.get('/questionnaire/statistics'"));
assert.ok(page.includes("api('/api/management/questionnaire/analysis'"));
assert.ok(page.includes('/api/management/research.csv?dataset=student_questionnaires'));
assert.ok(page.includes('Study 1 3時点質問紙分析'));
assert.ok(page.includes('3時点完備 N'));
assert.ok(page.includes('試験的LMM分析（研究者用）'));
assert.ok(page.includes('/api/management/questionnaire/lmm-trial'));
assert.equal(page.includes('Holm補正後 p &lt; .05'), false);
assert.ok(management.includes('href="/questionnaire-analysis.html"'));
assert.equal(management.includes('id="questionnaireSection"'), false, 'questionnaire analysis must be detached from Research Dashboard HTML');
assert.ok(runtime.includes('student_questionnaires.csv'));
assert.ok(runtime.includes('schema_version: 7'));
assert.equal(runtime.includes('questionnairePromise'), false, 'Research Dashboard must not wait for questionnaire Firestore reads');
assert.equal(runtime.includes('questionnaireRowCount'), false, 'Research Dashboard payload must not depend on questionnaire row count');
assert.equal(runtime.includes('injectQuestionnaireUi'), false, 'questionnaire UI must live on its dedicated page');
assert.equal(runtime.includes("path === '/api/management/research.dashboard'"), false, 'questionnaire export runtime must not wrap the Research Dashboard');
assert.equal(entry.includes('withQuestionnaireAutoSyncDashboardRuntime'), false, 'legacy questionnaire dashboard UI wrapper must not be mounted');
assert.equal(entry.includes('withQuestionnaireDescriptiveDashboardRuntime'), false, 'legacy questionnaire descriptive UI wrapper must not be mounted');
assert.ok(!runtime.includes('改善＝'));

console.log('Study 1 questionnaire research QA: PASS');
