const CONFIGURED_API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => `${CONFIGURED_API_BASE}${path}`;

export interface TeacherDashboardStudent {
  learningId: string;
  classId: string;
  attendanceNumber: number | '';
  status: 'submitted' | 'draft' | 'missing';
  reflectionCharCount: number;
  todayGoal: string;
  goalRating: number | null;
  selfRegulationRating: number | null;
  reflectionText: string;
  updatedAt: string;
}

export interface TeacherDashboardResponse {
  localDate: string;
  classId: string;
  classes: string[];
  counts: { total: number; submitted: number; draft: number; missing: number };
  students: TeacherDashboardStudent[];
}

export interface TeacherHistoryRecord {
  reflectionId: string;
  localDate: string;
  todayGoal: string;
  goalRating: number | null;
  selfRegulationRating: number | null;
  reflectionText: string;
  reflectionCharCount: number;
  status: 'draft' | 'submitted';
  revision: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
  achievements: string;
  languageUsed: string;
  thinking: string;
  difficultyStrategy: string;
  languageCultureAwareness: string;
  nextGoal: string;
}

export interface TeacherStudentHistoryResponse {
  learningId: string;
  classId: string;
  attendanceNumber: number | '';
  history: TeacherHistoryRecord[];
}

async function post<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.error || `HTTP_${response.status}`) as Error & { code?: string; status?: number };
    error.code = data?.error; error.status = response.status; throw error;
  }
  return data as T;
}

export function teacherShouldRedirectToApiOrigin(): string {
  if (!CONFIGURED_API_BASE) return '';
  try {
    const target = new URL(CONFIGURED_API_BASE);
    return target.origin !== window.location.origin ? `${target.origin}/reflection/teacher` : '';
  } catch { return ''; }
}

export async function teacherLogin(username: string, password: string): Promise<void> {
  await post('/api/reflection/teacher/login', { username, password });
}
export async function teacherLogout(): Promise<void> { await post('/api/reflection/teacher/logout'); }
export async function teacherMe(): Promise<{ username: string; role: string }> {
  const data = await post<{ success: true; user: { username: string; role: string } }>('/api/reflection/teacher/me');
  return data.user;
}
export async function teacherDashboard(localDate: string, classId: string): Promise<TeacherDashboardResponse> {
  const data = await post<{ success: true } & TeacherDashboardResponse>('/api/reflection/teacher/dashboard', { localDate, classId });
  return data;
}
export async function teacherStudentHistory(learningId: string): Promise<TeacherStudentHistoryResponse> {
  const data = await post<{ success: true; student: TeacherStudentHistoryResponse }>('/api/reflection/teacher/student', { learningId });
  return data.student;
}
export async function teacherExportCsv(localDate: string, classId: string): Promise<void> {
  const response = await fetch(apiUrl('/api/reflection/teacher/export.csv'), {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localDate, classId }),
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `my-english-growth-reflections-${localDate || 'all'}.csv`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(href);
}
