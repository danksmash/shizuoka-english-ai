import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, text) {
  fs.writeFileSync(path, text, 'utf8');
}

function replaceOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`Missing replacement target: ${label}`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`Replacement target is not unique: ${label}`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

{
  const path = 'src/App.tsx';
  let text = read(path);
  text = replaceOnce(text, "  getStudentFarewellMessage,\n  requestMicrophonePermission,\n} from './utils/speech';", "  getStudentFarewellMessage,\n} from './utils/speech';", 'remove requestMicrophonePermission import');
  text = replaceOnce(text, "  const handleStartDialogue = (newProfile: StudentProfile) => {\n    requestMicrophonePermission();\n    setProfile(newProfile);", "  const handleStartDialogue = (newProfile: StudentProfile) => {\n    setProfile(newProfile);", 'remove automatic microphone permission request');
  text = replaceOnce(text, "    const childJapanese = translateChildUtterance(trimmed);\n    const childMsg: ChatMessage = {", "    const localChildJapanese = translateChildUtterance(trimmed);\n    const childJapanese = /[ぁ-んァ-ヶ一-龠]/.test(localChildJapanese)\n      ? localChildJapanese\n      : '日本語訳を準備中です。';\n    const childMsg: ChatMessage = {", 'safe child translation placeholder');
  text = replaceOnce(text, "        const { reply, japaneseTranslation, mood: aiMood, culturalNote } = resData.data;", "        const {\n          reply,\n          japaneseTranslation,\n          studentJapaneseTranslation,\n          mood: aiMood,\n          culturalNote,\n        } = resData.data;", 'read child translation from API');
  text = replaceOnce(text, "        const updatedHistory = [...messagesRef.current, aiMsg];\n        setMessages(updatedHistory);\n        messagesRef.current = updatedHistory;", "        const translatedHistory = messagesRef.current.map((message) =>\n          message.id === childMsg.id &&\n          typeof studentJapaneseTranslation === 'string' &&\n          studentJapaneseTranslation.trim().length > 0\n            ? { ...message, japaneseText: studentJapaneseTranslation.trim() }\n            : message\n        );\n        const updatedHistory = [...translatedHistory, aiMsg];\n        setMessages(updatedHistory);\n        messagesRef.current = updatedHistory;", 'persist child Japanese translation');
  text = replaceOnce(text, "      const childJapanese = translateChildUtterance(pendingText);\n      const pendingChildMsg: ChatMessage = {", "      const localChildJapanese = translateChildUtterance(pendingText);\n      const childJapanese = /[ぁ-んァ-ヶ一-龠]/.test(localChildJapanese)\n        ? localChildJapanese\n        : '日本語訳を準備できませんでした。';\n      const pendingChildMsg: ChatMessage = {", 'safe pending child translation');
  write(path, text);
}

{
  const path = 'src/components/DialogueView.tsx';
  let text = read(path);
  text = replaceOnce(text, `\n                {/* Cultural highlight tag if present */}\n                {isAi && msg.culturalNote && (\n                  <div className="mt-2 pt-2 border-t border-blue-200/70 flex items-center gap-1 text-[11px] text-blue-800 font-medium">\n                    <span className="text-xs">💡</span>\n                    <span>{msg.culturalNote}</span>\n                  </div>\n                )}\n`, '\n', 'remove AI utterance explanation');
  write(path, text);
}

{
  const path = 'src/utils/speech.ts';
  let text = read(path);
  const farewellStart = text.indexOf('export function getStudentFarewellMessage');
  const permissionComment = text.indexOf('/**\n * Pre-authorizes hardware microphone access seamlessly for the app session\n */');
  if (farewellStart < 0 || permissionComment < 0 || permissionComment <= farewellStart) throw new Error('Could not locate farewell function block');
  const farewellFunction = `export function getStudentFarewellMessage(studentId: string): { english: string; japanese: string } {\n  switch (studentId) {\n    case 'oliver_uk':\n      return { english: \"Time is up! I was very happy to talk with you. Thank you, and see you again!\", japanese: '時間になりました！あなたとお話しできてとても嬉しかったよ。ありがとう！またね！' };\n    case 'emma_usa':\n      return { english: \"Time is up! I was so happy to talk with you today. Thank you, and see you soon!\", japanese: '時間になりました！今日はあなたとお話しできてとても嬉しかったよ。ありがとう！またね！' };\n    case 'liam_australia':\n      return { english: \"Time is up! I was really happy to chat with you. Thanks a lot, and see ya!\", japanese: '時間になりました！あなたとお話しできて本当に嬉しかったよ。ありがとう！またね！' };\n    case 'chloe_canada':\n      return { english: \"Time is up! I was very happy to talk with you. Thank you so much, and have a wonderful day!\", japanese: '時間になりました！あなたとお話しできてとても嬉しかったです。ありがとう！素敵な一日をね！' };\n    case 'bence_hungary':\n      return { english: \"Time is up! I was happy to talk with you today. Thank you! Szia, and see you next time!\", japanese: '時間になりました！今日はあなたとお話しできて嬉しかったよ。ありがとう！Szia、またね！' };\n    case 'zofia_poland':\n      return { english: \"Time is up! I was so happy to talk with you. Thank you! Cześć, and see you again!\", japanese: '時間になりました！あなたとお話しできてとても嬉しかったよ。ありがとう！Cześć、またね！' };\n    case 'rahul_bangladesh':\n      return { english: \"Time is up! I was very happy to talk with you, my friend. Thank you, and have a wonderful day!\", japanese: '時間になりました！友だちとしてあなたとお話しできてとても嬉しかったよ。ありがとう！素敵な一日を！' };\n    case 'linh_vietnam':\n      return { english: \"Time is up! I was really happy to talk with you today. Thank you! See you soon!\", japanese: '時間になりました！今日はあなたとお話しできて本当に嬉しかったよ。ありがとう！またね！' };\n    case 'aung_myanmar':\n      return { english: \"Time is up! I was very happy to talk with you. Thank you for our lovely chat. See you!\", japanese: '時間になりました！あなたとお話しできてとても嬉しかったよ。楽しいお話をありがとう！またね！' };\n    default:\n      return { english: \"Time is up! I was very happy to talk with you today. Thank you, and see you next time!\", japanese: '時間になりました！今日はあなたとお話しできてとても嬉しかったよ。ありがとう！またね！' };\n  }\n}\n\n`;
  text = text.slice(0, farewellStart) + farewellFunction + text.slice(permissionComment);
  const permissionStart = text.indexOf('/**\n * Pre-authorizes hardware microphone access seamlessly for the app session\n */');
  const recognitionComment = text.indexOf('/**\n * Speech-to-Text Recognition interface\n */', permissionStart);
  if (permissionStart < 0 || recognitionComment < 0) throw new Error('Could not locate microphone permission helper');
  text = text.slice(0, permissionStart) + text.slice(recognitionComment);
  write(path, text);
}

{
  const path = 'server.ts';
  let text = read(path);
  text = replaceOnce(text, `function sanitizeStudentInput(text: string): string {\n  if (!text) return '';\n  return maskHighRiskPII(text).maskedText;\n}\n`, `function sanitizeStudentInput(text: string): string {\n  if (!text) return '';\n  return maskHighRiskPII(text).maskedText;\n}\n\nfunction isExplicitFarewell(text: string): boolean {\n  return /\\b(?:goodbye|bye(?: bye)?|see you|see ya)\\b/i.test(text.trim());\n}\n\nfunction ensureActiveTurnEndsWithQuestion(reply: string, topic: string): string {\n  const normalized = reply.replace(/\\s+/g, ' ').trim();\n  if (/\\?\\s*$/.test(normalized)) return normalized;\n\n  const topicQuestions: Record<string, string> = {\n    intro: 'How about you?',\n    favorites: 'What do you like?',\n    shizuoka_culture: 'What do you like about Shizuoka?',\n    talents: 'What can you do?',\n    free: 'What would you like to talk about?',\n  };\n  const question = topicQuestions[topic] || 'How about you?';\n  const firstUnit = (normalized.match(/^[^.!?]+[.!?]?/)?.[0] || normalized).trim();\n  const words = firstUnit.split(/\\s+/).filter(Boolean);\n  let shortStatement = words.slice(0, 14).join(' ').replace(/[?]+$/g, '').trim();\n  if (shortStatement && !/[.!]$/.test(shortStatement)) shortStatement += '.';\n  return shortStatement ? shortStatement + ' ' + question : question;\n}\n`, 'insert follow-up question guard');
  text = replaceOnce(text, '5. Usually continue the conversation by asking ONE natural question related to the student\'s latest message or current topic context.', '5. In EVERY normal dialogue turn, end your reply with exactly ONE natural question related to the student\'s latest message or current topic context.', 'strengthen question rule');
  text = replaceOnce(text, '14. If the student says "Goodbye", "See you", "Thank you", or clearly ends the conversation, say goodbye warmly and do not force a follow-up question.', '14. If the student explicitly says "Goodbye", "Bye", or "See you" and clearly ends the conversation, say goodbye warmly and do not ask a follow-up question. A simple "Thank you" by itself is not automatically the end of the dialogue.', 'clarify farewell exception');
  text = replaceOnce(text, `  "reply": "English response from \${p.name}",\n  "japaneseTranslation": "Natural, gentle Japanese translation suitable for 5th/6th grade student",`, `  "reply": "English response from \${p.name}",\n  "japaneseTranslation": "Natural, gentle Japanese translation of the AI reply suitable for 5th/6th grade student",\n  "studentJapaneseTranslation": "Natural Japanese translation of the student's latest English input; never copy the English input as-is",`, 'system output schema child translation');
  text = replaceOnce(text, `CRITICAL RESPONSE MANDATES:\n1. Listen carefully to student's latest input and respond directly and naturally.\n2. If student asked a question (e.g. "How are you?", "What food do you like?", "Where are you from?", "Can you swim?"), DIRECTLY ANSWER FIRST with your persona details before asking any follow-up question.\n3. If student says "Goodbye" / "See you", respond with a warm farewell and do not force a question.\n4. If student asks for clarification (e.g. "Pardon?", "Sorry?"), rephrase your previous statement simply.\n5. Return strictly valid JSON: { "reply": "...", "japaneseTranslation": "...", "mood": "happy"|"speaking"|"encouraging", "culturalNote": "..." }`;\n`, `CRITICAL RESPONSE MANDATES:\n1. Listen carefully to student's latest input and respond directly and naturally.\n2. If student asked a question (e.g. "How are you?", "What food do you like?", "Where are you from?", "Can you swim?"), DIRECTLY ANSWER FIRST with your persona details.\n3. For every normal dialogue turn, END with exactly ONE short, natural follow-up question. Do not end a normal turn with only a statement.\n4. Only when the student explicitly says "Goodbye" / "Bye" / "See you" and clearly ends the dialogue, respond with a warm farewell and no question.\n5. If student asks for clarification (e.g. "Pardon?", "Sorry?"), rephrase your previous statement simply and then ask one simple checking question.\n6. Translate the student's latest English input into natural Japanese in studentJapaneseTranslation. It must be Japanese, not a copy of the English text.\n7. Return strictly valid JSON: { "reply": "...", "japaneseTranslation": "...", "studentJapaneseTranslation": "...", "mood": "happy"|"speaking"|"encouraging", "culturalNote": "..." }`;\n`, 'prompt response mandates');
  text = replaceOnce(text, `      const sanitizedReply = sanitizeAiOutput(parsed.reply, persona.name);\n      const responseEnd = Date.now();`, `      const baseSanitizedReply = sanitizeAiOutput(parsed.reply, persona.name);\n      const sanitizedReply = isExplicitFarewell(trimmedMessage)\n        ? baseSanitizedReply\n        : ensureActiveTurnEndsWithQuestion(baseSanitizedReply, String(topic || 'favorites'));\n      const studentJapaneseTranslation =\n        typeof parsed.studentJapaneseTranslation === 'string' &&\n        /[ぁ-んァ-ヶ一-龠]/.test(parsed.studentJapaneseTranslation)\n          ? parsed.studentJapaneseTranslation.trim()\n          : '日本語訳を準備できませんでした。';\n      const responseEnd = Date.now();`, 'enforce question and validate child translation');
  text = replaceOnce(text, `          japaneseTranslation: parsed.japaneseTranslation || '',\n          mood: parsed.mood || 'speaking',`, `          japaneseTranslation: parsed.japaneseTranslation || '',\n          studentJapaneseTranslation,\n          mood: parsed.mood || 'speaking',`, 'return child translation');
  write(path, text);
}

console.log('Dialogue fixes applied successfully.');
