import concurrent.futures
import json
import os
import statistics
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = os.environ['GATE5_CANARY_URL'].rstrip('/')
TOKEN = os.environ['GATE5_CANARY_TOKEN']
OUT = Path(os.environ.get('GATE5_OUTPUT_DIR', 'gate5-artifacts'))
OUT.mkdir(parents=True, exist_ok=True)

PERSONAS = [
    'emma_usa','oliver_uk','liam_australia','minji_korea','pavel_belarus','lukas_germany','aina_malaysia','dimas_indonesia',
    'bence_hungary','yuting_taiwan','zofia_poland','matas_lithuania','ananya_india','xinyi_china','linh_vietnam','rahul_bangladesh',
    'nadeesha_srilanka','suman_nepal','amara_nigeria','andrei_romania',
]
LEVELS = [10, 20, 30, 35]


def post_json(path, payload, headers=None, timeout=50):
    data = json.dumps(payload).encode('utf-8')
    req_headers = {'Content-Type': 'application/json'}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(BASE_URL + path, data=data, headers=req_headers, method='POST')
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read()
            elapsed = (time.perf_counter() - started) * 1000
            return response.status, dict(response.headers.items()), body, elapsed
    except urllib.error.HTTPError as exc:
        body = exc.read()
        elapsed = (time.perf_counter() - started) * 1000
        return exc.code, dict(exc.headers.items()), body, elapsed


def run_flow(index):
    persona = PERSONAS[index % len(PERSONAS)]
    total_started = time.perf_counter()
    chat_status, chat_headers, chat_body, chat_ms = post_json('/api/chat', {
        'message': 'Hello! Nice to meet you.',
        'history': [],
        'topic': 'intro',
        'aiStudentId': persona,
    })
    result = {
        'persona': persona,
        'chat_status': chat_status,
        'chat_ms': round(chat_ms, 1),
        'tts_status': None,
        'tts_ms': None,
        'combined_ms': None,
        'provider': None,
        'voice': None,
        'ok': False,
        'error': '',
    }
    if chat_status != 200:
        result['error'] = f'chat_http_{chat_status}:{chat_body[:200].decode("utf-8", "replace")}'
        result['combined_ms'] = round((time.perf_counter() - total_started) * 1000, 1)
        return result
    try:
        parsed = json.loads(chat_body)
        if parsed.get('success') is not True or parsed.get('route') != 'anthropic-resilient':
            result['error'] = 'chat_route_or_success_invalid'
            result['combined_ms'] = round((time.perf_counter() - total_started) * 1000, 1)
            return result
        reply = str(parsed.get('data', {}).get('reply') or '').strip()
        if not reply:
            result['error'] = 'chat_reply_empty'
            result['combined_ms'] = round((time.perf_counter() - total_started) * 1000, 1)
            return result
    except Exception as exc:
        result['error'] = f'chat_json_invalid:{exc}'
        result['combined_ms'] = round((time.perf_counter() - total_started) * 1000, 1)
        return result

    tts_status, tts_headers, tts_body, tts_ms = post_json('/api/tts/azure-canary', {
        'text': reply[:280],
        'aiStudentId': persona,
        'speakingRate': 0.95,
    }, headers={'X-Azure-Canary-Token': TOKEN}, timeout=25)
    result['tts_status'] = tts_status
    result['tts_ms'] = round(tts_ms, 1)
    result['provider'] = tts_headers.get('X-TTS-Provider') or tts_headers.get('x-tts-provider')
    result['voice'] = tts_headers.get('X-TTS-Voice') or tts_headers.get('x-tts-voice')
    result['combined_ms'] = round((time.perf_counter() - total_started) * 1000, 1)
    if tts_status != 200:
        result['error'] = f'tts_http_{tts_status}:{tts_body[:200].decode("utf-8", "replace")}'
        return result
    if result['provider'] != 'azure-speech':
        result['error'] = f'provider_mismatch:{result["provider"]}'
        return result
    if len(tts_body) < 500:
        result['error'] = f'tts_audio_too_small:{len(tts_body)}'
        return result
    result['ok'] = True
    return result


def percentile(values, q):
    if not values:
        return None
    ordered = sorted(values)
    idx = max(0, min(len(ordered) - 1, int(round((len(ordered) - 1) * q))))
    return round(ordered[idx], 1)


all_results = []
level_summaries = []
flow_counter = 0
for level in LEVELS:
    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=level) as pool:
        futures = [pool.submit(run_flow, flow_counter + i) for i in range(level)]
        results = [future.result() for future in futures]
    flow_counter += level
    wall_ms = round((time.perf_counter() - started) * 1000, 1)
    all_results.extend(results)
    combined = [row['combined_ms'] for row in results if row['combined_ms'] is not None]
    chat = [row['chat_ms'] for row in results if row['chat_ms'] is not None]
    tts = [row['tts_ms'] for row in results if row['tts_ms'] is not None]
    errors = [row for row in results if not row['ok']]
    level_summaries.append({
        'concurrency': level,
        'attempted': len(results),
        'succeeded': sum(1 for row in results if row['ok']),
        'failed': len(errors),
        'http_429': sum(1 for row in results if row['chat_status'] == 429 or row['tts_status'] == 429),
        'chat_p50_ms': percentile(chat, 0.50),
        'chat_p95_ms': percentile(chat, 0.95),
        'tts_p50_ms': percentile(tts, 0.50),
        'tts_p95_ms': percentile(tts, 0.95),
        'combined_p50_ms': percentile(combined, 0.50),
        'combined_p95_ms': percentile(combined, 0.95),
        'wall_ms': wall_ms,
    })
    print(json.dumps(level_summaries[-1], ensure_ascii=False))

summary = {
    'gate': 5,
    'service': BASE_URL,
    'levels': level_summaries,
    'attempted_flows': len(all_results),
    'succeeded_flows': sum(1 for row in all_results if row['ok']),
    'failed_flows': sum(1 for row in all_results if not row['ok']),
    'http_429_total': sum(1 for row in all_results if row['chat_status'] == 429 or row['tts_status'] == 429),
    'providers': sorted({row['provider'] for row in all_results if row['provider']}),
    'voices_observed': len({row['voice'] for row in all_results if row['voice']}),
    'firestore_session_write_calls': 0,
}
(OUT / 'gate5-summary.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False))
(OUT / 'gate5-flows.json').write_text(json.dumps(all_results, indent=2, ensure_ascii=False))

expected = sum(LEVELS)
if summary['attempted_flows'] != expected:
    raise SystemExit(f'Gate 5 FAIL: attempted {summary["attempted_flows"]}, expected {expected}')
if summary['failed_flows'] != 0:
    first = next(row for row in all_results if not row['ok'])
    raise SystemExit(f'Gate 5 FAIL: {summary["failed_flows"]} failed flows; first={first}')
if summary['http_429_total'] != 0:
    raise SystemExit(f'Gate 5 FAIL: HTTP 429 count={summary["http_429_total"]}')
if summary['providers'] != ['azure-speech']:
    raise SystemExit(f'Gate 5 FAIL: provider set={summary["providers"]}')
if any((level['combined_p95_ms'] or 0) > 30000 for level in level_summaries):
    raise SystemExit('Gate 5 FAIL: combined p95 exceeded 30 seconds')

print('Gate 5: PASS')
print(json.dumps(summary, indent=2, ensure_ascii=False))
