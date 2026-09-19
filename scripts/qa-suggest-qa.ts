import assert from 'node:assert/strict';
import { suggestQa } from './qa-suggest';

const docs = suggestQa(['docs/QA_OPERATING_CONTRACT.md']);
assert.deepEqual(docs.groups, []);
assert.equal(docs.risk, 'low');

const dashboard = suggestQa(['src/server/managementPage.ts']);
assert.deepEqual(dashboard.groups, ['qa:research-stack']);
assert.equal(dashboard.risk, 'medium');

const persona = suggestQa(['src/data/personaResearch.ts']);
assert.deepEqual(persona.groups, ['qa:persona-stack']);
assert.equal(persona.risk, 'medium');

const voice = suggestQa(['src/server/azureTts.ts']);
assert.deepEqual(voice.groups, ['qa:foundation', 'qa:voice-stack']);
assert.equal(voice.risk, 'medium');

const persistence = suggestQa(['src/server/persistence.ts']);
assert.deepEqual(persistence.groups, ['qa:foundation', 'qa:research-stack']);
assert.equal(persistence.risk, 'high');

const workflow = suggestQa(['.github/workflows/cloud-run-deploy.yml']);
assert.deepEqual(workflow.groups, ['qa:full']);
assert.equal(workflow.risk, 'high');

const mixed = suggestQa(['src/server/managementPage.ts', 'src/data/personaResearch.ts']);
assert.deepEqual(mixed.groups, ['qa:research-stack', 'qa:persona-stack']);
assert.equal(mixed.risk, 'medium');

console.log('QA suggestion classifier: PASS');
