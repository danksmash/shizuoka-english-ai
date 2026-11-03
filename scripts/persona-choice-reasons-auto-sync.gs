const PERSONA_CHOICE_FORM_ID = '1yJZ0nfvYETEnKaV227VBD9_T0WiOMobI6gT-K6BYS7I';
const PERSONA_CHOICE_RESPONSE_SHEET_ID = '1kktYzTDTXwzNpOtaiNkWO8MMILCrk1ATaRE4smKxpkw';
const PERSONA_CHOICE_INGEST_URL = 'https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app/api/questionnaire-auto/ingest';
const PERSONA_CHOICE_SECRET_PROPERTY = 'QUESTIONNAIRE_INGEST_SECRET';
const PERSONA_CHOICE_SYNC_LOG_SHEET = '_sync_log';

function installPersonaChoiceReasonsAutoSync() {
  const secret = personaChoiceSecret_();
  if (!secret) throw new Error('QUESTIONNAIRE_INGEST_SECRET をスクリプトプロパティに設定してください。');

  const handlers = ['onPersonaChoiceReasonSubmit', 'retryPersonaChoiceReasonSync'];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger('onPersonaChoiceReasonSubmit')
    .forForm(FormApp.openById(PERSONA_CHOICE_FORM_ID))
    .onFormSubmit()
    .create();
  ScriptApp.newTrigger('retryPersonaChoiceReasonSync')
    .timeBased()
    .everyMinutes(5)
    .create();

  personaChoiceSyncLog_();
  return auditPersonaChoiceReasonsAutoSync();
}

function onPersonaChoiceReasonSubmit(event) {
  if (!event || !event.response) throw new Error('フォーム送信イベントがありません。');
  const payload = personaChoicePayload_(event.response);
  try {
    const result = sendPersonaChoicePayload_(payload);
    recordPersonaChoiceSync_(payload, 'synced', result, '');
  } catch (error) {
    recordPersonaChoiceSync_(payload, 'pending', null, String(error && error.message || error));
    throw error;
  }
}

function retryPersonaChoiceReasonSync() {
  const sheet = personaChoiceSyncLog_();
  // Older script versions wrote payload JSON including a learner code.
  // Wipe that legacy column before scanning, including already-synced rows.
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).clearContent();
  }
  const values = sheet.getDataRange().getValues();
  const state = {};
  for (let row = 1; row < values.length; row += 1) {
    const id = String(values[row][0] || '');
    if (!id) continue;
    const status = String(values[row][3] || '');
    if (!state[id] || (status === 'synced' && state[id].status !== 'synced')) {
      state[id] = { row: row + 1, status: status };
    }
  }

  // Reconcile against the Google Form itself, not only previously logged
  // "pending" submissions. This rescues responses missed by both the submit
  // trigger and the log writer. Firestore already deduplicates by Form response ID.
  const responses = FormApp.openById(PERSONA_CHOICE_FORM_ID).getResponses();
  responses.forEach(function(response) {
    const id = String(response.getId() || '');
    if (state[id] && state[id].status === 'synced') return;
    const payload = personaChoicePayload_(response);
    try {
      const result = sendPersonaChoicePayload_(payload);
      if (state[id]) {
        sheet.getRange(state[id].row, 3).clearContent(); // Never retain the learning code in the sync log.
        sheet.getRange(state[id].row, 4, 1, 4).setValues([['synced', new Date(), JSON.stringify(result), '']]);
      } else {
        recordPersonaChoiceSync_(payload, 'synced', result, '');
      }
    } catch (error) {
      const message = String(error && error.message || error);
      if (state[id]) {
        sheet.getRange(state[id].row, 3).clearContent();
        sheet.getRange(state[id].row, 4).setValue('pending');
        sheet.getRange(state[id].row, 7).setValue(message);
      } else {
        recordPersonaChoiceSync_(payload, 'pending', null, message);
      }
    }
  });
}

function auditPersonaChoiceReasonsAutoSync() {
  const triggers = ScriptApp.getProjectTriggers().map(function(trigger) {
    return { handler: trigger.getHandlerFunction(), source: String(trigger.getTriggerSource()), event: String(trigger.getEventType()) };
  });
  const form = FormApp.openById(PERSONA_CHOICE_FORM_ID);
  const log = personaChoiceSyncLog_();
  const logRows = log.getDataRange().getValues().slice(1);
  const formResponses = form.getResponses();
  const logged = new Set(logRows.map(function(row) { return String(row[0] || ''); }).filter(Boolean));
  const synced = new Set(logRows.filter(function(row) { return String(row[3]) === 'synced'; })
    .map(function(row) { return String(row[0] || ''); }).filter(Boolean));
  return {
    formId: PERSONA_CHOICE_FORM_ID,
    responseSheetId: PERSONA_CHOICE_RESPONSE_SHEET_ID,
    acceptingResponses: form.isAcceptingResponses(),
    secretConfigured: Boolean(personaChoiceSecret_()),
    // These are aggregate diagnostics only: do not expose pupil codes or answers.
    formResponseCount: formResponses.length,
    loggedResponseCount: logged.size,
    syncedResponseCount: synced.size,
    pendingResponseCount: logRows.filter(function(row) { return String(row[3]) === 'pending'; }).length,
    unloggedResponseCount: formResponses.filter(function(response) { return !logged.has(String(response.getId())); }).length,
    submitTriggerInstalled: triggers.some(function(trigger) {
      return trigger.handler === 'onPersonaChoiceReasonSubmit' && trigger.event === 'ON_FORM_SUBMIT';
    }),
    retryTriggerInstalled: triggers.some(function(trigger) {
      return trigger.handler === 'retryPersonaChoiceReasonSync' && trigger.event === 'CLOCK';
    }),
    triggers: triggers,
    syncLogSheet: log.getName(),
    syncLogHidden: log.isSheetHidden(),
  };
}

function testPersonaChoiceReasonsConnectionNoWrite() {
  const payload = {
    formId: PERSONA_CHOICE_FORM_ID,
    formResponseId: 'connection-test-no-write',
    submittedAt: new Date().toISOString(),
    learningCode: '0000',
    answers: { initialReasons: ['接続確認'], finalReasons: ['接続確認'], comment: '' },
  };
  try {
    sendPersonaChoicePayload_(payload);
    throw new Error('無効コードが受理されました。');
  } catch (error) {
    const message = String(error && error.message || error);
    if (message.indexOf('INVALID_LEARNING_CODE') < 0) throw error;
    return { ok: true, expected: 'INVALID_LEARNING_CODE', writePerformed: false };
  }
}

function personaChoicePayload_(response) {
  const answers = { initialReasons: [], finalReasons: [], comment: '' };
  let learningCode = '';
  response.getItemResponses().forEach(function(itemResponse) {
    const title = itemResponse.getItem().getTitle();
    const value = itemResponse.getResponse();
    if (title.indexOf('学習コード') >= 0) learningCode = String(value || '').trim().toUpperCase();
    else if (title.indexOf('質問1') === 0) answers.initialReasons = personaChoiceList_(value);
    else if (title.indexOf('質問2') === 0) answers.finalReasons = personaChoiceList_(value);
    else if (title.indexOf('質問3') === 0) answers.comment = String(value || '').trim();
  });
  return {
    formId: PERSONA_CHOICE_FORM_ID,
    formResponseId: response.getId(),
    submittedAt: response.getTimestamp().toISOString(),
    learningCode: learningCode,
    answers: answers,
  };
}

function personaChoiceList_(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return list.map(function(item) { return String(item).trim(); }).filter(Boolean);
}

function sendPersonaChoicePayload_(payload) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const canonical = personaChoiceCanonical_(payload);
  const signatureBytes = Utilities.computeHmacSha256Signature(timestamp + '\n' + canonical, personaChoiceSecret_());
  const signature = signatureBytes.map(function(value) { return ('0' + (value & 255).toString(16)).slice(-2); }).join('');
  const response = UrlFetchApp.fetch(PERSONA_CHOICE_INGEST_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: canonical,
    headers: { 'X-Questionnaire-Timestamp': timestamp, 'X-Questionnaire-Signature': signature },
    muteHttpExceptions: true,
  });
  const body = response.getContentText();
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('同期に失敗しました (' + code + '): ' + body);
  return JSON.parse(body);
}

function personaChoiceCanonical_(payload) {
  return JSON.stringify({
    formId: String(payload.formId || '').trim(),
    formResponseId: String(payload.formResponseId || '').trim(),
    submittedAt: String(payload.submittedAt || '').trim(),
    learningCode: String(payload.learningCode || '').trim().toUpperCase(),
    answers: {
      initialReasons: personaChoiceList_(payload.answers && payload.answers.initialReasons),
      finalReasons: personaChoiceList_(payload.answers && payload.answers.finalReasons),
      comment: String(payload.answers && payload.answers.comment || '').trim(),
    },
  });
}

function recordPersonaChoiceSync_(payload, status, result, error) {
  personaChoiceSyncLog_().appendRow([
    payload.formResponseId,
    payload.submittedAt,
    '', // The Form is the source of truth; do not copy the learning code into the sync log.
    status,
    status === 'synced' ? new Date() : '',
    result ? JSON.stringify(result) : '',
    error || '',
  ]);
}

function personaChoiceSyncLog_() {
  const spreadsheet = SpreadsheetApp.openById(PERSONA_CHOICE_RESPONSE_SHEET_ID);
  let sheet = spreadsheet.getSheetByName(PERSONA_CHOICE_SYNC_LOG_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PERSONA_CHOICE_SYNC_LOG_SHEET);
    sheet.getRange(1, 1, 1, 7).setValues([['formResponseId', 'submittedAt', 'payload', 'status', 'syncedAt', 'result', 'error']]);
    sheet.setFrozenRows(1);
  }
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function personaChoiceSecret_() {
  return String(PropertiesService.getScriptProperties().getProperty(PERSONA_CHOICE_SECRET_PROPERTY) || '').trim();
}
