# iFarm Academy v0.36 — White Label Foundation

## Objetivo
Permitir identidade e catálogo por tenant sem duplicar o núcleo da Academy, sem executar CSS arbitrário e sem provisionar DNS automaticamente.

## Entregas
- migration `0021_white_label.sql`;
- identidade visual por tenant com nome, nome da Academy, três cores controladas, referência de logo e título de certificado;
- fallback automático para a marca iFarm quando não existe configuração ativa;
- validação de cores apenas em `#RRGGBB`;
- `logoRef` limitado a HTTPS ou referência relativa da própria Academy;
- nenhum campo de CSS/HTML arbitrário;
- domínio white label registrado como `pending`;
- domínio só pode ser marcado `verified` por `ifarm_admin` com referência/evidência externa registrada;
- nenhuma operação DNS automática;
- somente domínio verificado pode ser primário;
- hostname único para evitar roteamento ambíguo entre tenants;
- catálogo em modo `all_tenant_courses` ou `selected_courses`;
- seleção e destaque de cursos tenant-aware;
- catálogo acadêmico e marketplace respeitando o escopo configurado;
- endpoint de contexto runtime da marca;
- workspace exibindo o nome da Academy configurada;
- área administrativa `White Label` com prévia, marca, domínio e catálogo;
- certificado novo preservando `brand_snapshot_json` imutável;
- certificado público renderizando a marca preservada no momento da emissão;
- certificados antigos sem snapshot continuam usando fallback iFarm;
- fixture D1-compatible e gate próprio no CI;
- versão `0.36.0`.

## Imutabilidade de certificados
Uma alteração futura de nome, logo ou cores do tenant não reescreve certificados já emitidos. O certificado guarda o snapshot da marca vigente na emissão, assim como já preserva metadados acadêmicos e política de validade.

## Domínio
Esta release registra e governa o domínio, mas **não altera DNS**. A verificação depende de ação humana externa e somente depois é registrada por `ifarm_admin` com uma referência de evidência. Provisionamento Cloudflare/domínio continua fora desta release.

## Segurança
- sem CSS customizado;
- sem HTML customizado;
- sem `javascript:` em logo;
- hostname sem protocolo, porta ou caminho;
- domínio e catálogo segregados por tenant;
- catálogo não aceita curso de outro tenant;
- default iFarm permanece operacional quando White Label não está configurado.

## Limites intencionais
- upload dedicado de logo não é implementado nesta release; usa referência segura;
- DNS/SSL não são provisionados;
- e-mail transacional white label ainda não é customizado;
- app móvel/PWA por marca não é gerado separadamente;
- contratos comerciais de white label permanecem fora do código.

## Governança
- destino: `develop`;
- nenhum deploy nesta release;
- `main` e produção permanecem intactos;
- nenhum secret, banco, domínio ou recurso de outro projeto é reutilizado.
