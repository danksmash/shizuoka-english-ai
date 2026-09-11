import assert from 'node:assert/strict';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { personaUsageLabel, withPersonaCountryDashboardLabels } from '../src/server/personaCountryDashboardLabels';

const targetPersonas = TARGET_20_AI_STUDENT_IDS.map((id) => {
  const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
  if (!persona) throw new Error(`QA_PERSONA_MISSING:${id}`);
  return persona;
});

assert.equal(targetPersonas.length, 20);
for (const persona of targetPersonas) {
  assert.equal(
    personaUsageLabel(persona.name),
    `${persona.name} (${persona.country})`,
    `${persona.id} must display English name plus English country`,
  );
}
assert.equal(personaUsageLabel('Unknown Persona'), 'Unknown Persona');

let captured: any = null;
const baseHandler: any = (_req: any, res: any) => res.json({
  success: true,
  charts: {
    personas: [
      { label: 'Emma Johnson', value: 3 },
      { label: 'Oliver Wright', value: 2 },
    ],
  },
});
const wrapped = withPersonaCountryDashboardLabels('/api/management/research.dashboard', baseHandler);
const response: any = {
  json(body: any) {
    captured = body;
    return body;
  },
};
wrapped({} as any, response, (() => {}) as any);

assert.deepEqual(captured.charts.personas, [
  { label: 'Emma Johnson (United States)', value: 3 },
  { label: 'Oliver Wright (United Kingdom)', value: 2 },
]);

const untouched = withPersonaCountryDashboardLabels('/api/health', baseHandler);
assert.equal(untouched, baseHandler, 'non-dashboard handlers must remain untouched');

console.log('Persona country dashboard label QA: PASS (20 personas)');
