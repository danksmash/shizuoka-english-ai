from pathlib import Path
import re

path = Path(__file__).with_name('_apply_ai_reflection_4point_backend_patch.py')
text = path.read_text(encoding='utf-8')
pattern = re.compile(
    r"replace_once\(\n    'src/server/researchDashboard\.ts',\n    \"      reflection_conveyed_ideas: session\.reflection\?\.conveyedIdeas.*?\n\)\n",
    re.S,
)
replacement = '''replace_once(\n    'src/server/researchExport.ts',\n    \"      reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '', reflection_understood_partner: session.reflection?.understoodPartner ?? '',\\n      reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '', system_event_count: systemEvents.length,\",\n    \"      reflection_scale_version: session.reflection?.scaleVersion || (session.reflection ? 'legacy-135' : ''),\\n      reflection_understood_partner: session.reflection?.understoodPartner ?? '', reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '',\\n      reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '', system_event_count: systemEvents.length,\"\n)\n'''
new_text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'failed to replace wrong researchDashboard mapping block: {count}')
path.write_text(new_text, encoding='utf-8')
print('patch helper mapping corrected')
