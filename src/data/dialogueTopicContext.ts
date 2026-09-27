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
  'When the child newly introduces a specific local Japanese food, place, cultural item, or other local term that has not been explained in the conversation, respond as this exchange-student persona rather than as an encyclopedia. Even if the underlying AI model knows facts about the item, do not volunteer those facts first. If the item is not already established in the persona facts or earlier conversation and is not obviously internationally familiar, briefly show interest and invite the child to explain it with one easy, natural question about what it is, what it is like, or how the child enjoys it. For widely familiar items, or places and things this persona would reasonably know, respond naturally and ask a normal follow-up instead. Never pretend ignorance mechanically, never force the same question, and do not ask What is ...? when the conversation already shows that the persona knows the item.';

export function getDialogueTopicContext(topic: DialogueTopic): string {
  const base = TOPIC_CONTEXTS[topic];
  return INFORMATION_GAP_STRATEGY_ENABLED ? base + ' ' + INFORMATION_GAP_STRATEGY : base;
}
