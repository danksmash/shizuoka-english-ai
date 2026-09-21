import { getDocument, setDocument } from './firestore';

export const RQ2_CODEBOOK_COLLECTION = 'research_rq2_codebooks';
export const RQ2_DEFAULT_CODEBOOK_ID = 'draft-current';

export const DEFAULT_RQ2_CODEBOOK = {
  version: 'draft-2026-09-21',
  status: 'draft',
  title: 'RQ2 暫定コードブック',
  codingUnit: 'AI前ターン→児童ターン→必要に応じAI後ターン',
  multiLabel: true,
  referenceBasis: [
    { code: 'B0', label: '一般・非特定', definition: '特定の国・Persona・直前発話・相手の理解状態ではなく、一般的な情報や非特定の相手を手掛かりにしている。' },
    { code: 'B1', label: '国・文化等のカテゴリー情報', definition: '国籍、国、文化など、個人固有ではないカテゴリー情報を手掛かりにしている。' },
    { code: 'B2', label: 'Persona固有情報', definition: '特定のAI留学生Personaに固有のプロフィール・人物情報を手掛かりにしている。' },
    { code: 'B3', label: '直前発話利用', definition: '相手の直前発話に含まれる新情報を、次の児童発話で利用している。' },
    { code: 'B4', label: '相手の理解状態', definition: '相手が理解しているか、知っているかなどの理解状態を手掛かりに、児童が発話を調整している。' },
  ],
  interactionFunction: [
    { code: 'Q', label: '質問', definition: '相手に情報を求める質問を行う。' },
    { code: 'A-SD', label: '応答／自己開示', definition: '相手の問いに答える、または自分自身について情報を伝える。' },
    { code: 'T', label: '話題展開', definition: '現在の話題を関連方向へ広げたり、次の内容へ展開したりする。' },
    { code: 'E', label: '説明／詳述', definition: '内容を補足し、理由・具体例・追加情報などによって説明を詳しくする。' },
    { code: 'U', label: '理解確認／調整', definition: '相手の理解を確かめたり、理解しやすいように表現や内容を調整したりする。' },
    { code: 'R', label: '修復', definition: '聞き返し、言い直し、確認などによって対話上の問題を修復する。' },
  ],
  recipientLocus: [
    { code: 'INIT', label: '児童自発', definition: 'AIの直前質問に直接要求されず、児童が自発的に開始・追加した発話。' },
    { code: 'RESP', label: 'AI質問への応答', definition: 'AIの直前質問への応答として生じた発話。' },
    { code: 'AI-SCAFF', label: 'AIによる強い足場かけ', definition: 'AIの直前質問・提示によって内容や形式が強く誘導された発話。' },
  ],
  notes: [
    '本コードブックは実データから作成した暫定版であり、Phase 1〜3および比較校対応期間1〜3を含む開発用標本で境界事例を確認してから確定版へ移行する。',
    'コード確定前は定義・含む例／含まない例・境界事例・多重ラベル規則を追記できる。',
  ],
};

export async function getRq2Codebook() {
  const stored = await getDocument(RQ2_CODEBOOK_COLLECTION, RQ2_DEFAULT_CODEBOOK_ID);
  return stored || DEFAULT_RQ2_CODEBOOK;
}

export async function saveRq2Codebook(input: Record<string, any>, updatedBy: string, freeze = false) {
  const referenceBasis = Array.isArray(input.referenceBasis) ? input.referenceBasis : [];
  const interactionFunction = Array.isArray(input.interactionFunction) ? input.interactionFunction : [];
  if (!referenceBasis.length || !interactionFunction.length) throw new Error('RQ2_CODEBOOK_REQUIRED_DIMENSIONS');
  const allCodes = [...referenceBasis, ...interactionFunction].map((row: any) => String(row?.code || '').trim()).filter(Boolean);
  if (new Set(allCodes).size !== allCodes.length) throw new Error('RQ2_CODEBOOK_DUPLICATE_CODE');
  if (freeze) {
    const incomplete = [...referenceBasis, ...interactionFunction].some((row: any) => !String(row?.code || '').trim() || !String(row?.definition || '').trim());
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
    version,
    status: freeze ? 'frozen' : 'draft',
    revision,
    updatedAt: now,
    updatedBy: String(updatedBy || 'researcher').slice(0, 100),
  };
  await setDocument(RQ2_CODEBOOK_COLLECTION, RQ2_DEFAULT_CODEBOOK_ID, record);
  if (freeze) await setDocument(RQ2_CODEBOOK_COLLECTION, version, record);
  return record;
}

export function rq2AllowedCodes(codebook: Record<string, any>) {
  return {
    reference: new Set((Array.isArray(codebook.referenceBasis) ? codebook.referenceBasis : []).map((row: any) => String(row.code || ''))),
    functions: new Set((Array.isArray(codebook.interactionFunction) ? codebook.interactionFunction : []).map((row: any) => String(row.code || ''))),
    locus: new Set((Array.isArray(codebook.recipientLocus) ? codebook.recipientLocus : []).map((row: any) => String(row.code || ''))),
  };
}
