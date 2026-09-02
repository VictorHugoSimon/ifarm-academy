# iFarm Academy v0.30 — Instrutores, Qualificações e Responsabilidade Técnica

## Objetivo
Criar governança auditável para instrutores, revisores e responsáveis técnicos sem transformar uma declaração cadastral em presunção automática de habilitação legal.

## Entregas
- cadastro de instrutor reutilizando `userId` do iFarm;
- qualificações de graduação, formação técnica, registro profissional, certificação, experiência e outras;
- status `declared`, `verified`, `rejected` e `expired`;
- instituição, área, conselho, registro, região, emissão, validade e referência de evidência;
- vínculo do instrutor ao curso nos papéis de autor, instrutor, revisor e responsável técnico;
- responsável técnico exige qualificação verificada, confirmação humana explícita e justificativa;
- APIs administrativas tenant-aware;
- auditoria das verificações e dos vínculos ao curso;
- nova área `Instrutores` no workspace da Academy;
- migration `0016_instructor_governance.sql`;
- fixture D1-compatible de governança técnica e isolamento por tenant;
- gate próprio no CI.

## Regra de segurança regulatória
A Academy não declara automaticamente que uma pessoa está legalmente habilitada a ministrar, revisar ou responder tecnicamente por determinado treinamento. O sistema registra evidências e decisões humanas; a adequação à norma aplicável continua dependente de validação técnica/jurídica.

## Responsabilidade técnica
Para gravar um vínculo com papel `technical_responsible`, o backend e o banco exigem:
1. perfil de instrutor ativo no mesmo tenant;
2. qualificação vinculada ao instrutor;
3. qualificação em status `verified`;
4. confirmação humana de adequação ao curso;
5. justificativa registrada;
6. trilha de auditoria.

## Multi-tenant
Instrutor, qualificação, curso e responsabilidade técnica são sempre resolvidos dentro do mesmo tenant. Triggers bloqueiam referências cross-tenant.

## Impacto no LMS
A camada prepara a publicação de cursos regulatórios, certificados com responsável correto, matrizes de compliance, NR-31, conteúdos agro, pecuária e ambiental sem duplicar identidade do iFarm Core.

## Governança de release
- versão: `0.30.0`;
- destino: `develop`;
- nenhum deploy nesta release;
- `main` e produção permanecem intactos;
- nenhum secret ou recurso de outro projeto é reutilizado.
