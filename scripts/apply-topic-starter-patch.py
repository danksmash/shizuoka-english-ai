from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    'src/data/curriculum.ts',
    """export const DAILY_ROUTINE_STARTER_ENGLISH = 'I usually get up at seven. What time do you get up?';

const topicPrompts = (
  intro: string,
  favorites: string,
  culture: string,
  talents: string,
  free: string
): Record<DialogueTopic, string> => ({
  intro,
  favorites,
  shizuoka_culture: culture,
  talents,
  daily_routine: DAILY_ROUTINE_STARTER_ENGLISH,
  free,
});""",
    """export const GUIDED_TOPIC_STARTERS_ENGLISH: Record<Exclude<DialogueTopic, 'intro' | 'free'>, string> = {
  favorites: \"Let's talk about our favorite things. What do you like?\",
  shizuoka_culture: \"Let's talk about Shizuoka and culture. What do you like about Shizuoka?\",
  talents: \"Let's talk about things we can do. What can you do?\",
  daily_routine: \"Let's talk about our daily lives. What do you do in the morning?\",
};

export const DAILY_ROUTINE_STARTER_ENGLISH = GUIDED_TOPIC_STARTERS_ENGLISH.daily_routine;

const topicPrompts = (
  intro: string,
  _favorites: string,
  _culture: string,
  _talents: string,
  free: string
): Record<DialogueTopic, string> => ({
  intro,
  favorites: GUIDED_TOPIC_STARTERS_ENGLISH.favorites,
  shizuoka_culture: GUIDED_TOPIC_STARTERS_ENGLISH.shizuoka_culture,
  talents: GUIDED_TOPIC_STARTERS_ENGLISH.talents,
  daily_routine: GUIDED_TOPIC_STARTERS_ENGLISH.daily_routine,
  free,
});"""
)

replace_once(
    'src/data/dialogueTopicContext.ts',
    "  daily_routine: 'Talk naturally about everyday routines and time: getting up, breakfast, university or school, helping at home, free time, dinner, and bedtime. For consistent simple persona answers when a routine fact is needed, use: get up at 7:00, breakfast at 7:30, university at 9:00, dinner at 7:00 p.m., bedtime at 11:00 p.m.; sometimes help by cooking or cleaning.',",
    "  daily_routine: 'Talk naturally about everyday routines and time: getting up, breakfast, university or school, helping at home, free time, dinner, bedtime, and weekends.',"
)

replace_once(
    'server.ts',
    "Persona interests: ${p.likes.join(', ')}.",
    "Persona field of study: ${p.major}.\nPersona interests: ${p.likes.join(', ')}."
)

replace_once(
    'src/utils/translation.ts',
    """export const DAILY_ROUTINE_STARTER_JAPANESE = '私はふだん7時に起きます。あなたは何時に起きますか？';

export const STARTER_PROMPTS_JAPANESE: Record<string, Record<DialogueTopic, string>> = Object.fromEntries(
  Object.entries(BASE_STARTER_PROMPTS_JAPANESE).map(([studentId, prompts]) => [
    studentId,
    { ...prompts, daily_routine: DAILY_ROUTINE_STARTER_JAPANESE },
  ]),
) as Record<string, Record<DialogueTopic, string>>;""",
    """export const GUIDED_TOPIC_STARTERS_JAPANESE: Record<Exclude<DialogueTopic, 'intro' | 'free'>, string> = {
  favorites: '好きなものについて話しましょう。あなたは何が好きですか？',
  shizuoka_culture: '静岡と文化について話しましょう。あなたは静岡の何が好きですか？',
  talents: 'できることについて話しましょう。あなたは何ができますか？',
  daily_routine: 'ふだんの生活について話しましょう。あなたは朝、何をしますか？',
};

export const DAILY_ROUTINE_STARTER_JAPANESE = GUIDED_TOPIC_STARTERS_JAPANESE.daily_routine;

export const STARTER_PROMPTS_JAPANESE: Record<string, Record<DialogueTopic, string>> = Object.fromEntries(
  Object.entries(BASE_STARTER_PROMPTS_JAPANESE).map(([studentId, prompts]) => [
    studentId,
    {
      ...prompts,
      favorites: GUIDED_TOPIC_STARTERS_JAPANESE.favorites,
      shizuoka_culture: GUIDED_TOPIC_STARTERS_JAPANESE.shizuoka_culture,
      talents: GUIDED_TOPIC_STARTERS_JAPANESE.talents,
      daily_routine: GUIDED_TOPIC_STARTERS_JAPANESE.daily_routine,
    },
  ]),
) as Record<string, Record<DialogueTopic, string>>;"""
)

replace_once(
    'scripts/qa-dialogue.ts',
    "import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';\nimport type { DialogueTopic } from '../src/types';",
    "import { AI_STUDENTS_MASTER_LIST, GUIDED_TOPIC_STARTERS_ENGLISH, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';\nimport { getDialogueTopicContext } from '../src/data/dialogueTopicContext';\nimport type { DialogueTopic } from '../src/types';"
)
replace_once(
    'scripts/qa-dialogue.ts',
    """    if (forbiddenFixedPrefixes.some((prefix) => lower.startsWith(prefix))) failures.push(`${student.id}/${topic}: fixed reaction prefix remains: ${starter}`);
    if (wordCount(starter) > 14) failures.push(`${student.id}/${topic}: starter too difficult/long (${wordCount(starter)} words): ${starter}`);
    if (!starter.includes('?')) failures.push(`${student.id}/${topic}: starter must include an easy question`);""",
    """    if (forbiddenFixedPrefixes.some((prefix) => lower.startsWith(prefix))) failures.push(`${student.id}/${topic}: fixed reaction prefix remains: ${starter}`);
    if (topic !== 'intro' && topic !== 'free') {
      const expected = GUIDED_TOPIC_STARTERS_ENGLISH[topic];
      if (starter !== expected) failures.push(`${student.id}/${topic}: guided starter mismatch: ${starter}`);
      if (!starter.startsWith(\"Let's talk about \")) failures.push(`${student.id}/${topic}: guided starter must begin with Let's talk about`);
    } else if (starter.startsWith(\"Let's talk about \")) {
      failures.push(`${student.id}/${topic}: intro/free must preserve persona-specific starter behavior`);
    }
    if (wordCount(starter) > 14) failures.push(`${student.id}/${topic}: starter too difficult/long (${wordCount(starter)} words): ${starter}`);
    if (!starter.includes('?')) failures.push(`${student.id}/${topic}: starter must include an easy question`);"""
)
replace_once(
    'scripts/qa-dialogue.ts',
    "if (TARGET_20_AI_STUDENT_IDS.length !== 20) failures.push(`Expected 20 target personas, found ${TARGET_20_AI_STUDENT_IDS.length}`);",
    """const dailyRoutineContext = getDialogueTopicContext('daily_routine');
for (const fixedTime of ['7:00', '7:30', '9:00', '11:00']) {
  if (dailyRoutineContext.includes(fixedTime)) failures.push(`daily_routine context must not force fixed time ${fixedTime}`);
}
if (TARGET_20_AI_STUDENT_IDS.length !== 20) failures.push(`Expected 20 target personas, found ${TARGET_20_AI_STUDENT_IDS.length}`);"""
)

replace_once(
    'scripts/qa-starter-translations.ts',
    "import { STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';",
    "import { GUIDED_TOPIC_STARTERS_JAPANESE, STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';"
)
replace_once(
    'scripts/qa-starter-translations.ts',
    """    if (!english) failures.push(`${student.id}/${topic}: English starter is missing`);
    if (!japanese) failures.push(`${student.id}/${topic}: Japanese translation is missing`);
    if (japanese && topic !== 'intro' && nativeGreetings.some((greeting) => japanese.includes(greeting))) {""",
    """    if (!english) failures.push(`${student.id}/${topic}: English starter is missing`);
    if (!japanese) failures.push(`${student.id}/${topic}: Japanese translation is missing`);
    if (japanese && topic !== 'intro' && topic !== 'free' && japanese !== GUIDED_TOPIC_STARTERS_JAPANESE[topic]) {
      failures.push(`${student.id}/${topic}: Japanese guided starter mismatch`);
    }
    if (japanese && topic !== 'intro' && nativeGreetings.some((greeting) => japanese.includes(greeting))) {"""
)
