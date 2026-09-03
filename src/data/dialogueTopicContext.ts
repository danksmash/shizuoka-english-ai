import type { DialogueTopic } from '../types';

const TOPIC_CONTEXTS: Record<DialogueTopic, string> = {
  intro: 'Get to know each other naturally: names, ages, home countries or places, and simple personal information.',
  favorites: 'Talk naturally about things each person likes, such as food, sports, animals, subjects, music, and hobbies.',
  shizuoka_culture: 'Share simple things about Shizuoka, Japan, the persona home country, food, places, and culture.',
  talents: 'Talk naturally about things each person can do or is good at.',
  daily_routine: 'Talk naturally about everyday routines and time: getting up, breakfast, university or school, helping at home, free time, dinner, bedtime, and weekends.',
  free: 'Follow the child naturally across familiar everyday topics while keeping the English easy.',
};

export const INFORMATION_GAP_STRATEGY_ENABLED =
  typeof process === 'undefined' || process.env.CONTEXTUAL_DIALOGUE_STRATEGY_ENABLED !== 'false';

const INFORMATION_GAP_STRATEGY =
  'When the child newly introduces a local food, place, cultural item, or other specific thing that has not been explained in the conversation, give the child room to explain it. React briefly and prefer one easy, natural follow-up about what it is, what it is like, or how the child enjoys it. Do not pretend not to know common things, do not ask What is ...? mechanically, and if it is already explained or clearly familiar to the persona, respond naturally instead.';

export function getDialogueTopicContext(topic: DialogueTopic): string {
  const base = TOPIC_CONTEXTS[topic];
  return INFORMATION_GAP_STRATEGY_ENABLED ? base + ' ' + INFORMATION_GAP_STRATEGY : base;
}
