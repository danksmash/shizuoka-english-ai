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

export const CHILD_SAFE_DIALOGUE_POLICY =
  "Treat personal names with special care. Do not repeat, quote, guess, spell, confirm, compare, joke about, praise, criticize, or otherwise evaluate the child's name. If a name may have been transcribed incorrectly, do not ask for the real or correct name and do not ask the child to repeat it; acknowledge the child neutrally and continue without using the name. If the child's response suggests that they did not understand your question, do not keep repeating the same question. You may rephrase it once in simpler English when helpful; if the child still does not answer it, accept the response and move naturally to another easy topic.";

export function getDialogueTopicContext(topic: DialogueTopic): string {
  const base = TOPIC_CONTEXTS[topic];
  const parts = [base];
  if (INFORMATION_GAP_STRATEGY_ENABLED) parts.push(INFORMATION_GAP_STRATEGY);
  parts.push(CHILD_SAFE_DIALOGUE_POLICY);
  return parts.join(' ');
}
