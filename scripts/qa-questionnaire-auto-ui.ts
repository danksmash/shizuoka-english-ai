import assert from 'node:assert/strict';
import { removeQuestionnaireManualImportUi } from '../src/server/questionnaireAutoSyncDashboardRuntime';

const source = `<section id="questionnaireSection"><div class="q-controls"><label>調査時点<select id="qWave"><option value="pre_app">事前 pre_app</option><option value="post_exchange">事後 post_exchange</option></select></label><label>Google Forms回答CSV<input id="qCsvFile" type="file" accept=".csv,text/csv"></label><button id="qImportBtn" class="secondary">回答CSVを取り込む</button><a href="/api/management/research.csv?dataset=student_questionnaires"><button class="secondary" type="button">質問紙CSV</button></a></div><script>q$('qImportBtn').addEventListener('click',importCsv);</script></section>`;

const transformed = removeQuestionnaireManualImportUi(source);
assert.ok(!transformed.includes('id="qWave"'), 'manual pre/post selector must not be shown');
assert.ok(!transformed.includes('Google Forms回答CSV'), 'manual CSV file label must not be shown');
assert.ok(!transformed.includes('id="qCsvFile"'), 'manual CSV file input must not be shown');
assert.ok(!transformed.includes('id="qImportBtn"'), 'manual CSV import button must not be shown');
assert.ok(transformed.includes('dataset=student_questionnaires'), 'questionnaire CSV export must remain available');
assert.ok(transformed.includes("if(q$('qImportBtn'))q$('qImportBtn').addEventListener('click',importCsv);"), 'legacy import listener must be null-safe after controls are removed');

console.log('Study 1 questionnaire auto-sync dashboard UI QA: PASS');
