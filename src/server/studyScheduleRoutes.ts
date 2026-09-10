import express from 'express';
import { requireManagementRole, type AuthenticatedRequest } from './auth';
import { getAllSessionsForManagement } from './persistence';
import { getAllReflectionRecordsForTeacher } from './reflectionPersistence';
import { researchDataScopeForRow } from './researchDashboard';
import {
  STUDY_CLASS_IDS,
  getAllStudySchedules,
  phaseForLocalDate,
  saveStudySchedule,
  type StudyPhase,
  type StudyScheduleRecord,
} from './studySchedulePersistence';

const PHASES: StudyPhase[] = ['unconfigured', 'pre_start', 'unknown_virtual_other', 'anticipated_other', 'identified_real_other', 'exchange_or_after'];

function phaseCounts() {
  return Object.fromEntries(PHASES.map((phase) => [phase, 0])) as Record<StudyPhase, number>;
}

function sessionLocalDate(session: Record<string, any>): string {
  if (typeof session.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(session.localDate)) return session.localDate;
  const raw = session.startedAt || session.endedAt;
  const parsed = raw ? new Date(raw) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) : '';
}

function configuredFieldCount(schedule: StudyScheduleRecord): number {
  return [schedule.appStartDate, schedule.nationalityRevealDate, schedule.videoViewDate, schedule.exchangeDate].filter(Boolean).length;
}

async function buildLinkageAudit() {
  const [schedules, sessions, reflections] = await Promise.all([
    getAllStudySchedules(),
    getAllSessionsForManagement(),
    getAllReflectionRecordsForTeacher(),
  ]);
  const scheduleByClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const classRows = STUDY_CLASS_IDS.map((classId) => {
    const schedule = scheduleByClass.get(classId)!;
    const classSessions = sessions.filter((row) => String(row.classId || '') === classId);
    const classReflections = reflections.filter((row) => row.classId === classId);
    const sessionPhases = phaseCounts();
    const reflectionPhases = phaseCounts();
    let mainSessions = 0;
    let mainReflections = 0;
    for (const session of classSessions) {
      const localDate = sessionLocalDate(session);
      sessionPhases[phaseForLocalDate(localDate, schedule)] += 1;
      if (researchDataScopeForRow({ class_id: classId, local_date: localDate }) === 'main') mainSessions += 1;
    }
    for (const reflection of classReflections) {
      reflectionPhases[phaseForLocalDate(reflection.localDate, schedule)] += 1;
      if (researchDataScopeForRow({ class_id: classId, local_date: reflection.localDate }) === 'main') mainReflections += 1;
    }
    const dialogueDayKeys = new Set(classSessions.map((row) => {
      const researchId = String(row.researchId || '');
      const localDate = sessionLocalDate(row);
      return researchId && localDate ? `${researchId}|${localDate}` : '';
    }).filter(Boolean));
    const reflectionKeys = new Set(classReflections.map((row) => row.researchId && row.localDate ? `${row.researchId}|${row.localDate}` : '').filter(Boolean));
    let matchedDayKeys = 0;
    for (const key of dialogueDayKeys) if (reflectionKeys.has(key)) matchedDayKeys += 1;
    return {
      classId,
      configuredFields: configuredFieldCount(schedule),
      scheduleRevision: schedule.revision,
      schedule,
      sessions: classSessions.length,
      mainSessions,
      reflections: classReflections.length,
      mainReflections,
      dialogueDayKeys: dialogueDayKeys.size,
      reflectionDayKeys: reflectionKeys.size,
      matchedDialogueReflectionDayKeys: matchedDayKeys,
      sessionPhases,
      reflectionPhases,
    };
  });
  return {
    success: true,
    joinRules: {
      scheduleToDialogue: ['class_id', 'local_date'],
      scheduleToReflection: ['class_id', 'local_date'],
      dialogueToReflection: ['research_id', 'local_date'],
      note: 'Phase is derived from the current official class schedule. Every saved schedule revision remains in schedule.history.',
    },
    classes: classRows,
  };
}

function csvCell(value: unknown): string {
  const original = value === null || value === undefined ? '' : String(value);
  const safe = /^\s*[=+\-@]/.test(original) ? `'${original}` : original;
  return `"${safe.replace(/"/g, '""')}"`;
}

async function buildLinkageCsv(): Promise<string> {
  const [schedules, sessions, reflections] = await Promise.all([
    getAllStudySchedules(),
    getAllSessionsForManagement(),
    getAllReflectionRecordsForTeacher(),
  ]);
  const scheduleByClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const headers = [
    'record_type', 'research_id', 'class_id', 'local_date', 'record_id', 'data_scope', 'study_phase', 'schedule_revision',
    'app_start_date', 'nationality_reveal_date', 'video_view_date', 'exchange_date',
  ];
  const rows: Record<string, unknown>[] = [];
  for (const session of sessions) {
    const classId = String(session.classId || '');
    const schedule = scheduleByClass.get(classId as any);
    if (!schedule) continue;
    const localDate = sessionLocalDate(session);
    rows.push({
      record_type: 'dialogue_session', research_id: session.researchId || '', class_id: classId, local_date: localDate,
      record_id: session.sessionId || '', data_scope: researchDataScopeForRow({ class_id: classId, local_date: localDate }),
      study_phase: phaseForLocalDate(localDate, schedule), schedule_revision: schedule.revision,
      app_start_date: schedule.appStartDate, nationality_reveal_date: schedule.nationalityRevealDate,
      video_view_date: schedule.videoViewDate, exchange_date: schedule.exchangeDate,
    });
  }
  for (const reflection of reflections) {
    const classId = reflection.classId;
    const schedule = scheduleByClass.get(classId as any);
    if (!schedule) continue;
    rows.push({
      record_type: 'lesson_reflection', research_id: reflection.researchId, class_id: classId, local_date: reflection.localDate,
      record_id: reflection.reflectionId, data_scope: researchDataScopeForRow({ class_id: classId, local_date: reflection.localDate }),
      study_phase: phaseForLocalDate(reflection.localDate, schedule), schedule_revision: schedule.revision,
      app_start_date: schedule.appStartDate, nationality_reveal_date: schedule.nationalityRevealDate,
      video_view_date: schedule.videoViewDate, exchange_date: schedule.exchangeDate,
    });
  }
  rows.sort((a, b) => String(a.local_date).localeCompare(String(b.local_date)) || String(a.class_id).localeCompare(String(b.class_id)) || String(a.record_type).localeCompare(String(b.record_type)));
  return '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n');
}

export function createStudyScheduleRouter() {
  const router = express.Router();

  router.post('/study-schedules/query', requireManagementRole(['researcher']), async (_req, res) => {
    try {
      const [schedules, audit] = await Promise.all([getAllStudySchedules(), buildLinkageAudit()]);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, schedules, audit });
    } catch (error: any) {
      console.error('Study schedule query failed', { message: error?.message });
      return res.status(503).json({ success: false, error: 'STUDY_SCHEDULE_QUERY_UNAVAILABLE' });
    }
  });

  router.put('/study-schedules', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
    try {
      const saved = await saveStudySchedule(req.body || {}, req.managementUser?.username || 'researcher');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, schedule: saved });
    } catch (error: any) {
      const code = String(error?.message || '');
      if (code === 'STUDY_SCHEDULE_REVISION_CONFLICT') return res.status(409).json({ success: false, error: code });
      if (code.startsWith('INVALID_')) return res.status(400).json({ success: false, error: code });
      console.error('Study schedule save failed', { message: error?.message });
      return res.status(503).json({ success: false, error: 'STUDY_SCHEDULE_SAVE_UNAVAILABLE' });
    }
  });

  router.post('/study-schedules/audit', requireManagementRole(['researcher']), async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(await buildLinkageAudit());
    } catch (error: any) {
      console.error('Study schedule audit failed', { message: error?.message });
      return res.status(503).json({ success: false, error: 'STUDY_SCHEDULE_AUDIT_UNAVAILABLE' });
    }
  });

  router.post('/study-schedules/linkage.csv', requireManagementRole(['researcher']), async (_req, res) => {
    try {
      const csv = await buildLinkageCsv();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="study-schedule-linkage.csv"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(csv);
    } catch (error: any) {
      console.error('Study schedule linkage export failed', { message: error?.message });
      return res.status(503).json({ success: false, error: 'STUDY_SCHEDULE_LINKAGE_UNAVAILABLE' });
    }
  });

  return router;
}
