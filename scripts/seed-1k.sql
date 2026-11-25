-- Adopty — dataset de 1.000 mascotas SOLO para benchmarks locales.
--
-- Nunca ejecutar contra el proyecto cloud. Requiere el seed normal aplicado
-- (`supabase db reset` crea los dos publicadores demo).
--
-- Uso:
--   npx supabase db reset
--   npx supabase db execute --file scripts/seed-1k.sql
--   node scripts/perf.mjs http://localhost:4321

DELETE FROM public.mascotas WHERE nombre LIKE 'Mascota 1k %';

INSERT INTO public.mascotas (
  id_publicador,
  nombre,
  especie,
  raza,
  edad_meses,
  sexo,
  tamano,
  descripcion,
  estado_salud,
  ubicacion,
  estado,
  fecha_publicacion
)
SELECT
  CASE
    WHEN g % 2 = 0 THEN '11111111-1111-1111-1111-111111111111'::uuid
    ELSE '22222222-2222-2222-2222-222222222222'::uuid
  END,
  'Mascota 1k ' || g,
  (ARRAY['perro', 'gato', 'otro'])[1 + (g % 3)]::public.especie,
  'Raza ' || (g % 40),
  1 + (g * 7) % 120,
  (CASE WHEN g % 2 = 0 THEN 'Macho' ELSE 'Hembra' END)::public.sexo_mascota,
  (ARRAY['Pequeño', 'Mediano', 'Grande'])[1 + (g % 3)]::public.tamano_mascota,
  'Descripción sintética para el benchmark de 1k, mascota número ' || g || '.',
  'Sano',
  (ARRAY['Bethania', 'Tocumen', 'Arraiján', 'El Cangrejo', 'Albrook', 'Clayton'])[1 + (g % 6)],
  'disponible',
  now() - (g || ' minutes')::interval
FROM generate_series(1, 970) AS g;

-- 30 del seed normal + 970 sintéticas = 1.000.
SELECT count(*) AS mascotas_totales FROM public.mascotas;
