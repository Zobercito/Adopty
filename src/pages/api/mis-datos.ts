import type { APIRoute } from 'astro';
import { supabaseServer } from '../../lib/supabase';
import { rateLimit, respuestaRateLimit } from '../../lib/ratelimit';
import { fotosOrdenadas, fotoUrl, type FotoRow } from '../../lib/mascotas';

export const prerender = false;

/**
 * GET /api/mis-datos — descarga JSON con todo lo que guardamos de ti.
 *
 * Es el derecho de acceso del aviso de privacidad (ARCO, Ley 81). Sale de las
 * tablas que la RLS ya deja leer solo al propio usuario, así que no hay que
 * saltarse nada: lo que ves en la app es exactamente lo que se descarga.
 * No incluye conversaciones ajenas ni datos de terceros.
 */
export const GET: APIRoute = async ({ cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const rl = rateLimit(`mis-datos:${user.id}`, 2, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  const id = user.id;
  const [cuenta, persona, org, estilo, mascotas, enviadas, favoritos, mensajes] = await Promise.all(
    [
      supabase
        .from('usuarios')
        .select('correo, tipo_usuario, fecha_registro, activo, borrado_en')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('personas')
        .select('nombre, descripcion, foto_perfil, experiencia, motivacion')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('organizaciones')
        .select('nombre_oficial, direccion, descripcion, sitio_web, verificada, logo, redes')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('perfil_estilo_vida').select('*').eq('id_persona', id).maybeSingle(),
      supabase
        .from('mascotas')
        .select(
          'id, nombre, especie, raza, edad_meses, sexo, tamano, descripcion, estado_salud, ubicacion, estado, fecha_publicacion, updated_at, deleted_at',
        )
        .eq('id_publicador', id)
        .order('fecha_publicacion', { ascending: false }),
      supabase
        .from('solicitudes')
        .select('id, id_mascota, estado, mensaje_inicial, fecha_solicitud')
        .eq('id_adoptante', id)
        .order('fecha_solicitud', { ascending: false }),
      supabase.from('favoritos').select('id_mascota, fecha').eq('id_usuario', id),
      supabase
        .from('mensajes')
        .select('id, id_mascota, id_emisor, contenido, leido, fecha_envio')
        .or(`id_emisor.eq.${id},id_receptor.eq.${id}`)
        .order('fecha_envio', { ascending: false })
        .limit(500),
    ],
  );

  const ids = (mascotas.data ?? []).map((m) => m.id as string);
  let fotosPorMascota: Record<string, string[]> = {};
  if (ids.length) {
    const { data: f } = await supabase
      .from('fotos_mascota')
      .select('id_mascota, url_foto, es_principal, orden')
      .in('id_mascota', ids);
    for (const i of ids) fotosPorMascota[i] = [];
    for (const fila of fotosOrdenadas(f as FotoRow[])) {
      fotosPorMascota[fila.id_mascota]?.push(fotoUrl(fila.url_foto));
    }
  }

  const datos = {
    generado: new Date().toISOString(),
    aviso: 'Copia de los datos personales que Adopty tiene sobre tu cuenta (Ley 81 de Panamá).',
    cuenta: cuenta.data ?? null,
    perfil: persona.data ?? org.data ?? null,
    estilo_de_vida: estilo.data ?? null,
    mascotas_publicadas: (mascotas.data ?? []).map((m) => ({
      ...m,
      fotos: fotosPorMascota[m.id as string] ?? [],
    })),
    solicitudes_enviadas: enviadas.data ?? [],
    favoritos: favoritos.data ?? [],
    mensajes: mensajes.data ?? [],
  };

  return new Response(JSON.stringify(datos, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="adopty-mis-datos-${id.slice(0, 8)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
};
