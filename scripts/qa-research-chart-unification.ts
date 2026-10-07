import assert from 'node:assert/strict';
import fs from 'node:fs';
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
assert.match(sentBody, /授業内のみ｜累積平均（セッション単位）｜授業外利用は除外/);
assert.match(sentBody, /turns\.innerHTML=classSeriesSvg\(charts\.cumulativeTurnsByClass/);
assert.match(sentBody, /words\.innerHTML=classSeriesSvg\(charts\.cumulativeWordsByClass/);
assert.match(sentBody, /function conditionColors\(condition\)/);
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

console.log('Research dashboard chart unification QA: PASS');
