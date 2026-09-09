import assert from 'node:assert/strict';
import { filterResearchExportDataSets, normalizeFormalResearchExportQuery, researchDataScopeForRow } from '../src/server/researchDashboard';

const ids = ['teacher-pretest','pb5','pb6','main5','main6','explicit-test','reserve'];
const data: any = {
  sessions: [
    { session_id:'teacher-pretest', class_id:'6-PB', grade_level:6, local_date:'2026-09-08', data_quality_flag:'complete' },
    { session_id:'pb5', class_id:'5-PB', grade_level:5, local_date:'2026-09-09', data_quality_flag:'complete' },
    { session_id:'pb6', class_id:'6-PB', grade_level:6, local_date:'2026-09-09', data_quality_flag:'complete' },
    { session_id:'main5', class_id:'5-1', grade_level:5, local_date:'2026-09-09', data_quality_flag:'complete' },
    { session_id:'main6', class_id:'6-1', grade_level:6, local_date:'2026-09-09', data_quality_flag:'complete' },
    { session_id:'explicit-test', class_id:'テスト', grade_level:'', local_date:'2026-09-08', data_quality_flag:'complete' },
    { session_id:'reserve', class_id:'予備', grade_level:'', local_date:'2026-09-08', data_quality_flag:'complete' },
  ],
  utterances: ids.map((session_id) => ({ session_id, utterance_id:session_id+'-1' })),
  expressions: ids.map((session_id) => ({ session_id, utterance_id:session_id+'-1' })),
  personas: [{ persona_id:'emma_usa' }],
  codebook: [{ file_name:'sessions.csv' }],
};

assert.equal(researchDataScopeForRow(data.sessions[0]), 'test');
assert.equal(researchDataScopeForRow(data.sessions[1]), 'pilot_b');
assert.equal(researchDataScopeForRow(data.sessions[2]), 'pilot_b');
assert.equal(researchDataScopeForRow(data.sessions[3]), 'main');
assert.equal(researchDataScopeForRow(data.sessions[5]), 'test');
assert.equal(researchDataScopeForRow(data.sessions[6]), 'reserve');

const pilot = filterResearchExportDataSets(data, { dataScope:'pilot_b' });
assert.deepEqual(pilot.sessions.map((row:any) => row.session_id), ['pb5','pb6']);
assert.deepEqual(pilot.utterances.map((row:any) => row.session_id), ['pb5','pb6']);
assert.deepEqual(pilot.expressions.map((row:any) => row.session_id), ['pb5','pb6']);
assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'pilot_b', grade:'6' }).sessions.map((row:any) => row.session_id), ['pb6']);

assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'test' }).sessions.map((row:any) => row.session_id), ['teacher-pretest','explicit-test']);
assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'main' }).sessions.map((row:any) => row.session_id), ['main5','main6']);
assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'main', grade:'6' }).sessions.map((row:any) => row.session_id), ['main6']);
assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'reserve' }).sessions.map((row:any) => row.session_id), ['reserve']);

assert.equal(normalizeFormalResearchExportQuery({}).dataScope, 'main');
assert.equal(normalizeFormalResearchExportQuery({ dataScope:'all' }).dataScope, 'main');
assert.equal(normalizeFormalResearchExportQuery({ dataScope:'pilot_b' }).dataScope, 'pilot_b');
assert.equal(normalizeFormalResearchExportQuery({ dataScope:'test' }).dataScope, 'test');

console.log('Pilot B / main / test / reserve data-scope isolation QA: PASS');
