import {
  applySpeechRecognitionBiasPhrases,
  formatSpeechText,
  isSpeechRecognitionSupported,
  type SpeechRecognitionBiasPhrase,
} from './speech';

export interface SpeechRecognitionAlternativeText {
  text: string;
  confidence: number;
  primaryConfidence: number;
  rank: number;
}

export interface StableSpeechSnapshot {
  finalText: string;
  interimText: string;
  displayText: string;
  bestText: string;
  rawBestText: string;
  alternatives: SpeechRecognitionAlternativeText[];
}

export interface SpeechRecognitionResultUnit {
  isFinal: boolean;
  alternatives: Array<{ transcript: string; confidence?: number }>;
}

export interface StableSpeechRecognitionOptions {
  biasPhrases?: readonly SpeechRecognitionBiasPhrase[];
  maxAlternatives?: number;
  onStart?: () => void;
  onUpdate: (snapshot: StableSpeechSnapshot) => void;
  onError: (error: string) => void;
  onEnd?: (snapshot: StableSpeechSnapshot, reason: 'stopped' | 'failed') => void;
  onRestart?: (count: number) => void;
  onBiasStatus?: (applied: boolean, phraseCount: number) => void;
}

export interface StableSpeechRecognitionSession {
  start: () => boolean;
  requestStop: () => Promise<StableSpeechSnapshot>;
  cancel: () => void;
  getSnapshot: () => StableSpeechSnapshot;
}

const emptySnapshot = (committedRaw = ''): StableSpeechSnapshot => {
  const bestText = committedRaw.trim() ? formatSpeechText(committedRaw.trim()) : '';
  return {
    finalText: bestText,
    interimText: '',
    displayText: bestText,
    bestText,
    rawBestText: committedRaw.trim(),
    alternatives: [],
  };
};

const joinRaw = (...parts: string[]) => parts.map((part) => String(part || '').trim()).filter(Boolean).join(' ').trim();

const stripTerminalPunctuation = (value: string) => value.replace(/[.?!]+$/g, '');

function primaryTranscript(unit: SpeechRecognitionResultUnit): string {
  return String(unit.alternatives?.[0]?.transcript || '').trim();
}

/**
 * Collapse only progressive interim hypotheses. Distinct finalized result
 * indexes are never deduplicated, so a child saying "natto natto" twice is
 * preserved as two speech segments.
 */
export function collapseProgressiveSpeechUnits(
  results: readonly SpeechRecognitionResultUnit[],
): SpeechRecognitionResultUnit[] {
  const output: SpeechRecognitionResultUnit[] = [];
  for (const rawUnit of results) {
    const unit: SpeechRecognitionResultUnit = {
      isFinal: Boolean(rawUnit.isFinal),
      alternatives: (rawUnit.alternatives || [])
        .map((alternative) => ({
          transcript: String(alternative.transcript || '').trim(),
          confidence: Number.isFinite(Number(alternative.confidence)) ? Number(alternative.confidence) : 0,
        }))
        .filter((alternative) => alternative.transcript.length > 0),
    };
    if (!unit.alternatives.length) continue;

    const previous = output[output.length - 1];
    if (previous && !previous.isFinal) {
      const previousText = primaryTranscript(previous).toLowerCase();
      const nextText = primaryTranscript(unit).toLowerCase();
      if (
        previousText &&
        nextText &&
        (nextText === previousText || nextText.startsWith(`${previousText} `))
      ) {
        output[output.length - 1] = unit;
        continue;
      }
    }
    output.push(unit);
  }
  return output;
}

export function buildStableSpeechSnapshot(
  results: readonly SpeechRecognitionResultUnit[],
  committedRaw = '',
): StableSpeechSnapshot {
  const units = collapseProgressiveSpeechUnits(results);
  const primaryParts = units.map(primaryTranscript).filter(Boolean);
  const finalParts = units.filter((unit) => unit.isFinal).map(primaryTranscript).filter(Boolean);
  const interimParts = units.filter((unit) => !unit.isFinal).map(primaryTranscript).filter(Boolean);

  const rawBestText = joinRaw(committedRaw, primaryParts.join(' '));
  const rawFinalText = joinRaw(committedRaw, finalParts.join(' '));
  const rawInterimText = interimParts.join(' ').trim();
  const bestText = rawBestText ? formatSpeechText(rawBestText) : '';
  const formattedFinal = rawFinalText ? formatSpeechText(rawFinalText) : '';
  const finalText = rawInterimText ? stripTerminalPunctuation(formattedFinal) : formattedFinal;
  const interimText = rawInterimText ? stripTerminalPunctuation(formatSpeechText(rawInterimText)) : '';

  const alternatives: SpeechRecognitionAlternativeText[] = [];
  const seen = new Set<string>();
  units.forEach((unit, unitIndex) => {
    const primary = unit.alternatives[0];
    if (!primary) return;
    unit.alternatives.slice(1, 3).forEach((alternative, alternativeIndex) => {
      const altParts = [...primaryParts];
      altParts[unitIndex] = String(alternative.transcript || '').trim();
      const rawAlternative = joinRaw(committedRaw, altParts.join(' '));
      if (!rawAlternative) return;
      const text = formatSpeechText(rawAlternative);
      if (!text || text === bestText || seen.has(text.toLowerCase())) return;
      seen.add(text.toLowerCase());
      alternatives.push({
        text,
        confidence: Number(alternative.confidence) || 0,
        primaryConfidence: Number(primary.confidence) || 0,
        rank: alternativeIndex + 2,
      });
    });
  });

  return {
    finalText,
    interimText,
    displayText: bestText,
    bestText,
    rawBestText,
    alternatives,
  };
}

function readRecognitionResults(event: any): SpeechRecognitionResultUnit[] {
  const results: SpeechRecognitionResultUnit[] = [];
  for (let i = 0; i < Number(event?.results?.length || 0); i += 1) {
    const item = event.results[i];
    if (!item) continue;
    const alternatives: SpeechRecognitionResultUnit['alternatives'] = [];
    const length = Math.min(Number(item.length || 0), 3);
    for (let j = 0; j < length; j += 1) {
      const alternative = item[j];
      if (!alternative) continue;
      alternatives.push({
        transcript: String(alternative.transcript || ''),
        confidence: Number(alternative.confidence) || 0,
      });
    }
    if (alternatives.length) results.push({ isFinal: Boolean(item.isFinal), alternatives });
  }
  return results;
}

export function createStableSpeechRecognitionSession(
  options: StableSpeechRecognitionOptions,
): StableSpeechRecognitionSession | null {
  if (!isSpeechRecognitionSupported() || typeof window === 'undefined') return null;

  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) return null;

  const biasPhrases = options.biasPhrases || [];
  const maxAlternatives = Math.max(1, Math.min(3, options.maxAlternatives || 3));
  let recognition: any = null;
  let recordingIntent = false;
  let stopRequested = false;
  let cancelled = false;
  let committedRaw = '';
  let latestSnapshot = emptySnapshot();
  let restartCount = 0;
  let stopPromise: Promise<StableSpeechSnapshot> | null = null;
  let stopResolve: ((snapshot: StableSpeechSnapshot) => void) | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let stopFinished = false;

  const clearStopTimer = () => {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = null;
  };

  const finishStop = (reason: 'stopped' | 'failed' = 'stopped') => {
    if (stopFinished) return latestSnapshot;
    stopFinished = true;
    clearStopTimer();
    const snapshot = latestSnapshot;
    recognition = null;
    options.onEnd?.(snapshot, reason);
    stopResolve?.(snapshot);
    stopResolve = null;
    return snapshot;
  };

  const fail = (error: string) => {
    if (cancelled || stopFinished) return;
    recordingIntent = false;
    stopRequested = true;
    options.onError(error);
    finishStop('failed');
  };

  const startRecognizer = (isRestart = false): boolean => {
    if (!recordingIntent || cancelled || stopFinished) return false;
    try {
      const nextRecognition = new SpeechRec();
      nextRecognition.continuous = true;
      nextRecognition.interimResults = true;
      nextRecognition.maxAlternatives = maxAlternatives;
      nextRecognition.lang = 'en-US';
      const biasApplied = applySpeechRecognitionBiasPhrases(nextRecognition, biasPhrases);
      options.onBiasStatus?.(biasApplied, biasPhrases.length);

      nextRecognition.onstart = () => {
        if (cancelled || stopFinished) return;
        if (isRestart) options.onRestart?.(restartCount);
        options.onStart?.();
      };

      nextRecognition.onresult = (event: any) => {
        if (cancelled || stopFinished) return;
        const units = readRecognitionResults(event);
        latestSnapshot = buildStableSpeechSnapshot(units, committedRaw);
        if (latestSnapshot.rawBestText) restartCount = 0;
        options.onUpdate(latestSnapshot);
      };

      nextRecognition.onerror = (event: any) => {
        const error = String(event?.error || 'speech-recognition-error');
        if (cancelled || stopFinished || (stopRequested && error === 'aborted')) return;
        if (recordingIntent && (error === 'no-speech' || error === 'aborted')) return;
        fail(error);
      };

      nextRecognition.onend = () => {
        if (cancelled || stopFinished) return;
        if (stopRequested || !recordingIntent) {
          finishStop('stopped');
          return;
        }

        if (latestSnapshot.rawBestText.trim()) {
          committedRaw = latestSnapshot.rawBestText.trim();
          latestSnapshot = emptySnapshot(committedRaw);
          options.onUpdate(latestSnapshot);
        }

        restartCount += 1;
        if (restartCount > 4) {
          fail('recognition-ended-repeatedly');
          return;
        }
        recognition = null;
        window.setTimeout(() => {
          if (recordingIntent && !stopRequested && !cancelled && !stopFinished) startRecognizer(true);
        }, 120);
      };

      recognition = nextRecognition;
      nextRecognition.start();
      return true;
    } catch (error) {
      console.warn('Stable speech recognition start error:', error);
      fail('start');
      return false;
    }
  };

  const start = () => {
    if (recordingIntent || cancelled || stopFinished) return false;
    recordingIntent = true;
    stopRequested = false;
    committedRaw = '';
    latestSnapshot = emptySnapshot();
    restartCount = 0;
    return startRecognizer(false);
  };

  const requestStop = () => {
    if (stopPromise) return stopPromise;
    stopPromise = new Promise<StableSpeechSnapshot>((resolve) => {
      stopResolve = resolve;
    });
    recordingIntent = false;
    stopRequested = true;

    if (!recognition) {
      finishStop('stopped');
      return stopPromise;
    }

    try {
      recognition.stop();
    } catch (error) {
      console.warn('Stable speech recognition stop error:', error);
      finishStop('stopped');
      return stopPromise;
    }

    if (!stopFinished) {
      stopTimer = setTimeout(() => {
        try { recognition?.abort?.(); } catch { /* no-op */ }
        finishStop('stopped');
      }, 900);
    }
    return stopPromise;
  };

  const cancel = () => {
    cancelled = true;
    recordingIntent = false;
    stopRequested = true;
    clearStopTimer();
    try { recognition?.abort?.(); } catch { /* no-op */ }
    recognition = null;
  };

  return {
    start,
    requestStop,
    cancel,
    getSnapshot: () => latestSnapshot,
  };
}
