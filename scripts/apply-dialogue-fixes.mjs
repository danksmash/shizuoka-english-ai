import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text, 'utf8'); }
function replaceOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error('Missing replacement target: ' + label);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error('Replacement target is not unique: ' + label);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

// App.tsx
{
  const path = 'src/App.tsx';
  let text = read(path);
  text = replaceOnce(text,
    "  getStudentFarewellMessage,\n  requestMicrophonePermission,\n} from './utils/speech';",
    "  getStudentFarewellMessage,\n} from './utils/speech';",
    'remove microphone permission import');
  text = replaceOnce(text,
    "  const handleStartDialogue = (newProfile: StudentProfile) => {\n    requestMicrophonePermission();\n    setProfile(newProfile);",
    "  const handleStartDialogue = (newProfile: StudentProfile) => {\n    setProfile(newProfile);",
    'remove automatic microphone permission');
  text = replaceOnce(text,
    "    const childJapanese = translateChildUtterance(trimmed);\n    const childMsg: ChatMessage = {",
    [
      "    const localChildJapanese = translateChildUtterance(trimmed);",
      "    const childJapanese = /[ぁ-んァ-ヶ一-龠]/.test(localChildJapanese)",
      "      ? localChildJapanese",
      "      : '日本語訳を準備中です。';",
      "    const childMsg: ChatMessage = {"
    ].join('\n'),
    'safe child translation placeholder');
  text = replaceOnce(text,
    "        const { reply, japaneseTranslation, mood: aiMood, culturalNote } = resData.data;",
    [
      "        const {",
      "          reply,",
      "          japaneseTranslation,",
      "          studentJapaneseTranslation,",
      "          mood: aiMood,",
      "          culturalNote,",
      "        } = resData.data;"
    ].join('\n'),
    'read child translation from API');
  text = replaceOnce(text,
    "        const updatedHistory = [...messagesRef.current, aiMsg];\n        setMessages(updatedHistory);\n        messagesRef.current = updatedHistory;",
    [
      "        const translatedHistory = messagesRef.current.map((message) =>",
      "          message.id === childMsg.id &&",
      "          typeof studentJapaneseTranslation === 'string' &&",
      "          studentJapaneseTranslation.trim().length > 0",
      "            ? { ...message, japaneseText: studentJapaneseTranslation.trim() }",
      "            : message",
      "        );",
      "        const updatedHistory = [...translatedHistory, aiMsg];",
      "        setMessages(updatedHistory);",
      "        messagesRef.current = updatedHistory;"
    ].join('\n'),
    'persist child Japanese translation');
  text = replaceOnce(text,
    "      const childJapanese = translateChildUtterance(pendingText);\n      const pendingChildMsg: ChatMessage = {",
    [
      "      const localChildJapanese = translateChildUtterance(pendingText);",
      "      const childJapanese = /[ぁ-んァ-ヶ一-龠]/.test(localChildJapanese)",
      "        ? localChildJapanese",
      "        : '日本語訳を準備できませんでした。';",
      "      const pendingChildMsg: ChatMessage = {"
    ].join('\n'),
    'safe pending child translation');
  write(path, text);
}

// DialogueView.tsx
{
  const path = 'src/components/DialogueView.tsx';
  let text = read(path);
  const startMarker = '                {/* Cultural highlight tag if present */}';
  const endMarker = '                {/* Audio replay button for AI messages */}';
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Could not locate AI cultural explanation block');
  text = text.slice(0, start) + text.slice(end);
  write(path, text);
}

// speech.ts
{
  const path = 'src/utils/speech.ts';
  let text = read(path);
  const farewellStart = text.indexOf('export function getStudentFarewellMessage');
  const permissionComment = text.indexOf('/**\n * Pre-authorizes hardware microphone access seamlessly for the app session\n */');
  if (farewellStart < 0 || permissionComment < 0 || permissionComment <= farewellStart) throw new Error('Could not locate farewell function block');
  const farewellFunction = [
    "export function getStudentFarewellMessage(studentId: string): { english: string; japanese: string } {",
    "  switch (studentId) {",
    "    case 'oliver_uk': return { english: \"Time is up! I was very happy to talk with you. Thank you, and see you again!\", japanese: '時間になりました！あなたとお話しできてとても嬉しかったよ。ありがとう！またね！' };",
    "    case 'emma_usa': return { english: \"Time is up! I was so happy to talk with you today. Thank you, and see you soon!\", japanese: '時間になりました！今日はあなたとお話しできてとても嬉しかったよ。ありがとう！またね！' };",
    "    case 'liam_australia': return { english: \"Time is up! I was really happy to chat with you. Thanks a lot, and see ya!\", japanese: '時間になりました！あなたとお話しできて本当に嬉しかったよ。ありがとう！またね！' };",
    "    case 'chloe_canada': return { english: \"Time is up! I was very happy to talk with you. Thank you so much, and have a wonderful day!\", japanese: '時間になりました！あなたとお話しできてとても嬉しかったです。ありがとう！素敵な一日をね！' };",
    "    case 'bence_hungary': return { english: \"Time is up! I was happy to talk with you today. Thank you! Szia, and see you next time!\", japanese: '時間になりました！今日はあなたとお話しできて嬉しかったよ。ありがとう！Szia、またね！' };",
    "    case 'zofia_poland': return { english: \"Time is up! I was so happy to talk with you. Thank you! Cześć, and see you again!\", japanese: '時間になりました！あなたとお話しできてとても嬉しかったよ。ありがとう！Cześć、またね！' };",
    "    case 'rahul_bangladesh': return { english: \"Time is up! I was very happy to talk with you, my friend. Thank you, and have a wonderful day!\", japanese: '時間になりました！友だちとしてあなたとお話しできてとても嬉しかったよ。ありがとう！素敵な一日を！' };",
    "    case 'linh_vietnam': return { english: \"Time is up! I was really happy to talk with you today. Thank you! See you soon!\", japanese: '時間になりました！今日はあなたとお話しできて本当に嬉しかったよ。ありがとう！またね！' };",
    "    case 'aung_myanmar': return { english: \"Time is up! I was very happy to talk with you. Thank you for our lovely chat. See you!\", japanese: '時間になりました！あなたとお話しできてとても嬉しかったよ。楽しいお話をありがとう！またね！' };",
    "    default: return { english: \"Time is up! I was very happy to talk with you today. Thank you, and see you next time!\", japanese: '時間になりました！今日はあなたとお話しできてとても嬉しかったよ。ありがとう！またね！' };",
    "  }",
    "}",
    "",
    ""
  ].join('\n');
  text = text.slice(0, farewellStart) + farewellFunction + text.slice(permissionComment);
  const permissionStart = text.indexOf('/**\n * Pre-authorizes hardware microphone access seamlessly for the app session\n */');
  const recognitionComment = text.indexOf('/**\n * Speech-to-Text Recognition interface\n */', permissionStart);
  if (permissionStart < 0 || recognitionComment < 0) throw new Error('Could not locate proactive microphone helper');
  text = text.slice(0, permissionStart) + text.slice(recognitionComment);
  write(path, text);
}

// server.ts
{
  const path = 'server.ts';
  let text = read(path);
  const sanitizer = "function sanitizeStudentInput(text: string): string {\n  if (!text) return '';\n  return maskHighRiskPII(text).maskedText;\n}\n";
  const helpers = [
    sanitizer.trimEnd(),
    '',
    'function isExplicitFarewell(text: string): boolean {',
    "  return /\\b(?:goodbye|bye(?: bye)?|see you|see ya)\\b/i.test(text.trim());",
    '}',
    '',
    'function ensureActiveTurnEndsWithQuestion(reply: string, topic: string): string {',
    "  const normalized = reply.replace(/\\s+/g, ' ').trim();",
    "  if (/\\?\\s*$/.test(normalized)) return normalized;",
    '',
    '  const topicQuestions: Record<string, string> = {',
    "    intro: 'How about you?',",
    "    favorites: 'What do you like?',",
    "    shizuoka_culture: 'What do you like about Shizuoka?',",
    "    talents: 'What can you do?',",
    "    free: 'What would you like to talk about?',",
    '  };',
    "  const question = topicQuestions[topic] || 'How about you?';",
    "  const firstUnit = (normalized.match(/^[^.!?]+[.!?]?/)?.[0] || normalized).trim();",
    "  const words = firstUnit.split(/\\s+/).filter(Boolean);",
    "  let shortStatement = words.slice(0, 14).join(' ').replace(/[?]+$/g, '').trim();",
    "  if (shortStatement && !/[.!]$/.test(shortStatement)) shortStatement += '.';",
    "  return shortStatement ? shortStatement + ' ' + question : question;",
    '}',
    ''
  ].join('\n');
  text = replaceOnce(text, sanitizer, helpers + '\n', 'insert server guards');
  text = replaceOnce(text,
    "5. Usually continue the conversation by asking ONE natural question related to the student's latest message or current topic context.",
    "5. In EVERY normal dialogue turn, end your reply with exactly ONE natural question related to the student's latest message or current topic context.",
    'strengthen system question rule');
  text = replaceOnce(text,
    '14. If the student says "Goodbye", "See you", "Thank you", or clearly ends the conversation, say goodbye warmly and do not force a follow-up question.',
    '14. If the student explicitly says "Goodbye", "Bye", or "See you" and clearly ends the conversation, say goodbye warmly and do not ask a follow-up question. A simple "Thank you" by itself is not automatically the end of the dialogue.',
    'clarify system farewell exception');
  text = replaceOnce(text,
    '  "japaneseTranslation": "Natural, gentle Japanese translation suitable for 5th/6th grade student",',
    '  "japaneseTranslation": "Natural, gentle Japanese translation of the AI reply suitable for 5th/6th grade student",\n  "studentJapaneseTranslation": "Natural Japanese translation of the student latest English input; never copy the English input as-is",',
    'add child translation schema');
  text = replaceOnce(text,
    '2. If student asked a question (e.g. "How are you?", "What food do you like?", "Where are you from?", "Can you swim?"), DIRECTLY ANSWER FIRST with your persona details before asking any follow-up question.',
    '2. If student asked a question, DIRECTLY ANSWER FIRST with your persona details.',
    'critical answer first');
  text = replaceOnce(text,
    '3. If student says "Goodbye" / "See you", respond with a warm farewell and do not force a question.',
    '3. For every normal dialogue turn, END with exactly ONE short, natural follow-up question. Do not end a normal turn with only a statement.',
    'critical question rule');
  text = replaceOnce(text,
    '4. If student asks for clarification (e.g. "Pardon?", "Sorry?"), rephrase your previous statement simply.',
    '4. Only when the student explicitly says "Goodbye" / "Bye" / "See you" and clearly ends the dialogue, respond with a warm farewell and no question.\n5. If student asks for clarification, rephrase your previous statement simply and then ask one simple checking question.\n6. Translate the student latest English input into natural Japanese in studentJapaneseTranslation. It must be Japanese, not a copy of the English text.',
    'critical farewell and translation rules');
  text = replaceOnce(text,
    '5. Return strictly valid JSON: { "reply": "...", "japaneseTranslation": "...", "mood": "happy"|"speaking"|"encouraging", "culturalNote": "..." }`;',
    '7. Return strictly valid JSON: { "reply": "...", "japaneseTranslation": "...", "studentJapaneseTranslation": "...", "mood": "happy"|"speaking"|"encouraging", "culturalNote": "..." }`;',
    'critical output schema');
  text = replaceOnce(text,
    '      const sanitizedReply = sanitizeAiOutput(parsed.reply, persona.name);\n      const responseEnd = Date.now();',
    [
      '      const baseSanitizedReply = sanitizeAiOutput(parsed.reply, persona.name);',
      '      const sanitizedReply = isExplicitFarewell(trimmedMessage)',
      '        ? baseSanitizedReply',
      "        : ensureActiveTurnEndsWithQuestion(baseSanitizedReply, String(topic || 'favorites'));",
      '      const studentJapaneseTranslation =',
      "        typeof parsed.studentJapaneseTranslation === 'string' &&",
      '        /[ぁ-んァ-ヶ一-龠]/.test(parsed.studentJapaneseTranslation)',
      '          ? parsed.studentJapaneseTranslation.trim()',
      "          : '日本語訳を準備できませんでした。';",
      '      const responseEnd = Date.now();'
    ].join('\n'),
    'enforce question and validate translation');
  text = replaceOnce(text,
    "          japaneseTranslation: parsed.japaneseTranslation || '',\n          mood: parsed.mood || 'speaking',",
    "          japaneseTranslation: parsed.japaneseTranslation || '',\n          studentJapaneseTranslation,\n          mood: parsed.mood || 'speaking',",
    'return child translation');
  write(path, text);
}

console.log('Dialogue fixes applied successfully.');
