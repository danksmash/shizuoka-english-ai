from pathlib import Path

path = Path('src/utils/speech.ts')
source = path.read_text(encoding='utf-8')

old = """    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      try {
        const resultsArray: Array<{ transcript: string; isFinal: boolean }> = [];
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item && item[0]) {
            resultsArray.push({
              transcript: item[0].transcript,
              isFinal: Boolean(item.isFinal),
            });
          }
        }

        const { formatted, combinedRaw, hasFinal } = accumulateSpeechResults(resultsArray);
        onResult(formatted || combinedRaw, hasFinal);
      } catch (e) {
        console.warn('Speech onresult error:', e);
      }
    };"""

new = """    // Keep finalized speech across events, while replacing (not accumulating)
    // the current interim hypothesis. Using resultIndex avoids re-processing
    // unchanged results, which can otherwise duplicate phrases on Android Chrome.
    let finalizedTranscript = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      try {
        let interimTranscript = '';
        const startIndex = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;

        for (let i = startIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (!item || !item[0]) continue;

          const piece = String(item[0].transcript || '').trim();
          if (!piece) continue;

          if (item.isFinal) {
            finalizedTranscript = (finalizedTranscript ? `${finalizedTranscript} ` : '') + piece;
          } else {
            interimTranscript = (interimTranscript ? `${interimTranscript} ` : '') + piece;
          }
        }

        const combinedRaw = [finalizedTranscript.trim(), interimTranscript.trim()]
          .filter(Boolean)
          .join(' ');
        const formatted = formatSpeechText(combinedRaw);
        onResult(formatted || combinedRaw, Boolean(finalizedTranscript.trim()));
      } catch (e) {
        console.warn('Speech onresult error:', e);
      }
    };"""

if old not in source:
    raise SystemExit('Expected SpeechRecognition block not found; refusing broad edit')

patched = source.replace(old, new, 1)
if patched.count('event.resultIndex') != 1:
    raise SystemExit('Unexpected resultIndex count after patch')

path.write_text(patched, encoding='utf-8')
print('Patched src/utils/speech.ts only.')
