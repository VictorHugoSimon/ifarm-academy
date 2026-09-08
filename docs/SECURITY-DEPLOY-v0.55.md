# Segurança de Deploy — v0.55

## Boundary
O pipeline de deploy aceita somente os alvos `stage` e `production` definidos em código e recursos cujo nome pertence ao namespace `ifarm-academy`.

## Credenciais
- Cloudflare token e account ID vêm apenas de GitHub Actions secrets do repositório Academy.
- Tokens nunca são impressos.
- Secrets internos do runtime são gerados no runner e enviados diretamente ao Pages.
- Nenhum secret usa prefixo `VITE_`.

## Isolamento
O provisionador não aceita `database_id`, `bucket_id` ou project name via input do workflow. Isso impede apontar acidentalmente para recursos de outro projeto durante a promoção.

## Ordem segura
1. validação local/CI;
2. criação/descoberta de recursos exclusivos;
3. migrations D1;
4. configuração de secrets/bindings;
5. deploy Pages;
6. smoke obrigatório.

## Produção
A branch `main` continua sendo a única origem automática de PRODUCTION. STAGE utiliza projeto, D1 e R2 diferentes.
