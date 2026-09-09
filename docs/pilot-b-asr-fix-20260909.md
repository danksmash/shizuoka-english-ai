# Pilot B ASR improvement — 2026-09-09

Pilot B teacher feedback identified difficulty with locally meaningful proper nouns and familiar Japanese food terms. This change extends the existing context-sensitive ASR strategy without introducing a fixed misrecognition-to-correction table.

## Added high-priority candidates

Food: karaage, ramen, curry rice, hamburger steak, omurice.

Local/place candidates: Hamamatsu, Shizuoka, Mt. Fuji, Lake Hamana, Tenryu River, Lake Sanaru.

## Safety

- Learner/person names are not auto-corrected and are not supplied as contextual recognition hints.
- Manual text input is not contextually corrected.
- Recognition bias is progressive enhancement only; unsupported browsers keep the existing recognition path.
- Contextual post-processing still requires a strong conversation context and high phonetic confidence.
- `karaoke` is explicitly protected from accidental correction to `karaage`.
- New ASR system events store bias availability and dictionary candidate/category only, not an additional copy of the raw child transcript.

## Verification

Targeted contextual ASR QA, full QA, TypeScript, and production build passed on the implementation branch.
