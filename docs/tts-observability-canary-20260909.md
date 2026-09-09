# TTS observability canary — 2026-09-09

Production-like isolated Cloud Run canary using the same Azure Speech region and the current 3.5 s Azure synthesis timeout.

- Origin: `https://danksmash.github.io`
- Concurrent clients per wave: 35
- Waves: 3
- Total real TTS requests: 105
- Azure Speech responses: 105 / 105 (100%)
- Google Chirp fallback: 0 / 105
- HTTP 200: 105 / 105
- Invalid requests: 0
- Server latency p50: 710 ms
- Server latency p95: 2323 ms
- Server latency p99: 2693 ms
- Client elapsed p95: 2675 ms
- CORS exposure check: PASS

Decision: retain the current 3.5 s Azure synthesis timeout. The observed p99 remained below 3.5 s with 35 simultaneous clients and no fallback occurred.

The temporary canary Cloud Run service and one-shot canary workflow were removed after the test.
