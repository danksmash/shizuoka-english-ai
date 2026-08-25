from pathlib import Path
import re

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 target, found {count}')
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# App.tsx: use Cloud Run API on GitHub Pages, and let AI own child translation.
# -----------------------------------------------------------------------------
path = 'src/App.tsx'
text = read(path)
text = replace_once(
    text,
    "import { STARTER_PROMPTS_JAPANESE, translateChildUtterance } from './utils/translation';\nimport { motion, AnimatePresence } from 'motion/react';\n",
    "import { STARTER_PROMPTS_JAPANESE } from './utils/translation';\nimport { motion, AnimatePresence } from 'motion/react';\n\nconst API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\\/$/, '');\nconst apiUrl = (path: string) => `${API_BASE_URL}${path}`;\n",
    'App imports/API base',
)
text = replace_once(
    text,
    "    const words = countEnglishWords(trimmed);\n    const localChildJapanese = translateChildUtterance(trimmed);\n    const childJapanese = /[ぁ-んァ-ヶ一-龠]/.test(localChildJapanese)\n      ? localChildJapanese\n      : '日本語訳を準備中です。';\n    const childMsg: ChatMessage = {\n",
    "    const words = countEnglishWords(trimmed);\n    const childMsg: ChatMessage = {\n",
    'remove local child translation',
)
text = replace_once(text, "      japaneseText: childJapanese,\n", "      japaneseText: '',\n", 'empty child translation until AI returns')
text = replace_once(text, "      const response = await fetch('/api/chat', {\n", "      const response = await fetch(apiUrl('/api/chat'), {\n", 'chat API URL')
text = replace_once(
    text,
    "          studentJapaneseTranslation,\n          mood: aiMood,\n",
    "          studentJapaneseTranslation,\n          studentTranslationStatus,\n          mood: aiMood,\n",
    'read translation status',
)
old_map = """        const translatedHistory = messagesRef.current.map((message) =>
          message.id === childMsg.id &&
          typeof studentJapaneseTranslation === 'string' &&
          studentJapaneseTranslation.trim().length > 0
            ? { ...message, japaneseText: studentJapaneseTranslation.trim() }
            : message
        );
"""
new_map = """        const translatedHistory = messagesRef.current.map((message) => {
          if (message.id !== childMsg.id) return message;
          if (studentTranslationStatus === 'incomplete') {
            return { ...message, japaneseText: '日本語に訳せませんでした。' };
          }
          if (
            typeof studentJapaneseTranslation === 'string' &&
            studentJapaneseTranslation.trim().length > 0
          ) {
            return { ...message, japaneseText: studentJapaneseTranslation.trim() };
          }
          return { ...message, japaneseText: '日本語に訳せませんでした。' };
        });
"""
text = replace_once(text, old_map, new_map, 'persist AI translation/status')
text = replace_once(
    text,
    "      const words = countEnglishWords(pendingText);\n      const localChildJapanese = translateChildUtterance(pendingText);\n      const childJapanese = /[ぁ-んァ-ヶ一-龠]/.test(localChildJapanese)\n        ? localChildJapanese\n        : '日本語訳を準備できませんでした。';\n      const pendingChildMsg: ChatMessage = {\n",
    "      const words = countEnglishWords(pendingText);\n      const pendingChildMsg: ChatMessage = {\n",
    'remove local pending translation',
)
text = replace_once(text, "        japaneseText: childJapanese,\n", "        japaneseText: '日本語に訳せませんでした。',\n", 'pending unsent translation label')
text = replace_once(text, "        const response = await fetch('/api/feedback', {\n", "        const response = await fetch(apiUrl('/api/feedback'), {\n", 'feedback API URL')
write(path, text)


# -----------------------------------------------------------------------------
# translation.ts: never echo English into the Japanese translation field.
# -----------------------------------------------------------------------------
path = 'src/utils/translation.ts'
text = read(path)
text = replace_once(
    text,
    "  if (msg.sender === 'child') {\n    return translateChildUtterance(msg.englishText);\n  }\n",
    "  if (msg.sender === 'child') {\n    const translated = translateChildUtterance(msg.englishText);\n    return /[ぁ-んァ-ヶ一-龠]/.test(translated)\n      ? translated\n      : '日本語に訳せませんでした。';\n  }\n",
    'child translation final guard',
)
write(path, text)


# -----------------------------------------------------------------------------
# server.ts: CORS for GitHub Pages + explicit AI translation status.
# -----------------------------------------------------------------------------
path = 'server.ts'
text = read(path)
old_middleware = """// Security Middleware: Set headers compatible with iframe embedding
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
"""
new_middleware = """// Security + CORS middleware for the GitHub Pages frontend.
const ALLOWED_ORIGINS = new Set([
  'https://danksmash.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
]);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
"""
text = replace_once(text, old_middleware, new_middleware, 'CORS middleware')
text = replace_once(
    text,
    '  "studentJapaneseTranslation": "Natural Japanese translation of the student latest English input; never copy the English input as-is",\n',
    '  "studentJapaneseTranslation": "Natural Japanese translation of the student latest English input, or exactly 日本語に訳せませんでした。 when the utterance is too incomplete to translate reliably",\n  "studentTranslationStatus": "translated" | "incomplete",\n',
    'system translation schema',
)
text = replace_once(
    text,
    '6. Translate the student latest English input into natural Japanese in studentJapaneseTranslation. It must be Japanese, not a copy of the English text.\n7. Return strictly valid JSON: { "reply": "...", "japaneseTranslation": "...", "studentJapaneseTranslation": "...", "mood": "happy"|"speaking"|"encouraging", "culturalNote": "..." }`;\n',
    '6. Translate the student latest English input into natural Japanese in studentJapaneseTranslation. Normal complete utterances and questions, including short expressions such as "How are you?", "Yes.", "No.", "I like soccer.", MUST be translated.\n7. Only when the latest English is so fragmentary that its intended meaning cannot be translated reliably, set studentTranslationStatus to "incomplete" and studentJapaneseTranslation to exactly "日本語に訳せませんでした。". Otherwise set studentTranslationStatus to "translated".\n8. Return strictly valid JSON: { "reply": "...", "japaneseTranslation": "...", "studentJapaneseTranslation": "...", "studentTranslationStatus": "translated"|"incomplete", "mood": "happy"|"speaking"|"encouraging", "culturalNote": "..." }`;\n',
    'prompt translation rules',
)
old_translation_validation = """      const studentJapaneseTranslation =
        typeof parsed.studentJapaneseTranslation === 'string' &&
        /[ぁ-んァ-ヶ一-龠]/.test(parsed.studentJapaneseTranslation)
          ? parsed.studentJapaneseTranslation.trim()
          : '日本語訳を準備できませんでした。';
"""
new_translation_validation = """      const studentTranslationStatus =
        parsed.studentTranslationStatus === 'incomplete' ? 'incomplete' : 'translated';
      const studentJapaneseTranslation =
        studentTranslationStatus === 'incomplete'
          ? '日本語に訳せませんでした。'
          : typeof parsed.studentJapaneseTranslation === 'string' &&
              /[ぁ-んァ-ヶ一-龠]/.test(parsed.studentJapaneseTranslation)
            ? parsed.studentJapaneseTranslation.trim()
            : '日本語に訳せませんでした。';
"""
text = replace_once(text, old_translation_validation, new_translation_validation, 'translation validation')
text = replace_once(
    text,
    "          studentJapaneseTranslation,\n          mood: parsed.mood || 'speaking',\n",
    "          studentJapaneseTranslation,\n          studentTranslationStatus,\n          mood: parsed.mood || 'speaking',\n",
    'return translation status',
)
# Dedupe AI-generated key phrases before returning feedback.
old_feedback_return = """      const parsed = JSON.parse(jsonStr);
      return res.json({
        success: true,
        isFallback: false,
        data: {
          ...parsed,
          encounteredVocab: encounteredVocab || [],
"""
new_feedback_return = """      const parsed = JSON.parse(jsonStr);
      const uniqueKeyPhrases = Array.isArray(parsed.keyPhrases)
        ? parsed.keyPhrases.filter((phrase: any, index: number, all: any[]) => {
            const key = String(phrase?.english || '').trim().toLowerCase();
            return key.length > 0 && all.findIndex((candidate: any) =>
              String(candidate?.english || '').trim().toLowerCase() === key
            ) === index;
          })
        : [];
      return res.json({
        success: true,
        isFallback: false,
        data: {
          ...parsed,
          keyPhrases: uniqueKeyPhrases,
          encounteredVocab: encounteredVocab || [],
"""
text = replace_once(text, old_feedback_return, new_feedback_return, 'server key phrase dedupe')
write(path, text)


# -----------------------------------------------------------------------------
# FeedbackScreen.tsx: UI-level key phrase dedupe as a final guard.
# -----------------------------------------------------------------------------
path = 'src/components/FeedbackScreen.tsx'
text = read(path)
text = replace_once(
    text,
    "  const aiStudent = getAIStudentById(profile.selectedAiStudentId);\n\n  const formatTime = (secs: number) => {\n",
    "  const aiStudent = getAIStudentById(profile.selectedAiStudentId);\n  const uniqueKeyPhrases = (feedback?.keyPhrases || []).filter((phrase, index, all) => {\n    const key = phrase.english.trim().toLowerCase();\n    return key.length > 0 && all.findIndex((candidate) => candidate.english.trim().toLowerCase() === key) === index;\n  });\n\n  const formatTime = (secs: number) => {\n",
    'UI key phrase dedupe',
)
text = text.replace('feedback?.keyPhrases && feedback.keyPhrases.length > 0', 'uniqueKeyPhrases.length > 0')
text = text.replace('feedback.keyPhrases.map((phrase, idx) => (', 'uniqueKeyPhrases.map((phrase, idx) => (')
write(path, text)


# -----------------------------------------------------------------------------
# SetupScreen.tsx: selected student detail = information left, large portrait right.
# -----------------------------------------------------------------------------
path = 'src/components/SetupScreen.tsx'
text = read(path)
pattern = re.compile(
    r'''          <div className="bg-white rounded-2xl p-2\.5 sm:p-3 border border-slate-200 shadow-2xs flex flex-col gap-1\.5 min-h-0">.*?          </div>\n\n          <div className="bg-white rounded-2xl p-2 sm:p-2\.5 border border-slate-200 shadow-2xs">''',
    re.S,
)
replacement = '''          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs min-h-0">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(150px,42%)] gap-3 sm:gap-4 items-stretch min-h-0">
              <div className="min-w-0 flex flex-col justify-center gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xl sm:text-2xl leading-none">{selectedStudent.flag}</span>
                    <span className="text-xs sm:text-sm font-black text-slate-800">
                      {selectedStudent.countryJapanese} ({getStudentCountryDisplay(selectedStudent)})
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap mt-1">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">{selectedStudent.name}</h3>
                    <span className="text-xs sm:text-sm font-bold text-blue-700">{selectedStudent.japaneseName}</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-blue-700 mt-0.5">
                    {selectedStudent.age}歳 · {selectedStudent.city}
                  </p>
                </div>

                <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/60 font-medium break-words">
                  {selectedStudent.japaneseBio}
                </p>

                <div className="grid grid-cols-1 gap-1.5 text-[11px] sm:text-xs text-slate-700 font-medium">
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-slate-900 flex-shrink-0">❤️ 好き:</span>
                    <span className="text-slate-700 leading-snug break-words">{selectedStudent.likes.join('、')}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-slate-900 flex-shrink-0">🎓 専攻:</span>
                    <span className="text-slate-700 leading-snug">{selectedStudent.major}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-slate-900 flex-shrink-0">🏛️ 名所:</span>
                    <span className="text-slate-700 leading-snug">{selectedStudent.heritageLandmark}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center min-w-0">
                <div className="w-full max-w-[220px] aspect-[4/5] rounded-2xl border-2 border-blue-200 shadow-sm overflow-hidden bg-slate-100">
                  <StudentAvatar student={selectedStudent} size="custom" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-2 sm:p-2.5 border border-slate-200 shadow-2xs">'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'Setup selected card: expected 1 replacement, found {count}')
write(path, text)


# -----------------------------------------------------------------------------
# GitHub Pages workflow: compile public frontend with the actual Cloud Run URL.
# -----------------------------------------------------------------------------
path = '.github/workflows/pages.yml'
text = read(path)
text = replace_once(
    text,
    "      - name: Build project (Vite & Pages Assets)\n        run: npm run build\n",
    "      - name: Build project (Vite & Pages Assets)\n        env:\n          VITE_API_BASE_URL: https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app\n        run: npm run build\n",
    'Pages API base env',
)
write(path, text)

print('Public repair patches applied.')
