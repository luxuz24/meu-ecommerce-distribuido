# 05 — Plano do Frontend

## Objetivo
SPA/SSR loja virtual que consome user-service e catalog-service (e, depois, order/payment), em `frontend/` na raiz do monorepo.

## Stack implementada
- **Vite + React 19 + TypeScript**, Tailwind CSS (tema *Distributed Commerce Minimalist* gerado no Stitch), React Router v7.
- Testes: Vitest (`src/__tests__/api.test.ts`).

## Diretriz de Telemetria de Desenvolvimento vs. Produção Limpa
- Durante o desenvolvimento das fases de backend e integração, o frontend conta com widgets de telemetria e diagnóstico (`<DevOnly>`, `<EndpointBar>`, `<JsonInspectorDrawer>`, simuladores de erro 401/404, latência em `ms` e health check de `:3000` e `:3001`) isolados em `frontend/src/components/telemetry/DevTelemetry.tsx` e controlados pelo `TelemetryContext` (`VITE_DEV_TELEMETRY` + botão `Dev Telemetry: ON / Modo Limpo` no topo).
- **Regra para versões finais**: Todo código de telemetria/teste está encapsulado em `<DevOnly>`. Na versão final para o usuário, basta desativar `VITE_DEV_TELEMETRY=false` e remover `components/telemetry/` para entregar uma loja 100% limpa ao consumidor final.
- Referências visuais brutas do Stitch ficam na pasta local `Front_referencias/` (ignorada no `.gitignore`, não versionada no Git).

## Fases do frontend
| Fase | Entrega | Depende de | Status |
|---|---|---|---|
| F0 | Scaffold, lint, cliente HTTP, layout, Dockerfile + entrada no compose (`:3002`) | — | ✅ |
| F1 | Cadastro (`POST /users`), login (`POST /login`), logout, página de perfil (`GET /users/me`) | CORS | ✅ |
| F2 | Catálogo: listagem paginada, busca (`?q=`), filtros e detalhe (`GET /api/products/:id`) | `GET /api/products` | ✅ |
| F3 | Admin: CRUD de produtos (`POST`, `PATCH`, `DELETE` soft delete + reativação) | `catalog-service` CRUD | ✅ (proteção JWT admin na Fase 3 backend) |
| F4 | Carrinho (cliente) e checkout | order-service | ✅ (CartContext + POST /api/orders na OrdersPage) |
| F5 | Meus pedidos, status de pagamento (polling/SSE/manual refresh) | order/payment | ✅ (OrdersPage + status da Saga e controles) |
| F6 | Notificações em tempo real (opcional), E2E, CI | notification evolução | ✅ (Notification consumer + CI matrix) |

## Regras
- Tipos/contratos espelham `04-contratos-api-e-eventos.md`; atualizar ambos juntos.
- Validação com Zod espelhando as regras do backend (nome ≥2, senha ≥6, preço/estoque ≥0).
- Tratar 401 globalmente (redirect para login); estados de loading/erro em toda tela.
- Acessibilidade e responsividade desde o início.
