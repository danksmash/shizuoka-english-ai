import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export type QaGroup =
  | 'qa:foundation'
  | 'qa:experience'
  | 'qa:research-stack'
  | 'qa:persona-stack'
  | 'qa:voice-stack'
  | 'qa:full';

export type QaSuggestion = {
  files: string[];
  risk: 'low' | 'medium' | 'high';
  groups: QaGroup[];
  reasons: string[];
  prGate: string[];
};

const GROUP_ORDER: QaGroup[] = [
  'qa:foundation',
  'qa:experience',
  'qa:research-stack',
  'qa:persona-stack',
  'qa:voice-stack',
  'qa:full',
];

function normalizeFile(file: string): string {
  return file.trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

function matches(file: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(file));
}

function gitLines(args: string[]): string[] {
  try {
    const output = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output.split(/\r?\n/).map(normalizeFile).filter(Boolean);
  } catch {
    return [];
  }
}

export function detectChangedFiles(): string[] {
  const workingTree = [
    ...gitLines(['diff', '--name-only', '--cached']),
    ...gitLines(['diff', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ];
  if (workingTree.length) return [...new Set(workingTree)].sort();

  for (const range of ['origin/main...HEAD', 'main...HEAD']) {
    const committed = gitLines(['diff', '--name-only', range]);
    if (committed.length) return [...new Set(committed)].sort();
  }
  return [];
}

export function suggestQa(filesInput: string[]): QaSuggestion {
  const files = [...new Set(filesInput.map(normalizeFile).filter(Boolean))].sort();
  if (!files.length) {
    return {
      files,
      risk: 'low',
      groups: [],
      reasons: ['変更ファイルを検出できませんでした。必要ならファイルパスを引数で指定してください。'],
      prGate: ['PRでは npm run qa と npm run build を実行します。'],
    };
  }

  const groups = new Set<QaGroup>();
  const reasons = new Set<string>();
  let risk: QaSuggestion['risk'] = 'low';
  const raiseRisk = (next: QaSuggestion['risk']) => {
    const rank = { low: 0, medium: 1, high: 2 };
    if (rank[next] > rank[risk]) risk = next;
  };

  for (const file of files) {
    let fileClassified = false;
    if (/^(README\.md|docs\/.*\.md)$/.test(file)) {
      reasons.add('文書ファイル自体には対象QA不要です。PRのFull QAは維持します。');
      continue;
    }

    if (matches(file, [
      /^\.github\/workflows\//,
      /^package(?:-lock)?\.json$/,
      /^tsconfig(?:\..+)?\.json$/,
      /^vite\.config\./,
      /^server-entry\.ts$/,
      /^scripts\/build-server\.ts$/,
    ])) {
      groups.add('qa:full');
      fileClassified = true;
      raiseRisk('high');
      reasons.add('CI・依存関係・build/deploy基盤は横断影響があるためFull QAを推奨します。');
      continue;
    }

    if (file === 'server.ts') {
      groups.add('qa:full');
      raiseRisk('high');
      reasons.add('server.ts は認証・保存・研究APIを横断するためFull QAを推奨します。');
      continue;
    }

    if (matches(file, [
      /(?:^|\/)(?:tts|azure|voice|speech)[^/]*\.(?:ts|tsx|js|mjs)$/i,
      /^src\/.*(?:tts|azure|voice|speech)/i,
      /^scripts\/qa-(?:azure|tts|stable-speech|contextual-asr)/,
    ])) {
      groups.add('qa:voice-stack');
      groups.add('qa:foundation');
      fileClassified = true;
      raiseRisk('medium');
      reasons.add('音声関連はvoice設定と基礎的な対話・認識の両方を確認します。');
    }

    if (matches(file, [
      /^src\/assets\/personas\//,
      /^src\/data\/(?:curriculum|personaResearch|studentImages)\.ts$/,
      /^scripts\/qa-(?:persona|20-persona)/,
    ])) {
      groups.add('qa:persona-stack');
      fileClassified = true;
      raiseRisk('medium');
      reasons.add('Persona定義・画像・研究対象設定はpersona-stackで確認します。');
    }

    if (matches(file, [
      /^src\/server\/(?:research|management|studySchedule|questionnaire)/,
      /^src\/server\/.*Reflection/i,
      /^public\/(?:study-schedule|questionnaire-analysis)\.html$/,
      /^public\/researcher-readable\.css$/,
      /^scripts\/qa-(?:research|management|study-schedule|questionnaire|reflection)/,
    ])) {
      groups.add('qa:research-stack');
      fileClassified = true;
      raiseRisk('medium');
      reasons.add('研究者画面・Phase・session・質問紙・Reflectionはresearch-stackで確認します。');
    }

    if (matches(file, [
      /^src\/components\//,
      /^src\/App\.tsx$/,
      /^src\/.*\.(?:css|scss)$/,
      /^public\/.*\.(?:css|html)$/,
      /^scripts\/qa-(?:responsive|dialogue-viewport|setup-column|feedback|ai-reflection)/,
    ])) {
      groups.add('qa:experience');
      fileClassified = true;
      raiseRisk('medium');
      reasons.add('UI構造・レスポンシブ・操作性はexperienceで確認します。');
    }

    if (matches(file, [
      /^src\/server\/(?:persistence|security|auth)/i,
      /^src\/.*(?:security|privacy|dataContract)/i,
      /^scripts\/qa-(?:security|data-contract|dialogue|pilot-b)/,
    ])) {
      groups.add('qa:foundation');
      groups.add('qa:research-stack');
      fileClassified = true;
      raiseRisk('high');
      reasons.add('保存・認証・研究データ境界はHigh riskとしてfoundationとresearch-stackを確認します。');
    }

    if (/^(src\/|scripts\/|public\/)/.test(file) && !fileClassified) {
      groups.add('qa:foundation');
      raiseRisk('medium');
      reasons.add('未分類の実装変更は安全側に倒してfoundationを推奨します。');
    }
  }

  const ordered = GROUP_ORDER.filter((group) => groups.has(group));
  const finalGroups = ordered.includes('qa:full') ? ['qa:full' as QaGroup] : ordered;

  return {
    files,
    risk,
    groups: finalGroups,
    reasons: [...reasons],
    prGate: ['PRでは npm run qa と npm run build を1回ずつ通します。'],
  };
}

function printHuman(result: QaSuggestion): void {
  console.log(`変更ファイル: ${result.files.length}件`);
  console.log(`リスク: ${result.risk.toUpperCase()}`);
  if (result.files.length) {
    console.log('\n対象:');
    for (const file of result.files) console.log(`  - ${file}`);
  }
  console.log('\n推奨QA:');
  if (!result.groups.length) {
    console.log('  - 対象QAなし（文書変更または変更未検出）');
  } else {
    for (const group of result.groups) console.log(`  npm run ${group}`);
  }
  if (result.reasons.length) {
    console.log('\n理由:');
    for (const reason of result.reasons) console.log(`  - ${reason}`);
  }
  console.log('\nPRゲート:');
  for (const gate of result.prGate) console.log(`  - ${gate}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const explicitFiles = args.filter((arg) => !arg.startsWith('--'));
  const files = explicitFiles.length ? explicitFiles : detectChangedFiles();
  const result = suggestQa(files);
  if (json) console.log(JSON.stringify(result, null, 2));
  else printHuman(result);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entry && import.meta.url === entry) main();
