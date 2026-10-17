import { phaseForLocalDate, type StudyScheduleRecord } from './studySchedulePersistence';

/**
 * Lightweight, display-only progress summary.
 * The caller passes the already loaded, filtered dashboard export rows and the
 * SAME final in-lesson session ID set used by the research chart pipeline.
 * No Firestore access, utterance expansion, or new API request is permitted here.
 */
type PhaseKey = 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'notApplicable' | 'unclassified';
type StageBucket = { sessions: number; participantIds: Set<string> };
const STAGE_KEYS: PhaseKey[] = ['phase1', 'phase2', 'phase3', 'phase4', 'notApplicable', 'unclassified'];

function newStages(): Record<PhaseKey, StageBucket> {
  return Object.fromEntries(STAGE_KEYS.map((key) => [key, { sessions: 0, participantIds: new Set<string>() }])) as Record<PhaseKey, StageBucket>;
}

function stageFor(date: string, schedule?: StudyScheduleRecord): PhaseKey {
  if (!schedule) return 'unclassified';
  const phase = phaseForLocalDate(date, schedule);
  if (phase === 'unknown_virtual_other') return 'phase1';
  if (phase === 'anticipated_other') return 'phase2';
  if (phase === 'identified_real_other') return 'phase3';
  if (phase === 'exchange_or_after') return 'phase4';
  return 'unclassified';
}

export function summarizeInLessonResearchCollection(
  filteredSessionRows: Record<string, any>[],
  schedules: StudyScheduleRecord[],
  inLessonSessionIds: ReadonlySet<string>,
) {
  const schedulesByClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const byClass = new Map<string, {
    classId: string;
    schoolCondition: string;
    sessions: number;
    participantIds: Set<string>;
    stages: Record<PhaseKey, StageBucket>;
  }>();

  for (const row of filteredSessionRows) {
    const sessionId = String(row.session_id || '');
    if (!sessionId || !inLessonSessionIds.has(sessionId)) continue;
    const classId = String(row.class_id || '未設定');
    const schoolCondition = String(row.school_condition || 'intervention');
    const key = schoolCondition + '|' + classId;
    let bucket = byClass.get(key);
    if (!bucket) {
      bucket = { classId, schoolCondition, sessions: 0, participantIds: new Set<string>(), stages: newStages() };
      byClass.set(key, bucket);
    }
    const researchId = String(row.research_id || '');
    const phase: PhaseKey = schoolCondition === 'comparison'
      ? 'notApplicable'
      : stageFor(String(row.local_date || ''), schedulesByClass.get(classId));
    bucket.sessions += 1;
    bucket.stages[phase].sessions += 1;
    if (researchId) {
      bucket.participantIds.add(researchId);
      bucket.stages[phase].participantIds.add(researchId);
    }
  }

  const classes = [...byClass.values()]
    .sort((a, b) => a.schoolCondition.localeCompare(b.schoolCondition)
      || a.classId.localeCompare(b.classId, 'ja', { numeric: true }))
    .map((bucket) => ({
      classId: bucket.classId,
      schoolCondition: bucket.schoolCondition,
      sessions: bucket.sessions,
      participants: bucket.participantIds.size,
      stages: Object.fromEntries(STAGE_KEYS.map((key) => [key, {
        sessions: bucket.stages[key].sessions,
        participants: bucket.stages[key].participantIds.size,
      }])) as Record<PhaseKey, { sessions: number; participants: number }>,
    }));
  return {
    definition: '既存の確定授業内判定・分析除外を反映した収集数。時間異常・欠測のみを理由とした自動除外は行わない。正式RQ1の分析対象数とは異なる。',
    classes,
    lessonSessions: classes.reduce((sum, item) => sum + item.sessions, 0),
  };
}
