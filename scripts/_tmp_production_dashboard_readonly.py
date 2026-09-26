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
    with urllib.request.urlopen(req,timeout=90) as resp:
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


def median(values):
    return statistics.median(values) if values else 0.0


def mean(values):
    return statistics.fmean(values) if values else 0.0


def pct(n,d):
    return (100.0*n/d) if d else 0.0


def safe_counter(rows,key):
    return Counter((r.get(key) or '').strip() or '(blank)' for r in rows)


def top_counter(c, n=5):
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


def group_sessions(rows, class_id, start_date, end_date=None):
    end_date=end_date or start_date
    return [r for r in rows if (r.get('class_id') or '').strip()==class_id and start_date <= (r.get('local_date') or '') <= end_date]


def session_ids(rows):
    return {r.get('session_id','') for r in rows if r.get('session_id')}


def group_turns(turns, sessions):
    ids=session_ids(sessions)
    return [r for r in turns if r.get('session_id','') in ids]


def summarize_sessions(rows):
    participants={r.get('research_id','') for r in rows if r.get('research_id')}
    per_person=Counter(r.get('research_id','') for r in rows if r.get('research_id'))
    durations=[fnum(r.get('actual_duration_seconds')) for r in rows if fnum(r.get('actual_duration_seconds'))>0]
    child_words=[fint(r.get('child_total_words') or r.get('total_child_words')) for r in rows]
    child_turns=[fint(r.get('child_turn_count') or r.get('total_turns')) for r in rows]
    questions=sum(fint(r.get('child_question_count')) for r in rows)
    reciprocal=sum(fint(r.get('child_reciprocal_question_count')) for r in rows)
    repairs=sum(fint(r.get('child_repair_count')) for r in rows)
    reasons=sum(fint(r.get('child_reason_expression_count')) for r in rows)
    total_words=sum(child_words)
    total_turns=sum(child_turns)
    total_duration=sum(durations)
    session_wpm=[]
    for r in rows:
        dur=fnum(r.get('actual_duration_seconds'))
        words=fint(r.get('child_total_words') or r.get('total_child_words'))
        if dur>0:
            session_wpm.append(words*60.0/dur)
    q=safe_counter(rows,'data_quality_flag')
    persona=safe_counter(rows,'persona_id')
    topic=safe_counter(rows,'topic')
    usage=safe_counter(rows,'usage_context_inferred')
    lesson=safe_counter(rows,'lesson_context_inferred')
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
        'session_wpm_mean':round(mean(session_wpm),2),
        'session_wpm_median':round(median(session_wpm),2),
        'question_n':questions,
        'question_per_100_child_turns':round(pct(questions,total_turns),2),
        'reciprocal_question_n':reciprocal,
        'reciprocal_per_100_child_turns':round(pct(reciprocal,total_turns),2),
        'repair_n':repairs,
        'repair_per_100_child_turns':round(pct(repairs,total_turns),2),
        'reason_n':reasons,
        'reason_per_100_child_turns':round(pct(reasons,total_turns),2),
        'persona_top5':top_counter(persona,5),
        'persona_unique':len([k for k in persona if k!='(blank)']),
        'persona_hhi':round(hhi(persona),3),
        'persona_entropy_norm':round(normalized_entropy(persona),3),
        'emma_usa_pct':round(pct(persona.get('emma_usa',0),len(rows)),1),
        'oliver_uk_pct':round(pct(persona.get('oliver_uk',0),len(rows)),1),
        'topic_top5':top_counter(topic,5),
        'usage_context':dict(usage),
        'lesson_context':dict(lesson),
    }


def summarize_turns(rows):
    child=[r for r in rows if (r.get('speaker') or '').strip()=='child']
    words=[fint(r.get('word_count')) for r in child]
    questions=sum(1 for r in child if yes(r,'is_question'))
    reciprocal=sum(1 for r in child if yes(r,'is_reciprocal_question'))
    repair=sum(1 for r in child if yes(r,'is_repair'))
    reason=sum(1 for r in child if yes(r,'is_reason_expression'))
    question_types=Counter((r.get('question_type') or '').strip() or '(none)' for r in child if yes(r,'is_question'))
    tokens=[]
    for r in child:
        tokens.extend(tokenize(r.get('english_text_anonymized','')))
    # Immediate child response after an AI turn ending in a question mark.
    by_session=defaultdict(list)
    for r in rows:
        by_session[r.get('session_id','')].append(r)
    response_after_ai_q=0
    child_with_prev=0
    consecutive_child=0
    for seq in by_session.values():
        seq.sort(key=lambda r:fint(r.get('turn_sequence')))
        for i,r in enumerate(seq):
            if (r.get('speaker') or '').strip()!='child' or i==0:
                continue
            prev=seq[i-1]
            child_with_prev+=1
            if (prev.get('speaker') or '').strip()=='ai' and '?' in (prev.get('english_text_anonymized') or ''):
                response_after_ai_q+=1
            if (prev.get('speaker') or '').strip()=='child':
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
        'question_types':dict(question_types),
        'response_after_ai_question_pct_of_child_turns':round(pct(response_after_ai_q,len(child)),1),
        'consecutive_child_pct_of_child_turns':round(pct(consecutive_child,len(child)),1),
        'pooled_token_count':len(tokens),
        'pooled_unique_word_types':len(set(tokens)),
        'pooled_type_token_ratio':round(len(set(tokens))/len(tokens),3) if tokens else 0,
    }


def compare(a,b):
    keys=['sessions_per_participant_mean','complete_pct','pooled_wpm','pooled_words_per_turn','question_per_100_child_turns','reciprocal_per_100_child_turns','repair_per_100_child_turns','reason_per_100_child_turns','emma_usa_pct','persona_hhi']
    return {k:round(fnum(a.get(k))-fnum(b.get(k)),2) for k in keys}


def main():
    config=runtime_values({'MANAGEMENT_ACCOUNTS_JSON','MANAGEMENT_SESSION_SECRET'})
    assert config.get('MANAGEMENT_ACCOUNTS_JSON') and config.get('MANAGEMENT_SESSION_SECRET')
    cookie=researcher_cookie(config['MANAGEMENT_ACCOUNTS_JSON'],config['MANAGEMENT_SESSION_SECRET'])
    sessions=read_csv('sessions',cookie)
    turns=read_csv('turns',cookie)
    assert sessions and turns, 'production research exports are empty'

    print('CLASS DATE COUNTS (sessions, main data scope only)')
    for cls in ['5-1','5-3']:
        c=Counter(r.get('local_date','') for r in sessions if (r.get('class_id') or '').strip()==cls)
        print(cls, json.dumps(dict(sorted(c.items())),ensure_ascii=False,sort_keys=True))

    specs=[
        ('5-1_DAY1_2026-09-25','5-1','2026-09-25','2026-09-25'),
        ('5-1_SINCE_START_TO_2026-09-26','5-1','2026-09-25','2026-09-26'),
        ('5-3_DAY1_2026-09-17','5-3','2026-09-17','2026-09-17'),
        ('5-3_THROUGH_2026-09-25','5-3','2026-09-17','2026-09-25'),
        ('5-3_THROUGH_2026-09-26','5-3','2026-09-17','2026-09-26'),
    ]
    reports={}
    for label,cls,start,end in specs:
        ss=group_sessions(sessions,cls,start,end)
        tt=group_turns(turns,ss)
        reports[label]={'session':summarize_sessions(ss),'turn':summarize_turns(tt)}
        print('===',label,'===')
        print(json.dumps(reports[label],ensure_ascii=False,sort_keys=True))

    a=reports['5-1_DAY1_2026-09-25']['session']
    b=reports['5-3_DAY1_2026-09-17']['session']
    at=reports['5-1_DAY1_2026-09-25']['turn']
    bt=reports['5-3_DAY1_2026-09-17']['turn']
    print('=== DAY1_SESSION_DIFF_5-1_MINUS_5-3 ===')
    print(json.dumps(compare(a,b),ensure_ascii=False,sort_keys=True))
    turn_diff={k:round(fnum(at.get(k))-fnum(bt.get(k)),2) for k in [
        'word_count_mean','one_word_pct','two_or_less_words_pct','eight_or_more_words_pct',
        'question_pct','reciprocal_question_pct','repair_pct','reason_pct',
        'response_after_ai_question_pct_of_child_turns','consecutive_child_pct_of_child_turns',
        'pooled_type_token_ratio']}
    print('=== DAY1_TURN_DIFF_5-1_MINUS_5-3 ===')
    print(json.dumps(turn_diff,ensure_ascii=False,sort_keys=True))

    print('READ_ONLY_AUDIT_COMPLETE')
    print('No production data was written, modified, or deleted. Only aggregate statistics were printed; no child utterance text was emitted.')

if __name__=='__main__':
    main()
