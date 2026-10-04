# Panel de administración (moderación)

Ruta: **`/admin`** (solo administradores). Permite revisar reportes de publicaciones
y solicitudes de verificación de organizaciones.

> Si entras y no eres admin verás un **404**, no un mensaje de "no autorizado":
> así no se revela que el panel existe.

---

## 1. Cómo convertirse en administrador

La identidad de admin vive en la tabla `administradores`, que **no tiene permisos de
escritura para `authenticated`**. Por diseño, un usuario normal **no puede** auto-asignarse
el rol (probado: la RLS lo bloquea). Solo alguien con acceso a la base de datos puede añadir admins.

### Opción A — Ya te registraste en la app

1. Regístrate en Adopty con tu correo real (usuario normal, tipo _Persona_).
   - Si Supabase pide confirmar el correo, ábrelo. Si no te llega, puedes confirmar
     la cuenta con el SQL del punto 3.
2. Averigua tu UUID (Supabase → Authentication → Users → tu correo → _User UID_), o ejecútalo tú mismo:

```sql
SELECT id, correo FROM usuarios WHERE correo = 'tu-correo@ejemplo.com';
```

3. Añádete como admin:

```sql
INSERT INTO administradores (id, notas)
VALUES ('<TU-UUID>', 'admin fundacional')
ON CONFLICT (id) DO UPDATE SET notas = EXCLUDED.notas;
```

### Opción B — Confirmar el correo y.admin en un solo paso

```sql
-- 1) Confirmar el correo (si el alta te pidió confirmar)
UPDATE auth.users SET email_confirmed_at = now()
WHERE email = 'tu-correo@ejemplo.com' AND email_confirmed_at IS NULL;

-- 2) Crear la fila en usuarios + dar de alta (si no existe)
INSERT INTO usuarios (id, correo, tipo_usuario)
SELECT id, email, 'persona' FROM auth.users
WHERE email = 'tu-correo@ejemplo.com'
ON CONFLICT (id) DO NOTHING;
INSERT INTO personas (id, nombre)
SELECT id, split_part(email, '@', 1) FROM auth.users
WHERE email = 'tu-correo@ejemplo.com'
ON CONFLICT (id) DO NOTHING;

-- 3) Ser admin
INSERT INTO administradores (id)
SELECT id FROM auth.users WHERE email = 'tu-correo@ejemplo.com'
ON CONFLICT (id) DO NOTHING;
```

### Quitar el rol de admin

```sql
DELETE FROM administradores WHERE id = '<UUID>';
```

---

## 2. Qué puede hacer el admin

| Acción                    | Efecto                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ocultar publicación**   | `mascotas.deleted_at = now()` → desaparece de Explorar, pero **se conserva** (reversible). Además **descarta automáticamente** el resto de reportes pendientes de esa mascota. |
| **Descartar reporte**     | El reporte era infundado. La publicación sigue visible.                                                                                                                        |
| **Aprobar verificación**  | La organización recibe el badge **verificada**.                                                                                                                                |
| **Rechazar verificación** | No se otorga el badge. Si no hay otra verificación aprobada, se le quita.                                                                                                      |

Todo queda registrado en la tabla `auditoria` (acción, cambios e IP).

### Privacidad (minimización de datos — Ley 81)

El panel muestra **solo el nombre** de quien reportó o de la organización.
**Nunca** se muestra el correo ni el teléfono, aunque el admin tenga permisos para leerlos.
No es un filtro de la interfaz: el endpoint de listado no lo pide a la base de datos.

### Estados

```
Reporte:      pendiente ──► resuelto    (la publicación se ocultó)
                    └──► descartado  (reporte infundado / la ya se ocultó)

Verificación: pendiente ──► aprobada    (organizaciones.verificada = true)
                    └──► rechazada
```

---

## 3. Cómo está protegido (RLS + RPC)

- `administradores`: solo `SELECT` de la propia fila. Sin `INSERT`/`UPDATE`/`DELETE` para `authenticated`.
- `soy_admin()`: función `SECURITY DEFINER` que consulta `administradores` con `auth.uid()`.
- `reportes` y `verificaciones_org`: policies extra que permiten ver todo al admin
  (sin ellas, un usuario solo ve lo suyo).
- Los cambios de estado **no** se hacen con `UPDATE` directo: se llaman a las RPC
  `resolver_reporte(...)` y `resolver_verificacion(...)`, que son `SECURITY DEFINER`,
  validan `soy_admin()` internamente y hacen todo en una sola transacción
  (evita estados intermedios si algo falla a mitad).

Las API routes validan el rol **además** de la RPC (doble barrera).

---

## 4. Endpoints

| Método | Ruta                                         | Uso                                            |
| ------ | -------------------------------------------- | ---------------------------------------------- |
| `GET`  | `/api/admin/reportes?estado=pendiente`       | Listar reportes                                |
| `POST` | `/api/admin/reportes/:id`                    | `{ accion: 'ocultar' \| 'descartar', notas? }` |
| `GET`  | `/api/admin/verificaciones?estado=pendiente` | Listar verificaciones                          |
| `POST` | `/api/admin/verificaciones/:id`              | `{ aprobar: boolean, notas? }`                 |

---

## 5. Nota de seguridad sobre las cuentas demo

Las cuentas de la semilla (`patitas@adopty.pa`, `rescatista@adopty.pa`) son las
**dueñas de todo el catálogo de demostración** (19 + 13 mascotas), así que borrarlas
deja la aplicación vacía. Lo que se hizo fue **rotar su contraseña**: la clave ya no
está en el repositorio.

```sql
-- Ver las cuentas demo
SELECT correo FROM auth.users WHERE correo IN ('patitas@adopty.pa','rescatista@adopty.pa');

-- Cambiar su contraseña (rotar)
UPDATE auth.users SET encrypted_password = crypt('<nueva-clave>', gen_salt('bf'))
WHERE email = 'patitas@adopty.pa';
```

**Nunca** añadas estas cuentas a `administradores`: como son públicas, cualquiera que
conozca el proyecto sería administrador.

### Si decides borrarlas

Ojo: se lleva por cascada las 32 mascotas, las solicitudes y los mensajes. Hazlo solo
cuando ya no necesites datos de demostración, y primero respalda:

```bash
./scripts/backup.sh   # o el workflow de GitHub Actions "Backup base de datos"
```

```sql
DELETE FROM auth.users WHERE correo IN ('patitas@adopty.pa','rescatista@adopty.pa');
```

### Crear un administrador

Vuelve a la sección 1. Para el correo del administrador no hace falta que el dominio
exista todavía: Supabase solo valida el MX al **registrarse**, no al iniciar sesión.

---

## 6. Cambiar la contraseña

Desde `/perfil` → _Cambiar contraseña_.

La API (`POST /api/auth/cambiar-password`) **exige la contraseña actual** antes de
aplicar la nueva. Eso es lo que la convierte en un cambio de contraseña y no en un
simple _set_ de sesión: sin esa comprobación, un cookie robado bastaría para dejar la
cuenta inutilizable.

```
POST /api/auth/cambiar-password  {actual, nueva, confirmar}
```

- Valida con Zod en servidor (`cambiarPasswordSchema`): mínimo 8 caracteres, las dos
  nuevas coinciden y no repite la actual.
- Verifica la actual con `signInWithPassword`; si falla, `401`.
- Supabase invalida el resto de sesiones al cambiar la contraseña.
- 5 intentos por hora y usuario, y queda registrado en `auditoria`
  (`password_cambiada`).

Cuando tu correo todavía no tiene dominio, esta pantalla es tu única forma de dejar de
depender de la que está escrita en el chat: cámbiala y no la menciones más.

---

## 7. Rate limiting por ruta

Todas las rutas que escriben datos tienen límite. El contador vive en memoria por
proceso (suficiente para frenar abuso casual); en un despliegue multi-instancia habría
que migrarlo a Upstash/Redis.

| Ruta                              | Límite              |
| --------------------------------- | ------------------- |
| `POST /api/auth/register`         | 10/min por IP       |
| `POST /api/auth/login`            | 10/min por IP       |
| `POST /api/auth/recuperar`        | 5/min por IP        |
| `POST /api/auth/cambiar-password` | 5/hora por usuario  |
| `POST /api/mascotas`              | 5/hora por usuario  |
| `POST /api/mascotas/upload`       | 20/hora por usuario |
| `POST /api/mensajes`              | 30/min por usuario  |
| `POST /api/solicitudes`           | 10/hora por usuario |
| `POST /api/reportes`              | 10/hora por usuario |
| `POST /api/verificacion`          | 5/hora por usuario  |
| `PUT /api/perfil`                 | 20/hora por usuario |
| `POST/DELETE /api/favoritos`      | 60/min por usuario  |

Las autenticadas se limitan por `user.id`, no por IP: varias personas pueden salir por
la misma IP sin estorbarse. Al superarse devuelven `429` con `Retry-After`.
