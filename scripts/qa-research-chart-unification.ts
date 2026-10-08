import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { withResearchDashboardChartUnification } from '../src/server/researchDashboardChartUnificationRuntime';

let sentBody = '';
const res: any = {
  send(body: unknown) {
    sentBody = String(body ?? '');
    return body;
  },
};
const handler = withResearchDashboardChartUnification(
  '/management',
  ((_req: any, response: any) => response.send('<html><body><div id="chartTurns"></div></body></html>')) as any,
);
handler({} as any, res, (() => undefined) as any);

assert.match(sentBody, /researchDashboardChartUnificationStyle/);
assert.match(sentBody, /researchDashboardChartUnification/);
assert.match(sentBody, /research-chart-left-stack/);
assert.match(sentBody, /grid-template-rows:minmax\(0,1fr\) minmax\(0,1fr\)/);
assert.match(sentBody, /W=460,H=245,LEFT=56,RIGHT=15,BOTTOM=43,LINE_WIDTH=1\.6/);
assert.match(sentBody, /unified-line-axis/);
assert.match(sentBody, /font-size:10px/);
assert.match(sentBody, /unified-line-legend/);
assert.match(sentBody, /font-size:9px/);
assert.match(sentBody, /ensureSeparateCards/);
assert.match(sentBody, /research-turns-card/);
assert.match(sentBody, /daily-class-stack-card/);
assert.match(sentBody, /cumulativeWordsByClass/);
assert.match(sentBody, /lessonCumulativeReflection/);
assert.match(sentBody, /reflectionSvg/);
assert.match(sentBody, /observed===false/);
// Cumulative values can be carried forward for API consumers, but unobserved dates must not create line vertices.
assert.match(sentBody, /if\(valid\(p\.value\)&&p\.observed!==false\)points\.push/);
assert.match(sentBody, /if\(valid\(r\[item\.key\]\)&&r\[item\.observed\]!==false\)/);
assert.match(sentBody, /授業内のみ｜累積平均（セッション単位）｜授業外利用は除外/);
assert.match(sentBody, /turns\.innerHTML=classSeriesSvg\(charts\.cumulativeTurnsByClass/);
assert.match(sentBody, /words\.innerHTML=classSeriesSvg\(charts\.cumulativeWordsByClass/);
assert.match(sentBody, /function conditionColors\(condition\)/);
assert.match(sentBody, /school_condition==='comparison'\|\|\/\^\[1-9\]-C\[1-9\]\$\/i/);
assert.match(sentBody, /condition==='comparison'[\s\S]*\? \['#f59e0b'\]/);
assert.match(sentBody, /label:'新しい言葉や文化に気づいた',color:'#f59e0b'/);
assert.doesNotMatch(sentBody, /#c2410c|#ea580c|#f97316|#fb923c|#9a3412|#fdba74/);
assert.doesNotMatch(sentBody, /#047857|#059669|#10b981|#34d399|#065f46|#6ee7b7/);
assert.match(sentBody, /function classShape\(classId\)/);
assert.match(sentBody, /stroke-width="'\+LINE_WIDTH\+'"/);
assert.doesNotMatch(sentBody, /patchTurnsLineWidth/);

const serverEntry = fs.readFileSync(new URL('../server-entry.ts', import.meta.url), 'utf8');
assert.match(serverEntry, /withResearchDashboardChartUnification/);
assert.ok(
  serverEntry.indexOf('withResearchWordsByClassRuntime(path')
    < serverEntry.indexOf('withResearchDashboardChartUnification(path'),
  'chart unification runtime must wrap after words-by-class runtime',
);

const polish = fs.readFileSync(
  new URL('../src/server/researchReflectionChartPolishRuntime.ts', import.meta.url),
  'utf8',
);
assert.match(polish, /setAttribute\('stroke-width','1\.6'\)/);
assert.match(polish, /setAttribute\('stroke-width','1\.8'\)/);
assert.doesNotMatch(polish, /setAttribute\('stroke-width','2\.25'\)/);


// Render the actual injected browser script, not only its text, so missing-day
// cumulative averages cannot silently split a trend again.
const injectedScript = sentBody.match(/<script id="researchDashboardChartUnification">([\s\S]*?)<\/script>/)?.[1];
assert.ok(injectedScript, 'unified chart browser script should be injected');
const reflectionElement = { innerHTML: '' };
const wordElement = { innerHTML: '' };
const turnElement = { innerHTML: '' };
const browser: any = {
  window: {},
  document: {
    getElementById(id: string) {
      if (id === 'chartReflection') return reflectionElement;
      if (id === 'chartWords') return wordElement;
      if (id === 'chartTurns') return turnElement;
      return null;
    },
  },
  renderDashboard() {},
};
runInNewContext(injectedScript, browser);

function reflectionTestRow(date: string, observed: boolean, a: number, b: number, c: number) {
  return {
    date,
    reflection_understood: a,
    reflection_understood_n: observed ? 2 : 0,
    reflection_understood_observed: observed,
    reflection_conveyed: b,
    reflection_conveyed_n: observed ? 2 : 0,
    reflection_conveyed_observed: observed,
    reflection_culture: c,
    reflection_culture_n: observed ? 2 : 0,
    reflection_culture_observed: observed,
  };
}
const gapRows = [
  reflectionTestRow('2026-09-17', true, 2.6, 2.8, 2.4),
  reflectionTestRow('2026-09-18', false, 2.6, 2.8, 2.4),
  reflectionTestRow('2026-09-19', true, 2.8, 2.9, 2.5),
  reflectionTestRow('2026-09-20', false, 2.8, 2.9, 2.5),
  reflectionTestRow('2026-09-21', true, 2.9, 3.0, 2.7),
];
browser.window.renderDashboard({ charts: { lessonCumulativeReflection: gapRows } });
const gapSvg = reflectionElement.innerHTML;
const observedPaths = [...gapSvg.matchAll(/<polyline points="([^"]+)"/g)];
assert.equal(observedPaths.length, 3, 'all three reflection trends must be continuous');
for (const path of observedPaths) {
  const xPositions = path[1].split(' ').map(point => Number(point.split(',')[0]));
  assert.deepEqual(xPositions, [56, 250.5, 445], 'connect observed dates 1, 3, 5 without filling gaps');
}
assert.equal((gapSvg.match(/<title>/g) || []).length, 9, 'draw 3 marks per item on observed days only');

const singleRow = gapRows.map((row, i) => ({
  ...row,
  reflection_understood_observed: i === 0,
  reflection_conveyed_observed: i === 0,
  reflection_culture_observed: i === 0,
}));
browser.window.renderDashboard({ charts: { lessonCumulativeReflection: singleRow } });
assert.doesNotMatch(reflectionElement.innerHTML, /<polyline /, 'a single observed date must not draw a line');
assert.equal((reflectionElement.innerHTML.match(/<title>/g) || []).length, 3, 'single day has only 3 marks');


// With the same observed values, word/min uses a tighter automatic axis while
// turn/min keeps the prior shared renderer's original y-axis behavior.
const axisNumbers = (svg: string) => [...svg.matchAll(/<text x="39" y="[^"]+" text-anchor="middle" class="unified-line-axis">([^<]+)<\/text>/g)]
  .map(match => Number(match[1]));
const wordExample = [
  { class_id: '5-2', label: '5年2組', school_condition: 'intervention', points: [
    {date:'2026-10-07',value:9.3,n:1,observed:true},
  ] },
  { class_id: '5-3', label: '5年3組', school_condition: 'intervention', points: [
    {date:'2026-09-17',value:13.7,n:1,observed:true},
  ] },
];
browser.window.renderDashboard({ charts: {
  cumulativeWordsByClass: wordExample,
  cumulativeTurnsByClass: wordExample,
} });
assert.deepEqual(axisNumbers(wordElement.innerHTML), [9,10,11,12,13,14],
  'word/min y-axis should fit representative values 9.3–13.7 instead of 6–16');
assert.deepEqual(axisNumbers(turnElement.innerHTML), [6,8,10,12,14,16],
  'turn/min y-axis must remain unchanged');
assert.match(wordElement.innerHTML, /9\.3 語\/分/, 'low observed word value must be retained');
assert.match(wordElement.innerHTML, /13\.7 語\/分/, 'high observed word value must be retained');

const laterWords = [{ class_id: '5-3', label: '5年3組', school_condition: 'intervention', points: [
  {date:'2026-10-08',value:24.1,n:1,observed:true},
  {date:'2026-10-09',value:24.8,n:2,observed:true},
]}];
browser.window.renderDashboard({ charts: { cumulativeWordsByClass: laterWords } });
const laterTicks = axisNumbers(wordElement.innerHTML);
assert.ok(laterTicks[0] <= 24.1 && laterTicks.at(-1)! >= 24.8,
  'future word/min values must remain inside an automatically expanded axis');
assert.ok(laterTicks.at(-1)! - laterTicks[0] < 3,
  'small future word/min differences should not get excessively padded');

console.log('Research dashboard chart unification QA: PASS');
