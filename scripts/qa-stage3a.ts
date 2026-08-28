import assert from 'node:assert/strict';
import { isDialogueDuration, parseReflectionAnswers, validateSessionSaveInput } from '../src/dataContract';
assert.equal(isDialogueDuration(10), false); assert.equal(isDialogueDuration(5), true);
assert.equal(parseReflectionAnswers({ conveyedIdeas:5, understoodPartner:4, continuedConversation:3, noticedLanguageCulture:2 })?.conveyedIdeas,5);
assert.equal(parseReflectionAnswers({ conveyedIdeas:6, understoodPartner:4, continuedConversation:3, noticedLanguageCulture:2 }),undefined);
const valid=validateSessionSaveInput({sessionId:'session_12345',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'intro',targetDurationMinutes:1,startedAt:1000,endedAt:61000,history:[{id:'c1',sender:'child',englishText:'Hello',timestamp:2000}],reflection:{conveyedIdeas:5,understoodPartner:4,continuedConversation:3,noticedLanguageCulture:2}}); assert.equal(valid.ok,true); console.log('STAGE 3A QA PASS');
