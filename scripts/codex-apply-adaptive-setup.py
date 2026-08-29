from pathlib import Path
import re


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    text = text.replace(old, new, 1)
    p.write_text(text)


def regex_once(path: str, pattern: str, replacement: str, flags=0):
    p = Path(path)
    text = p.read_text()
    new, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'regex count {count} in {path}: {pattern[:120]!r}')
    p.write_text(new)

# ---------------------------------------------------------------------------
# 1) Feedback data contract: AI-selected, grounded learning expressions.
# ---------------------------------------------------------------------------
replace_once(
    'src/types.ts',
    "export interface FeedbackData {\n",
    "export interface FeedbackExpressionItem {\n"
    "  english: string;\n"
    "  japanese: string;\n"
    "  reason: string;\n"
    "  evidenceText: string;\n"
    "  speaker: 'child' | 'ai';\n"
    "  messageId?: string;\n"
    "  culturalNote?: string;\n"
    "}\n\n"
    "export interface FeedbackData {\n"
)
replace_once(
    'src/types.ts',
    "  keyPhrases: Array<{\n    english: string;\n    japanese: string;\n    culturalNote?: string;\n  }>;\n",
    "  childLearningItems: FeedbackExpressionItem[];\n"
    "  aiLearningItems: FeedbackExpressionItem[];\n"
    "  keyPhrases: FeedbackExpressionItem[];\n"
)

# ---------------------------------------------------------------------------
# 2) Server: ask AI for up to three useful expressions per source, then ground
#    every item against the actual utterance before returning it.
# ---------------------------------------------------------------------------
server_helpers = r'''

type FeedbackExpressionCandidate = {
  english?: unknown;
  japanese?: unknown;
  reason?: unknown;
  speaker?: unknown;
  culturalNote?: unknown;
};

function normalizeFeedbackEvidence(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groundFeedbackExpressions(
  candidates: unknown,
  speaker: 'child' | 'ai',
  history: ReturnType<typeof canonicalizeHistory>,
  limit = 3,
) {
  if (!Array.isArray(candidates)) return [];
  const sourceMessages = history.filter((message) => message.sender === speaker && message.englishText.trim());
  const seen = new Set<string>();
  const grounded: Array<{
    english: string;
    japanese: string;
    reason: string;
    evidenceText: string;
    speaker: 'child' | 'ai';
    messageId?: string;
    culturalNote?: string;
  }> = [];

  for (const raw of candidates as FeedbackExpressionCandidate[]) {
    if (grounded.length >= limit) break;
    const english = typeof raw?.english === 'string' ? raw.english.trim().slice(0, 100) : '';
    const normalized = normalizeFeedbackEvidence(english);
    if (!english || normalized.length < 2 || seen.has(normalized)) continue;
    const source = sourceMessages.find((message) => normalizeFeedbackEvidence(message.englishText).includes(normalized));
    if (!source) continue;
    seen.add(normalized);
    grounded.push({
      english,
      japanese: typeof raw?.japanese === 'string' && raw.japanese.trim() ? raw.japanese.trim().slice(0, 100) : '対話で使われたことば・表現',
      reason: typeof raw?.reason === 'string' && raw.reason.trim() ? raw.reason.trim().slice(0, 160) : '別の英会話でも使いやすい表現です。',
      evidenceText: source.sender === 'child' ? maskHighRiskPII(source.englishText).maskedText.slice(0, 180) : source.englishText.slice(0, 180),
      speaker,
      messageId: source.id,
      culturalNote: typeof raw?.culturalNote === 'string' && raw.culturalNote.trim() ? raw.culturalNote.trim().slice(0, 160) : undefined,
    });
  }
  return grounded;
}

function groundKeyPhrases(
  candidates: unknown,
  history: ReturnType<typeof canonicalizeHistory>,
  limit = 3,
) {
  if (!Array.isArray(candidates)) return [];
  const result: ReturnType<typeof groundFeedbackExpressions> = [];
  const seen = new Set<string>();
  for (const candidate of candidates as FeedbackExpressionCandidate[]) {
    if (result.length >= limit) break;
    const preferredSpeaker = candidate?.speaker === 'ai' ? 'ai' : 'child';
    let grounded = groundFeedbackExpressions([candidate], preferredSpeaker, history, 1);
    if (grounded.length === 0) {
      const otherSpeaker = preferredSpeaker === 'child' ? 'ai' : 'child';
      grounded = groundFeedbackExpressions([candidate], otherSpeaker, history, 1);
    }
    const item = grounded[0];
    if (!item) continue;
    const key = normalizeFeedbackEvidence(item.english);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
'''
replace_once(
    'server.ts',
    "app.post('/api/feedback', async (req, res) => {",
    server_helpers + "\napp.post('/api/feedback', async (req, res) => {"
)

replace_once(
    'server.ts',
    "  const examples = childUtterances.map((t) => `「${t}」`).join('、');\n",
    "  const examples = childUtterances.map((t) => `「${t}」`).join('、');\n"
    "  const feedbackTranscript = rawHistory.map((message, index) => {\n"
    "    const safeText = message.sender === 'child'\n"
    "      ? maskHighRiskPII(message.englishText.trim()).maskedText.slice(0, 180)\n"
    "      : message.englishText.trim().slice(0, 180);\n"
    "    return `${index + 1}. ${message.sender === 'child' ? '児童' : 'AI留学生'}: ${safeText}`;\n"
    "  }).filter((line) => !line.endsWith(': ')).join('\\n');\n"
)

old_prompt = '''  const prompt = `小学5・6年生の英会話練習を日本語で短く講評してください。\n留学生: ${persona.name}\n時間: ${targetDuration}分\nターン: ${stats.totalTurns}\n児童の実際の発話: ${examples || '(発話なし)'}\n\n実際に出た表現だけを keyPhrases に入れ、架空の発話を追加しないでください。\nJSONのみ:\n{\n "goodPoints":["...","...","..."],\n "improvementAdvice":{"title":"...","detail":"...","examplePhrase":"..."},\n "overallComment":"指導者としての短い総合講評",\n "studentMessage":"選択された留学生本人が、実際の対話内容に触れながら児童へ直接話す自然な短い日本語メッセージ。必ず日本語で書き、英語文は書かない",\n "keyPhrases":[{"english":"...","japanese":"...","culturalNote":"..."}]\n}`;'''
new_prompt = '''  const prompt = `小学5・6年生の英会話練習を日本語で短く講評してください。\n留学生: ${persona.name}\n時間: ${targetDuration}分\nターン: ${stats.totalTurns}\n児童の実際の発話: ${examples || '(発話なし)'}\n\n【実際の対話ログ】\n${feedbackTranscript || '(発話なし)'}\n\n次の3種類を、実際の対話ログだけを根拠に選んでください。架空の語・表現は禁止です。\n1. childLearningItems: 児童自身が実際に使った語・短いチャンク・表現から、今後も役立つものを最大3件。細かな固定辞書には縛られない。\n2. aiLearningItems: AI留学生が実際に使った語・短いチャンク・表現から、児童が今後使えそうなものを最大3件。\n3. keyPhrases: 児童またはAIが実際に使った表現のうち、別の相手・別のテーマでも再利用価値が特に高い重要表現を最大3件。会話をつなぐ、質問する、自分を伝える、理由を伝える、聞き返す表現を優先する。\n適切なものが1〜2件しかなければ無理に3件作らないでください。englishは必ずログ中の連続した実際の語句をそのまま抜き出してください。\n\nJSONのみ:\n{\n "goodPoints":["...","...","..."],\n "improvementAdvice":{"title":"...","detail":"...","examplePhrase":"..."},\n "overallComment":"指導者としての短い総合講評",\n "studentMessage":"選択された留学生本人が、実際の対話内容に触れながら児童へ直接話す自然な短い日本語メッセージ。必ず日本語で書き、英語文は書かない",\n "childLearningItems":[{"english":"実発話から抜き出した語・表現","japanese":"意味","reason":"なぜ今後役立つか"}],\n "aiLearningItems":[{"english":"実発話から抜き出した語・表現","japanese":"意味","reason":"なぜ児童に役立つか"}],\n "keyPhrases":[{"english":"実発話から抜き出した重要表現","japanese":"意味","reason":"なぜ重要か","speaker":"child または ai","culturalNote":"必要な場合だけ"}]\n}`;'''
replace_once('server.ts', old_prompt, new_prompt)

replace_once('server.ts', '      900\n    );', '      1400\n    );')

old_key_processing = '''    const uniqueKeyPhrases = Array.isArray(parsed.keyPhrases)\n      ? parsed.keyPhrases.filter((phrase: any, index: number, all: any[]) => {\n          const key = String(phrase?.english || '').trim().toLowerCase();\n          return key && all.findIndex((p: any) => String(p?.english || '').trim().toLowerCase() === key) === index;\n        })\n      : [];'''
new_key_processing = '''    const childLearningItems = groundFeedbackExpressions(parsed.childLearningItems, 'child', rawHistory, 3);\n    const aiLearningItems = groundFeedbackExpressions(parsed.aiLearningItems, 'ai', rawHistory, 3);\n    const uniqueKeyPhrases = groundKeyPhrases(parsed.keyPhrases, rawHistory, 3);'''
replace_once('server.ts', old_key_processing, new_key_processing)

replace_once(
    'server.ts',
    "        keyPhrases: uniqueKeyPhrases,\n        encounteredVocab: canonicalVocab,",
    "        childLearningItems,\n        aiLearningItems,\n        keyPhrases: uniqueKeyPhrases,\n        encounteredVocab: canonicalVocab,"
)

# ---------------------------------------------------------------------------
# 3) Fallback: still grounded in real utterances when the AI feedback call is
#    unavailable. The AI route remains the normal selection route.
# ---------------------------------------------------------------------------
insert_before_return = r'''
  const childLearningItems: FeedbackData['childLearningItems'] = childMsgs.slice(0, 3).map((message) => ({
    english: maskHighRiskPII(message.englishText.trim()).maskedText.slice(0, 100),
    japanese: message.japaneseText?.trim() || '自分が対話で実際に使った表現',
    reason: '今回の対話で自分から実際に使えた英語です。',
    evidenceText: maskHighRiskPII(message.englishText.trim()).maskedText.slice(0, 180),
    speaker: 'child',
    messageId: message.id,
  }));

  const aiLearningItems: FeedbackData['aiLearningItems'] = history
    .filter((message) => message.sender === 'ai' && message.englishText?.trim())
    .slice(0, 3)
    .map((message) => ({
      english: message.englishText.trim().slice(0, 100),
      japanese: message.japaneseText?.trim() || 'AI留学生が対話で実際に使った表現',
      reason: 'AI留学生が今回の対話で実際に使った、次の会話でも参考になる英語です。',
      evidenceText: message.englishText.trim().slice(0, 180),
      speaker: 'ai',
      messageId: message.id,
    }));

  const fallbackKeyPhrases: FeedbackData['keyPhrases'] = extractedPhrases
    .map((phrase) => {
      const phraseLower = phrase.english.trim().toLowerCase();
      const source = history.find((message) => message.englishText?.toLowerCase().includes(phraseLower));
      if (!source) return null;
      return {
        english: phrase.english,
        japanese: phrase.japanese,
        reason: phrase.culturalNote || '別の英会話でも使いやすい表現です。',
        evidenceText: source.sender === 'child'
          ? maskHighRiskPII(source.englishText.trim()).maskedText.slice(0, 180)
          : source.englishText.trim().slice(0, 180),
        speaker: source.sender as 'child' | 'ai',
        messageId: source.id,
        culturalNote: phrase.culturalNote,
      };
    })
    .filter((item): item is FeedbackData['keyPhrases'][number] => item !== null)
    .slice(0, 3);

'''
replace_once('src/utils/feedbackFallback.ts', '  return {\n    goodPoints:', insert_before_return + '  return {\n    goodPoints:')
replace_once(
    'src/utils/feedbackFallback.ts',
    '    keyPhrases: extractedPhrases,\n    encounteredVocab:',
    '    childLearningItems,\n    aiLearningItems,\n    keyPhrases: fallbackKeyPhrases,\n    encounteredVocab:'
)

# ---------------------------------------------------------------------------
# 4) Feedback UI: use AI-selected grounded items, keep fixed dictionary only as
#    optional textbook metadata, and explain why each item matters.
# ---------------------------------------------------------------------------
replace_once(
    'src/components/FeedbackScreen.tsx',
    "import React, { useMemo, useState } from 'react';",
    "import React from 'react';"
)
replace_once(
    'src/components/FeedbackScreen.tsx',
    "import { ChatMessage, FeedbackData, StudentProfile, VisualVocabularyItem } from '../types';",
    "import { ChatMessage, FeedbackData, FeedbackExpressionItem, StudentProfile, VisualVocabularyItem } from '../types';"
)
replace_once(
    'src/components/FeedbackScreen.tsx',
    "import { speakVocabularyWord } from '../utils/speech';\n",
    ''
)

# Replace old vocabulary evidence helper block with the new learning-expression component.
regex_once(
    'src/components/FeedbackScreen.tsx',
    r"interface VocabularyEvidence \{.*?const EvidenceList: React\.FC<EvidenceListProps> = \(\{ items, emptyText, playingWordId, onPlay \}\) => \{.*?\n\};\n\n",
    r'''interface LearningItemListProps {
  items: FeedbackExpressionItem[];
  emptyText: string;
  onPlay: (text: string) => void;
  accent: 'emerald' | 'amber';
}

const LearningItemList: React.FC<LearningItemListProps> = ({ items, emptyText, onPlay, accent }) => {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] font-semibold text-slate-500">{emptyText}</p>;
  }
  const badgeClass = accent === 'emerald' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200';
  return <div className="space-y-2.5">{items.map((item, index) => {
    const dictionaryMatch = detectVocabularyInText(item.english)[0];
    return <div key={`${item.messageId || index}-${item.english}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-900 sm:text-sm">{item.english}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-600">{item.japanese}</p>
          {dictionaryMatch?.mitsumuraUnit && <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${badgeClass}`}>{dictionaryMatch.mitsumuraUnit}</span>}
        </div>
        <button type="button" onClick={() => onPlay(item.english)} className="shrink-0 rounded-xl border border-blue-200 bg-white p-2 text-blue-700" aria-label={`${item.english}を再生`}><Volume2 className="h-4 w-4" /></button>
      </div>
      <p className="mt-2 text-[10px] font-semibold leading-relaxed text-slate-700"><span className="font-black">なぜ大切？</span> {item.reason}</p>
      <div className="mt-2 rounded-xl border border-blue-100 bg-white px-2.5 py-2">
        <p className="text-[9px] font-black text-blue-700">根拠となる実際の発話</p>
        <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-relaxed text-slate-700">“{item.evidenceText}”</p>
      </div>
    </div>;
  })}</div>;
};

''',
    flags=re.S,
)

replace_once('src/components/FeedbackScreen.tsx', "  const [playingWordId, setPlayingWordId] = useState<string | null>(null);\n", '')
regex_once(
    'src/components/FeedbackScreen.tsx',
    r"\n  const \{ childVocabulary, aiVocabulary \} = useMemo\(\(\) => \{.*?\n  \}, \[encounteredVocabList, messages\]\);\n\n  const handlePlayVocab = \(item: VisualVocabularyItem\) => \{.*?\n  \};\n",
    '\n',
    flags=re.S,
)
# prop is retained in the public interface/App contract but no longer destructured because selection now comes from feedback.
replace_once('src/components/FeedbackScreen.tsx', '  encounteredVocabList,\n  onPlayAudio,', '  onPlayAudio,')

old_child_section = '''                  <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><BookOpen className="h-4 w-4 text-emerald-600" />🗣 自分が使ったことば</h2><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{childVocabulary.length}語</span></div>\n                  <EvidenceList items={childVocabulary} emptyText="今回は、辞書に登録された語彙の中で児童自身の発話から確認できる語はありませんでした。" playingWordId={playingWordId} onPlay={handlePlayVocab} />'''
new_child_section = '''                  <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><BookOpen className="h-4 w-4 text-emerald-600" />🗣 自分が使ったことば・表現</h2><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{feedback?.childLearningItems?.length || 0}件</span></div>\n                  <LearningItemList items={feedback?.childLearningItems || []} emptyText="今回は実発話から学習価値の高いことば・表現を選べませんでした。" onPlay={onPlayAudio} accent="emerald" />'''
replace_once('src/components/FeedbackScreen.tsx', old_child_section, new_child_section)

old_ai_section = '''                  <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Sparkles className="h-4 w-4 text-amber-600" />💡 AI留学生から出会ったことば</h2><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">{aiVocabulary.length}語</span></div>\n                  <EvidenceList items={aiVocabulary} emptyText="今回は、辞書に登録された新しい語彙はAI留学生の発話から確認されませんでした。" playingWordId={playingWordId} onPlay={handlePlayVocab} />'''
new_ai_section = '''                  <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Sparkles className="h-4 w-4 text-amber-600" />💡 AI留学生から出会ったことば・表現</h2><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">{feedback?.aiLearningItems?.length || 0}件</span></div>\n                  <LearningItemList items={feedback?.aiLearningItems || []} emptyText="今回は実発話から新しく学ぶ価値の高いことば・表現を選べませんでした。" onPlay={onPlayAudio} accent="amber" />'''
replace_once('src/components/FeedbackScreen.tsx', old_ai_section, new_ai_section)

old_key = '''{uniqueKeyPhrases.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900"><MessageSquare className="h-4 w-4 text-blue-600" />重要キーフレーズ (Key Expressions)</h2><div className="space-y-1.5">{uniqueKeyPhrases.map((phrase, idx) => <div key={idx} className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5"><div className="flex items-center justify-between"><span className="text-xs font-black text-blue-950">{phrase.english}</span><button type="button" onClick={() => onPlayAudio(phrase.english)} className="p-1 text-blue-700"><Volume2 className="h-4 w-4" /></button></div><p className="text-[11px] font-semibold text-slate-600">{phrase.japanese}</p>{phrase.culturalNote && <p className="mt-1 text-[10px] text-blue-700">💡 {phrase.culturalNote}</p>}</div>)}</div></section>}'''
new_key = '''{uniqueKeyPhrases.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900"><MessageSquare className="h-4 w-4 text-blue-600" />⭐ 重要キーフレーズ (Key Expressions)</h2><p className="mb-3 text-[10px] font-semibold text-slate-500">別の相手・別のテーマでも使いやすい表現を、実際の対話から最大3つ選んでいます。</p><div className="space-y-2">{uniqueKeyPhrases.map((phrase, idx) => <div key={`${phrase.messageId || idx}-${phrase.english}`} className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5"><div className="flex items-start justify-between gap-2"><div><span className="text-xs font-black text-blue-950">{phrase.english}</span><p className="text-[11px] font-semibold text-slate-600">{phrase.japanese}</p></div><button type="button" onClick={() => onPlayAudio(phrase.english)} className="p-1 text-blue-700"><Volume2 className="h-4 w-4" /></button></div><p className="mt-1 text-[10px] font-semibold text-blue-800"><span className="font-black">なぜ重要？</span> {phrase.reason}</p><p className="mt-1 rounded-lg bg-white/80 px-2 py-1 text-[9px] font-semibold text-slate-600"><span className="font-black text-slate-700">{phrase.speaker === 'child' ? '🗣 あなた' : '💡 AI留学生'}の実際の発話：</span> “{phrase.evidenceText}”</p>{phrase.culturalNote && <p className="mt-1 text-[9px] text-blue-700">💡 {phrase.culturalNote}</p>}</div>)}</div></section>}'''
replace_once('src/components/FeedbackScreen.tsx', old_key, new_key)

# Remove imports that became unused after moving to AI-selected items.
replace_once('src/components/FeedbackScreen.tsx', 'import { ChatMessage, FeedbackData, FeedbackExpressionItem, StudentProfile, VisualVocabularyItem } from \'../types\';', "import { ChatMessage, FeedbackData, FeedbackExpressionItem, StudentProfile } from '../types';")

# ---------------------------------------------------------------------------
# 5) Setup layout: remove the start-button auto spacer and make both columns
#    scale as a single composition on landscape screens.
# ---------------------------------------------------------------------------
replace_once(
    'src/components/SetupScreen.tsx',
    'className="setup-start mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl',
    'className="setup-start flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl'
)

css = Path('src/index.css').read_text()
start = css.index('/*\n * Setup screen responsive contract')
end = css.index('::-webkit-scrollbar')
new_contract = r'''/*
 * Setup screen responsive contract
 * The two landscape columns are one fluid composition: cards, portraits, text,
 * controls and gaps scale together. Portrait/narrow screens use natural
 * vertical flow instead of being squeezed to fit.
 */
.setup-screen {
  min-height: 100dvh;
  width: 100%;
  box-sizing: border-box;
}

.setup-shell {
  min-height: calc(100dvh - 1rem);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.setup-main,
.setup-student-section,
.setup-student-grid,
.setup-controls {
  min-width: 0;
  min-height: 0;
}

.setup-student-card,
.setup-profile,
.setup-topic,
.setup-duration,
.setup-start {
  min-width: 0;
  box-sizing: border-box;
}

@media (min-width: 1024px) and (orientation: landscape) {
  .setup-main {
    align-self: stretch;
    height: 100%;
    min-height: 0;
  }

  .setup-student-section {
    height: 100%;
  }

  .setup-student-grid {
    min-height: 0;
    grid-template-rows: repeat(3, minmax(0, 1fr));
  }

  .setup-student-card {
    min-height: 0 !important;
    overflow: hidden;
    padding: clamp(0.42rem, min(0.72vw, 1.05vh), 0.78rem) !important;
  }

  .setup-student-card > div:first-of-type {
    margin-bottom: clamp(0.2rem, 0.45vh, 0.42rem) !important;
    font-size: clamp(10px, min(0.77vw, 1.35vh), 12px) !important;
  }

  .setup-student-card > div:nth-of-type(2) {
    grid-template-columns: clamp(52px, min(4.7vw, 7.2vh), 76px) minmax(0, 1fr) !important;
    gap: clamp(0.38rem, min(0.65vw, 0.9vh), 0.68rem) !important;
  }

  .setup-student-card img {
    width: clamp(52px, min(4.7vw, 7.2vh), 76px) !important;
    height: clamp(52px, min(4.7vw, 7.2vh), 76px) !important;
  }

  .setup-student-card h3 {
    font-size: clamp(10.5px, min(0.84vw, 1.45vh), 13px) !important;
  }

  .setup-student-card h3 + p {
    font-size: clamp(9.5px, min(0.72vw, 1.28vh), 11px) !important;
  }

  .setup-student-card h3 + p + p {
    font-size: clamp(8.5px, min(0.65vw, 1.12vh), 10px) !important;
  }

  .setup-student-card h3 + p + p + p {
    margin-top: clamp(0.18rem, 0.35vh, 0.35rem) !important;
    padding: clamp(0.2rem, 0.34vh, 0.32rem) clamp(0.35rem, 0.45vw, 0.55rem) !important;
    font-size: clamp(7.8px, min(0.59vw, 1.02vh), 9px) !important;
  }

  .setup-student-card > button:last-child {
    min-height: clamp(27px, 3.8vh, 34px) !important;
    margin-top: clamp(0.25rem, 0.55vh, 0.5rem) !important;
    font-size: clamp(9px, min(0.69vw, 1.16vh), 11px) !important;
  }

  .setup-controls {
    height: 100%;
    display: grid !important;
    grid-template-rows: minmax(0, 1.45fr) minmax(0, 0.92fr) minmax(0, 0.5fr) auto;
    gap: clamp(0.38rem, min(0.62vw, 0.72vh), 0.62rem) !important;
  }

  .setup-profile,
  .setup-topic,
  .setup-duration {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    padding: clamp(0.5rem, min(0.82vw, 1.05vh), 0.8rem) !important;
  }

  .setup-profile {
    display: flex;
    align-items: center;
  }

  .setup-profile > div {
    width: 100%;
    grid-template-columns: minmax(0, 1fr) clamp(110px, min(12.2vw, 22vh), 170px) !important;
    gap: clamp(0.45rem, min(0.8vw, 1vh), 0.8rem) !important;
  }

  .setup-profile img {
    width: 100% !important;
    max-width: none !important;
  }

  .setup-profile h3 {
    font-size: clamp(14px, min(1.18vw, 2vh), 18px) !important;
  }

  .setup-profile p {
    line-height: 1.28;
  }

  .setup-profile .text-sm {
    font-size: clamp(10.5px, min(0.86vw, 1.45vh), 14px) !important;
  }

  .setup-profile .text-\[11px\] {
    font-size: clamp(8.8px, min(0.7vw, 1.18vh), 11px) !important;
  }

  .setup-profile .text-\[10px\] {
    font-size: clamp(8px, min(0.64vw, 1.05vh), 10px) !important;
  }

  .setup-topic,
  .setup-duration {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .setup-topic h2,
  .setup-duration h2 {
    margin-bottom: clamp(0.2rem, 0.4vh, 0.45rem) !important;
    font-size: clamp(10.5px, min(0.82vw, 1.35vh), 14px) !important;
  }

  .setup-topic button {
    min-height: clamp(31px, 4.6vh, 42px) !important;
    padding: clamp(0.2rem, 0.45vh, 0.42rem) clamp(0.5rem, 0.7vw, 0.75rem) !important;
  }

  .setup-topic button span:first-child,
  .setup-duration button span:first-child {
    font-size: clamp(9.5px, min(0.76vw, 1.24vh), 12px) !important;
  }

  .setup-topic button span:last-child,
  .setup-duration button span:last-child {
    font-size: clamp(7.5px, min(0.58vw, 0.98vh), 9px) !important;
  }

  .setup-duration button {
    padding-top: clamp(0.22rem, 0.45vh, 0.42rem) !important;
    padding-bottom: clamp(0.22rem, 0.45vh, 0.42rem) !important;
  }

  .setup-start {
    min-height: clamp(42px, 5.8vh, 54px) !important;
    margin-top: 0 !important;
    font-size: clamp(12px, min(1vw, 1.65vh), 16px) !important;
  }
}

@media (max-width: 1023px), (orientation: portrait) {
  .setup-shell {
    min-height: auto;
    grid-template-rows: auto auto auto;
  }

  .setup-main {
    height: auto;
    align-self: start;
  }

  .setup-controls {
    height: auto;
  }
}

@media (max-width: 519px) {
  .setup-screen {
    padding: 0.375rem;
  }

  .setup-header,
  .setup-profile,
  .setup-topic,
  .setup-duration {
    border-radius: 1rem;
  }

  .setup-student-card {
    min-height: 156px !important;
  }
}

'''
Path('src/index.css').write_text(css[:start] + new_contract + css[end:])

# ---------------------------------------------------------------------------
# 6) QA: ensure AI-selected grounded expressions and proportional setup layout
#    remain part of the standard contract.
# ---------------------------------------------------------------------------
qa_path = Path('scripts/qa-responsive-vocabulary.ts')
qa = qa_path.read_text()
qa = qa.replace(
    "assert.ok(feedback.includes('自分が使ったことば'), 'child-produced vocabulary section must exist');\nassert.ok(feedback.includes('AI留学生から出会ったことば'), 'AI-provided vocabulary section must exist');\nassert.ok(feedback.includes('根拠となる実際の発話'), 'each displayed vocabulary item must show utterance evidence');\nassert.ok(feedback.includes(\"message.sender === 'child' ? childMap : aiMap\"), 'vocabulary must be split by actual speaker');\n",
    "assert.ok(feedback.includes('自分が使ったことば・表現'), 'AI-selected child learning section must exist');\n"
    "assert.ok(feedback.includes('AI留学生から出会ったことば・表現'), 'AI-selected exchange-student learning section must exist');\n"
    "assert.ok(feedback.includes('根拠となる実際の発話'), 'each displayed learning item must show utterance evidence');\n"
    "assert.ok(feedback.includes('なぜ大切？'), 'learning items must explain their educational value');\n"
    "assert.ok(feedback.includes('なぜ重要？'), 'key phrases must explain why they are reusable');\n"
)
qa += "\nconst server = fs.readFileSync('server.ts', 'utf8');\n"
qa += "assert.ok(server.includes('childLearningItems'), 'feedback API must request child learning items');\n"
qa += "assert.ok(server.includes('aiLearningItems'), 'feedback API must request AI learning items');\n"
qa += "assert.ok(server.includes('groundFeedbackExpressions'), 'AI-selected items must be grounded against actual utterances');\n"
qa += "assert.ok(server.includes('groundKeyPhrases'), 'key phrases must be grounded against actual utterances');\n"
qa += "assert.ok(server.includes('最大3件'), 'feedback prompt must cap each learning list');\n"
qa += "assert.equal(setup.includes('setup-start mt-auto'), false, 'start button must not create an artificial vertical spacer');\n"
qa += "assert.ok(css.includes('grid-template-rows: minmax(0, 1.45fr)'), 'right setup column must proportionally share available height');\n"
qa += "assert.ok(css.includes('clamp(52px, min(4.7vw, 7.2vh), 76px)'), 'student avatar must scale with viewport while preserving proportions');\n"
qa += "assert.equal(css.includes('min-height: min(760px'), false, 'setup layout must not use old fixed desktop height contract');\n"
qa_path.write_text(qa)

print('Adaptive setup + grounded AI feedback patch applied.')
