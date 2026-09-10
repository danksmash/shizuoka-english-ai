import type { ReflectionRecord } from './reflectionPersistence';
import { researchDataScopeForRow, type ResearchFilterQuery } from './researchDashboard';

type Row = Record<string, unknown>;

export const RESEARCH_LESSON_REFLECTION_HEADERS = [
  'research_id', 'class_id', 'data_scope', 'grade_level', 'class_number', 'local_date', 'status', 'today_goal',
  'goal_rating', 'communication_rating', 'rating_scale_min', 'rating_scale_max', 'rating_item_1', 'rating_item_2',
  'reflection_text', 'reflection_char_count', 'revision', 'created_at', 'updated_at', 'submitted_at',
] as const;

const RATING_ITEM_1 = 'めあてに向かって取り組めた';
const RATING_ITEM_2 = '相手の話を聞いて分かろうとしたり，自分の気持ちを伝えようとしたりした';
const RATING_SCALE_MIN = 1;
const RATING_SCALE_MAX = 4;

function textQuery(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function gradeForClassId(classId: string): string {
  if (classId.startsWith('5-')) return '5';
  if (classId.startsWith('6-')) return '6';
  return '';
}

function classNumberForClassId(classId: string): string {
  const match = classId.match(/^[56]-([123])$/);
  return match ? match[1] : '';
}

function classMatches(classId: string, requested: string): boolean {
  if (!requested || requested === 'all') return true;
  if (['1', '2', '3'].includes(requested)) return classId.endsWith(`-${requested}`);
  return classId === requested;
}

function gradeMatches(classId: string, requested: string): boolean {
  if (!requested || requested === 'all') return true;
  return ['5', '6'].includes(requested) && gradeForClassId(classId) === requested;
}

export function buildResearchLessonReflectionRows(
  records: ReflectionRecord[],
  query: ResearchFilterQuery = {},
): Row[] {
  const start = textQuery(query.start);
  const end = textQuery(query.end);
  const classId = textQuery(query.classId);
  const grade = textQuery(query.grade);
  const dataScope = textQuery(query.dataScope);

  return records
    .filter((record) => {
      const scope = researchDataScopeForRow({ class_id: record.classId, local_date: record.localDate });
      return (!start || record.localDate >= start)
        && (!end || record.localDate <= end)
        && (!dataScope || dataScope === 'all' || scope === dataScope)
        && classMatches(record.classId, classId)
        && gradeMatches(record.classId, grade);
    })
    .sort((a, b) => a.localDate.localeCompare(b.localDate) || a.classId.localeCompare(b.classId, 'ja') || a.researchId.localeCompare(b.researchId))
    .map((record) => ({
      research_id: record.researchId,
      class_id: record.classId,
      data_scope: researchDataScopeForRow({ class_id: record.classId, local_date: record.localDate }),
      grade_level: gradeForClassId(record.classId),
      class_number: classNumberForClassId(record.classId),
      local_date: record.localDate,
      status: record.status,
      today_goal: record.todayGoal,
      goal_rating: record.goalRating ?? '',
      communication_rating: record.communicationRating ?? '',
      rating_scale_min: RATING_SCALE_MIN,
      rating_scale_max: RATING_SCALE_MAX,
      rating_item_1: RATING_ITEM_1,
      rating_item_2: RATING_ITEM_2,
      reflection_text: record.reflectionText,
      reflection_char_count: record.reflectionCharCount,
      revision: record.revision,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      submitted_at: record.submittedAt,
    }));
}

function csvCell(value: unknown): string {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const original = value === null || value === undefined ? '' : String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const safe = !numeric && /^\s*[=+\-@]/.test(original) ? `'${original}` : original;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeResearchLessonReflectionCsv(rows: Row[]): string {
  return '\uFEFF' + [
    RESEARCH_LESSON_REFLECTION_HEADERS.map(csvCell).join(','),
    ...rows.map((row) => RESEARCH_LESSON_REFLECTION_HEADERS.map((key) => csvCell(row[key])).join(',')),
  ].join('\n');
}

const FIELD_META: Record<string, { definition: string; dataType: 'string' | 'number'; allowedValues?: string }> = {
  research_id: { definition: 'AI対話研究データと共通の、児童を直接特定しない研究用匿名ID', dataType: 'string' },
  class_id: { definition: '匿名化された学級ID', dataType: 'string' },
  data_scope: { definition: '本研究・Pilot B・テスト・予備を分離する研究データ区分', dataType: 'string', allowedValues: 'main | pilot_b | test | reserve' },
  grade_level: { definition: '学年', dataType: 'number', allowedValues: '5 | 6 | blank' },
  class_number: { definition: '通常学級の組番号。Pilot B・テスト・予備は空欄', dataType: 'number', allowedValues: '1 | 2 | 3 | blank' },
  local_date: { definition: '日本時間での授業振り返り実施日。AI対話データとの日単位結合キー', dataType: 'string' },
  status: { definition: '振り返りの保存状態', dataType: 'string', allowedValues: 'draft | submitted' },
  today_goal: { definition: '児童が入力した今日のめあて', dataType: 'string' },
  goal_rating: { definition: 'めあてに向かって取り組めた自己評価', dataType: 'number', allowedValues: '1 | 2 | 3 | 4 | blank' },
  communication_rating: { definition: '相手の話を分かろうとし、自分の気持ちを伝えようとした自己評価', dataType: 'number', allowedValues: '1 | 2 | 3 | 4 | blank' },
  rating_scale_min: { definition: '自己評価尺度の最小値', dataType: 'number', allowedValues: '1' },
  rating_scale_max: { definition: '自己評価尺度の最大値', dataType: 'number', allowedValues: '4' },
  rating_item_1: { definition: '自己評価項目1の固定文言', dataType: 'string' },
  rating_item_2: { definition: '自己評価項目2の固定文言', dataType: 'string' },
  reflection_text: { definition: '児童が入力した授業全体の自由記述振り返り', dataType: 'string' },
  reflection_char_count: { definition: '自由記述振り返りのUnicode文字数', dataType: 'number' },
  revision: { definition: '同日振り返りの保存更新回数', dataType: 'number' },
  created_at: { definition: '最初に保存されたUTC日時', dataType: 'string' },
  updated_at: { definition: '最後に保存されたUTC日時', dataType: 'string' },
  submitted_at: { definition: '提出状態へ移行したUTC日時。未提出は空欄', dataType: 'string' },
};

export function buildResearchLessonReflectionCodebookRows(): Row[] {
  return RESEARCH_LESSON_REFLECTION_HEADERS.map((variable) => {
    const meta = FIELD_META[variable];
    return {
      file_name: 'lesson_reflections.csv',
      variable,
      definition: meta?.definition || variable.replace(/_/g, ' '),
      data_type: meta?.dataType || 'string',
      allowed_values: meta?.allowedValues || '',
      analysis_use: '授業全体の振り返り、4件法自己評価、自由記述をAI対話データとresearch_id + local_dateで結合して分析',
    };
  });
}
