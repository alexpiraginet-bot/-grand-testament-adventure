# R12 — integração da jornada e primeiro NPC animado

13/11/2026. Alex pediu que Codex assumisse a continuidade. A branch
`codex/takeover-r12` parte de `b470f32`, preservando o trabalho de Claude na
PR #1. A PR #7 foi integrada nessa branch de Claude em `7d27546`; essa
integração intermediária ainda não representava publicação em produção.

## Escopo desta revisão

- Preservar Bíblia, jornada, epílogo, exploração livre, painel e controles.
- Integrar somente Simão, derivado do candidato rigado revisado na R11,
  com idle/caminhada e perfis de textura de 1024 e 512 pixels.
- Manter as correções RTX da R11: alto com profundidade opaca sem MSAA,
  Master com TRAA; tentativa SMAA rejeitada e não incorporada.
- Validar localmente, hospedar os novos binários fora do Git e conferir a
  publicação real. Não liberar com base apenas em build ou render estático.

## Responsabilidades e evidências

Um agente cuida do runtime, um dos derivados/carregador e outro dos testes
de navegador. O integrador revisa, faz build, confere imagens e publica.
Arquivos de responsabilidade exclusiva evitam edição simultânea.
`NPC-INTEGRACAO-R12.md`, `NPC-ASSETS-R12.md` e `QA-R12.md` descrevem os resultados
e seus limites. Evidências privadas ficam em `shots/` e `assets-src/r12/`;
não são publicação automática de Reels.

Uma consulta auxiliar ao Gemma local gerou hipóteses de QA: 143 tokens de
entrada e 671 de saída, 26,76 segundos totais. A resposta não foi usada como
prova. Não houve nova geração Tripo, compra de créditos ou cobrança de API.

## Hospedagem dos assets

O acesso da CLI Vercel foi recuperado usando o repositório de certificados
do Windows (`NODE_USE_SYSTEM_CA=1` somente no processo). Não se desativou a
validação TLS nem se alterou autenticação. O projeto existente
`grand-testament-assets`, da equipe `lexprojects`, foi conferido antes de
qualquer publicação. A preparação preservou os 19 arquivos de modelos
anteriores, comparando os hashes locais com downloads públicos, e acrescentou
apenas dois GLBs Simão e seu catálogo. Nenhum `.env` foi copiado.

Assets publicados no deploy `dpl_4BF685t2G3vGWhd71ZBwVz2t7Qk8`, alias
`https://grand-testament-assets.vercel.app/`. Downloads anônimos conferiram
os 22 arquivos do diretório de modelos, 19.113.921 bytes, com hashes iguais
ao staging: 19 anteriores preservados, dois GLBs novos e seu catálogo.
O carregador também foi executado contra uma pasta vazia e baixou os dois
perfis, total de 2.688.540 bytes. Recibos em `ASSET-HOST-VERIFIED.json`
e `shots/r12-fresh-assets/RESULT.json`. Isso publica os assets; a publicação
do jogo é uma etapa separada, registrada após a QA.

Uso agregado da própria sessão atualizado em 13/11 às 20:26:33 UTC na
branch `metrics/development`, commit `6cefd685b0ec3b54e89f9028afb584b2fd7d1107`.
Horas estimadas e equivalência de API continuam separadas de pagamentos;
nenhum log privado, prompt ou consumo presumido de Claude foi publicado.

## Limites encontrados na revisão

A revisão de código identificou uma condição já presente em `main`: Créditos
e Nuvem suspendem áudio/NPC, mas não todo o relógio de missão. Uma fala pode
terminar atrás desses painéis. Não houve alteração desse comportamento na R12;
fica registrado para correção própria com teste das transições de painel.
A pausa pela Bíblia é conferida na QA desta entrega. Câmera em plano
cinematográfico é inspecionada nas cenas reais; validação de posição final
não prova todo arco intermediário para qualquer obstáculo do mapa.
