import type { DialogueTopic } from '../types';

export interface TopicLearningGoal {
  label: string;
  examples: string;
  sourceHint: string;
}

/**
 * Theme-specific goals for the 1:1 dialogue screen.
 * The expressions are selected from / aligned with the public CAN-DO language
 * material for Mitsumura Here We Go! 5 and 6 (2024 edition), then simplified
 * for short Grade 5-6 spoken interaction.
 */
export const TOPIC_LEARNING_GOALS: Record<DialogueTopic, TopicLearningGoal[]> = {
  intro: [
    {
      label: '名前や出身を伝えよう',
      examples: "My name is ... / I'm from ...",
      sourceHint: '5年 Unit 1・6年 Unit 1',
    },
    {
      label: '得意なこと・興味を伝えよう',
      examples: "I'm good at ... / I'm interested in ...",
      sourceHint: '6年 Unit 1',
    },
    {
      label: '相手にも質問してみよう',
      examples: 'Where are you from? / How about you?',
      sourceHint: '5年 One-minute Talk・6年 Unit 1',
    },
  ],
  favorites: [
    {
      label: '好きなものをたずねよう',
      examples: 'What ... do you like?',
      sourceHint: '5年 Unit 1・3',
    },
    {
      label: '自分の好きなものを伝えよう',
      examples: 'I like ... / My favorite ... is ...',
      sourceHint: '5年 Unit 1・3',
    },
    {
      label: '相手にも聞き返して会話を続けよう',
      examples: 'How about you? / What about you?',
      sourceHint: '5年 One-minute Talk',
    },
  ],
  shizuoka_culture: [
    {
      label: '静岡や日本にあるものを紹介しよう',
      examples: 'In Shizuoka, we have ...',
      sourceHint: '5年 Unit 8・6年 Unit 2',
    },
    {
      label: '見られる・食べられる・楽しめることを伝えよう',
      examples: 'You can see / eat / visit / enjoy ...',
      sourceHint: '5年 Unit 8・6年 Unit 2',
    },
    {
      label: '相手の国や地域の魅力も聞いてみよう',
      examples: 'What do you like about ...? / Where do you want to go?',
      sourceHint: '6年 Unit 6',
    },
  ],
  talents: [
    {
      label: 'できることを伝え合おう',
      examples: 'I can ... / Can you ...?',
      sourceHint: '5年 Unit 4',
    },
    {
      label: '得意なことを一歩くわしく伝えよう',
      examples: "I'm good at ...",
      sourceHint: '6年 Unit 1',
    },
    {
      label: 'これからしたいこと・夢にもつなげよう',
      examples: 'I want to ... / I want to be ...',
      sourceHint: '6年 Unit 6・7',
    },
  ],
  free: [
    {
      label: '知っている質問を使って話題を広げよう',
      examples: 'What / Where / When / How ...?',
      sourceHint: '5・6年 既習表現',
    },
    {
      label: '自分のことをもう一つ付け足してみよう',
      examples: 'I like ... / I can ... / I want to ...',
      sourceHint: '5年 Unit 1・4／6年 Unit 6・7',
    },
    {
      label: '聞き返しや質問返しで会話を続けよう',
      examples: 'How about you? / One more time, please.',
      sourceHint: '5・6年 やり取り',
    },
  ],
};

export function getTopicLearningGoals(topic: DialogueTopic): TopicLearningGoal[] {
  return TOPIC_LEARNING_GOALS[topic] ?? TOPIC_LEARNING_GOALS.free;
}
