import base64, csv, hashlib, hmac, io, json, math, re, statistics, subprocess, time, urllib.parse, urllib.request
from collections import Counter, defaultdict

PROJECT='shizuoka-english-ai'
REGION='asia-northeast1'
SERVICE='shizuoka-english-ai'
API='https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app'


def sh(*args):
    return subprocess.check_output(args, text=True).strip()


def runtime_values(names):
    service=json.loads(sh('gcloud','run','services','describe',SERVICE,'--project',PROJECT,'--region',REGION,'--format=json'))
    rows=service.get('spec',{}).get('template',{}).get('spec',{}).get('containers',[{}])[0].get('env',[])
    out={}
    for row in rows:
        name=row.get('name')
        if name not in names:
            continue
        if 'value' in row:
            out[name]=str(row.get('value',''))
        else:
            raise RuntimeError(f'{name} is secret-backed and unavailable to read-only audit identity')
    return out


def b64url(b):
    return base64.urlsafe_b64encode(b).decode().rstrip('=')


def researcher_cookie(accounts_json, secret):
    accounts=json.loads(accounts_json)
    acc=next(x for x in accounts if x.get('role')=='researcher' and x.get('username'))
    payload={'username':acc['username'],'role':'researcher','exp':int(time.time()*1000)+3600000}
    encoded=b64url(json.dumps(payload,separators=(',',':'),ensure_ascii=False).encode())
    sig=b64url(hmac.new(secret.encode(),encoded.encode(),hashlib.sha256).digest())
    return 'mgmt_session='+urllib.parse.quote(encoded+'.'+sig)


def get(path,cookie=''):
    headers={'User-Agent':'production-dialogue-readonly-audit/2026-09-26'}
    if cookie:
        headers['Cookie']=cookie
    req=urllib.request.Request(API+path,headers=headers)
    with urllib.request.urlopen(req,timeout=120) as resp:
        return resp.read().decode('utf-8-sig',errors='replace')


def read_csv(dataset,cookie):
    path=f'/api/management/research.csv?dataset={urllib.parse.quote(dataset)}&dataScope=main'
    text=get(path,cookie)
    rows=list(csv.DictReader(io.StringIO(text)))
    print(f'DATASET {dataset}: rows={len(rows)} columns={len(rows[0]) if rows else 0}')
    return rows


def fnum(value, default=0.0):
    try:
        x=float(value)
        return x if math.isfinite(x) else default
    except (TypeError,ValueError):
        return default


def fint(value, default=0):
    return int(round(fnum(value,default)))


def mean(values):
    return statistics.fmean(values) if values else 0.0


def median(values):
    return statistics.median(values) if values else 0.0


def pct(n,d):
    return 100.0*n/d if d else 0.0


def safe_counter(rows,key):
    return Counter((r.get(key) or '').strip() or '(blank)' for r in rows)


def top_counter(c,n=6):
    total=sum(c.values())
    return [{'value':k,'n':v,'pct':round(pct(v,total),1)} for k,v in c.most_common(n)]


def hhi(c):
    total=sum(c.values())
    return sum((v/total)**2 for v in c.values()) if total else 0.0


def normalized_entropy(c):
    vals=[v for v in c.values() if v>0]
    total=sum(vals)
    if total<=0 or len(vals)<=1:
        return 0.0
    ent=-sum((v/total)*math.log(v/total) for v in vals)
    return ent/math.log(len(vals))


def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", (text or '').lower())


def yes(row,key):
    return str(row.get(key,'')).strip().lower() in {'1','true','yes'}


def session_ids(rows):
    return {r.get('session_id','') for r in rows if r.get('session_id')}


def select_sessions(rows,class_id,start,end,lesson_only=False):
    out=[r for r in rows if (r.get('class_id') or '').strip()==class_id and start <= (r.get('local_date') or '') <= end]
    if lesson_only:
        out=[r for r in out if (r.get('lesson_context_inferred') or '').strip()=='in_lesson']
    return out


def select_utterances(rows,sessions):
    ids=session_ids(sessions)
    return [r for r in rows if r.get('session_id','') in ids]


def summarize_sessions(rows):
    participants={r.get('research_id','') for r in rows if r.get('research_id')}
    per_person=Counter(r.get('research_id','') for r in rows if r.get('research_id'))
    durations=[fnum(r.get('actual_duration_seconds')) for r in rows if fnum(r.get('actual_duration_seconds'))>0]
    child_words=[fint(r.get('child_total_words')) for r in rows]
    child_turns=[fint(r.get('child_turn_count')) for r in rows]
    total_words=sum(child_words)
    total_turns=sum(child_turns)
    total_duration=sum(durations)
    q=safe_counter(rows,'data_quality_flag')
    persona=safe_counter(rows,'persona_id')
    country=safe_counter(rows,'persona_country')
    gender=safe_counter(rows,'persona_gender')
    topic=safe_counter(rows,'topic')
    usage=safe_counter(rows,'usage_context_inferred')
    lesson=safe_counter(rows,'lesson_context_inferred')
    target=safe_counter(rows,'target_duration_minutes')
    return {
      'sessions':len(rows),
      'participants':len(participants),
      'sessions_per_participant_mean':round(mean(list(per_person.values())),2),
      'sessions_per_participant_median':round(median(list(per_person.values())),2),
      'sessions_per_participant_max':max(per_person.values()) if per_person else 0,
      'quality':dict(q),
      'complete_pct':round(pct(q.get('complete',0),len(rows)),1),
      'missing_core_pct':round(pct(q.get('missing_core',0),len(rows)),1),
      'interrupted_pct':round(pct(q.get('interrupted',0),len(rows)),1),
      'missing_reflection_pct':round(pct(q.get('missing_reflection',0),len(rows)),1),
      'duration_sec_mean':round(mean(durations),1),
      'duration_sec_median':round(median(durations),1),
      'sessions_under_30s':sum(1 for r in rows if 0 < fnum(r.get('actual_duration_seconds')) < 30),
      'sessions_under_60s':sum(1 for r in rows if 0 < fnum(r.get('actual_duration_seconds')) < 60),
      'sessions_zero_duration':sum(1 for r in rows if fnum(r.get('actual_duration_seconds'))<=0),
      'total_child_words':total_words,
      'total_child_turns':total_turns,
      'child_turns_per_session_mean':round(mean(child_turns),2),
      'child_turns_per_session_median':round(median(child_turns),2),
      'pooled_words_per_turn':round(total_words/total_turns,2) if total_turns else 0,
      'pooled_wpm':round(total_words*60.0/total_duration,2) if total_duration else 0,
      'persona_top6':top_counter(persona,6),
      'persona_unique':len([k for k in persona if k!='(blank)']),
      'persona_hhi':round(hhi(persona),3),
      'persona_entropy_norm':round(normalized_entropy(persona),3),
      'country_top6':top_counter(country,6),
      'gender':dict(gender),
      'topic_top6':top_counter(topic,6),
      'target_duration':dict(target),
      'usage_context':dict(usage),
      'lesson_context':dict(lesson),
    }


def summarize_utterances(rows):
    child=[r for r in rows if (r.get('speaker') or '').strip()=='child']
    words=[len(tokenize(r.get('english_text_anonymized',''))) for r in child]
    questions=sum(1 for r in child if yes(r,'is_question'))
    reciprocal=sum(1 for r in child if yes(r,'is_reciprocal_question'))
    repair=sum(1 for r in child if yes(r,'is_repair'))
    reason=sum(1 for r in child if yes(r,'is_reason_expression'))
    qtypes=Counter((r.get('question_type') or '').strip() or '(none)' for r in child if yes(r,'is_question'))
    tokens=[]
    for r in child:
        tokens.extend(tokenize(r.get('english_text_anonymized','')))
    by_session=defaultdict(list)
    for r in rows:
        by_session[r.get('session_id','')].append(r)
    after_ai_question=0
    after_ai_statement=0
    child_question_after_ai_statement=0
    child_question_after_ai_question=0
    consecutive_child=0
    first_child_question=0
    for seq in by_session.values():
        seq.sort(key=lambda r:fint(r.get('turn_sequence')))
        first_child_seen=False
        for i,r in enumerate(seq):
            if (r.get('speaker') or '').strip()!='child':
                continue
            if not first_child_seen:
                if yes(r,'is_question'):
                    first_child_question+=1
                first_child_seen=True
            if i==0:
                continue
            prev=seq[i-1]
            if (prev.get('speaker') or '').strip()=='ai':
                if '?' in (prev.get('english_text_anonymized') or ''):
                    after_ai_question+=1
                    if yes(r,'is_question'):
                        child_question_after_ai_question+=1
                else:
                    after_ai_statement+=1
                    if yes(r,'is_question'):
                        child_question_after_ai_statement+=1
            elif (prev.get('speaker') or '').strip()=='child':
                consecutive_child+=1
    return {
      'child_turn_rows':len(child),
      'word_count_mean':round(mean(words),2),
      'word_count_median':round(median(words),2),
      'one_word_pct':round(pct(sum(1 for x in words if x==1),len(words)),1),
      'two_or_less_words_pct':round(pct(sum(1 for x in words if x<=2),len(words)),1),
      'four_or_less_words_pct':round(pct(sum(1 for x in words if x<=4),len(words)),1),
      'eight_or_more_words_pct':round(pct(sum(1 for x in words if x>=8),len(words)),1),
      'twelve_or_more_words_pct':round(pct(sum(1 for x in words if x>=12),len(words)),1),
      'question_pct':round(pct(questions,len(child)),2),
      'reciprocal_question_pct':round(pct(reciprocal,len(child)),2),
      'repair_pct':round(pct(repair,len(child)),2),
      'reason_pct':round(pct(reason,len(child)),2),
      'question_types':dict(qtypes),
      'child_after_ai_question_pct':round(pct(after_ai_question,len(child)),1),
      'child_after_ai_statement_pct':round(pct(after_ai_statement,len(child)),1),
      'question_after_ai_statement_pct_of_opportunities':round(pct(child_question_after_ai_statement,after_ai_statement),1),
      'question_after_ai_question_pct_of_opportunities':round(pct(child_question_after_ai_question,after_ai_question),1),
      'first_child_turn_question_sessions':first_child_question,
      'consecutive_child_pct':round(pct(consecutive_child,len(child)),1),
      'pooled_token_count':len(tokens),
      'pooled_unique_word_types':len(set(tokens)),
      'pooled_type_token_ratio':round(len(set(tokens))/len(tokens),3) if tokens else 0,
    }


def report(label,sessions,utterances):
    data={'session':summarize_sessions(sessions),'utterance':summarize_utterances(select_utterances(utterances,sessions))}
    print('===',label,'===')
    print(json.dumps(data,ensure_ascii=False,sort_keys=True))
    return data


def main():
    config=runtime_values({'MANAGEMENT_ACCOUNTS_JSON','MANAGEMENT_SESSION_SECRET'})
    assert config.get('MANAGEMENT_ACCOUNTS_JSON') and config.get('MANAGEMENT_SESSION_SECRET')
    cookie=researcher_cookie(config['MANAGEMENT_ACCOUNTS_JSON'],config['MANAGEMENT_SESSION_SECRET'])
    sessions=read_csv('sessions',cookie)
    utterances=read_csv('utterances',cookie)
    assert sessions and utterances, 'production research exports are empty'

    print('CLASS DATE COUNTS')
    for cls in ['5-1','5-3']:
        c=Counter(r.get('local_date','') for r in sessions if (r.get('class_id') or '').strip()==cls)
        print(cls,json.dumps(dict(sorted(c.items())),ensure_ascii=False,sort_keys=True))

    groups={
      '5-1_DAY1_ALL':select_sessions(sessions,'5-1','2026-09-25','2026-09-25',False),
      '5-1_DAY1_IN_LESSON':select_sessions(sessions,'5-1','2026-09-25','2026-09-25',True),
      '5-1_START_TO_0926_ALL':select_sessions(sessions,'5-1','2026-09-25','2026-09-26',False),
      '5-3_DAY1_ALL':select_sessions(sessions,'5-3','2026-09-17','2026-09-17',False),
      '5-3_DAY1_IN_LESSON':select_sessions(sessions,'5-3','2026-09-17','2026-09-17',True),
      '5-3_TO_0925_ALL':select_sessions(sessions,'5-3','2026-09-17','2026-09-25',False),
      '5-3_TO_0925_IN_LESSON':select_sessions(sessions,'5-3','2026-09-17','2026-09-25',True),
    }
    reports={k:report(k,v,utterances) for k,v in groups.items()}

    for mode,a_key,b_key in [
      ('DAY1_ALL','5-1_DAY1_ALL','5-3_DAY1_ALL'),
      ('DAY1_IN_LESSON','5-1_DAY1_IN_LESSON','5-3_DAY1_IN_LESSON')]:
        a=reports[a_key]; b=reports[b_key]
        skeys=['sessions','participants','sessions_per_participant_mean','complete_pct','pooled_wpm','pooled_words_per_turn','child_turns_per_session_mean','persona_hhi','persona_entropy_norm']
        ukeys=['word_count_mean','one_word_pct','two_or_less_words_pct','eight_or_more_words_pct','question_pct','reciprocal_question_pct','repair_pct','reason_pct','child_after_ai_question_pct','question_after_ai_statement_pct_of_opportunities','pooled_type_token_ratio']
        diff={'session':{k:round(fnum(a['session'].get(k))-fnum(b['session'].get(k)),2) for k in skeys},
              'utterance':{k:round(fnum(a['utterance'].get(k))-fnum(b['utterance'].get(k)),2) for k in ukeys}}
        print('=== DIFF_5-1_MINUS_5-3_'+mode+' ===')
        print(json.dumps(diff,ensure_ascii=False,sort_keys=True))

    print('READ_ONLY_AUDIT_COMPLETE')
    print('No production data was written, modified, or deleted. Only aggregate statistics were printed; no child utterance text was emitted.')

if __name__=='__main__':
    main()
