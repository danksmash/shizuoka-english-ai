import { getDocument, setDocument } from './firestore';

export const RQ2_CODEBOOK_COLLECTION = 'research_rq2_codebooks';
export const RQ2_DEFAULT_CODEBOOK_ID = 'draft-current';
export const RQ2_CODEBOOK_SCHEMA_VERSION = 2;

export const DEFAULT_RQ2_CODEBOOK = {
  schemaVersion: RQ2_CODEBOOK_SCHEMA_VERSION,
  version: 'draft-2026-09-21-v2',
  status: 'draft',
  title: 'RQ2 暫定コードブック',
  codingUnit: 'AI前ターン→児童ターン→必要に応じAI後ターン',
  referenceBasisRule: '参照基盤は原則として主要な1コードを付与する。併用が必要な境界事例は、コードブック開発段階で判断規則を明記してから扱う。',
  interactionFunctionRule: '対話機能は、1つの発話に複数の機能が明確に認められる場合は複数コードを付与できる。',
  recipientLocusRule: 'recipient locus は補助欄であり、発話中の明示的な手掛かりから判断できる場合にのみ記録する。児童の意図を推測して付与しない。',
  referenceBasis: [
    { code: 'B0', label: '一般・非特定', definition: '相手固有の情報を用いず、一般的な質問・応答を行う。' },
    { code: 'B1', label: 'カテゴリー情報', definition: '国籍、国・文化、地域等のカテゴリー情報を手掛かりとする。' },
    { code: 'B2a', label: 'AI Persona 固有情報', definition: 'AI対話中にそのPersonaから得た趣味・経験・好み等を用いる。' },
    { code: 'B2b', label: '実在留学生本人情報', definition: '実践校のみ。本人動画等で得た名前、趣味、出身地等を用いる。' },
    { code: 'B3', label: '直前対話情報', definition: '直前の相手発話を受けて質問・応答・話題展開を行う。' },
    { code: 'B4', label: '相手の理解状態', definition: '相手が分からない／聞き取れない等の状態に応じて説明・確認・修復を行う。' },
  ],
  interactionFunction: [
    { code: 'Q', label: '質問', definition: '情報を得る、確認する、相手に働きかける質問。' },
    { code: 'A/SD', aliases: ['A-SD'], label: '応答・自己開示', definition: '質問への応答、自分の経験・好み等の具体化。' },
    { code: 'T', label: '話題展開', definition: '直前情報を利用して同じ話題を広げる・深める。' },
    { code: 'E', label: '説明', definition: '相手が知らない内容を説明・具体化する。' },
    { code: 'U', label: '理解確認・調整', definition: '相手の理解を確認し、理解しやすいように調整する。' },
    { code: 'R', label: '修復', definition: '聞き返し、言い換え、再説明等で理解上の問題を処理する。' },
  ],
  recipientLocus: [
    { code: '現在のAI', label: '現在のAI', definition: '発話中の明示的な手掛かりから、現在対話しているAIを受け手としていることが確認できる場合。' },
    { code: '将来の実在留学生', label: '将来の実在留学生', definition: '発話中の明示的な手掛かりから、将来交流する実在留学生を受け手としていることが確認できる場合。' },
    { code: 'AIと実在他者を橋渡し', label: 'AIと実在他者を橋渡し', definition: '発話中の明示的な手掛かりから、現在のAI対話と将来の実在他者との交流を結び付けていることが確認できる場合。' },
    { code: '判定不能', label: '判定不能', definition: '局所的対話系列だけではrecipient locusを根拠をもって判定できない場合。' },
  ],
  notes: [
    '本コードブックは実データから作成した暫定版であり、Phase 1〜3および比較校対応期間1〜3を含む開発用標本で境界事例を確認してから確定版へ移行する。',
    '正式化前に、各コードについて「含む例／含まない例」「境界事例」「必要な前後ターン」「多重ラベル規則」を追記する。',
    '予備分析で抽出された generic response、specific self-disclosure、reciprocal move、prior-turn follow-up、persona/category reference 等は、参照基盤×対話機能の組合せとして再整理し、コード体系を必要以上に細分化しない。',
    'AIの出力は候補コードであり、正式コード、児童意図、因果解釈、研究結論をAIだけで確定しない。',
  ],
};

function rowsForDimension(codebook: Record<string, any>, dimension: 'reference' | 'function' | 'locus') {
  const key = dimension === 'reference' ? 'referenceBasis' : dimension === 'function' ? 'interactionFunction' : 'recipientLocus';
  return Array.isArray(codebook[key]) ? codebook[key] : [];
}

function codebookLooksLikeLegacyDefault(codebook: Record<string, any>): boolean {
  if (Number(codebook.schemaVersion || 0) >= RQ2_CODEBOOK_SCHEMA_VERSION) return false;
  const refs = rowsForDimension(codebook, 'reference').map((row: any) => String(row?.code || ''));
  const locus = rowsForDimension(codebook, 'locus').map((row: any) => String(row?.code || ''));
  return refs.includes('B2') && !refs.includes('B2a') && locus.includes('INIT') && locus.includes('RESP');
}

export async function getRq2Codebook() {
  const stored = await getDocument(RQ2_CODEBOOK_COLLECTION, RQ2_DEFAULT_CODEBOOK_ID);
  if (!stored) return DEFAULT_RQ2_CODEBOOK;
  if (String(stored.status || '') === 'draft' && codebookLooksLikeLegacyDefault(stored)) {
    return {
      ...DEFAULT_RQ2_CODEBOOK,
      migratedFromRevision: Number(stored.revision || 0),
      migrationNote: '旧初期コードブックを共同研究提案書の暫定定義へ自動更新した未保存プレビューです。保存するとv2形式になります。',
    };
  }
  return stored;
}

export async function saveRq2Codebook(input: Record<string, any>, updatedBy: string, freeze = false) {
  const referenceBasis = Array.isArray(input.referenceBasis) ? input.referenceBasis : [];
  const interactionFunction = Array.isArray(input.interactionFunction) ? input.interactionFunction : [];
  const recipientLocus = Array.isArray(input.recipientLocus) ? input.recipientLocus : [];
  if (!referenceBasis.length || !interactionFunction.length || !recipientLocus.length) throw new Error('RQ2_CODEBOOK_REQUIRED_DIMENSIONS');
  const allCodes = [...referenceBasis, ...interactionFunction, ...recipientLocus].map((row: any) => String(row?.code || '').trim()).filter(Boolean);
  if (new Set(allCodes).size !== allCodes.length) throw new Error('RQ2_CODEBOOK_DUPLICATE_CODE');
  if (freeze) {
    const incomplete = [...referenceBasis, ...interactionFunction, ...recipientLocus]
      .some((row: any) => !String(row?.code || '').trim() || !String(row?.definition || '').trim());
    if (incomplete) throw new Error('RQ2_CODEBOOK_INCOMPLETE');
  }
  const now = new Date().toISOString();
  const previous = await getDocument(RQ2_CODEBOOK_COLLECTION, RQ2_DEFAULT_CODEBOOK_ID);
  const revision = Number(previous?.revision || 0) + 1;
  const version = freeze
    ? `rq2-v${revision}`
    : String(input.version || previous?.version || DEFAULT_RQ2_CODEBOOK.version);
  const record = {
    ...input,
    schemaVersion: RQ2_CODEBOOK_SCHEMA_VERSION,
    version,
    status: freeze ? 'frozen' : 'draft',
    revision,
    updatedAt: now,
    updatedBy: String(updatedBy || 'researcher').slice(0, 100),
  };
  delete (record as Record<string, any>).migratedFromRevision;
  delete (record as Record<string, any>).migrationNote;
  await setDocument(RQ2_CODEBOOK_COLLECTION, RQ2_DEFAULT_CODEBOOK_ID, record);
  if (freeze) await setDocument(RQ2_CODEBOOK_COLLECTION, version, record);
  return record;
}

function aliasMap(codebook: Record<string, any>, dimension: 'reference' | 'function' | 'locus') {
  const map = new Map<string, string>();
  for (const row of rowsForDimension(codebook, dimension)) {
    const canonical = String(row?.code || '').trim();
    if (!canonical) continue;
    map.set(canonical, canonical);
    for (const alias of Array.isArray(row?.aliases) ? row.aliases : []) {
      const text = String(alias || '').trim();
      if (text) map.set(text, canonical);
    }
  }
  return map;
}

export function rq2CanonicalizeCodes(
  codebook: Record<string, any>,
  dimension: 'reference' | 'function' | 'locus',
  values: unknown,
) {
  const map = aliasMap(codebook, dimension);
  const raw = Array.isArray(values) ? values.map((value) => String(value || '').trim()).filter(Boolean) : [];
  const valid = raw.map((value) => map.get(value)).filter((value): value is string => Boolean(value));
  return {
    valid: [...new Set(valid)],
    invalid: raw.filter((value) => !map.has(value)),
  };
}

export function rq2AllowedCodes(codebook: Record<string, any>) {
  return {
    reference: new Set(rowsForDimension(codebook, 'reference').map((row: any) => String(row.code || ''))),
    functions: new Set(rowsForDimension(codebook, 'function').map((row: any) => String(row.code || ''))),
    locus: new Set(rowsForDimension(codebook, 'locus').map((row: any) => String(row.code || ''))),
  };
}
