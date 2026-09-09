from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    source = p.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}")
    p.write_text(source.replace(old, new))


replace_once(
    "src/reflection/reflectionApi.ts",
    """async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });""",
    """async function postJson<T>(path: string, body: Record<string, unknown>, options?: { keepalive?: boolean }): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: options?.keepalive === true,
  });""",
)

replace_once(
    "src/reflection/reflectionApi.ts",
    """export async function saveReflection(deviceToken: string, input: {
  todayGoal: string;
  goalRating: number | null;
  selfRegulationRating: number | null;
  reflectionText: string;
  status: 'draft' | 'submitted';
}): Promise<ReflectionRecordDto> {
  const data = await postJson<{ success: true; reflection: ReflectionRecordDto }>('/api/reflection/save', { deviceToken, ...input });
  return data.reflection;
}""",
    """export async function saveReflection(deviceToken: string, input: {
  todayGoal: string;
  goalRating: number | null;
  selfRegulationRating: number | null;
  reflectionText: string;
  status: 'draft' | 'submitted';
}, options?: { keepalive?: boolean }): Promise<ReflectionRecordDto> {
  const data = await postJson<{ success: true; reflection: ReflectionRecordDto }>('/api/reflection/save', { deviceToken, ...input }, options);
  return data.reflection;
}

export async function saveReflectionGoal(deviceToken: string, todayGoal: string): Promise<ReflectionRecordDto> {
  const data = await postJson<{ success: true; reflection: ReflectionRecordDto }>(
    '/api/reflection/save',
    { deviceToken, todayGoal },
    { keepalive: true },
  );
  return data.reflection;
}""",
)

replace_once(
    "src/reflection/ReflectionApp.tsx",
    """  saveReflection,
  type BootstrapResponse,""",
    """  saveReflection,
  saveReflectionGoal,
  type BootstrapResponse,""",
)

replace_once(
    "src/reflection/ReflectionApp.tsx",
    """  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'); const [message, setMessage] = useState('');
  const firstRender = useRef(true); const timerRef = useRef<number | null>(null); const skipAutosaveOnce = useRef(false);
  const reflectionChars = useMemo(() => [...draft.reflectionText].length, [draft.reflectionText]);""",
    """  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'); const [message, setMessage] = useState('');
  const firstRender = useRef(true); const timerRef = useRef<number | null>(null); const skipAutosaveOnce = useRef(false);
  const latestGoalRef = useRef(draft.todayGoal);
  const lastGoalSavedRef = useRef(bootstrap.today?.todayGoal || '');
  const reflectionChars = useMemo(() => [...draft.reflectionText].length, [draft.reflectionText]);

  useEffect(() => { latestGoalRef.current = draft.todayGoal; }, [draft.todayGoal]);

  const flushGoalAutosave = useCallback(async () => {
    const goal = latestGoalRef.current;
    if (goal === lastGoalSavedRef.current) return;
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    setSaveState('saving');
    try {
      const saved = await saveReflectionGoal(token, goal);
      lastGoalSavedRef.current = saved.todayGoal;
      onRecordSaved(saved);
      setSaveState('saved');
    } catch { setSaveState('error'); }
  }, [token, onRecordSaved]);

  useEffect(() => {
    const flushBeforeLeave = () => {
      const goal = latestGoalRef.current;
      if (goal === lastGoalSavedRef.current) return;
      void saveReflectionGoal(token, goal).then((saved) => {
        lastGoalSavedRef.current = saved.todayGoal;
      }).catch(() => undefined);
    };
    window.addEventListener('pagehide', flushBeforeLeave);
    return () => window.removeEventListener('pagehide', flushBeforeLeave);
  }, [token]);""",
)

replace_once(
    "src/reflection/ReflectionApp.tsx",
    """    }, 1500);""",
    """    }, 1000);""",
)

replace_once(
    "src/reflection/ReflectionApp.tsx",
    """    <div className=\"meg-card meg-goal-card\"><div className=\"meg-section-title\"><Flag /><h2>Today's Goal</h2><strong>今日のめあて</strong></div><textarea value={draft.todayGoal} onChange={(e) => setDraft((current) => ({ ...current, todayGoal: e.target.value.slice(0, 1000) }))} placeholder=\"前回の振り返りも思い出して、今日のめあてを自分の言葉で書きましょう。\" /></div>""",
    """    <div className=\"meg-card meg-goal-card\"><div className=\"meg-section-title\"><Flag /><h2>Today's Goal</h2><strong>今日のめあて</strong></div><textarea value={draft.todayGoal} onChange={(e) => setDraft((current) => ({ ...current, todayGoal: e.target.value.slice(0, 1000) }))} onBlur={() => void flushGoalAutosave()} placeholder=\"前回の振り返りも思い出して、今日のめあてを自分の言葉で書きましょう。\" /></div>""",
)

replace_once(
    "scripts/qa-reflection-module.ts",
    """requireText(reflection, 'window.clearTimeout(timerRef.current)', 'submit/autosave timer cancellation');""",
    """requireText(reflection, 'window.clearTimeout(timerRef.current)', 'submit/autosave timer cancellation');
requireText(reflection, '}, 1000);', 'one-second draft autosave debounce');
requireText(reflection, 'saveReflectionGoal', 'goal-specific autosave');
requireText(reflection, 'onBlur={() => void flushGoalAutosave()}', 'goal blur autosave flush');
requireText(reflection, \"window.addEventListener('pagehide', flushBeforeLeave)\", 'goal page-leave autosave flush');
requireText(read('src/reflection/reflectionApi.ts'), 'keepalive: options?.keepalive === true', 'keepalive autosave request');
forbidText(reflection, 'めあてを保存', 'manual goal-save button');""",
)
