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

Las cuentas de la semilla usan la contraseña `Adopty123!` y son públicas en el
repositorio. **Nunca** las añadas a `administradores` en un entorno real, y
elimínalas o rota su contraseña antes del piloto:

```sql
-- Ver las cuentas demo
SELECT correo FROM auth.users WHERE correo IN ('patitas@adopty.pa','rescatista@adopty.pa');
```

Para borrarlas (esto también elimina sus mascotas, solicitudes y mensajes en cascada):

```sql
DELETE FROM auth.users WHERE correo IN ('patitas@adopty.pa','rescatista@adopty.pa');
```
