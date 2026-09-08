import assert from 'node:assert/strict';
import { filterResearchExportDataSets } from '../src/server/researchDashboard';

const data: any = {
  sessions: [
    { session_id:'pb5', class_id:'5-PB', grade_level:5, local_date:'2026-09-08', data_quality_flag:'complete' },
    { session_id:'pb6', class_id:'6-PB', grade_level:6, local_date:'2026-09-08', data_quality_flag:'complete' },
    { session_id:'main5', class_id:'5-1', grade_level:5, local_date:'2026-09-08', data_quality_flag:'complete' },
    { session_id:'reserve', class_id:'予備', grade_level:'', local_date:'2026-09-08', data_quality_flag:'complete' },
    { session_id:'test', class_id:'テスト', grade_level:'', local_date:'2026-09-08', data_quality_flag:'complete' },
  ],
  utterances: [
    { session_id:'pb5', utterance_id:'pb5-1' },
    { session_id:'pb6', utterance_id:'pb6-1' },
    { session_id:'main5', utterance_id:'main5-1' },
  ],
  expressions: [
    { session_id:'pb5', utterance_id:'pb5-1' },
    { session_id:'pb6', utterance_id:'pb6-1' },
    { session_id:'main5', utterance_id:'main5-1' },
  ],
  personas: [{ persona_id:'emma_usa' }],
  codebook: [{ file_name:'sessions.csv' }],
};

const pilot = filterResearchExportDataSets(data, { classId:'pilotb' });
assert.deepEqual(pilot.sessions.map((row:any) => row.session_id), ['pb5','pb6']);
assert.deepEqual(pilot.utterances.map((row:any) => row.session_id), ['pb5','pb6']);
assert.deepEqual(pilot.expressions.map((row:any) => row.session_id), ['pb5','pb6']);
assert.equal(pilot.personas.length, 1);
assert.equal(pilot.codebook.length, 1);

const grade5Pilot = filterResearchExportDataSets(data, { classId:'pilotb', grade:'5' });
assert.deepEqual(grade5Pilot.sessions.map((row:any) => row.session_id), ['pb5']);

const grade6Pilot = filterResearchExportDataSets(data, { classId:'pilotb', grade:'6' });
assert.deepEqual(grade6Pilot.sessions.map((row:any) => row.session_id), ['pb6']);

console.log('Pilot B research isolation QA: PASS');
