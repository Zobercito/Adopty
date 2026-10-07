import type { APIRoute } from 'astro';
import { supabaseServer } from '../../lib/supabase';
import { rateLimit, respuestaRateLimit } from '../../lib/ratelimit';
import { organizacionSchema, personaSchema, redesVacias } from '../../lib/validation/user';
import { borrarFotoPerfilStorage, subirFotoPerfil } from '../../lib/storage';
import { fotoUrl } from '../../lib/mascotas';

export const prerender = false;

/** GET /api/perfil — datos del perfil + estilo de vida, para el formulario. */
export const GET: APIRoute = async ({ cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const { data: cuenta } = await supabase
    .from('usuarios')
    .select('tipo_usuario, correo, activo, borrado_en')
    .eq('id', user.id)
    .maybeSingle();
  if (!cuenta) return Response.json({ error: 'Perfil no encontrado' }, { status: 404 });

  const tabla = cuenta.tipo_usuario === 'organizacion' ? 'organizaciones' : 'personas';
  const columnas =
    cuenta.tipo_usuario === 'organizacion'
      ? 'nombre_oficial, direccion, descripcion, sitio_web, verificada, logo, redes, contacto_visible'
      : 'nombre, descripcion, foto_perfil, experiencia, motivacion';

  const [{ data: detalle }, { data: estilo }] = await Promise.all([
    supabase.from(tabla).select(columnas).eq('id', user.id).maybeSingle(),
    supabase.from('perfil_estilo_vida').select('*').eq('id_persona', user.id).maybeSingle(),
  ]);

  const foto = (detalle as { foto_perfil?: string | null } | null)?.foto_perfil ?? null;
  return Response.json({
    tipo: cuenta.tipo_usuario,
    correo: cuenta.correo,
    activo: cuenta.activo,
    borrado_en: cuenta.borrado_en,
    detalle: detalle ?? {},
    foto_url: fotoUrl(foto),
    estilo: estilo ?? null,
  });
};

/**
 * PUT /api/perfil — actualiza persona u organización del usuario autenticado.
 *
 * Acepta `FormData`: `foto` es el archivo y el resto campos de texto (así se sube
 * la imagen en la misma petición que el resto del perfil).
 */
export const PUT: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  // 30 actualizaciones de perfil por hora y usuario (antes 20: ahora la subida
  // de foto va en la misma petición).
  const rl = rateLimit(`perfil:${user.id}`, 30, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('tipo_usuario')
    .eq('id', user.id)
    .single();
  if (!perfil) return Response.json({ error: 'Perfil no encontrado' }, { status: 404 });

  const fd = await request.formData().catch(() => null);
  if (!fd) return Response.json({ error: 'Datos inválidos' }, { status: 400 });

  // --- Foto de perfil (bucket `perfiles`, un solo archivo) ---
  const archivo = fd.get('foto');
  let fotoPath: string | null = null;
  let borrarFoto = false;
  if (archivo instanceof File && archivo.size > 0) {
    try {
      const { data: previo } = await supabase
        .from('personas')
        .select('foto_perfil')
        .eq('id', user.id)
        .maybeSingle();
      const anterior = (previo as { foto_perfil?: string | null } | null)?.foto_perfil ?? null;
      fotoPath = await subirFotoPerfil(supabase, user.id, archivo);
      if (anterior) await borrarFotoPerfilStorage(supabase, anterior);
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : 'No se pudo subir la foto' },
        { status: 400 },
      );
    }
  } else if (fd.get('quitar_foto') === '1') {
    const { data: previo } = await supabase
      .from('personas')
      .select('foto_perfil')
      .eq('id', user.id)
      .maybeSingle();
    const anterior = (previo as { foto_perfil?: string | null } | null)?.foto_perfil ?? null;
    if (anterior) await borrarFotoPerfilStorage(supabase, anterior);
    borrarFoto = true;
  }

  if (perfil.tipo_usuario === 'persona') {
    const parsed = personaSchema.safeParse({
      nombre: fd.get('nombre'),
      descripcion: fd.get('descripcion') ?? '',
      experiencia: fd.get('experiencia') ?? '',
      motivacion: fd.get('motivacion') ?? '',
    });
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 },
      );
    }
    const cambios: Record<string, string | null> = {
      nombre: parsed.data.nombre,
      descripcion: parsed.data.descripcion || null,
      experiencia: (parsed.data.experiencia || null) as string | null,
      motivacion: parsed.data.motivacion || null,
    };
    if (fotoPath) cambios.foto_perfil = fotoPath;
    if (borrarFoto) cambios.foto_perfil = null;

    const { error } = await supabase.from('personas').update(cambios).eq('id', user.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  } else {
    const parsed = organizacionSchema.safeParse({
      nombre_oficial: fd.get('nombre_oficial'),
      direccion: fd.get('direccion'),
      descripcion: fd.get('descripcion') ?? '',
      sitio_web: fd.get('sitio_web') ?? '',
      contacto_visible: fd.get('contacto_visible') === '1',
      redes: redesVacias({
        instagram: String(fd.get('instagram') ?? ''),
        facebook: String(fd.get('facebook') ?? ''),
        whatsapp: String(fd.get('whatsapp') ?? ''),
      }),
    });
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 },
      );
    }
    // `redes` es JSONB: se guarda el objeto, o NULL si no se indicó ninguna.
    const redes = parsed.data.redes ?? {};
    const hayRedes = Object.values(redes).some((v) => Boolean(v));
    let logoPath: string | null = null;
    const logo = fd.get('logo_archivo');
    if (logo instanceof File && logo.size > 0) {
      try {
        const { data: previo } = await supabase
          .from('organizaciones')
          .select('logo')
          .eq('id', user.id)
          .maybeSingle();
        const anterior = (previo as { logo?: string | null } | null)?.logo ?? null;
        logoPath = await subirFotoPerfil(supabase, user.id, logo);
        if (anterior) await borrarFotoPerfilStorage(supabase, anterior);
      } catch (e) {
        return Response.json(
          { error: e instanceof Error ? e.message : 'No se pudo subir el logo' },
          { status: 400 },
        );
      }
    }
    const { error } = await supabase
      .from('organizaciones')
      .update({
        nombre_oficial: parsed.data.nombre_oficial,
        direccion: parsed.data.direccion,
        descripcion: parsed.data.descripcion || null,
        sitio_web: parsed.data.sitio_web || null,
        contacto_visible: Boolean(parsed.data.contacto_visible),
        redes: hayRedes ? redes : null,
        ...(logoPath ? { logo: logoPath } : {}),
      })
      .eq('id', user.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true, foto_url: fotoPath ? fotoUrl(fotoPath) : null });
};
