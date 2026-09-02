# iFarm Academy v0.21 — Conteúdo das aulas

## Objetivo
Transformar as aulas do Course Builder em unidades de conteúdo consumíveis pelo Student Player, mantendo segurança, isolamento por tenant e governança de publicação.

## Entregas
- `LessonContent` no domínio do Course Builder.
- Editor de conteúdo por tipo de aula.
- Persistência de `content_json` no D1.
- Renderização segura no Student Player.
- Texto com preservação de quebras de linha.
- Links externos HTTP/HTTPS com `noopener noreferrer`.
- Materiais PDF, apresentação e arquivo preparados para storage autorizado.
- Vídeo e áudio preparados para referência de provedor/streaming.
- Exercício, atividade prática, estudo de caso e simulação com instruções.
- Quiz e prova vinculados a uma política de avaliação publicada.
- Aula de avaliação não pode ser concluída manualmente; depende do resultado server-side.
- Publicação do curso bloqueada quando aula obrigatória não possui conteúdo mínimo.
- Testes unitários da normalização e validação de conteúdo.

## Segurança
- Não há `dangerouslySetInnerHTML`.
- URLs não HTTP/HTTPS são rejeitadas.
- O frontend não recebe gabarito de avaliação.
- Referências de storage/streaming são apenas metadados; nenhuma credencial é persistida em `content_json`.
- Curso, aula e conteúdo continuam segregados por tenant.

## Fora do escopo desta versão
- Upload físico de arquivos.
- Provisionamento de bucket/storage.
- Streaming real de vídeo.
- DRM ou URLs assinadas de mídia.
- Produção.

## Próxima versão sugerida
v0.22 — storage de materiais, contratos de upload, metadados de arquivo e preparação do streaming, mantendo o provedor reversível até a decisão final de infraestrutura.
