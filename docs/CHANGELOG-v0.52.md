# CHANGELOG — v0.52.0

## Added
- smoke test de STAGE via `npm run stage:smoke`;
- contrato offline do smoke no CI;
- testes da política de readiness por ambiente;
- runbook `STAGE-HOMOLOGATION-v0.52.md`.

## Changed
- STAGE/PRODUCTION agora exigem iFarm Core configurado para `/api/readiness=ready`;
- `.env.example` atualizado para a versão e fluxo de homologação atuais;
- versão atualizada para `0.52.0`.

## Security
- `legacy_proxy` deixa de ser condição suficiente de readiness em STAGE/PRODUCTION;
- Bearer de homologação é opcional, recebido por ambiente e nunca impresso.
