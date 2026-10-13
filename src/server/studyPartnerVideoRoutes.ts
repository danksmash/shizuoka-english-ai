import crypto from 'node:crypto';
import express from 'express';
import { requireManagementRole, type AuthenticatedRequest } from './auth';
import { createDocumentIfAbsent, listCollection } from './firestore';
import { getAllStudySchedules, isStudyClassId, normalizeStudyDate } from './studySchedulePersistence';

// Researcher-only, append-only evidence. Never update study_schedules or raw sessions.
const VIDEO_VERSIONS = 'study_partner_video_versions';
const VISITOR_EVENTS = 'study_partner_visitor_events';
const router = express.Router();
const STUDENT_IDS = Array.from({ length: 20 }, (_, i) => 'S' + String(i + 1).padStart(3, '0'));

type VideoRecord = {
  studentId: string;
  revision: number;
  country: string;
  displayName: string;
  videoUrl: string;
  videoVersion: string;
  englishTranscript: string;
  japaneseSummary: string;
  contentTags: string[];
  researcherNotes: string;
  updatedAt: string;
  updatedBy: string;
};
type VisitorEvent = {
  eventId: string;
  classId: string;
  eventType: 'roster_change' | 'student_notice' | 'video_view';
  effectiveDate: string;
  announcedToChildrenDate: string;
  visitors: Array<{ studentId: string; country: string; displayName: string }>;
  note: string;
  createdAt: string;
  createdBy: string;
};

const limited = (raw: unknown, max: number) =>
  typeof raw === 'string' ? raw.trim().slice(0, max) : '';
function requiredString(raw: unknown, max: number, name: string): string {
  if (typeof raw !== 'string' || raw.trim().length > max) throw new Error('INVALID_' + name);
  return raw.trim();
}
function requiredId(raw: unknown): string {
  if (typeof raw !== 'string' || !STUDENT_IDS.includes(raw)) throw new Error('INVALID_PARTNER_ID');
  return raw;
}
function requiredDate(raw: unknown, optional: boolean, label: string): string {
  if (optional && (raw === '' || raw === undefined || raw === null)) return '';
  try {
    const d = normalizeStudyDate(raw);
    if (!d) throw new Error('missing');
    return d;
  } catch { throw new Error('INVALID_' + label); }
}
function videoUrl(raw: unknown): string {
  const input = requiredString(raw === undefined ? '' : raw, 1200, 'VIDEO_URL');
  if (!input) return '';
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !!url.username || !!url.password) throw new Error('protocol');
    return input;
  } catch { throw new Error('INVALID_VIDEO_URL'); }
}
function contentTags(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length > 30) throw new Error('INVALID_VIDEO_TAGS');
  const tags = raw.map(item => requiredString(item, 80, 'VIDEO_TAG')).filter(Boolean);
  return [...new Set(tags)];
}
function normalizedVideo(raw: Record<string, any>, revision: number, by: string): VideoRecord {
  const studentId = requiredId(raw.studentId);
  const country = requiredString(raw.country ?? '', 120, 'COUNTRY');
  const displayName = requiredString(raw.displayName ?? '', 120, 'DISPLAY_NAME');
  const englishTranscript = requiredString(raw.englishTranscript ?? '', 16000, 'TRANSCRIPT');
  const japaneseSummary = requiredString(raw.japaneseSummary ?? '', 8000, 'SUMMARY');
  const researcherNotes = requiredString(raw.researcherNotes ?? '', 2000, 'NOTES');
  if (!country && !englishTranscript && !japaneseSummary) throw new Error('PARTNER_CONTENT_REQUIRED');
  return {
    studentId, revision, country, displayName,
    videoUrl: videoUrl(raw.videoUrl),
    videoVersion: requiredString(raw.videoVersion ?? '', 60, 'VIDEO_VERSION'),
    englishTranscript, japaneseSummary,
    contentTags: contentTags(raw.contentTags ?? []),
    researcherNotes,
    updatedAt: new Date().toISOString(),
    updatedBy: limited(by, 100),
  };
}
function byStudentAndRevision(a: VideoRecord, b: VideoRecord) {
  return a.studentId.localeCompare(b.studentId) || b.revision - a.revision;
}
async function videoVersions(): Promise<VideoRecord[]> {
  const rows = await listCollection(VIDEO_VERSIONS, 200);
  return rows.filter(row => STUDENT_IDS.includes(String(row.studentId || '')) && Number.isInteger(Number(row.revision)))
    .map(row => ({
      studentId: String(row.studentId), revision: Number(row.revision),
      country: limited(row.country, 120), displayName: limited(row.displayName, 120),
      videoUrl: limited(row.videoUrl, 1200), videoVersion: limited(row.videoVersion, 60),
      englishTranscript: limited(row.englishTranscript, 16000),
      japaneseSummary: limited(row.japaneseSummary, 8000),
      contentTags: Array.isArray(row.contentTags) ? row.contentTags.map((v: unknown) => limited(v, 80)) : [],
      researcherNotes: limited(row.researcherNotes, 2000),
      updatedAt: limited(row.updatedAt, 100), updatedBy: limited(row.updatedBy, 100),
    })).sort(byStudentAndRevision);
}
function latestRecords(rows: VideoRecord[]) {
  const selected = new Map<string, VideoRecord>();
  for (const row of rows) if (!selected.has(row.studentId)) selected.set(row.studentId, row);
  return selected;
}

router.get('/study-partner-videos', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const [versions, events, schedules] = await Promise.all([
      videoVersions(), listCollection(VISITOR_EVENTS, 100), getAllStudySchedules(),
    ]);
    const latest = latestRecords(versions);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      studentIds: STUDENT_IDS,
      profiles: STUDENT_IDS.map(id => latest.get(id) || { studentId: id, revision: 0 }),
      versions,
      events: (events as VisitorEvent[]).filter(event => event.eventId && isStudyClassId(event.classId))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      schedules: schedules.filter(s => !/^[56]-C[1-9]$/.test(s.classId)).map(s => ({
        classId: s.classId, revision: s.revision,
        nationalityRevealDate: s.nationalityRevealDate,
        announcedVisitorCountries: s.announcedVisitorCountries,
        announcedVisitorCountryCounts: s.announcedVisitorCountryCounts,
        videoViewDate: s.videoViewDate,
        assignmentRevealDate: s.assignmentRevealDate,
        history: s.history,
      })),
    });
  } catch (error: any) {
    console.error('Partner video list failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'PARTNER_VIDEO_READ_UNAVAILABLE' });
  }
});

router.post('/study-partner-videos/record', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const input = req.body || {};
    const id = requiredId(input.studentId);
    const versions = (await videoVersions()).filter(row => row.studentId === id);
    const latest = versions[0];
    const expected = Number(input.expectedRevision);
    if (!Number.isInteger(expected) || expected < 0) throw new Error('INVALID_EXPECTED_REVISION');
    if (expected !== (latest?.revision || 0)) {
      return res.status(409).json({ success: false, error: 'PARTNER_VIDEO_REVISION_CONFLICT' });
    }
    const record = normalizedVideo(input, expected + 1, req.managementUser?.username || 'researcher');
    const key = id + '_r' + String(record.revision).padStart(6, '0');
    const created = await createDocumentIfAbsent(VIDEO_VERSIONS, key, record);
    if (!created) return res.status(409).json({ success: false, error: 'PARTNER_VIDEO_REVISION_CONFLICT' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ success: true, record });
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.startsWith('INVALID_') || message === 'PARTNER_CONTENT_REQUIRED') {
      return res.status(400).json({ success: false, error: message });
    }
    console.error('Partner video write failed', { message });
    return res.status(503).json({ success: false, error: 'PARTNER_VIDEO_SAVE_UNAVAILABLE' });
  }
});

router.post('/study-partner-videos/visitor-event', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const input = req.body || {};
    if (!isStudyClassId(input.classId) || /^[56]-C[1-9]$/.test(input.classId)) throw new Error('INVALID_EVENT_CLASS');
    if (input.eventType !== 'roster_change' && input.eventType !== 'student_notice' && input.eventType !== 'video_view') throw new Error('INVALID_EVENT_TYPE');
    if (!Array.isArray(input.visitorIds) || input.visitorIds.length < 1 || input.visitorIds.length > 20) throw new Error('INVALID_EVENT_VISITORS');
    const ids = input.visitorIds.map(requiredId);
    if (new Set(ids).size !== ids.length) throw new Error('INVALID_EVENT_DUPLICATE_VISITOR');
    const latest = latestRecords(await videoVersions());
    const missingCountry = ids.find(id => !latest.get(id)?.country);
    if (missingCountry) throw new Error('INVALID_EVENT_COUNTRY_REQUIRED_FOR_' + missingCountry);
    const effectiveDate = requiredDate(input.effectiveDate, false, 'EFFECTIVE_DATE');
    const announcedToChildrenDate = requiredDate(input.announcedToChildrenDate, true, 'ANNOUNCEMENT_DATE');
    if (input.eventType === 'video_view' && !announcedToChildrenDate) throw new Error('INVALID_VIDEO_VIEW_DATE_REQUIRED');
    const eventId = crypto.randomUUID();
    const event: VisitorEvent = {
      eventId, classId: input.classId, eventType: input.eventType,
      effectiveDate, announcedToChildrenDate,
      visitors: ids.map(id => ({
        studentId: id, country: latest.get(id)!.country,
        displayName: latest.get(id)!.displayName,
      })),
      note: requiredString(input.note ?? '', 1500, 'EVENT_NOTE'),
      createdAt: new Date().toISOString(),
      createdBy: limited(req.managementUser?.username, 100),
    };
    const created = await createDocumentIfAbsent(VISITOR_EVENTS, eventId, event);
    if (!created) throw new Error('EVENT_ID_CONFLICT');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ success: true, event });
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.startsWith('INVALID_')) return res.status(400).json({ success: false, error: message });
    console.error('Partner visitor event failed', { message });
    return res.status(503).json({ success: false, error: 'PARTNER_EVENT_SAVE_UNAVAILABLE' });
  }
});

export function createStudyPartnerVideoRouter() { return router; }
