import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('src/dialogue-viewport.css', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const dialogue = fs.readFileSync('src/components/DialogueView.tsx', 'utf8');
const speechInput = fs.readFileSync('src/components/SpeechInputBar.tsx', 'utf8');

// Classroom priority matrix. The base 100dvh contract is width-independent;
// these dimensions document the regression targets rather than creating
// device-specific hard-coded layout branches.
const targetViewports = [
  [1024, 600, 'small Chromebook'],
  [1280, 720, 'standard Chromebook'],
  [1366, 768, 'common Chromebook/notebook'],
  [1440, 900, 'large Chromebook/desktop'],
  [1024, 768, 'tablet landscape'],
  [768, 1024, 'tablet portrait'],
  [390, 844, 'phone portrait'],
] as const;

assert.ok(main.includes("import './dialogue-viewport.css';"), 'dialogue viewport CSS must be loaded');
assert.ok(
  main.indexOf("import './dialogue-viewport.css';") > main.indexOf("import './setup-screen-v2-polish.css';"),
  'dialogue viewport rules must load after existing UI styles',
);

// Scope must be dialogue-only: setup/reflection/feedback layouts are protected.
assert.ok(css.includes(':has(> .flex-1 > main > .min-h-\\[65dvh\\])'), 'dialogue CSS must stay scoped to the unique dialogue panel');

for (const marker of ['height: 100dvh', 'min-height: 100dvh', 'max-height: 100dvh', 'overflow: hidden']) {
  assert.ok(css.includes(marker), `viewport contract missing ${marker}`);
}
assert.ok(css.includes('grid-template-rows: minmax(0, 1fr)'), 'dialogue main grid must consume only remaining viewport height');
assert.ok(css.includes('height: 100%') && css.includes('min-height: 0') && css.includes('max-height: 100%'), 'central dialogue panel must be shrinkable inside the viewport');

// One input strategy at every width: in-panel controls are visible/non-shrinking,
// while the old narrow-screen fixed duplicate is retired by scoped CSS.
assert.ok(css.includes('> .hidden.lg\\:block') && css.includes('display: block') && css.includes('flex: 0 0 auto'), 'in-panel SpeechInputBar must stay visible and non-shrinking');
assert.ok(css.includes('> .lg\\:hidden.fixed') && css.includes('display: none'), 'old fixed narrow-screen input must be retired');
assert.equal(css.includes('overflow-y: auto'), false, 'speech input itself must never become a scroll container that can hide the microphone');
assert.equal(css.includes('max-height: min('), false, 'speech input height must not clip or hide the microphone');

// Narrow devices and short Chromebook viewports recover space without changing
// text sizes or tap-target sizes.
assert.ok(css.includes('@media (max-width: 1023px)'), 'narrow-device safe-area/compact handling must exist');
assert.ok(css.includes('@media (max-height: 650px)'), 'low-height Chromebook protection must exist');
assert.ok(css.includes('env(safe-area-inset-bottom)'), 'phone/tablet safe area must be honored');

// DialogueView is the only accumulating vertical scroll region and must return
// to the latest content after either a new message or an input-height change.
assert.ok(dialogue.includes('flex-1 min-h-0 overflow-y-auto overscroll-contain'), 'message stream must be the shrinkable scroll region');
assert.ok(dialogue.includes("container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })"), 'new content must scroll immediately to the latest message');
assert.ok(dialogue.includes('ResizeObserver'), 'input/layout height changes must keep the latest message visible');
assert.ok(dialogue.includes('[messages, isAiResponding, scrollToLatest]'), 'new messages and thinking state must trigger latest-message scroll');

// Pre-operation dialogue input is voice-only. Help phrases and manual keyboard
// entry must not remain reachable or emit research events from this component.
for (const removedMarker of [
  'COMMON_HELP_PHRASES',
  'manualText',
  'showKeyboardInput',
  'showPhrases',
  'Keyboard',
  'Sparkles',
  'onSendMessage',
  'onClearTranscript',
  'onResearchEvent',
  'help_open',
  'help_phrase_select',
  'text_input_open',
  'text_message_send',
  'お助け',
  '文字入力',
  '<input',
]) {
  assert.equal(speechInput.includes(removedMarker), false, `voice-only SpeechInputBar must not contain ${removedMarker}`);
}
assert.ok(speechInput.includes('音声を聞き取り中…'), 'pupil speech-recognition transcript status must remain visible');
assert.ok(speechInput.includes('min-h-16'), 'primary microphone tap target must remain large for pupils');
assert.ok(speechInput.includes('onToggleRecording'), 'microphone behavior contract must remain connected');

// App must preserve the established speech-recognition -> send path while no
// longer wiring manual text/help callbacks into SpeechInputBar.
assert.ok(app.includes('hidden lg:block"><SpeechInputBar'), 'existing in-panel SpeechInputBar must remain');
assert.ok(app.includes('lg:hidden fixed left-0 right-0 bottom-0'), 'legacy duplicate stays in DOM only for low-risk CSS retirement');
assert.ok(app.includes('await handleSendMessage(interpretedText)'), 'recognized speech must still be sent through the established message path');
assert.equal(app.includes('文字入力を使ってください'), false, 'speech errors must not point pupils to removed keyboard input');
const speechInputUsages = app.match(/<SpeechInputBar[^>]*\/>/g) || [];
assert.equal(speechInputUsages.length, 2, 'App must keep exactly the existing two responsive SpeechInputBar mount points');
for (const usage of speechInputUsages) {
  assert.ok(usage.includes('onToggleRecording={handleToggleRecording}'), 'every SpeechInputBar must keep microphone wiring');
  assert.equal(usage.includes('onSendMessage='), false, 'manual-send callback must not be wired to SpeechInputBar');
  assert.equal(usage.includes('onClearTranscript='), false, 'manual transcript-clear callback must not be wired to SpeechInputBar');
  assert.equal(usage.includes('onResearchEvent='), false, 'removed help/text UI must not emit research events');
}

for (const [width, height, name] of targetViewports) {
  assert.ok(width >= 390 && height >= 600, `${name} target must have a valid supported viewport`);
}

console.log(`Chromebook-first voice-only dialogue viewport QA: PASS (${targetViewports.length} target viewport classes)`);
