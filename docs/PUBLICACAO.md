# Publicação — 12/11/2026

- Jogo público: https://grand-testament-adventure-lexprojects.vercel.app/
- Código: https://github.com/alexpiraginet-bot/-grand-testament-adventure
- Equipe Vercel: `lexprojects`; projeto `-grand-testament-adventure`.
- Projeto: `prj_mWgfsn6p0ZeLlhMXotPGpCFlzDcT`.
- Primeira publicação verificada: commit `293fc8415e9aad171775ae8728a25fbcf4c9004c`;
  deploy `dpl_8NaF1kSv5h1aRdqKQqYPHrjLra5h`, produção, estado `READY`.
- Vite, Node 24, `npm ci --ignore-scripts`, `npm run build`, saída `dist`.
- A conexão GitHub já existia no projeto criado por Alex. O primeiro push para
  `main` disparou o deploy automaticamente; não foi criado outro projeto.

## Acesso

O projeto inicialmente exigia login Vercel no domínio de produção.
Como Alex pediu publicação pública, a proteção foi ajustada para
`prod_deployment_urls_and_all_previews`: domínio principal público, prévias e URLs
individuais de deploy protegidas. Requisição anônima ao domínio principal retornou
HTTP 200, título `Grand Testament Adventure`, sem redirecionamento para login.
Referência: [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

## Evidência executada

- SHA de `main` conferido por `git ls-remote` e pela API pública do GitHub.
- Build local e build Vercel passaram: TypeScript, **28/28 testes** e Vite.
- `tools/check_feedback.mjs` contra produção: passou em **1280×800** e **390×844**;
  validação, consentimento, pausa, teclado, joystick, fechamento, foco, rascunho
  preservado e URL da issue correta. Navegação externa interceptada; nenhuma issue
  de teste foi publicada.
- `tools/shots.mjs` contra produção: as três missões chegaram a `MISSÃO CONCLUÍDA`
  nos dois viewports, com Simão, André, Tiago e João seguindo o personagem.
  O teste anda um trecho com teclado e usa teletransporte/ação pelos ganchos `?debug`
  para exercitar as missões. Não é uma caminhada manual do percurso inteiro.
- Chrome no PC, WebGPU. Amostra final do episódio: aproximadamente **100 FPS** no
  viewport desktop; **35–100 FPS** no viewport móvel com DPR 2. Emulação no PC não
  mede desempenho de um celular físico.
- Resource Timing no teste do formulário: cerca de **581 kB transferidos** com cache
  novo. Corpos descomprimidos registrados no teste do episódio: **1.375.211 bytes**.
  O campo legado `transfer` de `tools/shots.mjs` pode usar o corpo descomprimido
  quando não existe `Content-Length`; não deve ser usado como tráfego real.
- A consulta de logs Vercel com nível `error` na última hora não retornou registros.
  Isso não substitui os erros HTTP/avisos de assets abaixo nem monitoramento contínuo.

Evidências locais (fora do Git): `shots/publicacao/build.log`,
`shots/publicacao/feedback/`, `shots/publicacao/episodio/` e
`shots/publicacao/runtime-errors.jsonl`.

## Limitações vigentes

- **Modelos provisórios:** o GLB do herói não está no deploy Git. As tentativas de
  `models/heroi.glb` e `.glb.json` retornam 404 e o jogo usa as formas simples.
  O console registra esse fallback. As 20 malhas Tripo estão em `assets-src/tripo-r1/`
  no PC, fora do Git público, aguardando integração e hospedagem apropriada.
- O save local funciona; a cópia na nuvem continua desligada. Nenhuma migração do
  Supabase foi aplicada nesta publicação.
- Feedback abre a composição de issue; o jogador precisa de conta GitHub e confirma
  a publicação lá. Ainda não há endpoint de envio automático.
- DLSS 5 não foi demonstrado funcionando; veja `DLSS5-STATUS.md`.
- A sessão local do Claude Code ainda não iniciou por falta de autenticação na
  conta paga correta. O código, malhas e handoff estão prontos para ela assumir.
- Não houve teste em celular físico, prova com leitor de tela, benchmark prolongado
  ou integração de monitoramento de erros. Drains não foram inspecionados.

## Próxima revisão

Partir da `main` atual, criar `claude/...` ou `codex/...` e abrir PR em rascunho.
Integrar o herói com seu esqueleto original e o clip `walk`; preservar as licenças
separadas das malhas. Os outros humanos ainda precisam de rig e os clipes
`idle`, `run`, `beckon` não foram entregues. Não confundir a publicação deste
protótipo com a entrega visual final.
