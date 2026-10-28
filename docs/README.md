# Documentação técnica

| # | Documento | Conteúdo |
|---|-----------|----------|
| 01 | [Visão e Arquitetura](./01-visao-e-arquitetura.md) | Topologia, sequência da Saga, garantias de cada mecanismo, ADRs e limitações conhecidas |
| 02 | [Planejamento e Roadmap](./02-planejamento-roadmap.md) | Evolução do projeto por fases |
| 03 | [Convenções de Código](./03-convencoes-de-codigo.md) | Clean Architecture, TypeScript, estrutura de pastas, Docker, testes |
| 04 | [Contratos de API e Eventos](./04-contratos-api-e-eventos.md) | Endpoints (via gateway), autorização e eventos RabbitMQ |
| 05 | [Frontend](./05-frontend-plano.md) | Stack do frontend e o modo Dev (`<DevOnly>`) vs. Loja Limpa |
| 06 | [Fluxo, SOLID e Segurança](./06-fluxo-solid-e-seguranca.md) | Fluxo de PR, princípios SOLID e checklist de segurança |

## Comandos rápidos
```bash
docker compose up -d --build --wait   # sobe tudo e espera todos os healthchecks
npm run seed:demo                     # dados de demonstração (via gateway)
npm test                              # testes unitários de todos os serviços + frontend
npm run test:e2e                      # testes ponta a ponta da Saga contra a stack real
docker compose logs -f <serviço>      # logs de um serviço
```

Portas no host: frontend `3002`, API Gateway `8080`, Postgres `5434`, MongoDB `27017`,
RabbitMQ `5672` / painel `15672`. Os microsserviços não são expostos: tudo passa pelo gateway.

Se um documento divergir do código, o código vence — corrija o documento no mesmo PR.
