# Decisiones

### ADR-001 · Perfil ligero para el plan

- **Contexto:** la verificación la ejecuta el equipo, dura días, usa datos
  sintéticos en local y es reversible con un reset.
- **Alternativas:** estándar (10 documentos) — descartado porque el alcance es una
  batería de pruebas, no un producto nuevo; completo — descartado por la misma
  razón y por el coste de tiempo.
- **Decisión:** perfil ligero (`PLAN.md`, `DECISIONES.md`, `TAREAS.md`,
  `STATE.md`), más `00-estado-actual.md` porque el repositorio ya existe.
- **Consecuencia:** el AC es la prueba y no se exige un `TEST` separado; la
  trazabilidad queda en `TAREAS.md` y en el reporte de la suite.

### ADR-002 · Ejecutar solo contra Supabase local

- **Contexto:** la batería crea cuentas, mascotas, solicitudes y mensajes. En
  cloud la confirmación de correo impide crear sesiones y los datos quedarían
  sucios.
- **Alternativas:** producción con cuentas desechables — descartado por suciedad,
  correos rebotados y dependencia de accesos; un proyecto Supabase aparte —
  descartado por coste y por no reproducir las 35 migraciones.
- **Decisión:** local exclusivamente, con `db reset` + seed.
- **Consecuencia:** los resultados no demuestran producción; eso ya está cubierto
  por el e2e público y la validación de CSP.

### ADR-003 · Admin por fixture SQL, no por service role

- **Contexto:** el seed no crea administradores y la app no puede nombrar admins
  desde la interfaz.
- **Alternativas:** usar `SUPABASE_SERVICE_ROLE_KEY` en el arnés — descartado
  porque el proyecto prohíbe esa clave y falsearía la frontera de RLS; añadir un
  admin al seed — descartado porque el seed también se usa en el piloto.
- **Decisión:** registrar la cuenta admin como cualquier otra y, en local,
  insertar su UUID en `administradores` con `psql` vía el contenedor de Supabase.
- **Consecuencia:** el arnés depende de Docker (ya necesario para Supabase local);
  si el fixture falla, los casos de admin se omiten y se reporta.

### ADR-004 · API con sesión real y smoke de UI

- **Contexto:** recorrer toda la interfaz con clics es lento y frágil; la lógica y
  la autorización viven en las rutas de API.
- **Alternativas:** solo UI — descartado por tiempo y por selectores cambiantes;
  solo API — descartado porque no demuestra que las páginas rendericen.
- **Decisión:** cada flujo se prueba por API con cookies reales, más una visita de
  UI donde el valor está en la pantalla (panel, admin, ficha, chat).
- **Consecuencia:** los fallos apuntan a la capa correcta; la UI queda cubierta de
  forma parcial, igual que hoy.

### ADR-005 · El correo es best-effort

- **Contexto:** en local `pg_net` llama a `api.resend.com` con una clave falsa y
  devuelve 401; depender de esa llamada haría la suite lenta y no determinista.
- **Alternativas:** simular Resend con un servidor local — descartado por alcance;
  omitir el correo — descartado porque el encolado y el antispam sí son parte del
  producto.
- **Decisión:** verificar `notificaciones_log` y el antispam; leer
  `net._http_response` solo como información, nunca como aserción de éxito.
- **Consecuencia:** la suite no demuestra entrega real; eso sigue pendiente y es
  una prueba manual en producción.

### ADR-006 · Limpieza con `db reset`

- **Contexto:** la batería escribe datos y debe poder repetirse sin acumular.
- **Alternativas:** borrar fila por fila — descartado por lento y propenso a dejar
  restos; base efímera nueva por corrida — descartado por tiempo de arranque.
- **Decisión:** `supabase db reset` + seed antes de cada corrida y reset al final.
- **Consecuencia:** los datos de la corrida desaparecen; la evidencia queda en la
  salida de la suite, no en la base.

### ADR-007 · La suite se versiona

- **Contexto:** el proyecto ya versiona `e2e/publico.e2e.ts` y `e2e/flujo.e2e.ts`;
  la batería por roles tiene el mismo valor a futuro.
- **Alternativas:** dejarla como script temporal — descartado porque se perdería y
  no podría repetirse en CI.
- **Decisión:** `e2e/roles.e2e.ts`, con las mismas guardas (`E2E_FLUJO=1` y
  Supabase local) y sin tocar las suites existentes.
- **Consecuencia:** hay que mantenerla cuando cambien roles o endpoints; el CI
  puede ejecutarla más adelante con un paso de fixture para el admin.
