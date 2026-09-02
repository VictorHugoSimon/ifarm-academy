# iFarm Academy v0.23

## Mídia e retomada

Esta versão adiciona um contrato de mídia desacoplado do fornecedor e um player HTML5 para vídeo e áudio.

Entregas:
- endpoint autenticado `/api/media`;
- validação de tenant, curso, aula e matrícula;
- reprodução direta somente por URL HTTP/HTTPS autorizada;
- referências de fornecedor permanecem opacas até existir adapter ativo;
- URLs brutas de mídia não são expostas no payload geral do curso;
- retomada por `lastPositionSeconds`;
- salvamento periódico de progresso e salvamento ao pausar;
- conclusão automática ao terminar a mídia;
- sem conclusão manual para vídeo/áudio no fluxo server-side;
- posição de retomada independente da duração estimada da aula;
- limite defensivo de 24 horas para posição;
- testes do contrato de mídia.

Nenhuma credencial de streaming foi adicionada e nenhum fornecedor foi provisionado. `main` e produção permanecem fora desta versão.

Próxima camada: certificado público completo, validação e QR Code.
