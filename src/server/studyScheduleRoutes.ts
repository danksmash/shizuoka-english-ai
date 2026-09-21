import express from 'express';
import { requireManagementRole, type AuthenticatedRequest } from './auth';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';
import {
  getAllSessionsForManagement,
  getStudentRecordsForManagement,
  updateStudentResearchAssignments,
} from './persistence';
import { getAllReflectionRecordsForTeacher } from './reflectionPersistence';
import { researchDataScopeForRow } from './researchDashboard';
import {
  STUDY_CLASS_IDS,
  getAllStudySchedules,
  analysisPeriodForLocalDate,
  phaseForLocalDate,
  saveStudySchedule,
  type StudyPhase,
  type StudyScheduleRecord,
} from './studySchedulePersistence';

const PHASES: StudyPhase[] = ['unconfigured', 'pre_start', 'unknown_virtual_other', 'anticipated_other', 'identified_real_other', 'exchange_or_after'];

const BASE_COUNTRY_OPTIONS = TARGET_20_AI_STUDENT_IDS.map((id) => {
  const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
  if (!persona) throw new Error(`STUDY_ASSIGNMENT_PERSONA_MISSING:${id}`);
  return { value: persona.country, label: `${persona.country}（${persona.countryJapanese}）` };
}).filter((item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index);

function normalizedCountry(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    usa: 'united states',
    'u s a': 'united states',
    'united states of america': 'united states',
    uk: 'united kingdom',
    'u k': 'united kingdom',
    'great britain': 'united kingdom',
    korea: 'south korea',
    'republic of korea': 'south korea',
  };
  return aliases[raw] || raw;
}

function canonicalAssignedCountry(value: unknown): string {
  const raw = String(value || '').trim().slice(0, 120);
  if (!raw) return '';
  const normalized = normalizedCountry(raw);
  const canonical = BASE_COUNTRY_OPTIONS.find((option) => normalizedCountry(option.value) === normalized);
  if (canonical) return canonical.value;
  const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.countryJapanese === raw || item.countryNative === raw);
  return persona?.country || raw;
}

function assignmentAnnouncementIso(schedule: StudyScheduleRecord): string {
  if (!schedule.nationalityRevealDate) return '';
  return new Date(`${schedule.nationalityRevealDate}T00:00:00+09:00`).toISOString();
}

function phaseCounts() {
  return Object.fromEntries(PHASES.map((phase) => [phase, 0])) as Record<StudyPhase, number>;
}

function sessionLocalDate(session: Record<string, any>): string {
  if (typeof session.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(session.localDate)) return session.localDate;
  const raw = session.startedAt || session.endedAt;
  const parsed = raw ? new Date(raw) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) : '';
}

function isComparisonClassId(classId: string): boolean {
  return /^[56]-C[1-9]$/.test(classId);
}

function configuredFieldCount(schedule: StudyScheduleRecord, _schoolCondition: 'intervention' | 'comparison'): number {
  return [schedule.appStartDate, schedule.nationalityRevealDate, schedule.videoViewDate, schedule.exchangeDate].filter(Boolean).length;
}

function requiredConfiguredFieldCount(_schoolCondition: 'intervention' | 'comparison'): number {
  return 4;
}

function blankScheduleForClass(classId: string): StudyScheduleRecord {
  return {
    classId,
    revision: 0,
    appStartDate: '',
    nationalityRevealDate: '',
    videoViewDate: '',
    exchangeDate: '',
    updatedAt: '',
    updatedBy: '',
    history: [],
  };
}

function researchScopeRowForReflection(classId: string, localDate: string, student?: { formalStudyParticipant?: boolean; schoolCondition?: string; studyStartDate?: string }) {
  const comparison = student?.schoolCondition === 'comparison' || isComparisonClassId(classId);
  return {
    class_id: classId,
    local_date: localDate,
    formal_study_participant: student?.formalStudyParticipant === true || comparison ? 1 : 0,
    school_condition: comparison ? 'comparison' : (student?.schoolCondition || 'intervention'),
    study_start_date: student?.studyStartDate || '',
  };
}

async function buildLinkageAudit() {
  const [schedules, sessions, reflections, students] = await Promise.all([
    getAllStudySchedules(),
    getAllSessionsForManagement(),
    getAllReflectionRecordsForTeacher(),
    getStudentRecordsForManagement(),
  ]);
  const participants = students
    .filter((student) => student.active && student.formalStudyParticipant && ((STUDY_CLASS_IDS as readonly string[]).includes(student.classId) || isComparisonClassId(student.classId)))
    .map((student) => ({
      researchId: student.researchId,
      classId: student.classId,
      attendanceNumber: student.attendanceNumber,
      assignedPartnerCountry: student.assignedPartnerCountry,
      assignedPartnerId: student.assignedPartnerId,
      assignmentAnnouncedAt: student.assignmentAnnouncedAt,
      updatedAt: student.updatedAt,
      studySiteId: student.studySiteId,
      schoolCondition: student.schoolCondition,
      gradeLevel: student.gradeLevel,
      studyStartDate: student.studyStartDate,
    }))
    .sort((a, b) => a.classId.localeCompare(b.classId, 'ja')
      || Number(a.attendanceNumber || 999) - Number(b.attendanceNumber || 999)
      || a.researchId.localeCompare(b.researchId));
  const optionMap = new Map(BASE_COUNTRY_OPTIONS.map((option) => [option.value, option]));
  for (const participant of participants) {
    const country = String(participant.assignedPartnerCountry || '').trim();
    if (country && !optionMap.has(country)) optionMap.set(country, { value: country, label: country });
  }
  const countryOptions = Array.from(optionMap.values());
  const scheduleByClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const classIds = [...new Set([
    ...STUDY_CLASS_IDS,
    ...participants.map((participant) => participant.classId),
  ])].sort((a, b) => a.localeCompare(b, 'ja'));
  const studentByResearchId = new Map(students.map((student) => [student.researchId, student]));
  const classRows = classIds.map((classId) => {
    const schedule = scheduleByClass.get(classId) || blankScheduleForClass(classId);
    const classCondition = participants.find((participant) => participant.classId === classId)?.schoolCondition === 'comparison' || isComparisonClassId(classId)
      ? 'comparison'
      : 'intervention';
    const classSessions = sessions.filter((row) => String(row.classId || '') === classId);
    const classReflections = reflections.filter((row) => row.classId === classId);
    const classParticipants = participants.filter((row) => row.classId === classId);
    const configuredParticipants = classCondition === 'intervention'
      ? classParticipants.filter((row) => Boolean(row.assignedPartnerCountry))
      : [];
    const sessionPhases = phaseCounts();
    const reflectionPhases = phaseCounts();
    let mainSessions = 0;
    let mainReflections = 0;
    for (const session of classSessions) {
      const localDate = sessionLocalDate(session);
      if (classCondition === 'intervention') sessionPhases[phaseForLocalDate(localDate, schedule)] += 1;
      if (researchDataScopeForRow({
        class_id: classId,
        local_date: localDate,
        formal_study_participant: session.formalStudyParticipant === true ? 1 : 0,
        school_condition: session.schoolCondition || classCondition,
        study_start_date: session.studyStartDate || '',
      }) === 'main') mainSessions += 1;
    }
    for (const reflection of classReflections) {
      if (classCondition === 'intervention') reflectionPhases[phaseForLocalDate(reflection.localDate, schedule)] += 1;
      const student = studentByResearchId.get(reflection.researchId);
      if (researchDataScopeForRow(researchScopeRowForReflection(classId, reflection.localDate, student)) === 'main') mainReflections += 1;
    }
    const dialogueDayKeys = new Set(classSessions.map((row) => {
      const researchId = String(row.researchId || '');
      const localDate = sessionLocalDate(row);
      return researchId && localDate ? `${researchId}|${localDate}` : '';
    }).filter(Boolean));
    const reflectionKeys = new Set(classReflections.map((row) => row.researchId && row.localDate ? `${row.researchId}|${row.localDate}` : '').filter(Boolean));
    let matchedDayKeys = 0;
    for (const key of dialogueDayKeys) if (reflectionKeys.has(key)) matchedDayKeys += 1;
    let assignedCountryComparableSessions = 0;
    let assignedCountryMatchedSessions = 0;
    if (classCondition === 'intervention') {
      for (const session of classSessions) {
        const assigned = normalizedCountry(session.assignedPartnerCountry);
        const selected = normalizedCountry(session.personaCountry);
        if (!assigned || !selected) continue;
        assignedCountryComparableSessions += 1;
        if (assigned === selected) assignedCountryMatchedSessions += 1;
      }
    }
    return {
      classId,
      schoolCondition: classCondition,
      configuredFields: configuredFieldCount(schedule, classCondition),
      requiredFields: requiredConfiguredFieldCount(classCondition),
      scheduleRevision: schedule.revision,
      schedule,
      sessions: classSessions.length,
      mainSessions,
      reflections: classReflections.length,
      mainReflections,
      dialogueDayKeys: dialogueDayKeys.size,
      reflectionDayKeys: reflectionKeys.size,
      matchedDialogueReflectionDayKeys: matchedDayKeys,
      participantCount: classParticipants.length,
      assignedCountryConfiguredParticipants: configuredParticipants.length,
      assignedCountryUnconfiguredParticipants: classParticipants.length - configuredParticipants.length,
      assignedCountryComparableSessions,
      assignedCountryMatchedSessions,
      sessionPhases,
      reflectionPhases,
    };
  });
  return {
    success: true,
    participants,
    countryOptions,
    joinRules: {
      scheduleToDialogue: ['class_id', 'local_date'],
      scheduleToReflection: ['class_id', 'local_date'],
      dialogueToReflection: ['research_id', 'local_date'],
      note: '実践校のPhaseは正式学級日程から導出します。共通分析期間period1～3は両校とも4つの基準日から導出します。比較校のnationalityRevealDate/videoViewDate/exchangeDateはC1/C2/Postの分析基準日であり、国籍告知・本人動画・交流を実施したことを意味しません。保存済みrevisionはschedule.historyに保持します。',
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
  const [schedules, sessions, reflections, students] = await Promise.all([
    getAllStudySchedules(),
    getAllSessionsForManagement(),
    getAllReflectionRecordsForTeacher(),
    getStudentRecordsForManagement(),
  ]);
  const scheduleByClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const studentByResearchId = new Map(students.map((student) => [student.researchId, student]));
  const headers = [
    'record_type', 'research_id', 'site_id', 'school_condition', 'class_id', 'local_date', 'record_id', 'data_scope', 'study_phase', 'analysis_period', 'schedule_revision',
    'app_start_date', 'nationality_reveal_date', 'video_view_date', 'exchange_date',
    'assigned_partner_country', 'assigned_partner_id', 'assignment_announced_at', 'persona_country', 'assigned_country_persona_match',
  ];
  const rows: Record<string, unknown>[] = [];
  for (const session of sessions) {
    const classId = String(session.classId || '');
    const schedule = scheduleByClass.get(classId as any);
    if (!schedule) continue;
    const localDate = sessionLocalDate(session);
    const comparison = session.schoolCondition === 'comparison' || isComparisonClassId(classId);
    rows.push({
      record_type: 'dialogue_session', research_id: session.researchId || '', site_id: session.studySiteId || (comparison ? 'site_b' : 'site_a'), school_condition: comparison ? 'comparison' : 'intervention', class_id: classId, local_date: localDate,
      record_id: session.sessionId || '', data_scope: researchDataScopeForRow({
        class_id: classId, local_date: localDate,
        formal_study_participant: session.formalStudyParticipant === true ? 1 : 0,
        school_condition: comparison ? 'comparison' : 'intervention',
        study_start_date: session.studyStartDate || '',
      }),
      study_phase: comparison ? '' : phaseForLocalDate(localDate, schedule), analysis_period: analysisPeriodForLocalDate(localDate, schedule), schedule_revision: schedule.revision,
      app_start_date: schedule.appStartDate, nationality_reveal_date: schedule.nationalityRevealDate,
      video_view_date: schedule.videoViewDate, exchange_date: schedule.exchangeDate,
      assigned_partner_country: session.assignedPartnerCountry || '',
      assigned_partner_id: session.assignedPartnerId || '',
      assignment_announced_at: session.assignmentAnnouncedAt || '',
      persona_country: session.personaCountry || '',
      assigned_country_persona_match: normalizedCountry(session.assignedPartnerCountry) && normalizedCountry(session.personaCountry)
        ? (normalizedCountry(session.assignedPartnerCountry) === normalizedCountry(session.personaCountry) ? 1 : 0)
        : '',
    });
  }
  for (const reflection of reflections) {
    const classId = reflection.classId;
    const schedule = scheduleByClass.get(classId as any);
    if (!schedule) continue;
    const student = studentByResearchId.get(reflection.researchId);
    const comparison = student?.schoolCondition === 'comparison' || isComparisonClassId(classId);
    rows.push({
      record_type: 'lesson_reflection', research_id: reflection.researchId, site_id: student?.studySiteId || (comparison ? 'site_b' : 'site_a'), school_condition: comparison ? 'comparison' : 'intervention', class_id: classId, local_date: reflection.localDate,
      record_id: reflection.reflectionId, data_scope: researchDataScopeForRow(researchScopeRowForReflection(classId, reflection.localDate, student)),
      study_phase: comparison ? '' : phaseForLocalDate(reflection.localDate, schedule), analysis_period: analysisPeriodForLocalDate(reflection.localDate, schedule), schedule_revision: schedule.revision,
      app_start_date: schedule.appStartDate, nationality_reveal_date: schedule.nationalityRevealDate,
      video_view_date: schedule.videoViewDate, exchange_date: schedule.exchangeDate,
      assigned_partner_country: student?.assignedPartnerCountry || '',
      assigned_partner_id: student?.assignedPartnerId || '',
      assignment_announced_at: student?.assignmentAnnouncedAt || '',
      persona_country: '',
      assigned_country_persona_match: '',
    });
  }
  rows.sort((a, b) => String(a.local_date).localeCompare(String(b.local_date)) || String(a.class_id).localeCompare(String(b.class_id)) || String(a.record_type).localeCompare(String(b.record_type)));
  return '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n');
}

export function createStudyScheduleRouter() {
  const router = express.Router();

  router.post('/study-schedules/query', requireManagementRole(['researcher']), async (_req, res) => {
    try {
      const fullAudit = await buildLinkageAudit();
      const { participants, countryOptions, ...audit } = fullAudit;
      const schedules = audit.classes.map((row) => row.schedule);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, schedules, participants, countryOptions, audit });
    } catch (error: any) {
      console.error('Study schedule query failed', { message: error?.message });
      return res.status(503).json({ success: false, error: 'STUDY_SCHEDULE_QUERY_UNAVAILABLE' });
    }
  });

  router.put('/study-schedules', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.managementUser?.username || 'researcher';
      const saved = await saveStudySchedule(req.body || {}, actor);
      const students = await getStudentRecordsForManagement();
      const classAssignments = isComparisonClassId(saved.classId) ? [] : students
        .filter((student) => student.active && student.schoolCondition !== 'comparison' && student.classId === saved.classId && Boolean(student.assignedPartnerCountry))
        .map((student) => ({
          researchId: student.researchId,
          assignedPartnerCountry: student.assignedPartnerCountry,
          assignedPartnerId: student.assignedPartnerId,
          assignmentAnnouncedAt: assignmentAnnouncementIso(saved),
          expectedAssignedPartnerCountry: student.assignedPartnerCountry,
          expectedAssignedPartnerId: student.assignedPartnerId,
        }));
      const syncedAssignments = classAssignments.length
        ? await updateStudentResearchAssignments(classAssignments, actor)
        : [];
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        schedule: saved,
        assignmentAnnouncementSync: {
          checked: syncedAssignments.length,
          changed: syncedAssignments.filter((row) => row.changed).length,
        },
      });
    } catch (error: any) {
      const code = String(error?.message || '');
      if (code === 'STUDY_SCHEDULE_REVISION_CONFLICT') return res.status(409).json({ success: false, error: code });
      if (code.startsWith('INVALID_')) return res.status(400).json({ success: false, error: code });
      console.error('Study schedule save failed', { message: error?.message });
      return res.status(503).json({ success: false, error: 'STUDY_SCHEDULE_SAVE_UNAVAILABLE' });
    }
  });

  router.put('/study-schedules/assignments', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
    try {
      const requested = Array.isArray(req.body?.assignments) ? req.body.assignments : [];
      if (!requested.length || requested.length > 250) return res.status(400).json({ success: false, error: 'INVALID_RESEARCH_ASSIGNMENT_BATCH' });
      const [schedules, students] = await Promise.all([getAllStudySchedules(), getStudentRecordsForManagement()]);
      const scheduleByClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
      const participantByResearchId = new Map(students
        .filter((student) => student.active && student.formalStudyParticipant && student.schoolCondition === 'intervention' && (STUDY_CLASS_IDS as readonly string[]).includes(student.classId))
        .map((student) => [student.researchId, student]));
      const prepared = requested.map((input: any) => {
        const researchId = typeof input?.researchId === 'string' ? input.researchId.trim().toUpperCase() : '';
        const participant = participantByResearchId.get(researchId);
        if (!participant) throw new Error('RESEARCH_PARTICIPANT_NOT_FOUND');
        const schedule = scheduleByClass.get(participant.classId as any);
        if (!schedule) throw new Error('STUDY_SCHEDULE_NOT_FOUND');
        const assignedPartnerCountry = canonicalAssignedCountry(input?.assignedPartnerCountry);
        const assignedPartnerId = typeof input?.assignedPartnerId === 'string' ? input.assignedPartnerId.trim().slice(0, 120) : '';
        if (assignedPartnerId && !assignedPartnerCountry) throw new Error('ASSIGNED_COUNTRY_REQUIRED_FOR_PARTNER');
        if (assignedPartnerCountry && !schedule.nationalityRevealDate) throw new Error('NATIONALITY_REVEAL_DATE_REQUIRED');
        return {
          researchId,
          assignedPartnerCountry,
          assignedPartnerId,
          assignmentAnnouncedAt: assignedPartnerCountry ? assignmentAnnouncementIso(schedule) : '',
          ...(Object.prototype.hasOwnProperty.call(input || {}, 'expectedAssignedPartnerCountry')
            ? { expectedAssignedPartnerCountry: input.expectedAssignedPartnerCountry }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input || {}, 'expectedAssignedPartnerId')
            ? { expectedAssignedPartnerId: input.expectedAssignedPartnerId }
            : {}),
        };
      });
      const updated = await updateStudentResearchAssignments(prepared, req.managementUser?.username || 'researcher');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        updated,
        changedCount: updated.filter((row) => row.changed).length,
        totalCount: updated.length,
      });
    } catch (error: any) {
      const code = String(error?.message || '');
      if (code === 'RESEARCH_ASSIGNMENT_CONFLICT') return res.status(409).json({ success: false, error: code });
      if (code.startsWith('INVALID_') || code.endsWith('_REQUIRED') || code === 'RESEARCH_PARTICIPANT_NOT_FOUND' || code === 'STUDY_SCHEDULE_NOT_FOUND') {
        return res.status(400).json({ success: false, error: code });
      }
      console.error('Study research assignment save failed', { message: error?.message });
      return res.status(503).json({ success: false, error: 'RESEARCH_ASSIGNMENT_SAVE_UNAVAILABLE' });
    }
  });

  router.post('/study-schedules/audit', requireManagementRole(['researcher']), async (_req, res) => {
    try {
      const fullAudit = await buildLinkageAudit();
      const { participants: _participants, countryOptions: _countryOptions, ...audit } = fullAudit;
      res.setHeader('Cache-Control', 'no-store');
      return res.json(audit);
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
