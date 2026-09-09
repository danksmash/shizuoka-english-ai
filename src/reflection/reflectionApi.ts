const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export interface ReflectionRecordDto {
  reflectionId: string;
  localDate: string;
  todayGoal: string;
  goalRating: number | null;
  selfRegulationRating: number | null;
  reflectionText: string;
  reflectionCharCount: number;
  status: 'draft' | 'submitted';
  updatedAt: string;
  submittedAt: string;
}

export interface BootstrapResponse {
  learningId: string;
  today: ReflectionRecordDto | null;
  previous: ReflectionRecordDto | null;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.error || `HTTP_${response.status}`) as Error & { code?: string };
    error.code = data?.error;
    throw error;
  }
  return data as T;
}

export async function registerReflectionDevice(learningCode: string): Promise<string> {
  const data = await postJson<{ success: true; deviceToken: string }>('/api/reflection/register', { learningCode });
  return data.deviceToken;
}

export async function bootstrapReflection(deviceToken: string): Promise<BootstrapResponse> {
  const data = await postJson<{ success: true } & BootstrapResponse>('/api/reflection/bootstrap', { deviceToken });
  return data;
}

export async function saveReflection(deviceToken: string, input: {
  todayGoal: string;
  goalRating: number | null;
  selfRegulationRating: number | null;
  reflectionText: string;
  status: 'draft' | 'submitted';
}): Promise<ReflectionRecordDto> {
  const data = await postJson<{ success: true; reflection: ReflectionRecordDto }>('/api/reflection/save', { deviceToken, ...input });
  return data.reflection;
}

export async function loadReflectionHistory(deviceToken: string): Promise<ReflectionRecordDto[]> {
  const data = await postJson<{ success: true; history: ReflectionRecordDto[] }>('/api/reflection/history', { deviceToken });
  return data.history || [];
}

export async function loadClassReflections(deviceToken: string): Promise<Array<Pick<ReflectionRecordDto, 'reflectionId' | 'localDate' | 'todayGoal' | 'reflectionText'>>> {
  const data = await postJson<{ success: true; reflections: Array<Pick<ReflectionRecordDto, 'reflectionId' | 'localDate' | 'todayGoal' | 'reflectionText'>> }>('/api/reflection/class', { deviceToken });
  return data.reflections || [];
}
