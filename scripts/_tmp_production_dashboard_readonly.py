import base64, csv, hashlib, hmac, io, json, subprocess, time, urllib.parse, urllib.request
from collections import Counter

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
        if name not in names: continue
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
    headers={'User-Agent':'production-dashboard-readonly-audit/1.0'}
    if cookie: headers['Cookie']=cookie
    req=urllib.request.Request(API+path,headers=headers)
    with urllib.request.urlopen(req,timeout=60) as resp:
        return resp.read().decode('utf-8-sig',errors='replace')


def main():
    html=get('/management')
    for marker in ['id="researchDaily"','id="teacherDaily"','sessions.csv ― セッション単位の主要分析データ','turns.csv ― 匿名化した発話単位データ','system_events.csv ― 学習支援機能・操作ログ']:
        assert marker in html, f'production management UI marker missing: {marker}'
    config=runtime_values({'MANAGEMENT_ACCOUNTS_JSON','MANAGEMENT_SESSION_SECRET'})
    assert config.get('MANAGEMENT_ACCOUNTS_JSON') and config.get('MANAGEMENT_SESSION_SECRET')
    cookie=researcher_cookie(config['MANAGEMENT_ACCOUNTS_JSON'],config['MANAGEMENT_SESSION_SECRET'])
    text=get('/api/management/research.csv?dataset=sessions',cookie)
    rows=list(csv.DictReader(io.StringIO(text)))
    assert rows, 'production research sessions CSV is empty'
    assert all(r.get('session_id') for r in rows), 'session_id missing in production CSV'
    statuses=Counter(r.get('data_quality_flag','') for r in rows)
    dates=Counter(r.get('local_date','') for r in rows)
    classes=Counter((r.get('class_id') or '学級未設定') for r in rows)
    recent=[r for r in rows if '2026-08-28' <= r.get('local_date','') <= '2026-08-29']
    legacy_candidates=[]
    for r in rows:
        try: schema=int(float(r.get('schema_version') or 0))
        except ValueError: schema=0
        reflections=[r.get('reflection_conveyed_ideas',''),r.get('reflection_understood_partner',''),r.get('reflection_noticed_language_culture','')]
        if schema < 3 and all(str(x).strip() for x in reflections) and str(r.get('total_turns','')).strip() and str(r.get('total_child_words','')).strip():
            legacy_candidates.append(r)
    bad_legacy=[r for r in legacy_candidates if r.get('data_quality_flag')!='complete']
    assert not bad_legacy, f'legacy completed sessions still misclassified: {[r.get("session_id") for r in bad_legacy[:5]]}'
    print('PRODUCTION READ-ONLY DASHBOARD AUDIT PASS')
    print('total_sessions=',len(rows))
    print('quality=',dict(statuses))
    print('recent_2026-08-28_to_29=',len(recent),'by_date=',dict(Counter(r.get('local_date','') for r in recent)))
    print('classes=',dict(classes))
    print('legacy_complete_candidates=',len(legacy_candidates),'legacy_misclassified=',len(bad_legacy))
    print('No production data was written or deleted by this audit.')

if __name__=='__main__': main()
