import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { rateLimit, respuestaRateLimit } from '../../../lib/ratelimit';
import { estiloVidaSchema } from '../../../lib/validation/user';

export const prerender = false;

/** GET /api/estilo-de-vida — perfil de estilo de vida del usuario (o null). */
export const GET: APIRoute = async ({ cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const { data, error } = await supabase
    .from('perfil_estilo_vida')
    .select('*')
    .eq('id_persona', user.id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ perfil: data ?? null });
};

/** PUT /api/estilo-de-vida — guarda/actualiza el perfil (upsert). */
export const PUT: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const rl = rateLimit(`estilo:${user.id}`, 20, 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 60);

  const body = await request.json().catch(() => null);
  const parsed = estiloVidaSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const { error } = await supabase
    .from('perfil_estilo_vida')
    .upsert({ id_persona: user.id, ...parsed.data });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
};
