# 05 — Plano do Frontend

## Objetivo
SPA/SSR loja virtual que consome user-service e catalog-service (e, depois, order/payment), em `frontend/` na raiz do monorepo.

## Stack proposta (confirmar com o time antes de iniciar)
- **Next.js (App Router) + TypeScript**, Tailwind CSS, TanStack Query, Zod + React Hook Form.
- Alternativa: Vite + React. Decisão pendente.
- Testes: Vitest + Testing Library; E2E: Playwright.

## Estrutura sugerida
```
frontend/
├── src/
│   ├── app/                # rotas (login, register, products, cart, orders, admin)
│   ├── features/{auth,catalog,cart,orders}/   # components, hooks, api, schemas
│   ├── shared/{ui,lib,config}/
│   └── services/http.ts    # cliente fetch/axios com baseURL + Bearer
├── .env.example            # NEXT_PUBLIC_USER_API_URL, NEXT_PUBLIC_CATALOG_API_URL
└── Dockerfile
```

## Integração com o backend
- URLs: user `http://localhost:3000`, catalog `http://localhost:3001/api`.
- Auth: `POST /login` → guardar `tokenJwt` (preferir cookie httpOnly via route handler do Next; evitar localStorage se possível); enviar `Authorization: Bearer`.
- **Pré-requisito backend**: habilitar CORS (Fase 0). Recomendado futuro: API Gateway/BFF único para evitar múltiplas origens.
- Listagem de produtos depende de `GET /api/products` (Fase 2) — até lá usar mock/MSW.

## Fases do frontend
| Fase | Entrega | Depende de |
|---|---|---|
| F0 | Scaffold, lint, cliente HTTP, layout, Dockerfile + entrada no compose | — |
| F1 | Cadastro, login, logout, rota protegida, página de perfil (`/users/me`) | CORS |
| F2 | Catálogo: listagem, busca, detalhe | `GET /api/products` |
| F3 | Admin: CRUD de produtos | Roles + endpoints protegidos (Fase 3 backend) |
| F4 | Carrinho (cliente) e checkout | order-service |
| F5 | Meus pedidos, status de pagamento (polling/SSE) | order/payment |
| F6 | Notificações em tempo real (opcional), E2E, CI | notification evolução |

## Regras
- Tipos/contratos espelham `04-contratos-api-e-eventos.md`; atualizar ambos juntos.
- Validação com Zod espelhando as regras do backend (nome ≥2, senha ≥6, preço/estoque ≥0).
- Tratar 401 globalmente (redirect para login); estados de loading/erro em toda tela.
- Acessibilidade e responsividade desde o início.
