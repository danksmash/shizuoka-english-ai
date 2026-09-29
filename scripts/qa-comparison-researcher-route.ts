import assert from 'node:assert/strict';
import { researcherRouteAllowed } from '../src/server/auth';

for (const path of [
  '/comparison-participants/setup',
  '/comparison-participants/bootstrap',
  '/comparison-participants/activate',
  '/comparison-participants/activate-reserve',
  '/api/management/comparison-participants/setup',
  '/api/management/comparison-participants/bootstrap',
  '/api/management/comparison-participants/activate',
  '/api/management/comparison-participants/activate-reserve',
]) {
  assert.equal(researcherRouteAllowed({ path } as any), true, `researcher should be allowed: ${path}`);
}

for (const path of [
  '/students',
  '/api/management/students',
  '/teacher/students',
]) {
  assert.equal(researcherRouteAllowed({ path } as any), false, `researcher anonymity guard must remain: ${path}`);
}

console.log('Comparison researcher route allowlist QA: PASS');
