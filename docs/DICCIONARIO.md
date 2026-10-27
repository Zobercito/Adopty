# Diccionario de datos — Adopty (resumen; detalle SQL en `supabase/migrations/`)

Actualizado al 2026-10-14 (19 migraciones). Diagrama: `docs/DER.dbml`.

## ENUMs

| Enum                    | Valores                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `tipo_usuario`          | `persona`, `organizacion`                                                                                      |
| `especie`               | `perro`, `gato`, `otro`                                                                                        |
| `sexo_mascota`          | `Macho`, `Hembra`                                                                                              |
| `tamano_mascota`        | `Pequeño`, `Mediano`, `Grande`                                                                                 |
| `estado_mascota`        | `disponible` → `en_proceso` → `adoptada` (terminal); `en_proceso → disponible` si falla                        |
| `estado_solicitud`      | `pendiente` → `aprobar=aprobada` / `rechazar=rechazada` / `cancelar=cancelada`; sin transiciones entre finales |
| `nivel_energia`         | `tranquila`, `moderada`, `activa` (de la mascota)                                                              |
| `experiencia_adoptante` | `primera_vez`, `alguna_vez`, `experimentada`                                                                   |
| `ambiente`              | `apartamento`, `casa_chica`, `casa_grande`                                                                     |
| `especie_pref`          | `perro`, `gato`, `otro`, `indiferente`                                                                         |
| `energia_pref`          | `tranquila`, `moderada`, `activa`                                                                              |
| `edad_pref`             | `cachorro`, `adulto`, `indiferente`                                                                            |

Los estados de `reportes` y `verificaciones_org` son `TEXT` con `CHECK` (ver tablas).

## Tablas

| Tabla                | Clave                      | Contenido                                                                                         | Reglas                                                                                             |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `usuarios`           | `id` (FK `auth.users`)     | espejo: correo único, tipo, fecha, `activo`, `borrado_en`                                         | trigger `trg_new_user` la crea; `activo=false` = suspendida o dada de baja (el middleware la echa) |
| `personas`           | `id` (FK `usuarios`)       | nombre, foto, "sobre mí", `experiencia`, `motivacion`                                             | **solo la lee su dueño**; lo público sale del RPC `perfil_publico`                                 |
| `organizaciones`     | `id` (FK `usuarios`)       | nombre oficial, dirección, web, `logo`, `redes` (JSONB), `verificada`                             | la lee su dueño o cualquiera si está `verificada`; `verificada` solo la cambia un admin            |
| `mascotas`           | `id` UUID, `slug` único    | ficha + `estado` + datos de afinidad (`nivel_energia`, `apto_ninos`, `apto_otros`) + `deleted_at` | pública solo `disponible` no borrada (+ dueño, adoptante aprobado y admin); escribe el dueño       |
| `fotos_mascota`      | `id` UUID                  | `url_foto`, `es_principal`, `orden`                                                               | trigger máx 5 por mascota; subida WebP ≤500 KB                                                     |
| `solicitudes`        | `id` UUID                  | mascota + adoptante + estado + mensaje 10–1000                                                    | única pendiente por (mascota, adoptante); aprobar (RPC) → `en_proceso` + auto-rechaza resto        |
| `mensajes`           | `id` UUID                  | emisor/receptor/mascota + texto 1–2000 + `leido`                                                  | solo participantes; chat habilitado con solicitud aprobada; Realtime activo                        |
| `favoritos`          | `(id_usuario, id_mascota)` | guardados                                                                                         | solo dueño                                                                                         |
| `perfil_estilo_vida` | `id_persona`               | ambiente, niños, otras mascotas, preferencias de especie/energía/edad, zona                       | solo dueño; alimenta `src/lib/match.ts`                                                            |
| `reportes`           | `id` UUID                  | mascota + reportador + motivo 10–500 + `estado` (`pendiente`/`resuelto`/`descartado`)             | uno por (mascota, reportador); trigger impide reportar lo propio; resuelve un admin                |
| `verificaciones_org` | `id` UUID                  | evidencia (`tipo_evidencia`, `url_evidencia`) + `estado` (`pendiente`/`aprobada`/`rechazada`)     | la crea la organización; la resuelve un admin con nota                                             |
| `administradores`    | `id` (FK `usuarios`)       | desde, notas                                                                                      | alta manual por SQL (`docs/ADMIN.md`); nadie la escribe desde la app                               |
| `auditoria`          | `id` UUID                  | quién, `accion`, tabla, registro, antes/después (JSONB), IP, fecha                                | solo inserción propia; cada usuario lee lo suyo; el equipo la revisa por SQL                       |

## Funciones / triggers

| Objeto                                            | Hace                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `handle_new_user()` + `trg_new_user`              | espejo `auth.users → usuarios/personas/organizaciones`                                   |
| `sync_usuarios_correo()`                          | copia a `usuarios.correo` el cambio de correo confirmado en Auth                         |
| `check_max_fotos()` + `trg_max_fotos`             | tope 5 fotos por mascota                                                                 |
| `set_mascota_slug()`                              | genera el `slug` (`nombre-xxxxxx`) al publicar                                           |
| `set_updated_at()`                                | `updated_at` automático en `mascotas`                                                    |
| `buscar_por_similitud(text, int)`                 | búsqueda difusa con `pg_trgm`                                                            |
| `aprobar_solicitud(uuid)` (DEFINER)               | aprueba + `en_proceso` + auto-rechaza, atómico, solo publicador                          |
| `soy_publicador()` / `tengo_aprobada()` (DEFINER) | helpers RLS anti-recursión                                                               |
| `perfil_publico(uuid[])` (DEFINER)                | nombre, foto, tipo, badge y redes de una org verificada; anonimiza cuentas dadas de baja |
| `resumen_adoptantes(uuid[])` (DEFINER)            | ficha del adoptante, solo si le envió una solicitud al publicador que la pide            |
| `eliminar_mi_cuenta()` (DEFINER)                  | baja lógica: anonimiza, despublica, cancela pendientes; bloquea si hay una aprobada      |
| `soy_admin()`                                     | ¿el usuario está en `administradores`? (la usa la RLS)                                   |
| `resolver_reporte(uuid, text)`                    | admin: `ocultar` (soft-delete + descarta el resto) o `descartar`                         |
| `resolver_verificacion(uuid, bool, text)`         | admin: aprueba (marca `verificada`) o rechaza, con nota                                  |
| `restaurar_publicacion(uuid)`                     | admin: deshace un ocultamiento                                                           |
| `estado_cuenta(uuid, bool)`                       | admin: suspende o reactiva una cuenta y deja rastro en `auditoria`                       |
| `listar_cuentas(text)`                            | admin: listado de cuentas sin correo                                                     |
| `validar_auto_reporte()`                          | trigger: impide reportar tu propia publicación                                           |
