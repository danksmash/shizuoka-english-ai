from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')

def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

def replace_once(path, old, new):
    text = read(path)
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f'{path}: expected 1 occurrence, got {n}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))

def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    text2, n = re.subn(pattern, replacement, text, count=1, flags=flags)
    if n != 1:
        raise RuntimeError(f'{path}: expected 1 regex occurrence, got {n}: {pattern}')
    write(path, text2)

# RQ2: preserve existing frozen schema-4 formal coding behavior.
old = "    const repair = canonicalRepairAttributes(functions.primary, req.body || {}, true);"
new = "    const repair = Number(codebook.schemaVersion || 0) >= 5\n      ? canonicalRepairAttributes(functions.primary, req.body || {}, true)\n      : { repairSubtype: '', repairOutcome: '', technologyInvolvement: '' };"
text = read('src/server/researchRq2Routes.ts')
if text.count(old) != 2:
    raise RuntimeError(f'RQ2 repair validation occurrences: {text.count(old)}')
write('src/server/researchRq2Routes.ts', text.replace(old, new))

# RQ3: carry the schema-5 repair attributes through human confirmation and exports
replace_once(
    'src/server/researchRq3Routes.ts',
    "import { getRq2Codebook, rq2CanonicalPrimaryAndAux } from './researchRq2Codebook';",
    "import { getRq2Codebook, rq2CanonicalPrimaryAndAux } from './researchRq2Codebook';\nimport { canonicalRepairAttributes } from './researchRepair';",
)
replace_once(
    'src/server/researchRq3Routes.ts',
    "    const functions = canonicalPrimaryAux(codebook, 'function', req.body?.functionPrimary, req.body?.functionAuxCodes);\n    const decision = req.body?.decision === 'modify' ? 'modified' : 'confirmed';",
    "    const functions = canonicalPrimaryAux(codebook, 'function', req.body?.functionPrimary, req.body?.functionAuxCodes);\n    const repair = canonicalRepairAttributes(functions.primary, req.body || {}, true);\n    const decision = req.body?.decision === 'modify' ? 'modified' : 'confirmed';",
)
replace_once(
    'src/server/researchRq3Routes.ts',
    "      humanFunctionCodes: [functions.primary, ...functions.aux],\n      humanStatus: decision,",
    "      humanFunctionCodes: [functions.primary, ...functions.aux],\n      humanRepairSubtype: repair.repairSubtype,\n      humanRepairOutcome: repair.repairOutcome,\n      humanTechnologyInvolvement: repair.technologyInvolvement,\n      humanStatus: decision,",
)
replace_once(
    'src/server/researchRq3Routes.ts',
    "  const headers = ['run_id','sequence_id','coder_id','codebook_version','reference_primary','reference_aux_codes','function_primary','function_aux_codes','saved_at'];",
    "  const headers = ['run_id','sequence_id','coder_id','codebook_version','reference_primary','reference_aux_codes','function_primary','function_aux_codes','repair_subtype','repair_outcome','technology_involvement','saved_at'];",
)
replace_once(
    'src/server/researchRq3Routes.ts',
    "    function_aux_codes: row.functionAuxCodes || (Array.isArray(row.functionCodes) ? row.functionCodes.slice(1) : []),\n    saved_at: row.savedAt || '',",
    "    function_aux_codes: row.functionAuxCodes || (Array.isArray(row.functionCodes) ? row.functionCodes.slice(1) : []),\n    repair_subtype: row.repairSubtype || '',\n    repair_outcome: row.repairOutcome || '',\n    technology_involvement: row.technologyInvolvement || '',\n    saved_at: row.savedAt || '',",
)

# RQ3 analysis-ready export: add repair columns without changing primary typology models.
replace_once('src/server/researchRq3Analysis.ts', "export const INTERACTION_CODES_SCHEMA_VERSION = 'interaction-codes-2026-v1';", "export const INTERACTION_CODES_SCHEMA_VERSION = 'interaction-codes-2026-v2';")
replace_once(
    'src/server/researchRq3Analysis.ts',
    "  'function_primary',\n  'function_aux_labels',\n  'coding_status',",
    "  'function_primary',\n  'function_aux_labels',\n  'repair_subtype',\n  'repair_outcome',\n  'technology_involvement',\n  'coding_status',",
)
replace_once(
    'src/server/researchRq3Analysis.ts',
    "      function_primary: functionPrimary,\n      function_aux_labels: confirmed ? finalAux(item, 'function').join('|') : '',\n      coding_status:",
    "      function_primary: functionPrimary,\n      function_aux_labels: confirmed ? finalAux(item, 'function').join('|') : '',\n      repair_subtype: confirmed && functionPrimary === 'REP' ? String(item.humanRepairSubtype || '') : '',\n      repair_outcome: confirmed && functionPrimary === 'REP' ? String(item.humanRepairOutcome || '') : '',\n      technology_involvement: confirmed && functionPrimary === 'REP' ? String(item.humanTechnologyInvolvement || '') : '',\n      coding_status:",
)

# RQ3 researcher UI: schema5 gate + structured repair fields.
replace_once('public/research-rq3.html', "const schemaOk=Number(d.codebook.schemaVersion||0)>=4;", "const schemaOk=Number(d.codebook.schemaVersion||0)>=5;")
regex_once(
    'public/research-rq3.html',
    r"function inputs\(item\)\{.*?\}\nfunction renderItems",
    r'''function repairOptions(value,values){return '<option value="">—</option>'+values.map(([v,l])=>'<option value="'+v+'"'+(value===v?' selected':'')+'>'+l+'</option>').join('');}
function inputs(item){const rp=item.aiReferencePrimary||item.aiReferenceCodes?.[0]||'',ra=(item.aiReferenceAuxCodes||item.aiReferenceCodes?.slice(1)||[]).join(','),fp=item.aiFunctionPrimary||item.aiFunctionCodes?.[0]||'',fa=(item.aiFunctionAuxCodes||item.aiFunctionCodes?.slice(1)||[]).join(','),rs=item.aiRepairSubtype||'',ro=item.aiRepairOutcome||'',rt=item.aiTechnologyInvolvement||'';const repair='<div data-repair-box="'+esc(item.sequenceId)+'" style="display:'+(fp==='REP'?'grid':'none')+';grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:6px"><div><span class="muted">repair種類</span><select data-rs="'+esc(item.sequenceId)+'">'+repairOptions(rs,[['self_initiated','自己開始'],['response_to_trouble','理解困難への応答'],['third_position','AI誤理解への第三位置修復']])+'</select></div><div><span class="muted">修復結果</span><select data-ro="'+esc(item.sequenceId)+'">'+repairOptions(ro,[['resolved','解決'],['unresolved','未解決'],['unclear','判定不能']])+'</select></div><div><span class="muted">技術要因</span><select data-rt="'+esc(item.sequenceId)+'">'+repairOptions(rt,[['probable','強く疑われる'],['possible','可能性あり'],['not_evident','証拠なし'],['unclear','判定不能']])+'</select></div></div>';return '<div class="review-grid"><div><span class="muted">参照 主</span><input data-rp="'+esc(item.sequenceId)+'" value="'+esc(rp)+'"></div><div><span class="muted">参照 補助</span><input data-ra="'+esc(item.sequenceId)+'" value="'+esc(ra)+'"></div><div><span class="muted">機能 主</span><input data-fp="'+esc(item.sequenceId)+'" value="'+esc(fp)+'"></div><div><span class="muted">機能 補助</span><input data-fa="'+esc(item.sequenceId)+'" value="'+esc(fa)+'"></div></div>'+repair;}
function toggleRepair(sequenceId){const fp=document.querySelector('[data-fp="'+CSS.escape(sequenceId)+'"]');const box=document.querySelector('[data-repair-box="'+CSS.escape(sequenceId)+'"]');if(box)box.style.display=String(fp?.value||'').trim()==='REP'?'grid':'none';}
function renderItems''',
    flags=re.S,
)
replace_once(
    'public/research-rq3.html',
    "const ai='<div>参照 <span class=\"pill\">'+esc(item.aiReferencePrimary||item.aiReferenceCodes?.[0]||'—')+'</span> '+(item.aiReferenceAuxCodes||[]).map(x=>'<span class=\"pill\">'+esc(x)+'</span>').join('')+'</div><div>機能 <span class=\"pill\">'+esc(item.aiFunctionPrimary||item.aiFunctionCodes?.[0]||'—')+'</span> '+(item.aiFunctionAuxCodes||[]).map(x=>'<span class=\"pill\">'+esc(x)+'</span>').join('')+'</div>'+(item.aiNeedsReview?'<span class=\"pill warn\">要確認</span><div class=\"muted\">'+esc(item.aiReviewReason||'')+'</div>':'');",
    "const ai='<div>参照 <span class=\"pill\">'+esc(item.aiReferencePrimary||item.aiReferenceCodes?.[0]||'—')+'</span> '+(item.aiReferenceAuxCodes||[]).map(x=>'<span class=\"pill\">'+esc(x)+'</span>').join('')+'</div><div>機能 <span class=\"pill\">'+esc(item.aiFunctionPrimary||item.aiFunctionCodes?.[0]||'—')+'</span> '+(item.aiFunctionAuxCodes||[]).map(x=>'<span class=\"pill\">'+esc(x)+'</span>').join('')+'</div>'+((item.aiFunctionPrimary||item.aiFunctionCodes?.[0])==='REP'?'<div class=\"muted\"><b>repair</b> '+esc(item.aiRepairSubtype||'—')+' / '+esc(item.aiRepairOutcome||'—')+' / 技術 '+esc(item.aiTechnologyInvolvement||'—')+'</div>':'')+(item.aiNeedsReview?'<span class=\"pill warn\">要確認</span><div class=\"muted\">'+esc(item.aiReviewReason||'')+'</div>':'');",
)
replace_once(
    'public/research-rq3.html',
    "document.querySelectorAll('[data-context]').forEach(b=>b.onclick=()=>loadContext(b.dataset.context));$('pageInfo').textContent=total?",
    "document.querySelectorAll('[data-context]').forEach(b=>b.onclick=()=>loadContext(b.dataset.context));document.querySelectorAll('[data-fp]').forEach(el=>{const id=el.dataset.fp;el.addEventListener('input',()=>toggleRepair(id));toggleRepair(id);});$('pageInfo').textContent=total?",
)
regex_once(
    'public/research-rq3.html',
    r"async function saveHuman\(sequenceId,adopt\)\{.*?\}\nasync function loadContext",
    r'''async function saveHuman(sequenceId,adopt){try{const item=currentItems.find(x=>x.sequenceId===sequenceId)||{},q=s=>document.querySelector(s)?.value||'';const functionPrimary=adopt?(item.aiFunctionPrimary||item.aiFunctionCodes?.[0]||''):q('[data-fp="'+CSS.escape(sequenceId)+'"]');const body={runId:runId(),sequenceId,referencePrimary:adopt?(item.aiReferencePrimary||item.aiReferenceCodes?.[0]||''):q('[data-rp="'+CSS.escape(sequenceId)+'"]'),referenceAuxCodes:adopt?(item.aiReferenceAuxCodes||[]):splitCodes(q('[data-ra="'+CSS.escape(sequenceId)+'"]')),functionPrimary,functionAuxCodes:adopt?(item.aiFunctionAuxCodes||[]):splitCodes(q('[data-fa="'+CSS.escape(sequenceId)+'"]')),repairSubtype:functionPrimary==='REP'?(adopt?(item.aiRepairSubtype||''):q('[data-rs="'+CSS.escape(sequenceId)+'"]')):'',repairOutcome:functionPrimary==='REP'?(adopt?(item.aiRepairOutcome||''):q('[data-ro="'+CSS.escape(sequenceId)+'"]')):'',technologyInvolvement:functionPrimary==='REP'?(adopt?(item.aiTechnologyInvolvement||''):q('[data-rt="'+CSS.escape(sequenceId)+'"]')):'',decision:adopt?'confirm':'modify'};await api('/api/management/research-rq3/human-code',{method:'POST',body:JSON.stringify(body)});status('itemStatus','人間確認を保存しました。');await Promise.all([loadStatus(),loadItems(currentFilter,offset)]);}catch(e){status('itemStatus','保存失敗: '+e.message,true);}}
async function loadContext''',
    flags=re.S,
)

# QA coverage for all compatibility boundaries.
replace_once(
    'scripts/qa-research-rq2.ts',
    "assert.ok(routes.includes('humanRepairSubtype'));",
    "assert.ok(routes.includes('humanRepairSubtype'));\nassert.ok(routes.includes(\"Number(codebook.schemaVersion || 0) >= 5\"), 'schema-4 frozen RQ2 runs must not be forced to supply repair attributes');",
)
replace_once(
    'scripts/qa-research-rq3.ts',
    "const page = fs.readFileSync('public/research-rq3.html', 'utf8');",
    "const page = fs.readFileSync('public/research-rq3.html', 'utf8');\nconst rq3Analysis = fs.readFileSync('src/server/researchRq3Analysis.ts', 'utf8');",
)
replace_once(
    'scripts/qa-research-rq3.ts',
    "assert.ok(page.includes('前後文脈'));",
    "assert.ok(page.includes('前後文脈'));\nassert.ok(page.includes('AI誤理解への第三位置修復'));\nassert.ok(page.includes('schemaVersion||0)>=5');",
)
replace_once(
    'scripts/qa-research-rq3.ts',
    "assert.ok(routes.includes('/research-rq3/human-code'));",
    "assert.ok(routes.includes('/research-rq3/human-code'));\nassert.ok(routes.includes('humanRepairSubtype'));\nassert.ok(routes.includes('technologyInvolvement'));",
)
replace_once(
    'scripts/qa-research-rq3.ts',
    "assert.ok(rq3Persistence.includes(\"promptVersion: 'rq2-coding-prompt-v5'\"));",
    "assert.ok(rq3Persistence.includes(\"promptVersion: 'rq2-coding-prompt-v5'\"));\nassert.ok(rq3Analysis.includes(\"INTERACTION_CODES_SCHEMA_VERSION = 'interaction-codes-2026-v2'\"));\nassert.ok(rq3Analysis.includes('repair_subtype'));\nassert.ok(rq3Analysis.includes('technology_involvement'));",
)
# Extend row-level unit assertions.
replace_once(
    'scripts/qa-research-rq3.ts',
    "    humanFunctionAuxCodes: ['TOP'],\n    humanCoder: 'A',",
    "    humanFunctionAuxCodes: ['TOP'],\n    humanRepairSubtype: '',\n    humanRepairOutcome: '',\n    humanTechnologyInvolvement: '',\n    humanCoder: 'A',",
)
replace_once(
    'scripts/qa-research-rq3.ts',
    "assert.equal(rows[1].function_aux_labels, 'TOP');",
    "assert.equal(rows[1].function_aux_labels, 'TOP');\nassert.equal(rows[1].repair_subtype, '');\nassert.equal(rows[1].technology_involvement, '');",
)

print('RQ2/RQ3 repair consistency patch applied')
