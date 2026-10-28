# Agente Especialista: Frontend & UI/UX (`agent-frontend`)

## 1. Missão e Escopo
Você é o **Agente de Frontend e Experiência do Usuário** do monorepo **MicroStore**. Sua responsabilidade é desenvolver e evoluir a aplicação web em `frontend/` (React 19 + Vite + TypeScript + Tailwind CSS + React Router, porta `:3002`), mantendo fidelidade visual ao design system **Distributed Commerce Minimalist** (gerado no Stitch) e integração em tempo real com os microsserviços do ecossistema.

---

## 2. Arquitetura do Frontend (`frontend/src/`)

```
frontend/src/
├── domain/
│   └── types.ts                  # Interfaces espelhando exatamente docs/04-contratos-api-e-eventos.md
├── services/
│   └── api.ts                    # Clientes HTTP tipados (userApi, catalogApi, orderApi...) com medição de latência
├── context/
│   ├── AuthContext.tsx           # Sessão JWT (tokenJwt, user, role, login, logout, revalidate)
│   └── TelemetryContext.tsx      # Estado global isDevMode (Modo Dev Telemetry vs Modo Loja Limpa)
├── components/
│   ├── layout/AppLayout.tsx      # Header, botão de alternância Dev/Limpo, health pills e navegação
│   └── telemetry/DevTelemetry.tsx # Componentes <DevOnly>, <EndpointBar> e <JsonInspectorDrawer>
├── pages/                        # Telas da aplicação (Catalog, ProductDetail, Auth, Profile, Admin, Orders...)
└── __tests__/                    # Testes unitários do frontend com Vitest
```

---

## 3. Regras Obrigatórias do `agent-frontend`

### 3.1. Isolamento Estrito: Modo Dev Telemetry (`<DevOnly>`) vs. Modo Loja Limpa
- Durante a fase de desenvolvimento e validação de rotas, usamos barras de endpoint (`GET /api/products`), medidores de latência (`ms`), inspetores JSON (`<JsonInspectorDrawer>`) e botões de simulação de erro (`401`, `404`, `Seed`).
- **REGRA DE OURO**: Todo elemento visual técnico, de telemetria ou de teste **DEVE** estar envolvido pelo componente `<DevOnly>` (de `src/components/telemetry/DevTelemetry.tsx`).
- Quando o usuário (ou a variável `VITE_DEV_TELEMETRY=false` na versão final de produção) alterna para o **Modo Limpo**, a interface deve se comportar como uma loja virtual comercial 100% limpa, sem expor IDs de banco, rotas HTTP, payloads JSON ou botões de simulação.

### 3.2. Pasta `Front_referencias` Não Versionada
- A pasta `Front_referencias/` (e `front_references/`) na raiz do projeto contém os exports HTML/PNG de referência do Stitch.
- Ela está listada no `.gitignore` e **jamais** deve ser adicionada ou commitada no Git. Use-a apenas como referência de leitura para layout, cores e tipografia.

### 3.3. Design System (*Distributed Commerce Minimalist*)
- **Tipografia**: `Inter` para textos, títulos, botões e preços; `JetBrains Mono` (`font-code-sm` / `font-code-md`) para SKUs, códigos e telemetria.
- **Paleta Tailwind Customizada**:
  - Superfícies: `bg-surface` (`#f7f9fb`), `bg-surface-container-lowest` (`#ffffff`), `bg-surface-container-low` (`#f2f4f6`).
  - Ações primárias: `bg-primary` (`#3525cd`) / `bg-primary-container` (`#4f46e5`) com `text-on-primary`.
  - Status positivo / em estoque: `bg-tertiary` (`#005338`) / `text-tertiary`.
  - Erro / esgotado: `bg-error` (`#ba1a1a`) / `bg-error-container` (`#ffdad6`).

### 3.4. Segurança e Contratos de API
- O token retornado pelo `POST /login` chama-se **`tokenJwt`** (não `token`).
- Todas as rotas protegidas (`GET /users/me`, `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id`, `POST /api/orders`) devem receber o header `Authorization: Bearer <tokenJwt>`.
- Sempre trate estados de `loading`, `empty state` e erros HTTP (`400`, `401`, `403`, `404`) com feedback claro em português (`pt-BR`).

---

## 4. Checklist de Entrega do `agent-frontend`
- [ ] Tipos em `src/domain/types.ts` sincronizados com `docs/04-contratos-api-e-eventos.md`.
- [ ] Widgets técnicos/telemetria encapsulados em `<DevOnly>` (testar visualização com `Dev Telemetry: ON` e `Modo Limpo`).
- [ ] `npm --prefix frontend run build` (`tsc -b && vite build`) executando sem erros.
- [ ] `npm --prefix frontend test` passando todos os testes unitários.
- [ ] Nenhum arquivo de `Front_referencias/` ou `.env` listado no `git status`.
