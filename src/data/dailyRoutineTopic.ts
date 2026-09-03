import { AI_STUDENTS_MASTER_LIST, DIALOGUE_TOPICS } from './curriculum';
import { TOPIC_LEARNING_GOALS } from './topicLearningGoals';
import { STARTER_PROMPTS_JAPANESE } from '../utils/translation';

/**
 * Mitsumura Here We Go! 6 Unit 3 extension.
 *
 * The existing 20 persona definitions are intentionally left untouched. The
 * same starter is registered for every persona so this topic does not create a
 * new persona-dependent research condition or silently change persona facts.
 */
export const DAILY_ROUTINE_TOPIC_ID = 'daily_routine' as const;
export const DAILY_ROUTINE_STARTER_ENGLISH = 'I usually get up at seven. What time do you get up?';
export const DAILY_ROUTINE_STARTER_JAPANESE = '私はふだん7時に起きます。あなたは何時に起きますか？';

if (!DIALOGUE_TOPICS.some((topic) => String(topic.id) === DAILY_ROUTINE_TOPIC_ID)) {
  const freeIndex = DIALOGUE_TOPICS.findIndex((topic) => topic.id === 'free');
  const option = {
    id: DAILY_ROUTINE_TOPIC_ID,
    title: 'ふだんの生活・一日のようす',
    subTitle: 'Daily Routines & Time',
    description: '起きる時間や、ふだんしていることをたずね合って、おたがいのことをもっと知ろう！',
    iconName: 'Clock3',
    examplePhrases: [
      'What time do you get up?',
      'I get up at seven.',
      'I usually ... / I sometimes ...',
      'How about you?',
    ],
  } as any;
  if (freeIndex >= 0) DIALOGUE_TOPICS.splice(freeIndex, 0, option);
  else DIALOGUE_TOPICS.push(option);
}

for (const student of AI_STUDENTS_MASTER_LIST) {
  (student.topicPrompts as unknown as Record<string, string>)[DAILY_ROUTINE_TOPIC_ID] = DAILY_ROUTINE_STARTER_ENGLISH;
  const translationMap = STARTER_PROMPTS_JAPANESE as unknown as Record<string, Record<string, string>>;
  const translations = translationMap[student.id] || (translationMap[student.id] = {});
  translations[DAILY_ROUTINE_TOPIC_ID] = DAILY_ROUTINE_STARTER_JAPANESE;
}

(TOPIC_LEARNING_GOALS as unknown as Record<string, Array<{ label: string; examples: string; sourceHint: string }>>)[DAILY_ROUTINE_TOPIC_ID] = [
  {
    label: '何時に何をするかたずねよう',
    examples: 'What time do you get up? / What time do you ...?',
    sourceHint: '6年 Unit 3 What time do you get up?',
  },
  {
    label: '自分の生活を時間といっしょに伝えよう',
    examples: 'I get up at seven. / I ... at ...',
    sourceHint: '6年 Unit 3 What time do you get up?',
  },
  {
    label: 'ふだんしていることを伝え合おう',
    examples: 'I usually ... / I sometimes ... / How about you?',
    sourceHint: '6年 Unit 3 What time do you get up?',
  },
];
