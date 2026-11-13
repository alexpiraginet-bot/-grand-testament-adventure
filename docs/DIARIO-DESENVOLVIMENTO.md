# Diário de desenvolvimento — Grand Testament Adventure

Pedido de Alex: registrar cada melhoria para depois construir uma série de Reels.
Este diário guarda fatos verificáveis, decisões e limitações. Não é roteiro aprovado
nem autorização de publicação social. Código publicado e episódio de Reel publicado
são etapas diferentes.

## Linha do tempo comprovável

### 13/11/2026 — abertura e urgência Safari

Relato: iPhone 17 Pro Max/Safari encerrando repetidamente a página. Worktree
isolada `codex/ios-startup-r7`, base `016079d`, preservando R7 de seguidores/cais
e a PR paralela do Claude. Início da prioridade por volta de 13:00 UTC (estimado).
Arte HTML com cruz/progresso real, limites de textura antes do upload, fila móvel,
cancelamento de falhas e recuperação manual. Após visualizar, Alex mudou e
aprovou a identidade marfim/bordô/dourado em toda a interface fora do gameplay.
Build 109/109; sete cenários de carregamento Chrome e três tamanhos de painel
passaram. Medições e limites em [ABERTURA-SAFARI-R7.md](ABERTURA-SAFARI-R7.md).
Teste no iPhone real ainda depende do proprietário; imagens-conceito não são
captura de gameplay. Registros/tokens continuam pelo coletor da sessão autorizada,
sem inferir consumo das outras sessões. Publicação solicitada explicitamente.

As datas abaixo são as datas de autoria armazenadas no Git, com seu fuso original.
Não representam duração do trabalho, hora de cada captura nem comprovação nova de
um teste antigo. Handoffs históricos são relatos daquela entrega.

| Data Git | Entrega / commit | O que foi registrado | Evidência e limite |
|---|---|---|---|
| 2026-11-12 21:26:09Z | `1ad6154` — save em nuvem e exportação | Implementação de save/nuvem e contrato para outra engine | Histórico Git e `HANDOFF.md`; nuvem continuou desligada. Não é teste de DLSS. |
| 2026-11-12 21:36:21Z | `84443a7` — handoff da sessão de origem | Apelido e recuperação, continuidade do protótipo | `HANDOFF.md`; build/testes relatados pela sessão de origem, não repetidos aqui por este diário. |
| 2026-11-12 19:10:23−03:00 | `8bc56a0` — continuidade local | Preservação do projeto, pacote de malhas e licenças separadas | `HANDOFF-CODEX.md`, `ASSETS.md`; preparar arquivos não prova sessão Claude autenticada. |
| 2026-11-12 19:28:02−03:00 | `23870fb` — Construa conosco | Formulário de ideias/problemas e composição de issue GitHub | `docs/CONSTRUA-CONOSCO.md`, `shots/feedback/`; nenhum feedback fictício foi publicado. Jogador confirma no GitHub. |
| 2026-11-12 19:59:46−03:00 | `293fc84` — publicação inicial | Link público Vercel e conexão com o repositório correto | `docs/PUBLICACAO.md`, `shots/publicacao/`; cenário ainda usava formas simples. |
| 2026-11-12 20:09:01−03:00 | `917a69d` — evidência da publicação | Build/testes, acesso anônimo e limitações registrados | `docs/PUBLICACAO.md`; separar viewport móvel de telefone físico. |
| 2026-11-12 21:25:18−03:00 | `6e35ff1` — visual R1 | Herói Tripo com rig nativo, 13 malhas de cenário, vila e caminhos | `docs/TRIPO-RUNTIME-R1.md`; `shots/production-r1-{integration,world,episode}/`. 14 assets e três missões verificados naquela versão; NPCs provisórios. |
| 2026-11-12 21:41:08−03:00 | `424a096` — visual R2 | Céu fotográfico CC0, água rasa, reflexos e exposição | `docs/CAFARNAUM-CENARIO.md`; `shots/production-r2-integration/`, incluindo `PUBLICACAO-VERIFICADA.json`. 34 testes no build daquela revisão. |
| 2026-11-13 06:48:33−03:00 | `4d7cf86` — visual e jornada R3 | Rua menos regular, decoração orientada pela fachada, tecido/pregas dos NPCs e dicas contextuais de jornada | `shots/r3-final-*` e `shots/production-r3-integration/PUBLICACAO-VERIFICADA.json`; deploy público conferido READY. Sem NPCs Tripo rigados ou teste em telefone físico. |
| 2026-11-13 07:35:41−03:00 | `08785fe` — R4 publicada | Água, Colabore/Pix, prestação de contas e medição de esforço; fauna própria em preparação | 81 testes no build, QA público em WebGPU/WebGL2 e apoio nos dois viewports. Malhas Quaternius rejeitadas, sem fauna ativa entregue. |
| 2026-11-13 08:08:53−03:00 | `3d3f9c8` — R5 publicada | Metas revisáveis, candidatura voluntária e plano público | 92 testes e QA público de comunidade/apoio; rascunhos interceptados, sem candidatura ou pagamento enviados. |
| 2026-11-13 08:54:42−03:00 | `3ac7854` — R6 publicada | Entrada/Colabore cristalinos, mapa de visão geral e convite no rig real | 97 testes e seis suítes públicas; mapa sobre os mesmos 3.072 m. Desembarque posterior dos discípulos ainda pendente. |

Os instantes UTC das duas primeiras linhas antecedem a continuidade local
(18:26 e 18:36 em UTC−3). A diferença de fuso não deve virar uma falsa ordem na edição.

### Evidência local R3, antes da publicação

O relatório `shots/r3-final-build.log` registra **39 testes passando**. A integração
em `shots/r3-final-integration/report.json` registra 14 assets e zero erros de página;
amostra de FPS: desktop WebGPU 87,3–94,7, viewport móvel emulado 47,7–93,9 e WebGL2
89,8–95,5. Transferência de recursos nessa execução local: 17.887.926 bytes.
O cenário contém 158 casas, 20 pátios, 89 jarros, 69 toldos e oito segmentos de
caminho; são contagens do cenário artístico, não demografia histórica.
Esses dados não substituem a conferência pública posterior nem um telefone físico.

### Incremento Claude — HUD móvel (13/11/2026, sobre `4d7cf86`)

Autoria: sessão Claude Code na nuvem, branch `claude/quirky-hamilton-bt0y7w`, PR em rascunho.
Commit e deployment de produção: **pendentes** até revisão/merge; não presumir publicação.

- **Problema observado:** no celular o joystick só aparecia onde o dedo tocava e o botão de ação
  era um círculo com texto; `docs/ALTO-NIVEL.md` pedia joystick sempre visível e ícone de mão.
  Na paisagem 844×390, o botão de ação (posição anterior) cobria a linha "MARCOS 1:16-20" da placa.
- **Mudança:** joystick em repouso fixo no canto inferior esquerdo. Toque perto dele o conduz
  a partir do centro fixo; toque longe, ainda no lado esquerdo, traz a base para baixo do dedo
  durante o gesto e ela volta ao soltar. Raio do controle lido do layout. Botão com mão em SVG
  desenhado no código (sem emoji, `aria-hidden`), nome acessível = verbo da ação ("Chamar").
  Na paisagem, joystick e botão descem às bordas; em telas deitadas de até 340 px de altura
  o joystick fica com 96 px e a linha de referência da placa é omitida (a referência segue na legenda).
- **Arquivos:** `src/joystick.ts` (novo), `src/input.ts`, `src/hud.ts`, `src/hud.css`, `index.html`,
  `test/joystick.test.ts` (novo), `tools/check_touch.mjs` (novo), README e este diário.
- **Fontes/licenças:** nenhuma fonte externa nova; o desenho da mão é código deste repositório (MIT).
- **Evidência:** build completo com assets verificados por SHA-256 e 41/41 testes. `tools/check_touch.mjs`
  em 390×844, 844×390 (toque) e 1280×800, todos sobre `4d7cf86`: controle fixo e recentrado andam, soltar para o herói,
  `AnimationMixer` real com `walk` ≥ 0,9 de peso e ossos mudando, toque real no botão da mão
  dispara a fala, sem sobreposição com missão, radar, links e legenda, zero erros de página/HTTP.
  Varredura de layout de 320×568 a 932×430 em retrato e paisagem. Capturas e relatório em
  `shots/touch-r1/` (fora do Git).
- **Limites:** Chromium sem GPU (WebGL2 por software, cerca de 0,5–1 fps); FPS dessa máquina
  não representa jogo nem telefone. Viewport emulado não é celular físico. Em 568×320 o botão
  encosta (0 px) na última linha da placa do radar, sem cobri-la.
- **Possível Reel:** antes/depois do HUD de celular. Ainda sem gravação de vídeo nem aprovação.

### Sessão Claude na nuvem de 13/11/2026 — todas as mudanças e o consumo

Branch `claude/quirky-hamilton-bt0y7w`, PR em rascunho
[#1](https://github.com/alexpiraginet-bot/-grand-testament-adventure/pull/1), base `4d7cf86`.
Nada desta sessão está em produção até a PR ser revisada e integrada.

**Mudanças, na ordem dos commits:**

| Commit | O que mudou | Evidência | Limite |
|---|---|---|---|
| `a21d215` | Joystick sempre visível no celular (`src/joystick.ts`), botão de ação com mão em SVG provisório, paisagem sem cobrir a placa do radar, `tools/check_touch.mjs` | 41/41 testes no build com assets; `check_touch` em 390×844, 844×390 e 1280×800 sobre `4d7cf86`; varredura de layout 320×568 a 932×430 | viewport emulado; ícone provisório |
| `feb946b` | Diário do HUD, README, tabela de referência; pedido de arte do ícone ao Codex/Higgsfield em `ASSETS.md` | — | — |
| `4a61f47` | Mesma cena medida (`src/bench.ts`, `?bench`, `tools/bench.mjs`) e pós-processamento sob medição (`src/postfx.ts`, `?fx=alto/master`, desligado por padrão); `docs/GRAFICO-MASTER.md` | 44/44 testes; bench roda as variantes e grava imagens | sem GPU aqui: nenhum FPS vale para o jogo |
| `87ef481` | Registro da repetição 1280×800 no diário | relatório `shots/touch-r1/report.json` (local) | — |
| `dab8a9f` | Correção: o GTAO precisa de um amostrador de normal; nomes `packNormalToRGB`/`unpackRGBToNormal` da r186 | antes: `fx=alto` com 2 erros de console (`normalNode.sample is not a function`); depois: `alto` e `master` percorrem a rota com 0 erros | a oclusão não funcionava no primeiro commit |
| `d0eeb85` | Plano cinematográfico nas falas (`src/cinematic.ts`): dois planos escolhidos ao começar a fala, faixas de cinema, HUD recolhido, sai ao andar, respeita movimento reduzido | 48/48 testes (4 novos); conferência de navegador registrada na PR | conferido só em viewport emulado |
| `fbaeb0b` | Barra de qualidade AAA de mundo aberto, pilar por pilar, sem copiar nada da Rockstar (título retitulado depois, ver `docs/PLANO-AAA.md`) | — | plano, não entrega |
| `2a8a8e1` | Conferências determinísticas em renderizador lento: captura atômica do plano, `__gta.freeze()` (só `?debug`, segura o relógio da história), gesto reto no joystick, bench espera 24 quadros por foto | 48/48 testes; repetição da conferência registrada na PR | ver "Tentativas" abaixo |
| (este registro) | `tools/session_usage.py`: soma do consumo de tokens pelo transcrito e valor equivalente em preço de API | executado nesta sessão | ver nota de valor |
| `906ff83` | Correção do diagnóstico do `fx=master`: o TRAA derruba a água transparente na maioria dos quadros; `master` bloqueado | curva de cor quadro a quadro; duas hipóteses refutadas e uma isolada (ver "Tentativas") | causa exata em aberto |
| `072ca70` | A mira do plano cinematográfico acompanha o grupo enquanto os chamados andam até Jesus; `framed` exige os três no quadro; caminhadas do teste partem do corredor da missão | `check_touch` verde em 390×844, 844×390 e 1280×800: plano entra, 3/3 no quadro, sai ao andar (PC), 0 erros, 17.897.302 bytes servidos localmente | viewport emulado; NPCs ainda são formas provisórias |
| `bbefb20` | Registro da conferência verde do plano cinematográfico | ver linha acima | — |
| `2e3211c` | Plano AAA verificado (R4–R17, `docs/PLANO-AAA.md`) e correções de registros apontadas por ele | revisão adversarial do plano | plano, não entrega |
| `7cecdfc` | Build carimbado com o commit (`src/build-info.ts`, créditos) e `tools/bench.mjs` com máquina, teto de quadros, cache quente e rede (`BENCH_NET=4g`) | relatório de `2e3211c` (árvore alterada): 2ª visita com cache quente 11.931 bytes contra 17.901.187 na 1ª | perfil de rede é deste repositório, não medição de operadora |
| `68c4939` | `tools/compare_bench.mjs`: compara dois relatórios plano a plano e recusa máquina, tela ou commit diferentes | testes de carimbo estrito | — |
| `09963bd` | Testes-guarda: orçamento das malhas, rig provisório fora do herói, nenhum binário rastreado | 83/83 testes em `b471dfb` | — |
| `40b9f83` | Diário de sessão local (`src/session-log.ts`): recargas, quedas, erros, só nesta aba | testes com valores literais | base do teste de 10 min no celular, ainda não feito |
| `e703d01` | Tempo de GPU/CPU por quadro e estimativa de memória de textura no bench | relatório: GPU "n/d" com motivo (SwiftShader sem `EXT_disjoint_timer_query_webgl2`), CPU p95 0,8 ms, textura 1.204 MB pelo renderer contra 1.010,8 MB estimados (49 RGBA8) | software; nenhum tempo vale para o jogo |
| `af77202` | Correções das revisões adversariais das peças do R4 | revisão + testes | — |
| `b471dfb` `5bca3b3` `cd06f51` | Diário de sessão, tempos e memória ligados ao jogo; etapas da prova de sessão registradas; resumo do bench corrigido | 83/83 testes | — |
| `a47dbb5` | Prova do diário de sessão no navegador terminada | `{"ok":true,"loads":3,"uncleanEnds":1}`: recarga limpa não acusa nada; queda do renderizador (CDP `Page.crash`) é achada na recarga | Chromium emulado, não celular |
| `02781cd` | Variantes de visual sob medição (`src/look.ts`): `?tm=`, `?exp=`, `?atmo=1`, `?shadow=csm` | 88/88 testes; imagens A/B na base antiga (ver abaixo) | desligadas por padrão |
| `08d51c1` | `?ao=indireta`: GTAO só na luz ambiente/indireta (pré-passe de profundidade/normal, `builtinAOContext` da r186) | 89/89 testes | custa um segundo passe de geometria |
| `c1cb55a` `8b9f00d` | `?cam=mola` (`src/camera.ts`) e `tools/check_camera.mjs` | 95/95 testes | — |
| `af033e9` | Merge da `main` (`c664f9f`, inicialização segura no iOS e R4–R6 do Codex) | 165/165 testes, `tsc` limpo, build com assets; prévia Vercel pronta | ver "Integração com a main" |
| `fd65c11` | Mapa/Colabore/Créditos clicáveis durante a fala; arrastar o olhar sai do plano cinematográfico | achado pelo `check_hero_gesture` do Codex no build integrado | — |
| `9c05537` | Correções da revisão adversarial (10 achados confirmados, ver abaixo) | 167/167 testes; simulação do `CSMShadowNode` real | — |
| `cecfa1e` | Atividade estimada no `tools/session_usage.py`; resultados das variantes no roteiro gráfico | conferência da união de intervalos | — |
| `b7f62b8` | A barra de links elevada deixa o toque passar para a mão e o joystick; painéis voltam depois das faixas de cinema | achado pelo `check_touch` deitado (844×390) no build integrado | reconferência no navegador em andamento |
| `caf7244` | Merge da `main` (`ea39f63`, fauna própria R8 e áudio de natureza do Codex) | testes e build com assets; suítes de carga, toque e fauna rodadas no build integrado (ver "Fim da tarde") | fauna opcional expira aos 30 s reais no renderizador por software daqui |
| `14ce1b1` `6b339be` `740c25a` `1e4779b` `d0c055d` `cf7c4a7` `8b8af85` | Mundo aberto depois do episódio: "Continuar explorando", volta a Cafarnaum com a oração literal de Marcos 1:21 ("Eles entraram em Cafarnaum"), cinco lugares para encontrar (posições dos dados do mundo), aviso a 40 m do limite da região, "Explorar a região" no cartão inicial, radar aponta o lugar mais próximo por encontrar | testes de `freeroam.ts` e `places.ts`; `tools/check_roam.mjs` | conferência de navegador final na árvore conciliada com a R9 |
| `0f5e9fe` | Medidas das variantes de visual na base integrada, em `docs/GRAFICO-MASTER.md` | `shots/merge-r3/bench-*` (local) | sem GPU: imagens e draw calls, nenhum FPS |
| `b0dd3d3` `fe8d67b` `c39170f` `a66b232` | Bíblia do jogo (ideia de Alex): leitura em ordem do Bíblia Conectada (10 momentos, 26 versículos literais da BLIVRE, SHA-256 da fonte conferido), a passagem jogada no seu lugar da ordem, e a linha da missão selada até a leitura. A Bíblia orienta, não tranca o mundo (confirmado por Alex) | `test/bible.test.ts`; `tools/build_bible.py --check`; `tools/check_bible.mjs` passou em 390×844 e 1280×800 sobre `a66b232` (17:54 UTC) | viewport emulado, renderizador por software; repetição na árvore conciliada com a R9 em andamento |
| `30e8820` | Painel de devs (`painel.html`, link no rodapé do Colabore): commits por autoria, coautoria e conta, por dia, PRs, issues e contas de fora, lidos da API pública do GitHub; acessos declarados como não medidos | 6 testes sobre respostas gravadas deste repositório; `tools/check_painel.mjs` em 1280×800 e 390×844, recusa do GitHub e nova tentativa | sem fonte de medição de acessos: decisão de Alex |
| `6878694` | Merge da R9 do Codex (`4438ba7`, PR #5): sem NPCs provisórios. O plano cinematográfico passa a enquadrar o herói e o lugar do encontro; ninguém é desenhado na volta à vila; o aviso de cena em desenvolvimento aparece também no epílogo | 252/252 testes, `tsc` limpo, build | conferência de navegador em andamento neste registro |

Fora do Git: ambiente de nuvem pessoal "Grand Testament + Bíblia Conectada" criado com aprovação do Alex,
liberando só `grand-testament-assets.vercel.app` e `grand-testament-adventure-lexprojects.vercel.app`.
A PR #1 foi aberta como rascunho. Nenhuma issue, cobrança, migração de banco ou deploy de produção foi feito.

**Tentativas que falharam, com causa raiz (material honesto para os Reels):**

1. `fx=alto` e `fx=master` no primeiro commit (`4a61f47`) davam 2 erros de console e rodavam **sem oclusão**: o GTAO
   amostra a normal com `.sample(uv)` e recebeu um valor já desempacotado. Corrigido em `dab8a9f`.
2. A conferência do plano cinematográfico falhou três vezes. Hipóteses testadas uma de cada vez: obstáculos sem
   altura (falsa: todos têm `top`), qualidade alta (falsa: o plano entra também), corrida no teste (verdadeira: o
   estado era lido numa segunda chamada, depois de a fala de ~7 quadros acabar). Corrigido em `2a8a8e1`.
3. Uma repetição falhou antes, na caminhada: o herói parou num jarro da viela porque o gesto empurrava levemente para
   a direita. Colisão parar a animação é o jogo funcionando; o teste passou a empurrar reto.
4. As fotos do bench em `fx=master` saíram sem a água do raso. **Primeiro diagnóstico (errado, registrado no commit
   `2a8a8e1`):** histórico do TRAA atravessando o corte de câmera. A curva de cor quadro a quadro (água G>R, chão R>G)
   desmentiu: a água fica ausente na maioria dos quadros e aparece em quadros isolados, mesmo 24 quadros depois.
   Testado e refutado: reiniciar o histórico do TRAA no corte (`setSize`, duas variações) e entregar cor com alfa 1.
   Isolado: sem TRAA (com velocidade no MRT e sem MSAA) a água aparece. **Bloqueio aberto:** o `master` (TRAA) não
   desenha direito superfícies transparentes como a água; `fx=master` não deve virar padrão até resolver.

**Bench neste contêiner (sem GPU, Chromium com WebGL 2 por software, 640×400, `tools/bench.mjs` às 10:26 UTC):**
draw calls por plano (vila, viela, margem, pescadores, barco, panorama) — `fx=off` 174/78/174/203/123/41,
`fx=alto` 187/91/187/216/136/54, `fx=master` 189/93/189/218/138/56; memória de textura informada pelo renderer
1.206 / 1.210 / 1.218 MB; zero erros. Tempos de quadro dessa execução não valem para o jogo (software, ~0,5 fps).

**Consumo de tokens desta sessão (retrato no momento deste registro, 8 arquivos; respostas de 2026-11-13T09:39:24.792Z a 2026-11-13T11:02:47.196Z):**

| grupo | modelo | velocidade | respostas | input | output | cache_read | cache_write_5m | cache_write_1h | cache_write_sem_ttl | usd_equivalente_api |
|---|---|---|---|---|---|---|---|---|---|---|
| principal | claude-opus-5-5 | standard | 197 | 413 | 214.524 | 74.495.859 | 0 | 560.883 | 0 | 23.68 |
| workflow | claude-opus-5-5 | standard | 294 | 588 | 313.323 | 56.838.981 | 1.393.382 | 0 | 0 | 24.60 |

Total equivalente em preço de API: US$ 48.28. O valor é **equivalente em preço de lista da API** (claude-opus-5-5: entrada US$ 4,00, saída US$ 20,00,
leitura de cache US$ 0,20 por milhão; escrita de cache 1,25× a entrada com TTL de 5 min e 2× com TTL de 1 h), não
fatura: a sessão roda no plano da conta claude.ai, cobrado pelo plano. Conversão para reais não feita (precisa de
uma cotação com fonte). Reproduzir: `python3 -I tools/session_usage.py <pasta-do-transcrito-da-sessão>`.
O workflow do plano de qualidade AAA ainda estava rodando neste retrato; o total final entra no fechamento da sessão.

#### Tarde de 13/11 — variantes de visual, integração com a `main` e revisão

Alex escolheu seguir **só no navegador** (resposta "A"), buscando o melhor visual web; a versão nativa saiu do plano.

**Imagens A/B na base antiga (`02781cd`, software, 1280×800, mesmos seis planos):** `?atmo=1` muda em média
0,16–0,54 (de 255) nos planos próximos e 4,27 no panorama: com os valores escolhidos a névoa quase não aparece.
`?tm=agx` muda 11,9–17,3, mas deixa a imagem lavada e com menos contraste na exposição 1,08: pior, não promover.
Nenhuma das duas acrescenta draw call (máximo de 203 por plano nas três variantes). As cascatas e a combinação não
chegaram a sair nessa base (rodada interrompida para medir sobre a base integrada).

**Integração com a `main`:** a `main` recebeu o hotfix de inicialização do iOS (`c664f9f`) com 73 arquivos novos ou
alterados desde a base desta PR. O merge (`af033e9`) manteve o fluxo do Codex inteiro: carga com prazo, primeiro
quadro antes do cartão, perda de dispositivo/contexto como erro final com "Tentar novamente", sem recarga automática.
O diário de sessão deixou de recarregar com `?gl=1` e só anota a perda. A PR ficou sem conflito (`mergeable_state:
clean`). Esta PR acrescenta 16,16 kB gzip ao JS da `main` (341,47 kB em `9c05537` contra 325,31 kB em `c664f9f`,
builds feitos aqui com `vite build`).

**Revisão adversarial (4 lentes, 8 agentes; cada achado confirmado por um segundo agente):** a primeira tentativa não
rodou (limite de uso da conta atingido; resultado vazio não foi tratado como "nada encontrado"). Na segunda:
1. `?shadow=csm` quase sem sombra além de ~24 m: cada cascata herdava a câmera de sombra da caixa (`far` 220) e o
   `CSMShadowNode` a põe 200 m na direção do sol. Simulação com o nó real da r186, fração do chão visível fora da
   profundidade da cascata: antes 1–65% / 92–100% / 100%; depois de `9c05537`, 0% nas três, em seis ângulos.
2. **O `?bench` parou de funcionar depois do merge**: a `main` segura o quadro enquanto a fase é `intro`; o bench agora
   é exceção.
3. O diário anotaria perda de dispositivo falsa quando a `main` descarta o renderizador depois de uma falha.
4. Mola da câmera não era exata com o herói andando (atraso caía ~v·dt/2 em fps baixo); agora o passo trata o alvo
   como movendo em linha reta no quadro e o atraso é 2v/ω em qualquer fps (testado de 1/144 a 0,25 s).
5. Cascatas não acompanhavam o redimensionamento; 3× a memória de sombra no celular e em `q=low`; `?tm=off` gravava
   uma exposição que o three ignora; o pipeline do `?fx` não compilava antes do cartão; README falava em recarga.

**Tentativas que falharam nesta tarde (causa raiz):**
1. A prova do diário de sessão travou duas vezes: primeiro competindo com o bench pela CPU; depois esperando a
   resposta de `Page.crash`, que nunca chega (o renderizador morre antes). Esperar o evento `crash` e recarregar pelo
   CDP resolveu (`a47dbb5`); o Playwright recusa recarregar uma página que caiu.
2. Duas asserções de teste minhas estavam erradas, não o código: tolerância de continuidade apertada demais
   (`look.test.ts`) e uma conta da união de intervalos (`session_usage.py`). Corrigidas com a conta explícita.
3. O modo cinema escondia Mapa/Colabore/Créditos durante a fala (achado pelo teste do Codex); a correção elevou a
   barra e ela passou a cobrir a mão e o joystick deitado (achado pelo meu `check_touch`); corrigido em `b7f62b8`.
4. Ao reiniciar a conferência apaguei a pasta local `shots/merge-r1` (provas de `af033e9`: 7/7 no `check_loading`,
   falha do `check_hero_gesture`). Ficaram no registro da sessão; a rodada sobre `9c05537` substitui essas provas.

**Conferência de navegador do build integrado (`9c05537`, Chromium com WebGL2 por software, sequencial):**
`check_loading` 7/7 casos (lento PC/celular, falha e nova tentativa, modo seguro, perda de contexto na carga e com o
jogo pronto, sem recarga automática). `check_touch` 390×844 passou; 844×390 falhou pelo toque coberto (corrigido em
`b7f62b8`, reconferência em andamento). `check_hero_gesture` passa pela pausa do Colabore e os três ângulos agora
diferem, mas esgota os 15 s reais que o script dá para a missão avançar a ~1 fps; um controle com a `main` pura no
mesmo ambiente está na fila para separar ambiente de regressão. Demais suítes: em andamento.

#### Fim da tarde de 13/11 — fauna integrada, mundo aberto, Bíblia, painel e R9

**Pedidos de Alex nesta parte:** retomar código, mundo aberto e história deixando tudo commitado e publicado; uma
**Bíblia cronológica dentro do jogo** (a do Bíblia Conectada), que o jogador abre para saber o próximo passo, em vez
de só seguir um marcador; confirmação de que **a Bíblia não tranca o mundo**; uma **tela de analytics para devs**
(acessos e quem/quantos contribuíram). Pelo Codex, a pedido de Alex: R9 sem bonecos de esfera/cilindro, prioridade a
um trecho vila–praia bem acabado, e casas/solo como próxima frente desta sessão, em branch isolada.

**Fila de navegador sobre `9c05537` (`shots/merge-r3`, local; Chromium com WebGL2 por software, um teste por vez):**
passaram `check_loading`, `check_camera`, `check_session`, `check_world` e os dois benches. Falharam
`check_hero_gesture` (15 s reais para a missão avançar), `check_worldmap` (clique esgota 30 s em 1280×800; 390 e 320
passam), `check_premium` ("touch target"), `check_support`, `check_collaboration` e `check_feedback` (clique esgota
30 s), `check_tripo` (andar mais de 1 m em 2 s) e `shots`. **Controles com a `main` pura no mesmo ambiente:**
`check_hero_gesture` e `check_worldmap` falham do mesmo jeito sem nada desta PR, logo são limite do ambiente
(~0,3 fps em 1280×800, ~0,6 fps em 390×844), não regressão. Os controles das outras suítes ficaram na fila e **ainda
não rodaram**: essas falhas seguem sem classificação.
`check_camera`: maior salto da câmera 0,488 m (fixa) contra 0,506 m (`?cam=mola`), 0 quadros dentro de casas nas duas;
o benefício da mola não apareceu no navegador. Medidas das variantes na base integrada: `docs/GRAFICO-MASTER.md`.

**Fila sobre `caf7244` (com a fauna R8):** `check_fauna_scene` celular passou (22 verificações). Falharam
`check_loading` (casos `slow-desktop` e `fail-retry`), `check_touch`, fauna desktop, 404 parcial e áudio. Causa
observada nos registros: a fauna opcional tem prazo de 30 s **reais** por arquivo e, a ~0,3 fps, expira; o cancelamento
deixa erros `THREE.GLTFLoader: Couldn't load texture blob:` no console, que as suítes contam como erro. O
`check_touch` passou a separar esses erros somente quando o aviso de expiração da fauna está presente. O controle
dessas suítes na `main` pura (`ea39f63`) está na fila; até ele rodar, a causa é observação, não prova.

**Mundo aberto, Bíblia e painel:** ver a tabela de commits. Decisões tomadas por mim com a delegação de Alex
("o resto, decida pelo melhor para a evolução"), registradas em `docs/NARRATIVA.md`: o epílogo mostra só a primeira
oração de Marcos 1:21 e a Bíblia mostra o versículo inteiro; o mapa do Codex ainda lista as missões (alinhar com ele);
a leitura não é guardada entre visitas. O painel é construído por um `vite.painel.config.ts` próprio: como segunda
página do mesmo build ele tirava o CSS do tema e o auxiliar de pré-carga do Vite para arquivos à parte, ou seja, dois
pedidos a mais na abertura do jogo; separado, o CSS do jogo sai com o mesmo nome e hash (`index-CoqAIWud.css`).
**Acessos não são medidos hoje:** a API da Vercel responde "Web Analytics not found" para o projeto do jogo
(consulta de leitura em 13/11, 17:57 UTC) e o jogo não tem contador. O painel declara isso a partir de um registro no
repositório (`ACCESS` em `src/project-stats.ts`, com a data da conferência), e um teste impede que alguma página
carregue um contador enquanto o registro disser que não há fonte. Nenhum número de acesso foi inventado; a fonte de
medição depende de Alex.

**Contagem de visitas (pedido de Alex às ~18:07 UTC: `npm i @vercel/analytics`):** a produção passou a responder
200 em `/_vercel/insights/script.js` (antes 404), sinal de que o Web Analytics foi ligado no projeto. Instalado
`@vercel/analytics` 2.0.1 (MIT, sem dependências obrigatórias; versão exata no `package.json`, como as demais).
`src/analytics.ts` chama o `inject()` do pacote **só no build que a Vercel faz para produção** e corta do endereço
tudo depois de `?` ou `#` antes do envio. Medido: +2.435 bytes no JS do jogo (+1,09 kB gzip pelo relatório do Vite).
`tools/check_analytics.mjs`, com uma cópia do script servido em produção (SHA-256 `050e35bf7e6e9659…`, 4.522 bytes)
e os pedidos respondidos localmente: build local não pede nada; build de produção carrega o script e envia **uma**
visita com `{"o": endereço sem parâmetros, "sv", "sdkn", "sdkv", "r": ""}`; nenhum cookie, nada no armazenamento;
navegador automatizado carrega o script e **não** envia visita (os testes e agentes não inflam a contagem). Os
créditos do jogo ganharam a seção "Visitas" dizendo isso. O painel de devs não é contado. A API de consulta ainda
responde "Web Analytics not found": só haverá número depois que esta versão estiver em produção e receber visitas.
`npm` avisou de 4 vulnerabilidades moderadas no conjunto de dependências; não foram investigadas nem alteradas aqui.

**Conciliação com a R9 (`6878694`):** os trechos da R9 em `main.ts`, `hud.ts` e `journey.ts` ficaram como o Codex
escreveu (herói sem substituto, nenhum ator/colisor/seguidor de radar para participantes, aviso de cena em
desenvolvimento). Dois conflitos em `main.ts` (a chamada do HUD da jornada/Bíblia e os ganchos de depuração). O que
dependia dos atores retirados foi adaptado: plano cinematográfico, volta à vila, `check_roam`, `shots` e a guarda do
rig (o herói chega ao `animated-actor.ts` por `character-quality.ts`). O JS do jogo caiu de 1.236,36 kB para
1.229,10 kB (362,29 → 359,68 kB gzip) com a saída de `people.ts` do grafo. A fila do navegador foi trocada para essa
árvore quando o `check_bible` de `a66b232` terminou (passou nos dois tamanhos de tela); as demais conferências de
`a66b232` não rodaram e são substituídas pelas da árvore conciliada.

**Tentativas que falharam nesta parte (causa raiz):**
1. Literal de teste errado: 421,4 m no `places.test.ts`; a conta à mão dá 421,03 m. Corrigido o teste, não o código.
2. As marcas do contador não eram desenhadas ao entrar por "Explorar a região" (o contador só era montado por uma
   missão); `drawCounter` passou a ser comum (`cf7c4a7`).
3. `build_bible.py`: linhas do `SHA256SUMS` com espaços quebravam a leitura; e a primeira versão retirava colchetes do
   texto. Passou a usar o texto da BLIVRE como está, que é como o site do Bíblia Conectada o mostra.
4. O script que ligava a Bíblia ao `main.ts` abortou numa âncora duplicada, sem escrever nada; refeito com âncora
   única e conferido por `git diff --stat`.
5. O painel como segunda página do build mudou o bundle do jogo (ver acima); refeito com configuração própria.
6. A guarda do rig falhou depois do merge da R9 por conferir um import que mudou de arquivo; a conferência agora
   segue o caminho novo e continua exigindo o `animated-actor.ts`.
7. `check_roam` falhou na árvore conciliada em 23 s ("the found place is announced"): o aviso de lugar encontrado dura
   6 s reais e o teste o lia em quatro idas ao navegador, com a máquina ocupada por um `npm`/`tsc` meu ao mesmo tempo.
   A leitura passou a ser uma só, no mesmo instante em que o lugar é encontrado; repetição na fila.
8. A primeira asserção do `check_analytics` esperava a visita sem o campo do site de origem; o script da Vercel envia
   `"r": ""` quando a página é aberta direto. Corrigida a expectativa, não o código.

**Consumo real da sessão até 13/11/2026 17:53:25 UTC** (`python3 -I tools/session_usage.py <pasta do transcrito>`;
38 arquivos; respostas desde 09:39:24 UTC). Substitui o retrato anterior, que era parcial:

| grupo | modelo | respostas | input | output | cache_read | cache_write_5m | cache_write_1h | usd_equivalente_api |
|---|---|---|---|---|---|---|---|---|
| principal | claude-fable-5-2 | 174 | 362 | 274.636 | 102.955.312 | 0 | 1.139.040 | 49.80 |
| principal | claude-opus-5-5 | 635 | 1.417 | 529.421 | 306.777.585 | 0 | 1.362.632 | 82.85 |
| workflow | claude-opus-5-5 | 1.109 | 2.228 | 1.509.632 | 197.189.024 | 6.829.664 | 0 | 103.79 |

Total equivalente em preço de lista da API: **US$ 236,44**. Atividade estimada: **6,77 h** (intervalos entre respostas
até 5 min, sem sobreposição; estimativa, não ponto batido). Não é fatura: a sessão roda no plano da conta claude.ai.
O modelo da sessão foi trocado por Alex durante a tarde; a linha `claude-fable-5-2` usa o preço de lista da referência
da API que acompanha o Claude Code (US$ 8 entrada, US$ 40 saída, US$ 0,20 leitura de cache por milhão), acrescentado
ao script neste commit. Cinco respostas sintéticas (sem tokens) ficam fora da tabela. Conversão para reais não feita.

### Publicação R3 registrada

O commit completo é `4d7cf867945741c4d28c7ce1d8f9fe1cd8f2318f`, com data de autoria
Git `2026-11-13T06:48:33-03:00`. O registro
`shots/production-r3-integration/PUBLICACAO-VERIFICADA.json`, observado em
`2026-11-13T09:54:56.3260697Z`, associa esse SHA ao deployment
`dpl_8FxdsULHRteALFo2zGBNg6TKevHQ`, estado `READY`, HTTP 200 no domínio público.

O registro público lista 14 assets e zero erros de página, avisos ou falhas HTTP
nas execuções desktop WebGPU, viewport móvel WebGPU e desktop WebGL2; cada uma
registrou 16.730.339 bytes transferidos. As três missões completaram nos dois
viewports, com quatro seguidores. Isso preserva a evidência daquela execução,
não uma nova conferência de produção feita ao escrever este diário. O teste de
episódio usa teleporte/ações de debug; viewport móvel usa a GPU do PC.

### R4 publicada — água, colaboração e transparência

O problema visual observado motivou ondulações em duas escalas na água, normal
combinada, rugosidade variável, reflexo do céu e transparência conforme profundidade
e ângulo da câmera. A animação passa a seguir o tempo do jogo e pausa com ele.
O nível da superfície e os dados de terreno foram preservados. É uma aproximação
com material físico e transparência; não é refração em screen space, ray tracing
ou DLSS. Alteração em `src/world.ts`; comparar imagens e movimento reais antes de
concluir que o acabamento melhorou sem regressão de desempenho.

A investigação de fauna encontrou modelos genéricos, mas Alex rejeitou sua
qualidade visual: **Quaternius e derivados não integram a entrega**. A simulação
determinística em `src/fauna-simulation.ts` fica reservada para malhas próprias;
os testes cobrem terreno/água, pausa, estabilidade inicial e separação durante
60 segundos. Os três PNGs próprios de burro, galinha e peixe são referências
para o Tripo, não modelos rigados nem animais presentes no jogo. Fontes e limites
estão em `docs/FAUNA-GALILEIA.md`; não usar contagens do simulador como população
entregue ou reconstrução histórica.

Colabore preserva a composição de issue no GitHub e acrescenta, na mesma página,
apoio voluntário pela chave de e-mail autorizada. Copiar Pix não comprova pagamento.
A prestação de contas usa registros públicos revisados, valores em centavos,
recebimentos anônimos e links de comprovantes reais quando disponíveis. Ainda não
foram informados recebimentos, gastos do jogo ou abertura conferida: os totais
começam como **—**. Claude R$ 799/mês e Codex R$ 999/mês, pagos dia 6 segundo Alex,
ficam como assinaturas gerais; a parcela do jogo não foi definida nem debitada dos
apoios. Detalhes em `docs/APOIE.md`, `src/data/accountability.json` e testes próprios.

A medição de esforço lê apenas metadados autorizados, com cobertura parcial,
intervalos estimados sem dupla contagem e tokens observados com origem. Equivalente
hipotético de API não é despesa paga nem custo da assinatura. Fontes:
`tools/collect_project_usage.mjs`, `tools/project-usage-core.mjs`,
`src/effort.ts`/`src/effortui.ts`; snapshot real em
`public/metrics/development.json`. A branch pública `metrics/development` foi
publicada e lida por HTTP 200; o navegador consultou a fonte remota. O serviço
recebe snapshots e pode ter atraso de cache; não há coleta permanente instalada.
Sem atualização recente, a UI informa desatualização e não extrapola valores.

Ensaios anteriores estão em `shots/r4-world/` e `shots/r4-integration/`. Evidência
final: `shots/r4-final-build.log` (81/81), `shots/r4-final-support/` (abas, Pix,
contas e telemetria, incluindo refresh/fallback sintético separado dos dados reais).
Produção: `shots/production-r4-integration/PUBLICACAO-VERIFICADA.json` associa
`08785fe50b9995b7712a24e2b53bcbbb575d1804` ao deployment
`dpl_BnhY9vLRZA6CPErsZeZeX2b2aZ8r`, READY, HTTP 200 e bundle `index-BKHkIuyv.js`.
`shots/production-r4-support/report.json` confirma apoio nos dois viewports, fonte
remota, zero erros e nenhuma escrita de pagamento. Clipboard foi simulado.

Nessa amostra pública: PC WebGPU 89,1–95,5 FPS; viewport móvel no PC 49,6–94,8;
WebGL2 88,3–96,0. Cada caso carregou 14 assets e 16.739.661 bytes, com zero erros,
avisos ou falhas HTTP. São amostras curtas do script, não percentis de benchmark
contínuo ou teste em telefone físico. A PR #1 do Claude permanece separada,
incluindo seus efeitos opcionais; estes números não medem a PR combinada com R4.

### Série de Reels e expansão do mundo

Alex pediu uma sessão separada para produzir os bastidores desde os primeiros
vídeos e os conceitos até o jogo real, sempre com link para jogar. Handoff local:
`D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Serie-Reels-R1/HANDOFF-SERIE.md`.
As quatro referências recebidas em 13/11 incluem uma captura e conceitos de
deserto, pesca e Caná; não anunciar essas regiões ou “24 capítulos” como entregues.
A visão de mundo completo foi registrada em `docs/VISAO-MUNDO-ABERTO.md` como
expansão por etapas. A criação de sessão não equivale a Reel renderizado ou postado.

### R5 — metas revisáveis e colaboração voluntária

Alex ampliou o escopo para dezenas de missões nos quatro Evangelhos e pediu uma
estimativa para a campanha e para 200 voluntários. O plano usa uma referência de
caixa de R$300 mil, faixa de R$200–500 mil, com trabalho principal não remunerado
excluído. Primeiro marco de R$15 mil incluído, sem somar ao total. São hipóteses
de planejamento sem cotações ou gastos. Prazo com núcleo pequeno: 36–60 meses;
com 200 pessoas ativas e coordenação suficiente: 12–24 meses. Não são garantias
nem contagem de colaboradores existentes. As premissas estão em
`docs/ESTIMATIVA-PROJETO.md`, com dados validados em `src/data/project-plan.json`.

Colabore ganhou a aba Participe da equipe: nove frentes, disponibilidade e portfólio
opcional. O envio abre um rascunho GitHub com consentimento público; o candidato
confirma lá e os mantenedores analisam. Não há inscrição/contratação automática,
coleta de telefone/e-mail nem concessão de permissão. O template direto do GitHub
e o fluxo estão em `docs/VOLUNTARIOS.md`.

Build local: 92 testes. `shots/r5-community/` verifica os valores reais do plano,
navegação de três abas, pausa/foco e composição de candidatura nos dois viewports.
O rascunho de QA é sintético, window.open foi interceptado e nenhuma candidatura
foi enviada. `shots/r5-support/` cobre a regressão de Pix, contas e uso observado.
Publicada em `3d3f9c8f74e9aff0b74c32f86acce5327039ad22`, deployment
`dpl_Bg7HYru687BvoPAgK7sKzkwbD8eb` READY. Conferidos no domínio público os bundles
`index-CSnHhZh8.js` e `index-CZGO82_i.css`. QA público de colaboração e apoio passou
em 1280×800 e 390×844: `shots/production-r5-community/` e
`shots/production-r5-support/`, sem publicação de issue ou pagamento.
São viewports no PC, não testes em telefone físico. Prova completa:
`shots/production-r5-community/PUBLICACAO-VERIFICADA.json`.

Arquivo privado do diário: `INDEX-1b9aab97db4d.md`, com 42 arquivos R5 verificados
por hash, sem vídeos novos. O conjunto R5 tem SHA próprio e não relabela R4.

Por novo pedido de Alex, foram separados 13 arquivos de imagem para a série e
uma eventual proposta ao Tripo: oito capturas da ferramenta, uma referência de
entrada, duas capturas do GLB e duas do jogo. Fontes e cópias foram comparadas
por SHA-256. A pasta privada `Serie-Reels-R1/Fontes-Tripo` contém manifesto e
limites de uso; a sessão de Reels recebeu o caminho. Não há captura dedicada
da tela de rig nem gravação contínua da geração. Os prints brutos exigem recorte
de informações pessoais. `PROPOSTA-PATROCINIO-TRIPO.md` é rascunho local não enviado,
sem patrocínio confirmado e sem autorização implícita de postagem social.

### R6 — publicada e verificada

Publicada em **`3ac7854649a83183748bd61161d74d4e75fdc87a`**, deployment
`dpl_GJC9ZKJKEDjx1DFGruB972cwvPGo` **READY**, com os bundles públicos
`index-Dnf5SMyV.js` e `index-itFozVSF.css` conferidos. O registro
`shots/production-r6-community/PUBLICACAO-VERIFICADA.json`, observado em
`2026-11-13T12:02:54.736Z`, relaciona commit, deployment, hashes dos relatórios
e limites. Build local: **97/97 testes**, em `shots/r6-build.log`.

A entrada e o Colabore passaram ao material de cristal pérola claro, com azul-tinta,
cobalto, contornos irisados discretos e o cenário real visível. O painel usa três
abas, convite lateral no PC e composição compacta no celular; valores do plano,
consentimento, rascunhos, Pix e limites das contas foram preservados. Código CSS
nativo, sem biblioteca nova nem imagem conceitual substituindo o jogo. Fontes:
`docs/DIRECAO-VISUAL-R6.md`, `src/menus.css`, `src/feedback.css`, `index.html`,
`src/feedbackui.ts` e a organização de metas em `src/project-plan-ui.ts`.

O mapa de visão geral em `src/worldmap.ts`/`src/worldmap.css` acrescenta zoom,
arrasto, objetivo atual, escala e posição, com pausa e retorno de foco. Ele mostra
o terreno existente de **3.072 × 3.072 m**: não amplia a região jogável, o DEM,
as missões ou o horizonte distante. Focar uma missão no mapa não teletransporta
o jogador. Os estados de fala e conclusão continuam protegidos.

Jesus recebeu postura de repouso e convite aplicados sobre o **rig real do GLB**:
oito ossos ajustados, preservando a hierarquia de 65 ossos e o clipe `walk`.
É uma camada procedural, não um clipe novo do Tripo. O gesto acompanha a fala
literal de Marcos 1:17; não é repetido na narração de Marcos 1:20. Durante a fala,
Jesus se orienta para os chamados e os discípulos ficam parados, olhando para ele.
Os que estão no barco permanecem no convés até terminar a fala. A saída posterior
ainda usa seguidores que podem atravessar água a pé: **o desembarque não foi
resolvido**. Fontes: `docs/POSTURA-HEROI-R6.md`, `src/hero-posture.ts`,
`src/animated-actor.ts`, `src/main.ts` e testes correspondentes.

| Evidência local | Resultado e escopo |
|---|---|
| `shots/r6-build.log` | 97 testes passaram e build concluído. |
| `shots/r6-premium/report.json` | Entrada/abas em 1280×800, 390×844 e 320×740; campos de 16 px, alvos de 44 px, contraste forçado, sem cortes ou escritas de rede detectados. |
| `shots/r6-worldmap-final/report.json` | Três viewports: escala de terreno real, zoom/arrasto, pausa, foco e proteção de fases. Endpoints de fala/conclusão preparados por debug. |
| `shots/r6-gesture/report.json` | GLB real em 1280×800 e 390×844, gesto, ouvintes, pausa, retorno ao repouso e exclusão da narração; locais/câmeras preparados por debug. |
| `shots/r6-community/report.json` | Dois viewports: plano real, abas, rascunhos, pausa e composição GitHub. Candidatura sintética interceptada; nenhuma issue enviada. |
| `shots/r6-support/report.json` | Dois viewports: Pix, contas sem valores inventados e esforço observado. Clipboard simulado; nenhum pagamento ou upload. |
| `shots/r6-integration/report.json` | Herói e 14 assets nos ensaios WebGPU PC/móvel emulado e WebGL2 PC; sem erros de página, avisos ou falhas HTTP nos casos registrados. |

Premium e mapa passaram **antes do último refinamento de postura/NPCs em
`src/main.ts`**; CSS e módulo do mapa não mudaram depois desses testes. Gesto,
comunidade, apoio e integração foram verificados após o refinamento. Isso delimita
a cobertura; não apresentar todos os relatórios como execução simultânea do último
build. Os viewports continuam rodando no PC, sem Safari/iPhone/Android físicos.
Os testes de gesto/endpoints não comprovam percurso contínuo da R6.

Depois do deploy, **as seis suítes públicas passaram**, sem erros registrados:
premium e mapa em 1280×800, 390×844 e 320×740; gesto, comunidade e apoio em
1280×800 e 390×844; integração em WebGPU PC/móvel emulado e WebGL2 PC. Fontes:
`shots/production-r6-premium/`, `production-r6-worldmap/`,
`production-r6-gesture/`, `production-r6-community/`, `production-r6-support/`
e `production-r6-integration/`, todas sob `shots/`. Essa conferência pública inclui
o build final; preserva as limitações de teleporte preparatório, emulação móvel,
clipboard/rascunhos interceptados e ausência de pagamento/candidatura real.

Separadamente, a auditoria `shots/r6-gameplay-audit/` percorreu as três missões
com teclado/mouse reais no baseline **`d6539ae58bec172b2ddd8e6bb50092e7bcc67244`**.
Seu relatório `docs/MAPA-E-JOGABILIDADE-AUDITORIA-R6.md` antecede o redesign, mapa
e gesto. Essa prova não deve receber o SHA da R6 nem ser citada como travessia
final dela. Registrou água no desembarque, borda invisível, interior com poucos
destinos e acabamento desigual; ampliar quilômetros não corrige esses problemas.

A PR #1 do Claude exige integração coordenada: há sobreposição em `src/main.ts`
e `index.html`. Preservar o conjunto de motivos de pausa (`panelPauses`), abertura e
fechamento do mapa, gestos do herói, ouvintes durante a fala, três abas e dados de
Colabore; combinar os diários. Reconsultar o HEAD da PR e testar a combinação,
sem presumir que seus efeitos gráficos já estão presentes nesta R6.

Pedido editorial mais recente: **3–5 segundos de gameplay real, congelar o quadro
e apresentar um conceito gerado sobre o mesmo enquadramento**. A sessão de Reels
`01a1d480-3c37-74c2-93eb-9adff5607bc6` já recebeu esse briefing. Capturar movimento
real e preservar o frame de origem; rotular claramente o conceito e manter a
correspondência de câmera/composição. A pasta privada
`D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Serie-Reels-R1/Fontes-R6/`
agora contém dois artefatos distintos:

- `Video-Convite-R1/convite-marcos-1-17-gameplay-R6-4s.mp4`: quatro segundos
  contínuos do jogo real local, H.264, 390×844, 25 fps, 100 quadros, sem áudio.
  Foi capturado no Chrome do PC com viewport móvel emulado; posição/câmera foram
  preparadas por debug **antes** da tomada, a tecla E acionou a missão real e não
  houve edição de estado durante os quatro segundos. Não é caminhada completa,
  captura de telefone nem demonstração de 25 fps de desempenho do renderer.
  `metadata.json`/`ffprobe.json` guardam origem e verificação. SHA-256 do MP4:
  `c40d1a826ea959f97bc68d5fdc8f5fb07c10c797ba466bbf7300e1dd7d4dec4b`.
- `Conceito-Convite-R1/meta-grafica-convite-r1.png`: imagem de conceito gerada
  por `image_gen`, 992×1586, com quadro real de origem e prompt/proveniência
  preservados. SHA-256:
  `EBEB0DD9D579A0886A9244F2358A38805E1C245574905BA6661DEE50DC9C016B`.
  Não representa pixels entregues pelo jogo nem processamento DLSS.

A prévia comparativa foi concluída em `Fontes-R6/Previa-Comparativo-R1.mp4`:
8,466667 s, 720 × 1280, sem áudio. Quatro segundos reais, 0,7 s de congelamento,
0,6 s de dissolução e o conceito estático. SHA-256:
`116cfc14203045687e67e82cd8d9a6b4dbb41b437bc8bb54a8904151fa6de194`.
FFprobe e decode completo passaram; cinco quadros de controle foram inspecionados,
com leitura adicional do começo, transição e fim pelo integrador. A imagem gerada
não corresponde pixel a pixel ao cenário; o rótulo conceitual permanece legível.
Fontes e prévia foram encaminhadas à sessão da série. Narração/trilha e montagem
do Reel completo continuam naquela sessão; nenhuma publicação social ou
demonstração de DLSS decorre desses arquivos.

## Seis possíveis episódios, ainda sem roteiro ou publicação

1. **“Começamos com formas simples: o que já precisava funcionar?”** Mostrar a
   primeira publicação, controles e missões. Fonte: `shots/publicacao/episodio/`.
   Não chamar o protótipo de versão final.
2. **“Como o personagem ganhou movimento?”** Comparar o personagem provisório
   com o herói R1 e mostrar o clip de caminhada real. Fontes: R0 e
   `shots/production-r1-integration/`. Só há walk próprio; não anunciar uma biblioteca
   completa de animações ou seis NPCs Tripo rigados.
3. **“Por que a cidade parecia vazia?”** Comparar composição R1 e R3: densidade,
   orientação das portas, percursos e recuos. Fontes: `production-r1-world` e
   `r3-final-world`. A vila é composição artística sobre relevo; contagem de casas
   não é dado arqueológico de população.
4. **“Um céu de 307 kB mudou a cena?”** Mostrar comparação R1/R2 com mesma câmera,
   nuvens, reflexos e transparência no raso. Fonte: `public/textures/sky/LICENSE.json`
   (306.662 bytes nos dois derivados) e capturas R1/R2. É panorama LDR, não ray tracing.
5. **“Uma missão clara precisa de mais que uma seta.”** Mostrar as dicas de direção,
   aproximação e interação na R3, com as falas literais BLIVRE preservadas. Fonte:
   `src/journey.ts`, testes e capturas do episódio R3. Não atribuir texto de interface a Jesus.
6. **“Quem joga pode construir junto.”** Mostrar Construa conosco e uma revisão
   que passou por código, teste e deploy. Fonte: `docs/CONSTRUA-CONOSCO.md`, relatórios
   e commits. Não fingir comentários de jogadores, aprovação ou uma issue já enviada.

## O que ainda falta para editar os Reels

- Gravação contínua de gameplay nas mesmas posições antes/depois; screenshots são
  quadros reais, mas não substituem vídeo de movimento. O arquivador só copia vídeos
  existentes e informa quando a contagem é zero.
- Gravação contínua da R4 publicada; build, commit, deploy e QA público já estão registrados acima.
- Performance em iPhone/Android físicos. Os números atuais vêm do PC e seus viewports.
- NPCs Tripo rigados, acabamento final de vegetação/arquitetura e animações adicionais.
- Contribuição do Claude identificada por branch/commit/arquivo real antes de atribuir autoria.
- Seleção editorial dos trechos, narração, trilha licenciada, legendas e aprovação de Alex.
- Nada de DLSS ativo, reconstrução arqueológica exata ou qualidade da imagem-conceito
  como se fossem recursos já entregues.

## Preservação de cada próximo passo

Para cada incremento, registrar: problema observado; hipótese; arquivos alterados;
fontes/licenças; evidência antes/depois; teste e suas limitações; commit; deployment
quando houver; estado editorial do possível Reel. Guardar falhas relevantes também,
com rótulo claro, sem substituir uma referência por uma imagem gerada como prova.

O script `tools/archive_development.mjs` copia somente capturas, vídeos, relatórios
e logs selecionados já existentes. Confere SHA-256 na origem e na cópia. Originais
permanecem no projeto; o destino é:

`D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario`

```powershell
node tools/archive_development.mjs
# Comando da revisão R6 publicada e verificada:
node tools/archive_development.mjs --r6-commit 3ac7854649a83183748bd61161d74d4e75fdc87a
```

R3 permanece fixa em `4d7cf867945741c4d28c7ce1d8f9fe1cd8f2318f`.
`--commit` associa somente a R4, fixada por padrão em `08785fe50b9995b7712a24e2b53bcbbb575d1804`.
`--r5-commit` associa somente a R5, fixada por padrão em `3d3f9c8f74e9aff0b74c32f86acce5327039ad22`.
`--r6-commit` associa somente a R6; sem esse argumento, R6 recebe `working-tree`.
A entrada separada `baselineR6Audit` contém somente `shots/r6-gameplay-audit`,
fixada em `d6539ae58bec172b2ddd8e6bb50092e7bcc67244`; nunca herda o SHA funcional R6.
As fontes funcionais R6 incluem `shots/r6-build.log`, `r6-premium`, `r6-gesture`,
`r6-worldmap-final`, `r6-community`, `r6-support`, `r6-integration` e as respectivas
pastas `production-r6-*` (mapa: `production-r6-worldmap`). Nesta atualização, o
arquivador já foi executado com o SHA funcional R6. O índice privado
`INDEX-bd171721607b.md` preserva **122 arquivos R6** e **26 da auditoria anterior**,
com origem/cópia conferidas por SHA-256. Não há vídeos nesse conjunto arquivado;
os novos materiais de `Serie-Reels-R1/Fontes-R6` estão separados e não devem ser
inferidos a partir da contagem zero de vídeos do índice.
Seleções de evidência de futuras revisões
devem ser adicionadas separadamente, sem relabelar capturas históricas.
Snapshots, manifests e índices recebem identificadores de conteúdo e são imutáveis:
uma cópia divergente causa erro, não sobrescrita. Fontes ausentes ficam como pendência.
O programa imprime o caminho do índice mais recente. Não faz upload, não publica
redes sociais, não gera vídeo e não modifica memórias do assistente.

## 13/11/2026 — fauna própria R8

Pedido: povoar o mapa com animais e sons, preservando o padrão visual e a
correção de abertura no iPhone da R7. Base `c664f9f`; trabalho isolado em
`codex/fauna-original-r8`, sem modificar a branch de Claude.

Produção no site Tripo: 175 créditos nesta revisão, somados aos 1.025 já
registrados. Teto de 1.200 atingido; saldo observado 2.015. Não houve compra.
A ampliação de até 300 créditos foi perguntada, mas não presumida aprovada.
Ovelha, cabra e peixe aguardam geração própria; seus substitutos rejeitados
não voltaram ao jogo.

Galinha detalhada e burro detalhado foram preservados com seus originais.
Os rigs automáticos chegaram com classificação inadequada; as cópias receberam
animação local revisada, pés/cascos funcionais, variantes desktop/mobile e
hashes distintos. Galinha: 7.886 triângulos, caminhada a 0,24 m/s, dois ossos
adicionais de pé. Burro: 17.688 triângulos, caminhada a 0,38 m/s e repouso.
Ver `QA-GALINHA-R8-BIRDWALK.md` e `QA-BURRO-R8-WALK.md`; não há IK de terreno.

O mundo usa setores determinísticos e população próxima ao jogador, até 24
animais no celular/48 no PC. Só malhas aprovadas e carregadas produzem emissores
de animal. Cinco sons CC0 foram adaptados e creditados; aves e água ocupam
habitats, cacarejo/zurro vêm das posições dos animais. Limites de três vozes,
cache PCM de 12 MiB, pausa dos menus e botão de som. Uma retenção de buffer
fora do cache foi encontrada e corrigida com teste de regressão.

Build integrado inicial: 166 testes CPU + typecheck, bundle `index-By9uYN8-.js`.
O ensaio nativo de áudio encontrou depois o raio físico sendo usado como
alcance sonoro; o animal ficava inaudível. Correção com agente completo no
teste: 167 testes CPU + typecheck, bundle final `index-BvfTbjcg.js`. A falha
anterior foi guardada junto das evidências; não conta como áudio aprovado.
QA de cena no Chrome e WebKit é registrada por bundle; o WebKit Windows não
oferece Web Audio e mostra “Som indisponível”. Não equivale a Safari físico,
escuta humana ou prova de FPS no iPhone. Capturas são gameplay real de QA;
reposicionamentos via debug ficam identificados e não contam como missão
completada. Nenhuma evidência desta revisão usa DLSS.

Horas/tokens: snapshot agregado atualizado em 13/11 às 14:58:29 UTC, somente
da sessão autorizada. Publicado na branch `metrics/development`, commit
`d7e4aba7b478364efd4d92163cf1822f240f1d21`. Horas são atividade estimada e
valores em USD equivalência hipotética de API, não cobrança da assinatura.
Não foram coletadas conversas alheias nem inventadas horas de Claude.

## 13/11/2026 — R9, humanos provisórios retirados e direção visual aprovada

Alex rejeitou os NPCs feitos de esferas/cilindros e preferiu a ausência temporária
a modelos inacabados. Trabalho isolado em `codex/visual-quality-r9`, base
`ea39f630591439516e7314089d0a07d0955e3916`. A R9 retira criação, animação,
colisão e seguidores no radar desses personagens. Os IDs de participantes
continuam servindo ao progresso narrativo e aos saves. Perto dos encontros,
um aviso identifica a cena em desenvolvimento; nenhuma citação foi reescrita.
Falha do herói abre recuperação, sem boneco substituto. Os seis candidatos
Tripo sem rig/animação continuam fora da cena.

Ver `DIAGNOSTICO-VISUAL-R9.md`: auditoria de fontes/capturas R8 encontrou três
casas em 158 construções, proporções esticadas, fundações lisas expostas e um
material de chão praticamente uniforme. Não há prova de um limite do navegador.
Alex aprovou priorizar um trecho vila–praia bem acabado e poucos personagens
completos, preservando o mapa maior e investigando detalhe por região. Perfil
visual 30 FPS e KTX2 são propostas a testar, não otimizações já entregues.

Coordenação enviada à PR #1 e ao chat `GTA JC` no aplicativo Claude pelo
Computador, com leitura de retorno da mensagem enviada. Sua branch observada
era `a66b232`; ela não foi editada. Mantido o alinhamento de Alex: a Bíblia
orienta, mas não impede explorar/agir antes da leitura. A continuidade sugerida
para Claude é concluir jornada/analytics e depois tratar casas/solo sem
reintroduzir humanos provisórios. Envio confirmado não equivale a tarefa
concluída pelo outro agente.

Build/typecheck e 172 testes passaram. QA `check_npc_visual.mjs`: Chrome desktop
24/24, Chrome móvel 22/22, WebKit Windows 12/12 e herói 404 com retentativa 14/14.
As missões usaram E/toque reais após posicionamento explícito de QA; não foi
uma caminhada contínua do episódio. Um segmento W atravessou a antiga posição
do NPC, sem colisor invisível. Fauna própria R8 preservada. Vinte e três
capturas e quatro relatórios têm manifesto com hashes. Bundle funcional:
`index-7Z8RWWVI.js`, SHA-256
`57262772fec1784854f16e42b6316a7201d6d5c6bf5af5143c51645fb0d83514`.
Ver `QA-NPC-QUALIDADE-R9.md`. iPhone físico, desempenho térmico e acabamento de
casas/solo permanecem pendentes; a remoção de NPCs não é entrega de novas malhas.

Uso agregado da própria sessão atualizado em 13/11 às 17:40:26 UTC, branch
`metrics/development`, commit `35e441dcead64cab84dbd55377b2d6a512a70bb8`.
Horas estimadas e equivalência hipotética de API permanecem separadas de
pagamentos. Nenhuma nova geração ou compra Tripo; teto anterior consumido.

## 13/11/2026 — R10, primeiro acabamento de vila/solo

Registro inicial às 17:54 UTC. Alex autorizou prosseguir na direção aprovada e
pediu documentação de tudo. Base main `a1c5b21`; branch isolada
`codex/village-quality-r10`. Claude permanece com jornada/Bíblia/analytics;
Codex assume esta primeira revisão de casas/solo e avisa o escopo na PR #1.

Divisão: agente de casas em módulo próprio, agente de material do chão em
módulo próprio, agente de QA com capturas comparáveis e integrador em world.ts.
Sem escrita simultânea no mesmo arquivo. Fontes/modelos existentes preservados;
sem mudança de relevo de origem, sem NPC procedural, sem novo gasto Tripo.
Não foi iniciada uma IA local concorrente com o benchmark gráfico nesta GPU;
a revisão independente dos módulos e a inspeção do navegador foram realizadas
por agentes separados, com conferência final pelo integrador.

As 158 casas agora preservam a proporção do GLB runtime, com escala uniforme,
fachada mantida no mesmo alinhamento e colisores/decoração/fauna ajustados ao
footprint final. Uma saia texturada acompanha o terreno no lugar da base
retangular cinza. Trilha e margem têm menos relevo aparente que o cascalho;
transições de areia/umidade usam altura e variação espacial. Os três mapas de
solo foram reaproveitados, sem novo arquivo de imagem, modelo ou áudio.
Modelos, relevo e rotas originais foram preservados. Ver `CASAS-R10.md` e
`SOLO-R10.md`; não houve reconstrução das fontes brutas do Tripo.

Build, TypeScript e **184/184 testes** passaram. Comparação A/B: três posições,
mesmas poses/controles e tamanhos 1280×800/390×844; **36/36 verificações Chrome
por versão**, herói e fauna preservados, sem NPCs provisórios. Cada passagem
sondou 2.262 pontos de rota; um trecho usou caminhada W real, mas o restante
foi posicionado para QA. Candidata WebKit: **12/12 verificações**. Os PNGs reais
e relatórios têm hashes; não são imagens-conceito. `QA-VILA-R10.md` contém
procedimento, dimensões, bytes, medições e limitações.

Uma medição curta WebKit foi desfavorável (47,67 contra 56,26 FPS), motivando
novo par com 10 s de aquecimento e 10 s de medição. Nesse par, R9 ficou em
54,49 FPS e R10 em 62,80; a queda não se reproduziu. Ambos os resultados foram
preservados. Não se afirma ganho de desempenho nem validação de Safari físico.
Chrome ficou perto de 100 FPS, limitado pelo ritmo observado do ambiente.
Casas ainda têm apenas três variantes simples e atlas limitados; a base pode
ficar alta nas encostas e a margem do DEM permanece reta em alguns trechos.
Esta entrega melhora implantação/material e não encerra a qualidade artística.

Uso agregado da própria sessão publicado às 18:12:46 UTC em
`metrics/development`, commit `c4998ad20f32f7fe911e6c024b3a9354bd442ea7`.
Horas são atividade estimada e preços de API uma equivalência hipotética,
separada dos pagamentos. Não se inventou consumo de Claude ou de subagentes.

### Nova direção: interações que mudam a vida das pessoas

Durante a revisão, Alex propôs montar o burro, pegar a galinha, conversar com
pessoas e deixar palavras de ânimo. O centro da experiência será aproximar-se,
ouvir e ajudar, com consequência observável. `INTERACOES-E-ENCONTROS.md`
registra um primeiro encontro autoral, seleção contextual, animações,
persistência e dependências para animais. É um plano, não funcionalidade
implementada. Citações bíblicas continuam literais/referenciadas; falas
autorais recebem a etiqueta Narrativa do jogo. Não exigir leitura para agir.

Claude avançou até `7c02464` com painel e diário, incluindo a integração R9
em sua própria branch. Ela foi consultada sem alteração; casas/solo continuam
na worktree Codex. A publicação desta R10 e o handoff final serão vinculados
na PR e no arquivo privado de evidências, sem publicar Reels automaticamente.
