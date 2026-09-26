# Guion de sustentación — Adopty (7 min)

> Roles: Dev A comparte pantalla · Dev B narra. Datos: usuarios demo
> (`patitas@adopty.pa` / `rescatista@adopty.pa`) + seed de 30. Abrir 2 ventanas
> (normal + incógnito) para el chat en vivo.

## 0:00–1:30 — Problema + hero + búsqueda

- **Problema (30 s):** "Adoptar hoy es WhatsApp e Instagram: info fragmentada, sin filtros,
  expones tu número y no hay seguimiento. Adopty es un único punto confiable."
- **Hero (30 s):** inicio, buscador, destacadas desde DB.
- **Explorar (30 s):** filtros combinados (especie/tamaño/sexo/texto/orden), paginación,
  **copiar la URL** y pegarla en pestaña nueva → mismos resultados.

## 1:30–3:00 — Filtros + detalle

- Detalle de Luna: carrusel por teclado, ficha, publicador verificado, disclaimer legal.
- Mostrar estados: disponible / en_proceso / adoptada.

## 3:00–4:00 — Login + solicitar

- Entrar como `rescatista@adopty.pa` → solicitar Luna con mensaje → estado **pendiente**.
- Intentar duplicar → 409 (anti-doble-clic). Mostrar `/mis-solicitudes`.

## 4:00–5:00 — Panel: aprobar

- Cambiar a `patitas@adopty.pa` → `/panel` (17 publicadas, agregados) →
  `/panel/solicitudes` → **Aprobar** → Luna pasa a `en_proceso`, resto auto-rechazado.

## 5:00–6:00 — Chat en vivo

- Ventana incógnito (rescatista) + normal (patitas) en `/mensajes`: chatear sin refresh,
  contador de no-leídos, badge "Solicitud: aprobada".

## 6:00–7:00 — Cierre técnico + impacto

- 30 s: arquitectura (Astro Islands + Supabase RLS + Sharp WebP), 36 tests, rate-limit,
  RLS testeada por rol, costo $0.
- 30 s: impacto social (1–2 refugios piloto, 5 mascotas reales) + roadmap
  (OAuth Google, PWA, matching). Cierre: "un único punto confiable para adoptar en Panamá".

## Preguntas probables

- **¿Por qué no se ve Kira?** RLS: solo `disponible` es público (decisión §6).
- **¿Y si el publicador no responde?** Cancelar solicitud;cola de revisión para orgs no verificadas.
- **¿El acuerdo es legal?** No: se firma fuera de la plataforma (disclaimer + términos).
- **¿Google login?** Código listo, activación en F8 (mostrar botón + mensaje de degradación).
