import assert from 'node:assert/strict';
import vm from 'node:vm';
import { managementPageHtml } from '../src/server/managementPage';

const html = managementPageHtml();
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error('management script missing');

const elements = new Map<string, any>();
function element(id: string) {
  if (!elements.has(id)) {
    const classes = new Set<string>();
    elements.set(id, {
      id, value: '', checked: false, innerHTML: '', textContent: '', style: {}, options: [], dataset: {},
      classList: { add: (...xs: string[]) => xs.forEach((x) => classes.add(x)), remove: (...xs: string[]) => xs.forEach((x) => classes.delete(x)), contains: (x: string) => classes.has(x) },
      addEventListener: () => {}, appendChild: () => {}, remove: () => {}, click: () => {},
    });
  }
  return elements.get(id);
}
const documentStub = {
  getElementById: (id: string) => element(id),
  querySelectorAll: () => [] as any[],
  createElement: (tag: string) => element('created-' + tag + '-' + Math.random()),
  body: { appendChild: () => {} },
};
const context: any = {
  console, document: documentStub, window: {}, location: { reload: () => {} }, alert: () => {},
  fetch: async () => ({ ok: false, json: async () => ({}) }),
  URL, URLSearchParams, Blob, Set, Map, Math, Number, String, Array, Object, Date,
  setTimeout: () => 0, clearTimeout: () => {},
};
vm.createContext(context);
vm.runInContext(match[1], context, { filename: 'management-data-sync.js' });

assert.equal(context.periodKey('2026-08-28', 'day'), '2026-08-28');
assert.equal(context.periodKey('2026-08-28', 'week'), '2026-08-24~2026-08-30', 'Weekly key must display the full Monday-Sunday range');
assert.equal(context.periodKey('2026-08-29', 'month'), '2026-08');

context.researchData = [
  { research_id:'R-A', class_id:'', session_id:'s1', local_date:'2026-08-28', total_turns:'2', total_child_words:'10', actual_duration_seconds:'60', lifetime_session_number:'1', data_quality_flag:'complete', reflection_conveyed_ideas:'3', reflection_understood_partner:'4', reflection_noticed_language_culture:'3', topic:'shizuoka_culture' },
  { research_id:'R-A', class_id:'', session_id:'s2', local_date:'2026-08-29', total_turns:'4', total_child_words:'30', actual_duration_seconds:'120', lifetime_session_number:'2', data_quality_flag:'complete', reflection_conveyed_ideas:'4', reflection_understood_partner:'4', reflection_noticed_language_culture:'5', topic:'talents' },
  { research_id:'R-B', class_id:'5-1', session_id:'s3', local_date:'2026-08-29', total_turns:'6', total_child_words:'50', actual_duration_seconds:'180', lifetime_session_number:'1', data_quality_flag:'complete', reflection_conveyed_ideas:'5', reflection_understood_partner:'5', reflection_noticed_language_culture:'5', topic:'favorites' },
];
element('researchStart').value = '2026-08-28';
element('researchEnd').value = '2026-08-29';
element('researchDashboardClass').value = 'all';
element('researchMetric').value = 'words';
context.researchAgg = 'day';
context.updateResearchDashboard();
assert.equal(element('researchSessions').textContent, 3);
assert.ok(element('researchLegend').innerHTML.includes('すべて'));
assert.ok(!element('researchLegend').innerHTML.includes('学級未設定'), 'all scope must not be mislabeled as unassigned class');
assert.ok(element('researchChart').innerHTML.includes('08/28') && element('researchChart').innerHTML.includes('08/29'), 'daily chart must show each selected date');
assert.ok(element('researchConditionSummary').textContent.includes('日別'));
assert.ok(element('researchUsageSummary').innerHTML.includes('静岡のじまん＆世界の文化'));
assert.ok(element('researchUsageSummary').innerHTML.includes('できること・得意なこと'));
assert.ok(element('researchMedianLabel').textContent.includes('発話語数'));
assert.ok(element('researchStageSummary').innerHTML.includes('語'));

// Changing analysis metric must update both descriptive/stat cards and lifetime-stage summary.
element('researchMetric').value = 'turns';
context.updateResearchDashboard();
assert.ok(element('researchMedianLabel').textContent.includes('ターン数'));
assert.ok(element('researchStageSummary').innerHTML.includes('回'));
assert.ok(!element('researchStageSummary').innerHTML.includes('語</b>'), 'stage summary must not remain hard-wired to word count');

// Date and class dropdowns must filter every dependent R2 summary consistently.
element('researchDashboardClass').value = '5-1';
context.updateResearchDashboard();
assert.equal(element('researchSessions').textContent, 1);
assert.ok(element('researchConditionSummary').textContent.includes('対象: 5-1'));
element('researchDashboardClass').value = 'all';
element('researchStart').value = '2026-08-29';
context.updateResearchDashboard();
assert.equal(element('researchSessions').textContent, 2);
assert.ok(!element('researchChart').innerHTML.includes('08/28'));

console.log('Dashboard data/filter synchronization QA: PASS');
