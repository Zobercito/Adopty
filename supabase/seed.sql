-- Adopty Fase 1 — seed.sql — 2 publicadores demo + 30 mascotas.
-- Correr DESPUÉS de las migraciones, en SQL editor o `supabase db execute`.
-- Los UUIDs son fijos para que el seed sea idempotente (ON CONFLICT DO NOTHING).

-- Publicadores demo (huérfanos de auth.users a propósito: solo para pruebas de lectura)
INSERT INTO usuarios (id, correo, tipo_usuario) VALUES
  ('11111111-1111-1111-1111-111111111111', 'patitas@adopty.pa', 'organizacion'),
  ('22222222-2222-2222-2222-222222222222', 'rescatista@adopty.pa', 'persona')
ON CONFLICT (id) DO NOTHING;
INSERT INTO organizaciones (id, nombre_oficial, direccion, descripcion, verificada) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Refugio Patitas Felices', 'Ciudad de Panamá', 'Refugio aliado del piloto Adopty.', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO personas (id, nombre, descripcion) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Eira R. (rescatista)', 'Rescatista independiente en San Miguelito.')
ON CONFLICT (id) DO NOTHING;

-- 9 base (del mockup) + 21 sintéticas = 30
INSERT INTO mascotas (id_publicador, nombre, especie, raza, edad_meses, sexo, tamano, descripcion, estado_salud, ubicacion, estado)
VALUES
  ('11111111-1111-1111-1111-111111111111','Toby','perro','Labrador mix',8,'Macho','Mediano','Juguetón, sociable con niños y otros perros. Ideal para casa con patio.','Vacunado y desparasitado','Ciudad de Panamá','disponible'),
  ('22222222-2222-2222-2222-222222222222','Mishi','gato','Doméstico pelo corto',12,'Hembra','Pequeño','Tranquila, cariñosa, le encanta dormir al sol. Ideal para apartamento.','Esterilizada, vacunada','San Miguelito','disponible'),
  ('11111111-1111-1111-1111-111111111111','Rocky','perro','Beagle',24,'Macho','Mediano','Energético y leal, necesita paseos diarios.','Vacunado, sano','Arraiján','en_proceso'),
  ('11111111-1111-1111-1111-111111111111','Luna','gato','Siamés mix',6,'Hembra','Pequeño','Curiosa y ronroneadora, se lleva bien con otros gatos.','Vacunada, desparasitada','Bethania','disponible'),
  ('22222222-2222-2222-2222-222222222222','Max','perro','Criollo',36,'Macho','Grande','Protector y noble, perfecto como compañero de familia.','Esterilizado, vacunado','Tocumen','disponible'),
  ('11111111-1111-1111-1111-111111111111','Nina','perro','Poodle',12,'Hembra','Pequeño','Inteligente y dócil, aprende trucos rápido.','Vacunada, pelo hipoalergénico','El Cangrejo','disponible'),
  ('11111111-1111-1111-1111-111111111111','Simba','gato','Naranja tabby',4,'Macho','Pequeño','Bebé juguetón, muy activo y divertido.','Desparasitado, primera vacuna','Vía España','disponible'),
  ('22222222-2222-2222-2222-222222222222','Coco','otro','Conejo holandés',12,'Macho','Pequeño','Dócil, ideal para niños responsables.','Sano, revisado por veterinario','Albrook','disponible'),
  ('11111111-1111-1111-1111-111111111111','Kira','perro','Husky mix',24,'Hembra','Grande','Historia de éxito: adoptada en agosto.','Esterilizada y vacunada','Clayton','adoptada')
ON CONFLICT DO NOTHING;

-- 21 sintéticas para probar filtros/paginación (nombres deterministas)
INSERT INTO mascotas (id_publicador, nombre, especie, raza, edad_meses, sexo, tamano, descripcion, estado_salud, ubicacion, estado)
SELECT
  CASE WHEN g % 2 = 0 THEN '11111111-1111-1111-1111-111111111111' ELSE '22222222-2222-2222-2222-222222222222' END,
  'Mascota ' || g,
  (ARRAY['perro','gato','otro'])[1 + (g % 3)],
  'Raza ' || g,
  1 + (g * 7) % 120,
  CASE WHEN g % 2 = 0 THEN 'Macho' ELSE 'Hembra' END,
  (ARRAY['Pequeño','Mediano','Grande'])[1 + (g % 3)],
  'Descripción de prueba generada por el seed para la mascota número ' || g || '.',
  'Sano',
  (ARRAY['Bethania','Tocumen','Arraiján','El Cangrejo','Albrook','Clayton'])[1 + (g % 6)],
  'disponible'
FROM generate_series(10, 30) AS g
ON CONFLICT DO NOTHING;

-- Foto principal para las 9 base (rutas a /assets ya desplegados)
INSERT INTO fotos_mascota (id_mascota, url_foto, es_principal, orden)
SELECT m.id, '/assets/' || x.foto, true, 0
FROM mascotas m JOIN (VALUES
  ('Toby','1.jpeg'),('Mishi','2.jpeg'),('Rocky','3.jpeg'),('Luna','4.jpg'),
  ('Max','5.jpeg'),('Nina','6.JPG'),('Simba','7.jpeg'),('Coco','8.jpeg'),('Kira','9.jpg')
) AS x(nombre, foto) ON x.nombre = m.nombre
ON CONFLICT DO NOTHING;
