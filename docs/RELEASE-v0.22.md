# iFarm Academy v0.22 — Storage de materiais

## Objetivo
Adicionar um fluxo real e seguro para materiais de aula sem acoplar o domínio a credenciais ou recursos de outro projeto.

## Entregas
- tabela `academy_material_assets` no D1;
- metadados de arquivo segregados por tenant, curso e aula;
- reserva de upload server-side;
- upload por endpoint autenticado;
- entrega autenticada de materiais ao aluno matriculado;
- remoção auditável enquanto o curso estiver em `draft`;
- chaves de objeto opacas e segregadas;
- validação de nome de arquivo, extensão, MIME e tamanho;
- limite inicial de 100 MB por material;
- formatos iniciais: PDF, TXT, CSV, JPG/JPEG, PNG, WEBP, DOC/DOCX, XLS/XLSX, PPT/PPTX e ZIP;
- `ACADEMY_STORAGE` como binding opcional de storage;
- exemplo de binding Cloudflare R2 para STAGE, sem provisionamento real;
- editor da aula conectado ao fluxo de upload;
- Student Player usando `/api/materials/:id` para materiais internos;
- testes unitários das regras de storage;
- migration `0010_material_assets.sql`.

## Segurança
- nenhuma credencial é salva no frontend, D1 ou `content_json`;
- upload só é permitido para curso em `draft`;
- aluno precisa estar matriculado no mesmo tenant para acessar o arquivo;
- MIME precisa ser compatível com a extensão;
- nomes de arquivo são normalizados contra path traversal;
- `Content-Disposition` e `X-Content-Type-Options` são definidos na entrega;
- recursos de outros projetos não são reutilizados.

## Infraestrutura
A implementação aceita um binding `ACADEMY_STORAGE`. O exemplo utiliza R2 por alinhamento com Cloudflare, mas o domínio continua referenciando somente `academy_storage` + `providerRef`, permitindo troca futura do provedor.

## Fora do escopo
- criação real do bucket;
- streaming de vídeo;
- multipart upload para arquivos muito grandes;
- CDN pública;
- produção.

## Próxima versão sugerida
v0.23 — streaming/media adapter, retomada real de vídeo e contrato de provider de mídia.
