# CHANGELOG — v0.50.0

## Changed
- Enterprise agora usa transporte autenticado explícito.
- Motor Comercial agora usa transporte autenticado explícito.
- interceptor global do workspace foi removido.
- versão atualizada para `0.50.0`.

## Removed
- `workspaceApiTransport.ts`;
- teste dedicado ao interceptor obsoleto.

## Security
- o frontend não injeta mais Bearer por monkey patch global;
- chamadas protegidas usam o cliente autenticado explicitamente;
- superfícies públicas preservam transporte anônimo.
