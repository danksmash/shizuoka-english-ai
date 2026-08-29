from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'expected text not found in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'expected exactly one match in {path}, found {text.count(old)}')
    p.write_text(text.replace(old, new, 1))

# Give the feedback model the selected dialogue topic so it can interpret the
# whole conversation in relation to the learning focus without hard-coded scoring.
replace_once(
    'src/App.tsx',
    "aiStudentId:currentProf.selectedAiStudentId,encounteredVocab:encounteredVocabRef.current",
    "aiStudentId:currentProf.selectedAiStudentId,topic:currentProf.selectedTopic,encounteredVocab:encounteredVocabRef.current",
)

# The UI must render the server-selected items as-is. It must not decide that
# the first array entries are educationally important.
replace_once(
    'src/components/FeedbackScreen.tsx',
    "  const childLearningItems = (feedback?.childLearningItems || []).slice(0, 1);\n  const aiLearningItems = (feedback?.aiLearningItems || []).slice(0, 2);",
    "  const childLearningItems = feedback?.childLearningItems || [];\n  const aiLearningItems = feedback?.aiLearningItems || [];",
)

replace_once(
    'server.ts',
    "import { detectVocabularyInText } from './src/data/vocabulary56';",
    "import { detectVocabularyInText } from './src/data/vocabulary56';\nimport { getTopicLearningGoals } from './src/data/topicLearningGoals';",
)

replace_once(
    'server.ts',
    "  const { history, durationMinutes, aiStudentId } = req.body;",
    "  const { history, durationMinutes, aiStudentId, topic } = req.body;",
)

replace_once(
    'server.ts',
    "  const persona = getAIStudentById(aiStudentId);\n  const rawHistory = canonicalizeHistory(history);",
    "  const persona = getAIStudentById(aiStudentId);\n  const feedbackTopic = isDialogueTopic(topic) ? topic : undefined;\n  const learningGoalContext = feedbackTopic\n    ? getTopicLearningGoals(feedbackTopic)\n        .map((goal) => `- ${goal.label}（例: ${goal.examples}）`)\n        .join('\\n')\n    : 'テーマ情報なし。実際の対話全体から学習上の焦点を判断してください。';\n  const rawHistory = canonicalizeHistory(history);",
)

old_prompt = """  const prompt = `小学5・6年生の英会話練習を日本語で短く講評してください。\n留学生: ${persona.name}\n時間: ${targetDuration}分\nターン: ${stats.totalTurns}\n児童の実際の発話: ${examples || '(発話なし)'}\n\n【実際の対話ログ】\n${feedbackTranscript || '(発話なし)'}\n\n次の3種類を、実際の対話ログだけを根拠に選んでください。架空の語・表現は禁止です。\n1. childLearningItems: 児童自身が実際に使った語・短いチャンク・表現から、今後も役立つものを最大3件。細かな固定辞書には縛られない。\n2. aiLearningItems: AI留学生が実際に使った語・短いチャンク・表現から、児童が今後使えそうなものを最大3件。\n3. keyPhrases: 児童またはAIが実際に使った表現のうち、別の相手・別のテーマでも再利用価値が特に高い重要表現を最大3件。会話をつなぐ、質問する、自分を伝える、理由を伝える、聞き返す表現を優先する。\n適切なものが1〜2件しかなければ無理に3件作らないでください。englishは必ずログ中の連続した実際の語句をそのまま抜き出してください。\n\nJSONのみ:\n"""
new_prompt = """  const prompt = `小学5・6年生の英会話練習を日本語で短く講評してください。\n留学生: ${persona.name}\n時間: ${targetDuration}分\nターン: ${stats.totalTurns}\n選択テーマ: ${feedbackTopic || '会話内容から判断'}\n\n【今回のテーマで画面に示している学習のめあて・表現例】\n${learningGoalContext}\n\n【児童の実際の発話】\n${examples || '(発話なし)'}\n\n【実際の対話ログ】\n${feedbackTranscript || '(発話なし)'}\n\n対話全体を一つのやり取りとして読み、小学5・6年生の児童に今回の学びとして返す価値が最も高いことば・表現を選んでください。\n固定スコア、単純なキーワード一致、発話順だけで機械的に選ばず、対話の文脈、今回のテーマやめあてとの関係、その表現が会話を成立・発展させた役割、別の相手にも使える価値、児童にとっての学びやすさを総合して判断してください。\n上のめあてや表現例は判断材料であり、そこに表面的に一致させる必要はありません。実際の対話で別の表現の方が学習価値が高いなら、そちらを選んでください。\n\n1. childLearningItems: 児童自身が実際に使った語・短いチャンク・表現から、今回もっとも価値の高いものを1件だけ選ぶ。\n2. aiLearningItems: AI留学生が実際に使った語・短いチャンク・表現から、児童が次の会話で取り入れる価値が高いものを2件選ぶ。2件は、できるだけ異なる学びをもたらすものにする。\n3. keyPhrases: 児童またはAIが実際に使った表現のうち、別の相手・別のテーマでも再利用価値が特に高い重要表現を最大3件。\n\nchildLearningItemsとaiLearningItemsは、十分な実発話がある限り指定件数を選んでください。妥当な実発話がない場合は架空の表現を作らず、少ない件数または空配列にしてください。\nenglishはログ中に実際に連続して現れた語句を抜き出してください。長い発話全体より、児童が意味を理解して次に使いやすい自然なチャンクを選んでも構いません。\nAIの運営上の指示やメタ発話より、児童自身のコミュニケーションに役立つ表現を優先してください。\n\nJSONのみ:\n"""
replace_once('server.ts', old_prompt, new_prompt)

replace_once(
    'server.ts',
    "    const childLearningItems = groundFeedbackExpressions(parsed.childLearningItems, 'child', rawHistory, 3);\n    const aiLearningItems = groundFeedbackExpressions(parsed.aiLearningItems, 'ai', rawHistory, 3);",
    "    const childLearningItems = groundFeedbackExpressions(parsed.childLearningItems, 'child', rawHistory, 1);\n    const aiLearningItems = groundFeedbackExpressions(parsed.aiLearningItems, 'ai', rawHistory, 2);",
)

# Fallback is only used when the AI feedback route is unavailable. Keep it
# simple, but preserve the same visible item-count contract without adding a
# second competing selection engine.
replace_once(
    'src/utils/feedbackFallback.ts',
    "  const childLearningItems: FeedbackData['childLearningItems'] = childMsgs.slice(0, 3).map((message) => ({",
    "  const childLearningItems: FeedbackData['childLearningItems'] = childMsgs.slice(0, 1).map((message) => ({",
)
replace_once(
    'src/utils/feedbackFallback.ts',
    "    .slice(0, 3)\n    .map((message) => ({\n      english: message.englishText.trim().slice(0, 100),",
    "    .slice(0, 2)\n    .map((message) => ({\n      english: message.englishText.trim().slice(0, 100),",
)

# Replace the earlier QA that only verified UI slicing with a semantic contract
# for AI-led selection + evidence grounding.
qa = Path('scripts/qa-feedback-learning-counts.ts')
qa.write_text("""import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst app = fs.readFileSync('src/App.tsx', 'utf8');\nconst feedback = fs.readFileSync('src/components/FeedbackScreen.tsx', 'utf8');\nconst server = fs.readFileSync('server.ts', 'utf8');\nconst fallback = fs.readFileSync('src/utils/feedbackFallback.ts', 'utf8');\n\nassert.ok(app.includes('topic:currentProf.selectedTopic'), 'feedback API must receive the selected dialogue topic');\nassert.ok(server.includes(\"getTopicLearningGoals\"), 'feedback AI must receive the topic learning-goal context');\nassert.ok(server.includes('対話全体を一つのやり取りとして読み'), 'feedback selection must ask AI to interpret the whole interaction');\nassert.ok(server.includes('固定スコア、単純なキーワード一致、発話順だけで機械的に選ばず'), 'selection must not be reduced to rigid scoring or first-item order');\nassert.ok(server.includes('めあてや表現例は判断材料'), 'learning goals must inform rather than mechanically constrain AI selection');\nassert.ok(server.includes(\"groundFeedbackExpressions(parsed.childLearningItems, 'child', rawHistory, 1)\"), 'child selection must be grounded and capped at one');\nassert.ok(server.includes(\"groundFeedbackExpressions(parsed.aiLearningItems, 'ai', rawHistory, 2)\"), 'AI selection must be grounded and capped at two');\nassert.ok(server.includes('normalizeFeedbackEvidence(message.englishText).includes(normalized)'), 'every selected expression must be verified against an actual utterance');\nassert.equal(feedback.includes('.slice(0, 1)'), false, 'UI must not choose the first child item');\nassert.equal(feedback.includes('.slice(0, 2)'), false, 'UI must not choose the first two AI items');\nassert.ok(feedback.includes('items={childLearningItems}') && feedback.includes('items={aiLearningItems}'), 'UI must render server-selected items as-is');\nassert.ok(fallback.includes(\"childMsgs.slice(0, 1)\"), 'emergency fallback must preserve one child item maximum');\nassert.ok(fallback.includes(\".slice(0, 2)\"), 'emergency fallback must preserve two AI items maximum');\n\nconsole.log('Contextual AI feedback selection QA: PASS');\n""")

print('Contextual feedback patch applied successfully')
