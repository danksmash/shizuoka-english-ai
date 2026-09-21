import type { QuestionnaireRecord, QuestionnaireWave } from './questionnaireResearch';
import type { StudyScheduleRecord } from './studySchedulePersistence';

export interface QuestionnaireTimingAuditIssue {
  researchId: string;
  classId: string;
  surveyWave: QuestionnaireWave;
  surveyDate: string;
  code: string;
  message: string;
}

export function buildQuestionnaireTimingAudit(records: QuestionnaireRecord[], schedules: StudyScheduleRecord[]) {
  const scheduleByClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const duplicateKeys = new Set<string>();
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = `${record.researchId}|${record.surveyWave}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [key, count] of counts) if (count > 1) duplicateKeys.add(key);

  const issues: QuestionnaireTimingAuditIssue[] = [];
  let auditable = 0;
  let unavailable = 0;
  for (const record of records) {
    const key = `${record.researchId}|${record.surveyWave}`;
    if (duplicateKeys.has(key)) continue;
    const schedule = scheduleByClass.get(record.classId as StudyScheduleRecord['classId']);
    if (!schedule || !record.surveyDate) {
      unavailable += 1;
      continue;
    }
    auditable += 1;
    const push = (code: string, message: string) => issues.push({
      researchId: record.researchId,
      classId: record.classId,
      surveyWave: record.surveyWave,
      surveyDate: record.surveyDate,
      code,
      message,
    });
    const comparison = record.schoolCondition === 'comparison';
    if (record.surveyWave === 'pre_app') {
      if (!schedule.appStartDate) unavailable += 1;
      else if (record.surveyDate > schedule.appStartDate) push('PRE_AFTER_APP_START', 'Pre回答日がアプリ使用開始日より後です。');
    } else if (record.surveyWave === 'mid_pre_reveal') {
      if (!schedule.nationalityRevealDate) unavailable += 1;
      else {
        if (schedule.appStartDate && record.surveyDate < schedule.appStartDate) push('MID_BEFORE_APP_START', 'Mid回答日がアプリ使用開始日より前です。');
        if (record.surveyDate > schedule.nationalityRevealDate) {
          push(comparison ? 'MID_AFTER_COMPARISON_C1' : 'MID_AFTER_REVEAL', comparison ? '比較校Mid回答日が実践校Midに対応する相対時点（C1）より後です。' : 'Mid回答日が国籍告知日より後です。');
        }
      }
    } else if (record.surveyWave === 'post_pre_exchange') {
      if (!schedule.exchangeDate) unavailable += 1;
      else {
        if (!comparison && schedule.videoViewDate && record.surveyDate < schedule.videoViewDate) push('POST_BEFORE_VIDEO', 'Post回答日が本人動画視聴日より前です。');
        if (record.surveyDate > schedule.exchangeDate) {
          push(comparison ? 'POST_AFTER_COMPARISON_C2' : 'POST_AFTER_EXCHANGE', comparison ? '比較校Post回答日が実践校Postに対応する相対時点（C2）より後です。' : 'Post回答日が留学生交流会実施日より後です。');
        }
      }
    }
  }

  return {
    status: issues.length ? 'review' : auditable > 0 ? 'ok' : 'unavailable',
    auditable,
    unavailable,
    issueCount: issues.length,
    issues: issues.slice(0, 100),
    note: '日付単位の監査です。実践校はPre＝開始前、Mid＝国籍告知直前、Post＝交流前を確認します。比較校は同じ相対経過時点C1/C2を日程欄の対応日として監査し、国籍告知・本人動画・交流自体は前提にしません。同日回答は許容します。',
  };
}
