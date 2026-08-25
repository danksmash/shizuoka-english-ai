from pathlib import Path

path = Path('src/components/SetupScreen.tsx')
s = path.read_text()

old_import = "import { speakStudentVoice, stopSpeaking } from '../utils/speech';"
new_import = "import { createSpeechRecognitionInstance, isSpeechRecognitionSupported, speakStudentVoice, stopSpeaking } from '../utils/speech';"
if old_import not in s:
    raise SystemExit('speech import not found')
s = s.replace(old_import, new_import, 1)

old_state = "useState<'checking' | 'prompt' | 'ready' | 'denied' | 'unsupported'>('checking')"
new_state = "useState<'checking' | 'prompt' | 'testing' | 'ready' | 'denied' | 'unsupported'>('checking')"
if old_state not in s:
    raise SystemExit('mic state not found')
s = s.replace(old_state, new_state, 1)

old_granted = """            if (status.state === 'granted') {
              setMicStatus('ready');
              setMicMessage('マイクは使用できます。対話中に許可画面は出ません。');
"""
new_granted = """            if (status.state === 'granted') {
              setMicStatus('prompt');
              setMicMessage('マイクは許可済みです。「マイク・音声入力をテスト」を押して、英語を一言話してください。');
"""
if old_granted not in s:
    raise SystemExit('granted branch not found')
s = s.replace(old_granted, new_granted, 1)

start = s.find('  const handlePrepareMicrophone = async () => {')
end = s.find('\n  const selectedStudent =', start)
if start < 0 or end < 0:
    raise SystemExit('prepare microphone function bounds not found')

new_func = r'''  const handlePrepareMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !isSpeechRecognitionSupported()) {
      setMicStatus('unsupported');
      setMicMessage('この環境では音声入力テストを実行できません。文字入力でも利用できます。');
      return;
    }

    setMicStatus('testing');
    setMicMessage('マイクを確認しています。許可画面が出たら「許可」を押してください…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicMessage('音声入力テスト中です。「Hello」など英語を一言話してください。');

      let settled = false;
      let timeoutId: number | null = null;
      let recognition: ReturnType<typeof createSpeechRecognitionInstance> = null;

      const finishSuccess = (text: string) => {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        try { recognition?.stop(); } catch {}
        setMicStatus('ready');
        setMicMessage(`✓ 音声入力OK：「${text}」と聞き取れました。対話をスタートできます。`);
      };

      const finishFailure = (message: string, denied = false) => {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        try { recognition?.stop(); } catch {}
        setMicStatus(denied ? 'denied' : 'prompt');
        setMicMessage(message);
      };

      recognition = createSpeechRecognitionInstance(
        (text) => {
          const heard = text.trim();
          if (heard) finishSuccess(heard);
        },
        (error) => {
          const normalized = String(error || '').toLowerCase();
          if (normalized.includes('not-allowed') || normalized.includes('service-not-allowed')) {
            finishFailure('マイクが許可されていません。ブラウザのサイト設定でマイクを許可してください。', true);
          } else if (normalized.includes('audio-capture')) {
            finishFailure('マイクを使用できません。端末のマイク設定を確認して、もう一度テストしてください。');
          } else if (normalized.includes('no-speech')) {
            finishFailure('音声を聞き取れませんでした。もう一度テストして、英語を一言話してください。');
          } else {
            finishFailure('音声入力を確認できませんでした。もう一度マイクテストをしてください。');
          }
        },
        () => {
          if (!settled) {
            finishFailure('音声を聞き取れませんでした。もう一度テストして、英語を一言話してください。');
          }
        }
      );

      if (!recognition) {
        setMicStatus('unsupported');
        setMicMessage('このブラウザでは音声認識を利用できません。文字入力でも利用できます。');
        return;
      }

      timeoutId = window.setTimeout(() => {
        finishFailure('音声を聞き取れませんでした。もう一度テストして、英語を一言話してください。');
      }, 8000);

      try {
        recognition.start();
      } catch {
        finishFailure('音声入力を開始できませんでした。もう一度マイクテストをしてください。');
      }
    } catch (error) {
      const name = (error as { name?: string })?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setMicStatus('denied');
        setMicMessage('マイクが許可されていません。ブラウザのサイト設定でマイクを許可してください。');
      } else {
        setMicStatus('prompt');
        setMicMessage('マイクを確認できませんでした。もう一度マイクテストをしてください。');
      }
    }
  };
'''
s = s[:start] + new_func + s[end:]

replacements = [
    ('<span>マイクを準備する</span>', '<span>マイク・音声入力をテスト</span>'),
    ("disabled={micStatus === 'checking' || micStatus === 'ready' || micStatus === 'unsupported'}", "disabled={micStatus === 'checking' || micStatus === 'testing' || micStatus === 'unsupported'}"),
    ("micStatus === 'checking' || micStatus === 'unsupported'", "micStatus === 'checking' || micStatus === 'testing' || micStatus === 'unsupported'"),
    ("{micStatus === 'ready' ? '✓ 準備OK' : 'マイクを準備'}", "{micStatus === 'testing' ? 'テスト中…' : micStatus === 'ready' ? '✓ 音声入力OK' : 'マイクテスト'}"),
    ("if (micStatus === 'checking' || micStatus === 'prompt') {\n      setMicMessage('先に「マイクを準備する」を押して、許可確認を済ませてください。');", "if (micStatus === 'checking' || micStatus === 'prompt' || micStatus === 'testing') {\n      setMicMessage('先に「マイク・音声入力をテスト」を行い、音声入力OKを確認してください。');"),
    ("disabled={micStatus === 'checking' || micStatus === 'prompt'}", "disabled={micStatus === 'checking' || micStatus === 'prompt' || micStatus === 'testing'}"),
    ("micStatus === 'checking' || micStatus === 'prompt'\n                ? 'bg-slate-300", "micStatus === 'checking' || micStatus === 'prompt' || micStatus === 'testing'\n                ? 'bg-slate-300"),
]
for old, new in replacements:
    if old not in s:
        raise SystemExit(f'replacement target not found: {old[:60]}')
    s = s.replace(old, new, 1)

path.write_text(s)
