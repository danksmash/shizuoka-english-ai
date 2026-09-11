import type { RequestHandler } from 'express';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';

const personaUsageLabelByName = new Map(
  TARGET_20_AI_STUDENT_IDS.map((id) => {
    const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
    if (!persona) throw new Error(`PERSONA_COUNTRY_LABEL_MISSING:${id}`);
    return [persona.name, `${persona.name} (${persona.country})`] as const;
  }),
);

export function personaUsageLabel(name: string): string {
  return personaUsageLabelByName.get(name) || name;
}

export function withPersonaCountryDashboardLabels(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/api/management/research.dashboard') return handler;

  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    (res as any).json = (body: any) => {
      const personas = body?.charts?.personas;
      if (Array.isArray(personas)) {
        body = {
          ...body,
          charts: {
            ...body.charts,
            personas: personas.map((row: any) => ({
              ...row,
              label: personaUsageLabel(String(row?.label || '')),
            })),
          },
        };
      }
      return originalJson(body);
    };

    return handler(req, res, next);
  };
}
