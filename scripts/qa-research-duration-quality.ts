import assert from 'node:assert/strict';
import { assessResearchDuration, rateEligibleDurationSeconds } from '../src/server/researchDurationQuality';

const ordinary = { target_duration_minutes: 2, actual_duration_seconds: 120 };
assert.equal(assessResearchDuration(ordinary).quality, 'valid');
assert.equal(rateEligibleDurationSeconds(ordinary), 120);
assert.equal(rateEligibleDurationSeconds({ target_duration_minutes: 2, actual_duration_seconds: 3600 }), null);
assert.equal(assessResearchDuration({ target_duration_minutes: 2, actual_duration_seconds: 3600 }).reason, 'wall_clock_3600_cap');
assert.equal(assessResearchDuration({ target_duration_minutes: 5, actual_duration_seconds: 900 }).quality, 'needs_review');
assert.equal(assessResearchDuration({ target_duration_minutes: 1, actual_duration_seconds: 290 }).quality, 'needs_review');
assert.equal(rateEligibleDurationSeconds({ target_duration_minutes: 1, actual_duration_seconds: 0 }), null);
assert.equal(rateEligibleDurationSeconds({ target_duration_minutes: 5, actual_duration_seconds: 230, duration_quality: 'valid' }), 230);
assert.equal(rateEligibleDurationSeconds({ target_duration_minutes: 5, actual_duration_seconds: 230, duration_quality: 'invalid' }), null);
console.log('Research duration QA PASS');
