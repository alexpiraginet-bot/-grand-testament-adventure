# Publicação — 12/11/2026

## R12 — jornada e Simão, publicação verificada em 13/11/2026

As PRs #7 e #8 foram integradas à branch de Claude; a PR #1 foi integrada
em `main` no commit `81f4d2afae42e0eb7274ec20cf99986b58dcc256`.
Deploy de produção `dpl_9ALGJPaPvZbighm2D5BtUPiigRuk`, estado Ready,
projeto existente `-grand-testament-adventure`, equipe `lexprojects`.

- Endereço público: https://grand-testament-adventure-lexprojects.vercel.app/?release=simao-r12
- HTTP anônimo 200, sem login. Bundle `index-D5_CuN9U.js`, SHA-256
  `ac4f907ca2243bd165282c903cbbf74e7edbe1ef41f0cd2588d5d56e80fb289b`,
  contém o commit publicado. Os dois GLBs Simão no domínio do jogo tiveram
  tamanho e hash conferidos contra o catálogo.
- Build/TypeScript e 301 testes CPU passaram. A rodada local teve 199
  verificações nomeadas, Chrome desktop/móvel e WebKit, com falhas injetadas,
  painel e 56 PNGs. Detalhes e tentativas anteriores em `QA-R12.md`.
- Smoke público: Chrome 1280×800 e 390×844, 18 verificações por contexto;
  14 assets principais, duas espécies, Simão/idle, E/toque, legenda literal
  e único seguidor real. Sem erros inesperados. Seis capturas, relatório e
  manifesto em `shots/r12-public-smoke-r1/` (arquivo privado do projeto).
- Analytics foi interceptado no smoke para não gerar visitas artificiais.
  O script real foi consultado separadamente: HTTP 200, 4.522 bytes. Isso
  comprova disponibilidade do script, não contagem recebida no painel Vercel.
- Assets externos: deploy `dpl_4BF685t2G3vGWhd71ZBwVz2t7Qk8`; 22 arquivos
  conferidos por hash, incluindo os 19 anteriores preservados. GLBs continuam
  fora do Git e separados da licença MIT do código.

As capturas são gameplay real com posicionamento de QA, sem alegar percurso
integral caminhado. Móvel emulado e WebKit Windows não validam iPhone físico.
Simão tem somente idle/caminhada; os demais NPCs aguardam rig e revisão.
Esta entrada identifica a publicação funcional testada. Commits posteriores
exclusivamente documentais podem alterar o carimbo do bundle sem mudar o jogo.

## Publicação visual R1 conferida em produção

- Commit `6e35ff1534d4d17aa082d1d03113d997b51da801` em `main`;
  deployment `dpl_AHxLfGbMGUfi9VSjb3URSK47Uxmb`, estado `READY`, fonte Git conferida.
- Endereço público sem autenticação: https://grand-testament-adventure-lexprojects.vercel.app/
- Herói animado, treze malhas de cenário, 131 construções, 30 pátios e 48 jarros.
  Contagens vêm do gerador de cenário, não são estimativas históricas de população.
- 34 testes/build local; o build Vercel também terminou. Recursos Tripo baixados e
  verificados no build; nenhum GLB foi colocado no Git público.
- Teste **no domínio público**: WebGPU desktop e viewport móvel com toque, WebGL2
  desktop, 14/14 assets, nenhum erro de página, aviso de console ou HTTP registrado.
- A amostra de integração pública registrou 82,4–94,4 FPS desktop WebGPU,
  60,9–93,9 no viewport móvel e 78,7–94,2 em WebGL2. Todos rodaram neste PC.
- As três missões completaram nos dois viewports, com os quatro seguidores;
  o teste usa teleporte/ação de depuração nas missões. O corredor de cenário
  também passou na amostragem real de colisão.
- Evidências locais ignoradas pelo Git: `shots/production-r1-integration/`,
  `shots/production-r1-world/`, `shots/production-r1-episode/`.

Os NPCs continuam provisórios sem rig. Telefone físico, nuvem e DLSS permanecem
pendentes. A composição ainda está abaixo do realismo da imagem-alvo de Alex.

## Histórico da primeira publicação

Atualização visual autorizada depois desta primeira publicação: integração R1 documentada em
[TRIPO-RUNTIME-R1.md](TRIPO-RUNTIME-R1.md). O herói e treze malhas de cenário substituem os respectivos
provisórios. O relato abaixo preserva as evidências da primeira publicação, que ainda usava formas simples.

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

## Limitações da primeira publicação (registro histórico)

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

## Próxima revisão prevista naquele momento

Partir da `main` atual, criar `claude/...` ou `codex/...` e abrir PR em rascunho.
Integrar o herói com seu esqueleto original e o clip `walk`; preservar as licenças
separadas das malhas. Os outros humanos ainda precisam de rig e os clipes
`idle`, `run`, `beckon` não foram entregues. Não confundir a publicação deste
protótipo com a entrega visual final.
