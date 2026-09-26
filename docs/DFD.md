# DFD — Adopty (nivel contexto + nivel 1)

## Contexto

```mermaid
flowchart LR
    A[Adoptante] -->|busca, solicita, chatea| S((Adopty<br/>Astro + Vercel))
    P[Publicador<br/>persona / org] -->|publica, aprueba, chatea| S
    S -->|auth, datos, RLS| DB[(Supabase<br/>Postgres + Auth + Storage)]
    S -->|fotos WebP| DB
    S -->|realtime mensajes| DB
    S -->|deploy + analytics| V[Vercel]
    S -.->|pendiente F8| G[Google OAuth]
```

## Nivel 1 — flujos

```mermaid
flowchart TD
    subgraph Pub [Exploración pública]
        E[/explorar/] --> API1[GET /api/mascotas]
        API1 --> DB[(mascotas + fotos<br/>RLS: disponible)]
    end
    subgraph Aut [Auth]
        L[/login /register/] --> SA[Supabase Auth]
        SA --> TRG([trigger espejo<br/>usuarios])
    end
    subgraph Ges [Gestión]
        N[/mascota/nueva/] --> UP[POST /upload<br/>sharp WebP]
        UP --> CR[POST /api/mascotas]
        PA[/panel/] --> MU[PATCH estado / DELETE<br/>soft-delete]
    end
    subgraph Flu [Adopción]
        D[/mascota/id<br/>solicitar/] --> CS[POST /api/solicitudes]
        CS --> PS[/panel/solicitudes<br/>aprobar RPC/]
        PS --> MASC{mascota → en_proceso}
        MASC --> CH[/mensajes<br/>realtime/]
    end
    Pub -.-> Aut
    Ges -.-> Aut
    Flu -.-> Aut
```

## Diccionario de flujos

| Origen → Destino      | Datos                                                |
| --------------------- | ---------------------------------------------------- |
| Adoptante → Explorar  | `especie, tamano, sexo, q, orden, page`              |
| API → Adoptante       | `{items, total, page, totalPages}` (20/pág)          |
| Form → Upload         | multipart 1–5 fotos (≤5 MB, JPEG/PNG/WebP)           |
| Upload → Form         | `paths[]` WebP ≤500 KB                               |
| Detalle → Solicitudes | `{id_mascota, mensaje_inicial}`                      |
| Panel → Solicitudes   | `{accion: aprobar/rechazar}` (aprobar = RPC)         |
| Chat ⇄ Realtime       | `INSERT mensajes` por canal `chat:{mascota}:{a}:{b}` |
