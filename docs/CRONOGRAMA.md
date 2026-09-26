# Cronograma y ruta crítica — Adopty (10 semanas, 160 h)

```mermaid
gantt
    title Adopty — Gantt por fases
    dateFormat YYYY-MM-DD
    axisFormat Sem %W
    F0 Fundaciones + mock (16h)            :done, f0, 2026-05-04, 7d
    F1 DB + Auth (32h)                     :done, f1, 2026-05-11, 14d
    F2 CRUD + Storage (28h)                :done, f2, 2026-05-25, 14d
    F3 Búsqueda (20h)                      :done, f3, 2026-06-08, 7d
    F4 Solicitudes (20h)                   :done, f4, 2026-06-15, 7d
    F5 Mensajería (20h)                    :done, f5, 2026-06-22, 7d
    F6 Panel + favs (16h)                  :done, f6, 2026-06-29, 7d
    F7 QA + RNF (16h)                      :done, f7, 2026-07-06, 7d
    F8 Prod + piloto + OAuth (12h)         :active, f8, 2026-07-06, 5d
```

## PERT / ruta crítica

**Crítica:** F0 → F1 → F2 → F4 → F5 → F7 → F8 (10 sem, holgura 0).
**Holgura ≤ 1 sem:** F3 (búsqueda) y F6 (panel) — independientes del flujo solicitudes→chat.
**Riesgo absorvido:** Google OAuth se movió a F8 (decisión 24 sep); Cloudinary nunca se necesitó
(fotos WebP ≤500 KB caben en el free tier).

## Hitos por semana

| Sem | Hito                                       | Estado                        |
| --- | ------------------------------------------ | ----------------------------- |
| 1   | Preview Vercel + base Astro                | ✅                            |
| 2–3 | Auth + DB + RLS en cloud                   | ✅                            |
| 3–4 | CRUD + Storage WebP                        | ✅                            |
| 5   | Búsqueda < 1 s + URL compartible           | ✅                            |
| 6   | Solicitudes con estados + RPC              | ✅                            |
| 7   | Chat realtime + no-leídos                  | ✅                            |
| 8   | Panel + favoritos                          | ✅                            |
| 9   | QA: 36 tests, rate-limit, legales, backups | ✅                            |
| 10  | Prod + piloto + OAuth + sustentación       | 🔶 en curso (OAuth pendiente) |
