import base64, csv, hashlib, hmac, io, json, subprocess, time, urllib.parse, urllib.request
from collections import Counter

PROJECT='shizuoka-english-ai'
REGION='asia-northeast1'
SERVICE='shizuoka-english-ai'
API='https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app'
LEARNING_CODE='6RSX'
TEACHER_ID='XYX3'


def sh(*args):
    return subprocess.check_output(args, text=True).strip()


def http_json(url, method='GET', body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    hdr = {'User-Agent':'readonly-id-dashboard-audit/1.0', **(headers or {})}
    if body is not None: hdr['Content-Type']='application/json'
    req=urllib.request.Request(url,data=data,headers=hdr,method=method)
    with urllib.request.urlopen(req,timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8-sig'))


def http_text(url, headers=None):
    req=urllib.request.Request(url,headers={'User-Agent':'readonly-id-dashboard-audit/1.0', **(headers or {})})
    with urllib.request.urlopen(req,timeout=60) as resp:
        return resp.read().decode('utf-8-sig',errors='replace')


def decode_value(v):
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return float(v['doubleValue'])
    if 'booleanValue' in v: return bool(v['booleanValue'])
    if 'timestampValue' in v: return v['timestampValue']
    if 'nullValue' in v: return None
    if 'arrayValue' in v: return [decode_value(x) for x in v.get('arrayValue',{}).get('values',[])]
    if 'mapValue' in v: return {k:decode_value(x) for k,x in v.get('mapValue',{}).get('fields',{}).items()}
    return None


def firestore_list(collection):
    token=sh('gcloud','auth','print-access-token')
    rows=[]; page=''
    while True:
        q=urllib.parse.urlencode({'pageSize':'1000', **({'pageToken':page} if page else {})})
        url=f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{collection}?{q}'
        doc=http_json(url,headers={'Authorization':f'Bearer {token}'})
        for item in doc.get('documents',[]):
            row={k:decode_value(v) for k,v in item.get('fields',{}).items()}
            row['_doc_id']=item.get('name','').split('/')[-1]
            rows.append(row)
        page=doc.get('nextPageToken','')
        if not page: break
    return rows


def runtime_values(names):
    service=json.loads(sh('gcloud','run','services','describe',SERVICE,'--project',PROJECT,'--region',REGION,'--format=json'))
    env=service.get('spec',{}).get('template',{}).get('spec',{}).get('containers',[{}])[0].get('env',[])
    out={}
    for row in env:
        if row.get('name') in names and 'value' in row: out[row['name']]=str(row.get('value',''))
    return out


def b64url(b): return base64.urlsafe_b64encode(b).decode().rstrip('=')


def researcher_cookie(accounts_json, secret):
    accounts=json.loads(accounts_json)
    acc=next(x for x in accounts if x.get('role')=='researcher' and x.get('username'))
    payload={'username':acc['username'],'role':'researcher','exp':int(time.time()*1000)+3600000}
    encoded=b64url(json.dumps(payload,separators=(',',':'),ensure_ascii=False).encode())
    sig=b64url(hmac.new(secret.encode(),encoded.encode(),hashlib.sha256).digest())
    return 'mgmt_session='+urllib.parse.quote(encoded+'.'+sig)


def summary(rows):
    return {
        'count':len(rows),
        'duration_seconds':sum(int(r.get('actualDurationSeconds') or 0) for r in rows),
        'turns':sum(int(r.get('totalTurns') or 0) for r in rows),
        'words':sum(int(r.get('totalChildWords') or 0) for r in rows),
        'zero_turn_sessions':sum(1 for r in rows if int(r.get('totalTurns') or 0)==0),
        'dates':dict(Counter(str(r.get('localDate') or str(r.get('endedAt') or '')[:10]) for r in rows)),
    }


def main():
    # Public learner history: validates the supplied learner code without exposing internal identity.
    learner=http_json(API+'/api/student/history',method='POST',body={'learningCode':LEARNING_CODE})
    assert learner.get('success') is True
    learner_rows=learner.get('history',[])

    students=firestore_list('students')
    targets=[r for r in students if str(r.get('teacherStudentId') or '').upper()==TEACHER_ID]
    print('teacher_id_matches=',len(targets))
    assert len(targets)==1, f'{TEACHER_ID} must resolve to exactly one management student record'
    target=targets[0]
    student_id=str(target.get('studentId') or '')
    research_id=str(target.get('researchId') or '')
    print('teacher_id=',TEACHER_ID,'class_id=',target.get('classId') or '学級未設定','active=',target.get('active'))
    print('research_id_prefix=',research_id[:4] if research_id else '')

    sessions=firestore_list('sessions')
    target_sessions=[r for r in sessions if str(r.get('studentId') or '')==student_id]
    learner_ids={str(r.get('sessionId') or '') for r in learner_rows}
    teacher_ids={str(r.get('sessionId') or '') for r in target_sessions}
    print('learner_6RSX_summary=',json.dumps({
        'count':len(learner_rows),
        'duration_seconds':sum(int(r.get('actualDurationSeconds') or 0) for r in learner_rows),
        'turns':sum(int(r.get('totalTurns') or 0) for r in learner_rows),
        'words':sum(int(r.get('totalChildWords') or 0) for r in learner_rows),
        'zero_turn_sessions':sum(1 for r in learner_rows if int(r.get('totalTurns') or 0)==0),
    },ensure_ascii=False))
    print('teacher_XYX3_summary=',json.dumps(summary(target_sessions),ensure_ascii=False))
    print('session_id_sets_equal=',learner_ids==teacher_ids,'learner_only=',len(learner_ids-teacher_ids),'teacher_only=',len(teacher_ids-learner_ids))

    # Research endpoint: verify separate anonymous identifier and absence of learner/teacher codes.
    cfg=runtime_values({'MANAGEMENT_ACCOUNTS_JSON','MANAGEMENT_SESSION_SECRET'})
    if cfg.get('MANAGEMENT_ACCOUNTS_JSON') and cfg.get('MANAGEMENT_SESSION_SECRET'):
        cookie=researcher_cookie(cfg['MANAGEMENT_ACCOUNTS_JSON'],cfg['MANAGEMENT_SESSION_SECRET'])
        text=http_text(API+'/api/management/research.csv?dataset=sessions',headers={'Cookie':cookie})
        research_rows=list(csv.DictReader(io.StringIO(text)))
        target_research=[r for r in research_rows if r.get('research_id')==research_id]
        print('research_target_sessions=',len(target_research))
        print('research_columns_contain_teacher_id=',any('teacher' in c.lower() for c in (research_rows[0].keys() if research_rows else [])))
        print('research_values_contain_6RSX=',LEARNING_CODE in text,'research_values_contain_XYX3=',TEACHER_ID in text)
        print('research_recent_dates=',dict(Counter(r.get('local_date','') for r in research_rows if '2026-08-23' <= r.get('local_date','') <= '2026-08-29')))
        print('research_classes=',dict(Counter((r.get('class_id') or '学級未設定') for r in research_rows)))
    else:
        print('research_endpoint_audit=SKIPPED_CONFIG_NOT_READABLE')

    print('all_student_records=',len({str(r.get('studentId') or '') for r in students if r.get('studentId')}),'all_session_docs=',len(sessions))
    print('READ_ONLY_AUDIT_COMPLETE: no Firestore/Cloud Run writes performed')

if __name__=='__main__': main()
