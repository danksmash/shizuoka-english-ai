from pathlib import Path
p=Path('src/server/persistence.ts')
s=p.read_text()
old="""    reflection_understood_partner: session.reflection?.understoodPartner ?? '',
    reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '',
    child_utterances: Array.isArray(session.history)
      ? session.history.filter((message: any) => message?.sender === 'child').map((message: any) => String(message.englishText || '')).join(' | ')
      : '',
"""
new="""    reflection_understood_partner: session.reflection?.understoodPartner ?? '',
    reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '',
"""
assert old in s
p.write_text(s.replace(old,new))
print('research export minimized')
