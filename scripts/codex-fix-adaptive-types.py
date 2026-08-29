from pathlib import Path

feedback = Path('src/components/FeedbackScreen.tsx')
text = feedback.read_text()
old = "import { ChatMessage, FeedbackData, FeedbackExpressionItem, StudentProfile } from '../types';"
new = "import { ChatMessage, FeedbackData, FeedbackExpressionItem, StudentProfile, VisualVocabularyItem } from '../types';"
if old not in text:
    raise SystemExit('FeedbackScreen type import marker not found')
feedback.write_text(text.replace(old, new, 1))

fallback = Path('src/utils/feedbackFallback.ts')
text = fallback.read_text()
old = "    .filter((item): item is FeedbackData['keyPhrases'][number] => item !== null)\n    .slice(0, 3);"
new = "    .filter((item) => item !== null)\n    .slice(0, 3) as FeedbackData['keyPhrases'];"
if old not in text:
    raise SystemExit('fallback key phrase type marker not found')
fallback.write_text(text.replace(old, new, 1))
print('Adaptive feedback TypeScript fixes applied.')
