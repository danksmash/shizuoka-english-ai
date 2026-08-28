from pathlib import Path
import re

source = Path('scripts/patch-information-density.py').read_text()
actual_helpers = "var SCHOOL_CLASSES=['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備'];\nfunction uniqueClasses(source,key){var vals=Array.from(new Set(source.map(function(r){return String(r[key]||'').trim()}).filter(Boolean)));return SCHOOL_CLASSES.filter(function(c){return vals.indexOf(c)>=0}).concat(vals.filter(function(c){return SCHOOL_CLASSES.indexOf(c)<0}).sort())}\nfunction fillSchoolClassSelect(id,allLabel){var e=$(id);if(!e)return;var old=e.value;if(allLabel===null){e.innerHTML=SCHOOL_CLASSES.map(function(v){return '<option value=\\\"'+esc(v)+'\\\">'+esc(v)+'</option>'}).join('')}else{fillSelect(id,SCHOOL_CLASSES,allLabel);return}if(Array.from(e.options||[]).some(function(o){return o.value===old}))e.value=old}"
source, count = re.subn(r'old_helpers = "var SCHOOL_CLASSES=.*?"\nnew_helpers =', 'old_helpers = ' + repr(actual_helpers) + '\nnew_helpers =', source, count=1, flags=re.S)
if count != 1:
    raise SystemExit('could not rewrite class-helper target')
exec(compile(source, 'patch-information-density.py', 'exec'))
