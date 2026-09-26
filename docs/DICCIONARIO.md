# Diccionario de datos — Adopty (resumen; detalle SQL en `supabase/migrations/`)

## ENUMs

| Enum               | Valores                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `tipo_usuario`     | `persona`, `organizacion`                                                                                      |
| `especie`          | `perro`, `gato`, `otro`                                                                                        |
| `sexo_mascota`     | `Macho`, `Hembra`                                                                                              |
| `tamano_mascota`   | `Pequeño`, `Mediano`, `Grande`                                                                                 |
| `estado_mascota`   | `disponible` → `en_proceso` → `adoptada` (terminal); `en_proceso → disponible` si falla                        |
| `estado_solicitud` | `pendiente` → `aprobar=aprobada` / `rechazar=rechazada` / `cancelar=cancelada`; sin transiciones entre finales |

## Tablas

| Tabla                         | Clave                      | Contenido                                              | Reglas                                                                                       |
| ----------------------------- | -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `usuarios`                    | `id` (FK `auth.users`)     | espejo: correo único, tipo, fecha, activo              | trigger `trg_new_user` la crea al registrar                                                  |
| `personas` / `organizaciones` | `id` (FK `usuarios`)       | perfil según tipo; `verificada` manual v1              | lectura pública (nombres/badges), escritura propia                                           |
| `mascotas`                    | `id` UUID                  | ficha completa + `estado` + `deleted_at` (soft-delete) | lectura pública solo `disponible` no borrada (+ dueño y adoptante aprobado); escritura dueño |
| `fotos_mascota`               | `id` UUID                  | `url_foto`, `es_principal`, `orden`                    | trigger máx 5 por mascota; subida WebP ≤500 KB                                               |
| `solicitudes`                 | `id` UUID                  | mascota + adoptante + estado + mensaje 10–1000         | única pendiente por (mascota, adoptante); aprobar (RPC) → `en_proceso` + auto-rechaza resto  |
| `mensajes`                    | `id` UUID                  | emisor/receptor/mascota + texto 1–2000 + `leido`       | solo participantes; chat habilitado con solicitud aprobada; Realtime activo                  |
| `favoritos`                   | `(id_usuario, id_mascota)` | guardados                                              | solo dueño                                                                                   |

## Funciones / triggers

| Objeto                                            | Hace                                                            |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `handle_new_user()` + `trg_new_user`              | espejo `auth.users → usuarios/personas/organizaciones`          |
| `check_max_fotos()` + `trg_max_fotos`             | tope 5 fotos por mascota                                        |
| `aprobar_solicitud(uuid)` (DEFINER)               | aprueba + `en_proceso` + auto-rechaza, atómico, solo publicador |
| `soy_publicador()` / `tengo_aprobada()` (DEFINER) | helpers RLS anti-recursión                                      |
| `set_updated_at()`                                | `updated_at` automático en `mascotas`                           |
