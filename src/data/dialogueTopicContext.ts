import type { DialogueTopic } from '../types';

const TOPIC_CONTEXTS: Record<DialogueTopic, string> = {
  intro: 'Get to know each other naturally: names, ages, home countries or places, and simple personal information.',
  favorites: 'Talk naturally about things each person likes, such as food, sports, animals, subjects, music, and hobbies.',
  shizuoka_culture: 'Share simple things about Shizuoka, Japan, the persona home country, food, places, and culture.',
  talents: 'Talk naturally about things each person can do or is good at.',
  daily_routine: 'Talk naturally about everyday routines and time: getting up, breakfast, university or school, helping at home, free time, dinner, bedtime, and weekends.',
  free: 'Follow the child naturally across familiar everyday topics while keeping the English easy.',
};

export function getDialogueTopicContext(topic: DialogueTopic): string {
  return TOPIC_CONTEXTS[topic];
}
