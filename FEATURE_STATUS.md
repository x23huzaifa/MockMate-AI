# FEATURE_STATUS.md — InterviewSaathi AI

Single source of truth for what exists. Updated at the end of every phase.
"Done" means implemented → tested → fixed → retested → regression tested,
with evidence. Anything else is "not started" or "in progress".

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Project scaffold (configs, server, landing, docs) | Done | Phase 0, 2026-10-11 |
| Health API (`GET /api/v1/health`) | Done | Returns `{ ok, service }` |
| Env validation at startup | Done | `server/_core/env.ts`; clear errors, no silent fallbacks |
| User registration / login / logout | Not started | Phase A |
| JWT session cookies + protected routes | Not started | Phase A |
| User profiles | Not started | Phase A/B |
| CV upload (PDF/DOCX) + parsing | Not started | Phase B |
| Extracted-field review + correction | Not started | Phase B |
| Job profile manager | Not started | Phase C |
| Interview setup flow | Not started | Phase C |
| Text interview room (state machine) | Not started | Phase C |
| Local template question engine | Not started | Phase C (honestly labeled, not fake AI) |
| LLM provider interface | Not started | Phase C (interface first, real provider later) |
| Answer evaluation + per-answer feedback | Not started | Phase C |
| Session reports | Not started | Phase C |
| Multilingual settings (EN/UR/Roman Urdu) | Not started | Phase D |
| Roman Urdu handling + Urdu feedback | Not started | Phase D |
| Language test corpus | Not started | Phase D |
| Voice interview (STT/TTS abstraction) | Not started | Phase E |
| Transcript preview + edit before submit | Not started | Phase E |
| Session history (search/filter) | Not started | Phase F |
| Progress charts from real data | Not started | Phase F |
| Admin panel + RBAC + audit log | Not started | Phase F |
| Contact form | Not started | Phase F |
| Deployment docs + hardening | Not started | Phase G |

**Deliberately out of scope:** paid LLM dependency for v1, payments,
email delivery without a configured provider, mobile apps, any form of
third-party data scraping.
