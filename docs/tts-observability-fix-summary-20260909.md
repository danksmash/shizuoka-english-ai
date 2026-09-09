# TTS provider observability fix summary — 2026-09-09

This change makes the actual TTS provider browser-observable and research-safe.

## Main changes

- Expose TTS provenance headers through CORS.
- Treat an unreadable provider header as `not_observed` instead of silently classifying it as Google Chirp.
- Persist fallback source, fallback reason and latency research events.
- Add formal TTS provider observability fields to the research session export.
- Mark sessions captured before the fixed telemetry contract as `legacy_unreliable` / `not_observed` in formal research export rather than reinterpreting old values as factual provider observations.
- Keep Azure Voice Profile v3 speaking-rate control (0.75–1.25) and its QA coverage.
- Add a post-production-deploy browser/CORS + Azure provider verification workflow.

## Verification

Full QA, TypeScript and production build passed on the implementation branch. A separate isolated Cloud Run canary ran 105 real TTS requests (35 simultaneous clients × 3 waves) with the current 3.5 s Azure synthesis timeout: 105/105 Azure, 0 Chirp fallback, HTTP 200 for all requests, p95 server latency 2323 ms and p99 2693 ms. Therefore the current 3.5 s timeout is retained.
