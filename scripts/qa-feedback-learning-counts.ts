import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const feedback = fs.readFileSync('src/components/FeedbackScreen.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const fallback = fs.readFileSync('src/utils/feedbackFallback.ts', 'utf8');

// The model gets the whole interaction and the selected learning context; the
// application only enforces evidence grounding and the requested visible count.
assert.ok(app.includes('topic:currentProf.selectedTopic'), 'feedback API must receive the selected dialogue topic');
assert.ok(server.includes("getTopicLearningGoals"), 'feedback AI must receive the topic learning-goal context');
assert.ok(server.includes('対話全体を一つのやり取りとして読み'), 'feedback selection must ask AI to interpret the whole interaction');
assert.ok(server.includes('固定スコア、単純なキーワード一致、発話順だけで機械的に選ばず'), 'selection must not be reduced to rigid scoring or first-item order');
assert.ok(server.includes('めあてや表現例は判断材料'), 'learning goals must inform rather than mechanically constrain AI selection');
assert.ok(server.includes('実際の対話で別の表現の方が学習価値が高いなら'), 'AI must be allowed to prefer contextually stronger expressions over literal goal matching');
assert.ok(server.includes("groundFeedbackExpressions(parsed.childLearningItems, 'child', rawHistory, 1)"), 'child selection must be grounded and capped at one');
assert.ok(server.includes("groundFeedbackExpressions(parsed.aiLearningItems, 'ai', rawHistory, 2)"), 'AI selection must be grounded and capped at two');
assert.ok(server.includes('normalizeFeedbackEvidence(message.englishText).includes(normalized)'), 'every selected expression must be verified against an actual utterance');
assert.equal(feedback.includes('.slice(0, 1)'), false, 'UI must not choose the first child item');
assert.equal(feedback.includes('.slice(0, 2)'), false, 'UI must not choose the first two AI items');
assert.ok(feedback.includes('items={childLearningItems}') && feedback.includes('items={aiLearningItems}'), 'UI must render server-selected items as-is');
assert.ok(fallback.includes("childMsgs.slice(0, 1)"), 'emergency fallback must preserve one child item maximum');
assert.ok(fallback.includes(".slice(0, 2)"), 'emergency fallback must preserve two AI items maximum');

console.log('Contextual AI feedback selection QA: PASS');
