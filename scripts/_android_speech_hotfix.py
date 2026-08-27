from pathlib import Path

path = Path('src/utils/speech.ts')
source = path.read_text(encoding='utf-8')

start_marker = "    // eslint-disable-next-line @typescript-eslint/no-explicit-any\n    recognition.onresult = (event: any) => {"
end_marker = "\n\n    // eslint-disable-next-line @typescript-eslint/no-explicit-any\n    recognition.onerror = (event: any) => {"

start = source.find(start_marker)
if start < 0:
    raise SystemExit('SpeechRecognition onresult block start not found; refusing broad edit')
end = source.find(end_marker, start)
if end < 0:
    raise SystemExit('SpeechRecognition onresult block end not found; refusing broad edit')

new_block = """    // Keep finalized speech across events, while replacing (not accumulating)
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

patched = source[:start] + new_block + source[end:]
if patched == source:
    raise SystemExit('Patch made no change')
if patched.count('event.resultIndex') != 2:
    raise SystemExit('Unexpected event.resultIndex count after patch')

path.write_text(patched, encoding='utf-8')
print('Patched src/utils/speech.ts only.')
