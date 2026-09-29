from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f'{path}: expected one match, got {n}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once(
    'src/server/researchRq2Codebook.ts',
    "  if (!stored) return DEFAULT_RQ2_CODEBOOK;\n  if (codebookLooksLegacy(stored)) {",
    "  if (!stored) return DEFAULT_RQ2_CODEBOOK;\n  // Preserve an already-frozen legacy codebook so in-progress formal runs remain reproducible.\n  // Draft legacy codebooks are shown as an unsaved schema-5 migration preview.\n  if (codebookLooksLegacy(stored) && String(stored.status || '') === 'frozen') return stored;\n  if (codebookLooksLegacy(stored)) {",
)

replace_once(
    'src/server/researchRq3Persistence.ts',
    "    promptVersion: 'rq2-coding-prompt-v4',",
    "    promptVersion: 'rq2-coding-prompt-v5',",
)

replace_once(
    'scripts/qa-research-rq3.ts',
    "const rq2Ai = fs.readFileSync('src/server/researchRq2Ai.ts', 'utf8');",
    "const rq2Ai = fs.readFileSync('src/server/researchRq2Ai.ts', 'utf8');\nconst rq3Persistence = fs.readFileSync('src/server/researchRq3Persistence.ts', 'utf8');\nconst rq2Codebook = fs.readFileSync('src/server/researchRq2Codebook.ts', 'utf8');",
)
replace_once(
    'scripts/qa-research-rq3.ts',
    "assert.ok(rq2Ai.includes(\"promptVersion = 'rq2-coding-prompt-v5'\"));",
    "assert.ok(rq2Ai.includes(\"'rq2-coding-prompt-v5'\"));\nassert.ok(rq2Ai.includes(\"'rq2-coding-prompt-v4'\"), 'schema-4 prompt path must remain available for frozen legacy runs');\nassert.ok(rq3Persistence.includes(\"promptVersion: 'rq2-coding-prompt-v5'\"));\nassert.ok(rq2Codebook.includes(\"codebookLooksLegacy(stored) && String(stored.status || '') === 'frozen'\"));",
)

print('final repair-v5 compatibility fixes applied')
