# Plano de qualidade AAA — Grand Testament Adventure

> Este plano foi conferido só por leitura nesta rodada. Branch `claude/quirky-hamilton-bt0y7w` em `bbefb20`, 12 commits à frente de `origin/main` (`4d7cf86`, que é a produção).
> - O `bbefb20` (só diário) entrou durante a revisão. Antes de abrir a próxima `claude/...`, conferir o `git log` de novo.
> - O pedido do Alex de elevar o jogo a um padrão de mundo aberto AAA marca só a barra de qualidade. Nomes, marcas e termos de jogos da Rockstar não entram na interface, no `<title>`, nos Reels, em títulos de commit ou de PR, nem em material público (HANDOFF.md:29-30; TRIPO.md:28).
> - Do jogo da Rockstar não entra nada.

## 1. Em uma frase por pilar

- **Medição:** nada vira padrão sem três coisas: os seis planos do bench medidos (tempo de GPU e de CPU) no PC da RTX e em 1 Android e 1 iPhone físicos, abertos por HTTPS; vídeo da rota para o que só aparece em movimento; e o OK escrito do Alex.
- **Estabilidade:** hoje recarga da aba, perda do dispositivo e falha de modelo não deixam rastro. Um diário de sessão local entra antes de qualquer teste no celular.
- **Imagem:** primeiro o que é barato e hoje está incoerente, sempre atrás de flag: céu, sol fixo, névoa chapada e água que parece uma placa. Depois vêm KTX2, menos draw calls, sombras, TAAU e o plano de cinema nas falas.
- **Cena e personagens:** o chamado de Mc 1:16-20 é consertado só com código. Enquanto isso, o Codex riga o elenco num lote, com teto de créditos novo aprovado pelo Alex.
- **Sensação:** câmera com mola, aceleração gradual, som com mudo e primeiro quadro sem engasgo de shader entram cedo.
- **Celular:** nenhum efeito novo nem NPC rigado vira padrão no toque antes de a memória de textura caber.
  - Hoje: ~1,2 GB no desktop do Codex e ~1,05 GB em viewport emulado (GRAFICO-MASTER.md:17-18). Nunca foi medido em celular físico.
  - A prova: 10 minutos num aparelho físico sem a aba recarregar, contados pelo código.

## 2. O que já existe (conferido nesta rodada)

- **Renderer:**
  - Profundidade logarítmica. O MSAA do renderer só liga sem `?fx` e fora de `q=low` (`src/main.ts:61`). Com `fx=alto` o passe mantém MSAA 4×; só o `fx=master` fica sem (`src/postfx.ts:36`).
  - ACES com exposição 1,08 (`main.ts:64-65`). Sol constante (`:76`). Névoa linear de 400 a 16.000 m (`:78`). Ambiente LDR com intensidade 0,55 (`:80-82`).
  - Sombra num mapa único de ±28 m (`:86-87`). DPR até 2 (`:62`).
  - O perfil de toque é `(pointer: coarse)` ou `ontouchstart` (`:45`). Um notebook com tela de toque cai no perfil de toque.
- **Céu:**
  - `toneMapped:false` (`src/world.ts:198`) só é lido pelo WebGLRenderer clássico (`node_modules/three/src/renderers/WebGLRenderer.js:2389`). Com tone mapping, o WebGPURenderer desenha num quadro intermediário e aplica a curva no quadro inteiro (`common/Renderer.js:2609-2616`).
  - Pela leitura do código, a foto do céu passa duas vezes pela curva, o contrário do que diz `docs/CAFARNAUM-CENARIO.md:70`. Falta a prova por imagem. O panorama já é LDR tonemapeado (`public/textures/sky/LICENSE.json:10`).
  - O `prepare_sky.mjs` só grava WebP (`:13-14`). O sharp instalado não lê nem grava Radiance HDR: `sharp.format.rad` vem com entrada e saída falsas (conferido).
- **Água:** o mapa de normais se repete a cada 3,5 m (`world.ts:166`). A água é transparente e não grava profundidade (`:178`).
- **Pós-processamento (`?fx`, só no PR #1):**
  - O GTAO multiplica a cor final (`postfx.ts:49-50`), e o master usa TRAA (`:53`).
  - **`fx=master` está bloqueado:** com o TRAA, a água some (GRAFICO-MASTER.md:95).
- **Bench:**
  - Seis planos fixos (`src/bench.ts:82-87`). O tempo de quadro é o intervalo entre quadros, limitado pelo vsync (`tools/bench.mjs:7-8`).
  - O relatório grava url, viewport, dpr, toque e canal (`bench.mjs:20-21`), mais backend, qualidade e `texturesSize` (`main.ts:507-508`). Não grava GPU, navegador nem commit. Só tira imagens paradas (`bench.mjs:40-46`).
  - `texturesSize` conta textura comprimida como 1 byte (`common/Info.js:451-453`). `info.memory.total` existe e não é gravado (`Info.js:117-136`).
  - A r186 tem:
    - `trackTimestamp` (`Backend.js:76`). No WebGPU exige `timestamp-query` (`WebGPUBackend.js:298`); no WebGL 2, `EXT_disjoint_timer_query_webgl2` (`WebGLBackend.js:272`).
    - `resolveTimestampsAsync` (`Renderer.js:3018`), `compileAsync` (`:896`) e `reversedDepthBuffer` (`:97`).
  - O Playwright não está nas devDependencies (`package.json:20-30`). O README manda instalar global (`README.md:43-44`), mas o `bench.mjs` carrega por `createRequire` local ou por `PLAYWRIGHT_PATH` (`:11`).
- **Estabilidade:**
  - A perda do dispositivo WebGPU recarrega a página em `?gl=1` sem aviso (`main.ts:71`). Uma falha geral só troca o texto do botão (`:539-543`). Um modelo que falha só gera aviso no console (`src/tripo-assets.ts:27`). "Jogar de novo" recarrega a página (`main.ts:311`).
  - Não há tratamento de `error`, `unhandledrejection` nem `webglcontextlost` (grep em `src/`), nem monitoramento (`docs/PUBLICACAO.md:89-90`).
  - O hash dos modelos usa `crypto.subtle` (`tripo-assets.ts:23`), que só existe em contexto seguro. Por HTTP na rede local, os 14 modelos cairiam na forma provisória.
- **Acesso às variantes:** `?bench` e `?fx` só existem no PR #1. As prévias e as URLs de deploy exigem login na Vercel (`PUBLICACAO.md:45-46`), e o push na `main` dispara a produção (`:38-39`).
- **Números registrados** (nenhum medido por este plano):
  - Codex na RTX: ~166 draw calls; texturas de ~1,2 GB no desktop e ~1,05 GB no viewport emulado. Produção: 16.733.496 bytes (GRAFICO-MASTER.md:17-20).
  - Contêiner sem GPU, nesta sessão: 54 a 216 draw calls nos planos e `texturesSize` de 1206 MB a 640×400. Nenhum arquivo nem commit registra isso. Além disso, GRAFICO-MASTER.md:74 diz "166–216" e precisa ser corrigido.
  - `HANDOFF.md:99`: 482–485 contra um orçamento de 120. Era o contador antigo, cumulativo (TRIPO-RUNTIME-R1.md:25), e não se compara com os outros.
  - Cálculo a partir dos 14 GLB de runtime, lidos nesta rodada: 42 texturas WebP de 2048², três por modelo. Em RGBA8 com mipmaps, dá ≈940 MB. É cálculo, não medição na GPU.
- **Texturas:**
  - As texturas são 2048² em WebP q88, por decisão do Alex (`tools/prepare_tripo.mjs:51,56`).
  - O TRIPO.md pede 1024² para pessoas e barco (`TRIPO.md:36,43-49`), mas o catálogo marca 2048 para todos.
- **Elenco:**
  - Os seis humanos estão como `awaiting-rig-not-used-in-game`, e o carregador só baixa os `runtime` (`tripo-assets.ts:12`).
  - Para os `runtime`, o teste fixa 8.000 triângulos em todo modelo que não é o herói (`test/models.test.ts:19,32`) e o clipe `['walk']` no herói (`:36`).
  - Os NPCs têm de 9.866 a 11.856 triângulos (catálogo). Promover qualquer um quebra o teste.
  - O orçamento que o código lê só tem o herói (`src/data/modelos.json`, área do Codex, ASSETS.md:89).
  - O herói tem 65 juntas `mixamorig:*` (lido do GLB). A regra "sem WebAssembly" está em `models.test.ts:26`.
- **Herói:** a velocidade da animação é `v/2,5`, limitada entre 0,55 e 2,1 (`src/animated-actor.ts:63`). Ele anda a 2,5 m/s e corre a 5,2 m/s (`main.ts:379`).
- **Chamado:**
  - A fala e o evento `follow` saem no mesmo passo (`src/missions.ts:117-124`).
  - Os seguidores ficam em `y = max(chão, −0,6)` e não passam pela colisão (`main.ts:414-427`; a colisão está em `:314-324`).
  - O barco fica a 26 m da margem (`tools/build_world.py:52`).
  - Mc 1:20 aparece entre aspas, como fala (`src/hud.ts:131`).
  - O cartão final tem só "Jogar de novo" e "Construa conosco" (`index.html:78-79`).
  - `versiculos` já traz os versículos inteiros (`src/data/mc-pescadores.json`; Mc 1:17 começa com "Jesus lhes disse:").
  - Regerar o JSON exige um checkout do biblia-conectada, o `cv2` e os ladrilhos do S3 (`build_world.py:15,30,36-40`).
- **Som:** é todo sintetizado, sem arquivos (`src/audio.ts:1-3`). `tick()` existe (`:50`), mas `main.ts` nunca o chama.
- **Save:**
  - A junção de cópias pega o maior valor (`src/save.ts:85`), o que desfaria "Começar do zero" (`:112`).
  - O bug é latente: a junção só roda com a nuvem (`main.ts:279`; `cloud.ts:88`), que está desligada (`nuvem.json:2`). O teste `save.test.ts:83` fixa o máximo de propósito.
- **Controles:**
  - Teclas fixas (`src/input.ts:36,96-97`). Campo de visão fixo (`main.ts:136`). A câmera volta sozinha para trás do herói (`:387`).
  - O movimento reduzido vem só do sistema (`:333`). A qualidade só muda pela URL ou por `#baixa` (`:46-49`).
  - Leitor de tela nunca foi testado (`docs/CONSTRUA-CONOSCO.md:53-54`).
- **Infraestrutura:**
  - Não há integração contínua: `.github/` só tem `ISSUE_TEMPLATE`. A proteção da `main` foi pedida (`HANDOFF.md:53`) e não foi conferida. Os testes exigem as malhas baixadas (`models.test.ts:21`).
  - O `.gitignore` cobre `*.glb`, `*.gltf`, `assets-src/` e `public/models/` (`:9-19`), mas não `*.ktx2`.
- **Regras de trabalho:**
  - Créditos Tripo: o teto do lote 1 era 1.200 créditos existentes, sem compra. Restam 175 desse teto, e nenhuma geração deve começar só para gastar (`HANDOFF-CODEX.md:77-80`).
  - Arte e ícones são do Codex ou do Higgsfield (`ASSETS.md:68-71`).
  - `src/world.ts` é proposta do Codex (`ASSETS.md:91`), e antes de mexer na área de outro é preciso avisar na PR dele (`:81`).
  - Os arquivos da integração R1 do Codex (6e35ff1, 424a096) são `tripo-assets.ts`, `animated-actor.ts`, `check_tripo.mjs`, `check_world.mjs`, `prepare_tripo.mjs` e `prepare_sky.mjs`. O `models.test.ts` também foi alterado por último ali.

## 3. Marcos

Legenda: esforço P (pequeno), M (médio) ou G (grande). O ganho percebido é estimativa e só se confirma nas imagens e nos vídeos que o Alex avaliar.

**Regras de todo marco:**
- Cada marco tem duas saídas:
  - **(A) Merge atrás da flag:** testes, `check_touch` e `check_world` passando e capturas no contêiner. Só prova que funciona.
  - **(B) Promoção a padrão:** acontece apenas no R8 (PC) ou no R11 e R14 (toque), com número medido em aparelho real e o OK escrito do Alex.
- Todo marco usa PR em rascunho e commits pequenos na `claude/...`. Fecha com uma entrada no diário: commit, origem de cada número e tentativas que falharam (`docs/DIARIO-DESENVOLVIMENTO.md:158-163`).
- As trilhas de imagem e de cena do Claude só correm em paralelo depois que o R4 tirar os ganchos de `main.ts` (543 linhas). Sem isso, correm em sequência (`HANDOFF-CODEX.md:108-110`).

### Onda 1 — curta e entregável (R4–R9)

#### R4 — Passo zero: base, acesso e portão de medição · Esforço G · Ganho baixo (pré-requisito de tudo)

| Tarefa | Dono | Arquivos | Critério de aceite |
|---|---|---|---|
| Decidir a base, a URL HTTPS dos celulares e a regra de deploy (decisões 1 a 3) | Alex | — | Decisão escrita no PR #1 |
| Combinar na PR do Codex as mudanças nos arquivos da R1 dele e quem fica com céu e tone mapping. Registrar `sky.ts`, `camera.ts`, `followers.ts` e `session-log.ts` na "Divisão de arquivos" | Claude, Codex | `ASSETS.md` | Aceite do Codex na PR antes do R5 e do R6 |
| Tirar de `main.ts` os ganchos de seguidores, câmera e céu para módulos próprios, sem mudar o comportamento | Claude | `src/main.ts`, módulos novos | Build verde; capturas iguais às da base nos dois viewports |
| Diário de sessão em `sessionStorage`: início, pulso a cada 5 s, backend, perda de dispositivo ou de contexto, `error`, `unhandledrejection` e último plano. Na carga seguinte, avisa se a sessão anterior não terminou com `pagehide` limpo. Nada sai do aparelho | Claude | `src/session-log.ts` e `test/session-log.test.ts` (novos), `main.ts` | Um teste no Playwright derruba a página e encontra a marca |
| Carimbo de build: SHA do commit nos créditos e no bench.json, GPU (`adapter.info` ou `WEBGL_debug_renderer_info`), userAgent, versões da three e do Playwright, `heroSource` (hoje só no `__gta`, `main.ts:132,513`) e quantos modelos carregaram | Claude | `vite.config.ts`, `main.ts`, `src/credits.ts` | Campos presentes no bench.json do contêiner |
| `gpuMs` p50/p95 com `trackTimestamp`; sem suporte, grava `null` com o motivo. `cpuMs` p50/p95, do início do quadro até antes do render | Claude | `main.ts`, `bench.ts`, `test/bench.test.ts` | Teste da agregação e do caso `null` |
| Memória: `textureBytesEstimated` por formato e por origem; `info.memory.total` e geometrias; estimativa dos alvos de render (largura × altura × DPR² × bytes × amostras). `performance.memory` só onde existir, com rótulo | Claude | `bench.ts`, `test/bench.test.ts` | Teste com texturas sintéticas, comprimidas e sem compressão |
| No `bench.mjs`: `BENCH_UNCAPPED`, `BENCH_REFRESH_HZ`, `BENCH_WARM` (2ª visita) e `BENCH_NET=4g`. `npm run bench:all` define as variáveis no próprio Node, para rodar igual no PowerShell. Propor o Playwright com versão fixa nas devDependencies | Claude | `tools/bench.mjs`, `package.json` | Sem a taxa do monitor informada, o resumo avisa que o tempo pode estar no teto do vsync |
| Painel do `?bench`: resultado na tela e botão Copiar, que é o padrão. "Abrir no GitHub" só com um resumo compacto (p95 e draw calls por plano) e título `[Bench]`, já que rótulos não passam pela URL (`src/feedback.ts:41`). Antes de abrir, mostrar o texto exato com "Seu texto será público no GitHub" e os campos do aparelho visíveis, removíveis e com consentimento próprio (`CONSTRUA-CONOSCO.md:11-12,33-34`) | Claude | `main.ts`, `index.html`, `tools/check_feedback.mjs` | `check_touch` acha o botão em 390×844; teste de tamanho (≤1000 caracteres, `feedback.ts:4`); nada do aparelho sai sem consentimento |
| `tools/compare_bench.mjs` (novo): recusa relatórios com viewport, DPR, canal, GPU ou commit diferentes; imprime p95, `gpuMs` e `cpuMs` por plano; monta 6 pares de imagens | Claude | `tools/compare_bench.mjs` | Recusa um par inválido e gera a tabela num par válido |
| Guardas novas: `test/budget.test.ts` (bytes, triângulos e nº de texturas por item do catálogo, com o valor atual como teto); `test/rig-guard.test.ts` (ninguém importa `src/rig.ts`); `git ls-files` sem `.glb`, `.ktx2` ou `assets-src`; `*.ktx2` no `.gitignore`. O orçamento por item em `modelos.json` só com o Codex e depois da decisão 13 | Claude (o Codex no orçamento) | `test/`, `.gitignore`, `src/data/modelos.json` | Cada teste falha numa mudança de prova e passa com o lote atual |
| Planos extras por parâmetro, fora da média e do `vsFirst`: `percurso` (rota fixa gravada com `recordVideo`) e `fala`. `?bench=soak&min=10` grava o p95 por minuto e as recargas lidas do diário de sessão | Claude | `bench.ts`, `bench.mjs` | Teste prova que os seis planos padrão não mudaram |

**Depende de:** as decisões 1 a 3.

**Saída:**
- `npm run build` verde.
- `bench:all` no contêiner sem erros e com os campos novos.
- `?bench=1` aberto por HTTPS num celular físico, com `heroSource = tripo-r1/hero-native-skeleton`, os 14 modelos carregados e o backend registrado.

**Riscos:** o timestamp de GPU pode faltar no Safari iOS e no WebGL 2 (os dois backends degradam sem erro). Não foi verificado se o `BENCH_UNCAPPED` funciona no Chrome do Windows.

#### R5 — O chamado encenado, só com código · Esforço M · Ganho alto

| Tarefa | Dono | Arquivos | Critério de aceite |
|---|---|---|---|
| `src/followers.ts` (novo, puro): trabalhando → vira para o herói → ouve enquanto a citação está na tela → larga a rede → segue | Claude | `src/followers.ts` e `test/followers.test.ts` (novos), `main.ts` | Ninguém se move antes de a fala acabar; mesmo resultado com passo de 0,016 s e de 0,5 s; `test/missions.test.ts` sem alteração |
| Saída de Tiago e João do barco pela opção do Alex. Proposta: corte neutro no fim de Mc 1:20 que os põe na margem | Claude | `followers.ts`, `tools/shots.mjs` | Ninguém abaixo do chão, abaixo de 0 sobre a água ou dentro do casco; `shots.mjs` falha se `heightAt < −0,1` no fim |
| Cada vaga da formação passa por `blocked(x,z,false)`; ~0,7 m entre seguidores; fila única nas vielas | Claude | `main.ts`, `tools/check_world.mjs` (com aceite do Codex) | Com os seguidores andando por comando, sem teleporte, `blocked()` dá falso em toda amostra |
| `citacao.modo = 'discurso' \| 'relato'`, derivado em TS de `versiculos`: é discurso quando há verbo de dizer antes do fragmento. Sem regerar o mundo. O relato sai sem aspas e sempre com "Bíblia Livre · referência" | Claude | `src/missions.ts`, `hud.ts`, `test/data.test.ts`, `shots.mjs` | O fragmento continua igual ao versículo; Mc 1:20 nunca sai com "Narrativa do jogo" nem se oculta pela regra de NARRATIVA.md:19; vale nos dois viewports |
| `naturalSpeed` e `footSlip` do clipe walk, por cinemática direta; velocidade da animação = `v/naturalSpeed` | Claude (com aceite do Codex) | `animated-actor.ts`, `test/animated-actor.test.ts`, `check_tripo.mjs` | Clipe sintético dentro de 5%; no GLB real, com o AnimationMixer real, faixa e limiar propostos para o Alex fixar |
| "Jogar de novo" sem recarregar a página e um botão novo "Continuar explorando" | Claude | `main.ts`, `index.html`, `hud.ts`, `shots.mjs` | Duas partidas seguidas na mesma página terminam com 4 seguidores e nenhum erro |

**Saída A:** `shots`, `check_touch`, `check_world` e `check_tripo` passando em 390×844 e 1280×800, mais o vídeo do `percurso`. **Saída B:** o Alex aprova as capturas e o vídeo. **Riscos:** o ritmo de andar é decisão do Alex. O deslize de ~2× é estimativa, ainda não confirmada no navegador.

#### R6 — Céu, sol e atmosfera em `src/sky.ts` (dono combinado no R4) · Esforço M · Ganho alto

| Tarefa | Dono | Arquivos | Critério de aceite |
|---|---|---|---|
| Baixar no PC os `.hdr` oficiais de 1k e 2k do mesmo ativo CC0 da Poly Haven, sem reamostrar (o sharp não lê HDR), cada um com SHA-256 fixado | Codex (reserva: Alex) | `tools/prepare_sky.mjs`, `public/textures/sky/LICENSE.json` | O script recusa um hash diferente; os bytes a mais ficam informados |
| `?sky=hdr`: HDRLoader e PMREM, com o fundo na mesma rotação do ambiente; `sunFromPanorama` substitui a constante do sol | Claude | `src/sky.ts` e `test/sky.test.ts` (novos), `main.ts` | Sol sintético achado a menos de 1°; azimute da luz a menos de 5° do sol da imagem; nos planos margem e panorama, a sombra cai do lado oposto ao sol |
| Provar a segunda curva tonal com par de imagens (sem tone mapping × ACES). Só então corrigir CAFARNAUM-CENARIO.md:70 | Claude | `docs/CAFARNAUM-CENARIO.md` | Par de imagens anexado ao PR |
| `?tm=aces\|agx\|neutral` e `?atmo=1` (`scene.fogNode`: névoa por densidade e por altura, com a cor puxada para o sol). Crédito do HDR em ATTRIBUTION.md e em `credits.ts` | Claude | `main.ts`, `credits.ts`, `ATTRIBUTION.md`, `test/postfx.test.ts` (novo) | Parsers com teste; nenhuma draw call nova; teste novo confere o crédito do HDR em `credits.ts` e no manifesto |

**Saída A** apenas. O critério de p95 vai para o R8. **Riscos:** o fundo passa de 4K LDR para 2k HDR (decisão 8). Não foi conferido se o fundo e os reflexos ficam espelhados entre si.

#### R7 — Sensação: câmera, velocidade, som e primeiro quadro · Esforço M · Ganho alto

| Tarefa | Dono | Arquivos | Critério de aceite |
|---|---|---|---|
| `src/camera.ts` (novo, puro): mola amortecida e exata para qualquer passo de tempo. Quando algo tapa a visão, aproxima na hora e volta em ~0,3 s. Ombro com teste de colisão. Aceleração gradual entre 70% e 100% do joystick. Com movimento reduzido, mola curta e ombro fixo | Claude | `camera.ts` e `test/camera.test.ts` (novos), `main.ts`, `check_world.mjs` | Testes de convergência, de salto máximo por quadro e de velocidade contínua; deslocamento máximo da câmera na viela registrado antes e depois |
| Som: canais separados, tecla M, botão "Som" em texto, suspensão com a aba oculta ou com o diálogo aberto, ambiente mais baixo durante a fala, `tick()` no aviso de ação. Passos pela fase do walk atrás de `?som=2` | Claude | `audio.ts`, `main.ts`, `test/audio-steps.test.ts` (novo), `check_touch.mjs` | O áudio fica suspenso com o diálogo aberto e volta depois; teste de cadência dos passos |
| Fontes de áudio pela decisão 16: manifesto `public/audio/LICENSE.json` com SHA-256 e créditos com teste. Passos diferentes por material e um ambiente por zona | Claude (fontes: Alex) | `public/audio/`, `credits.ts`, `ATTRIBUTION.md` | Bytes a mais informados; teste do manifesto |
| `compileAsync` antes de liberar o início. Ordem de carga: herói, casas, chão e céu antes da vegetação. Progresso em bytes vindo do catálogo; falha de modelo avisada na tela | Claude | `main.ts`, `tripo-assets.ts` (com aceite do Codex), `index.html` | `warmupMaxMs` e `loadMs` medidos no R8 |

**Saída A** e vídeo do `percurso`. A aprovação no PC e no celular vai para o R8, porque a ~1 fps do contêiner não dá para julgar a mola. **Riscos:** câmera mal ajustada pode enjoar; no iOS o áudio pode voltar travado do segundo plano.

#### R8 — Rodada de medição 1 e primeira promoção, só no PC · Esforço P · Ganho alto

| Tarefa | Dono | Arquivos | Critério de aceite |
|---|---|---|---|
| `bench:all` na RTX com a base, `sky=hdr`, `tm=*`, `atmo=1` e `fx=alto`, com e sem `BENCH_UNCAPPED`; anotar GPU, VRAM, driver e taxa do monitor | Codex (reserva: Alex, com um comando) | — | bench.json, imagens e vídeo anexados ao PR |
| 1 Android e 1 iPhone na URL da decisão 2: as variantes com `?bench=1` e uma rodada de `?bench=soak&min=10` | Alex | — | Um resultado por aparelho, com modelo, navegador, backend e recargas tiradas do diário de sessão |
| Promoção no PC: céu e atmosfera com as mesmas draw calls e `gpuMs` p95 no máximo 5% acima da base (proposta); câmera e som aprovados pelo Alex no PC e num celular físico | Alex | — | OK escrito no PR |
| Ligar no perfil PC o que o Alex aprovar. `?perfil=anterior` volta todos os padrões. O toque não muda. `fx` fica fora. Registrar no PUBLICACAO.md o ID do último deploy bom. `check_touch` também em webkit e firefox, com `?gl=1` | Claude | `main.ts`, `docs/PUBLICACAO.md`, `GRAFICO-MASTER.md`, diário | No toque emulado, mesmas draw calls e mesma memória da base; o diário separa aparelho físico, viewport emulado e contêiner |

**Depende de:** saída A do R4 ao R7. **Saída:** produção atualizada só pelo caminho da decisão 3. **Riscos:** a regra de perfil (`main.ts:45`) erra nos dois sentidos (decisão 9).

#### R9 — Lote único de rig (corre em paralelo desde o R4) · Esforço G · Ganho alto

| Tarefa | Dono | Arquivos | Critério de aceite |
|---|---|---|---|
| Aprovar por escrito um teto novo de créditos (os 175 eram do lote 1), a ordem de prioridade e a textura das pessoas (decisão 13) | Alex | — | Decisão escrita antes de qualquer geração |
| Auto-rig no site do Tripo dos 6 humanos, na convenção do herói (65 juntas `mixamorig:*`, lidas do GLB dele), com os clipes do TRIPO.md; `idle`, `run` e `beckon` do herói; publicação no host separado com SHA-256 | Codex | `src/data/tripo-assets.json`, `ASSETS.md` | Validador glTF sem erros; só adultos, sem halo; nada no git nem no biblia-conectada; clipes que faltarem ficam anotados |

**Depende de:** as guardas do R4. Sem elas, os NPCs (9.866 a 11.856 triângulos) quebram `models.test.ts:32` e os clipes novos quebram `:36`. **Reserva:** `src/people.ts`. **Riscos:** a túnica pode deformar mal. Não se sabe o custo do auto-rig nem os nomes de ossos que ele gera. Memória (hipótese): com três mapas de 2048² por NPC, ~67 MB cada e ~400 MB os seis.

### Onda 2 — ordenada; cada marco só começa com o anterior medido (R10–R17)

#### R10 — KTX2 com reserva WebP · Esforço M · Ganho alto no celular
- **Alex:** decide a exceção à regra "sem WebAssembly" (`models.test.ts:26`) e a meta de memória.
- **Claude:**
  - KTX2Loader com o transcodificador Basis copiado da própria three, com hash fixado.
  - A licença é **Apache-2.0** (Basis Universal, BinomialLLC; `node_modules/three/examples/jsm/libs/basis/README.md:43-45`): texto da licença junto dos arquivos e linha em ATTRIBUTION.md e `credits.ts`, com teste.
  - Mais `?tex=webp` e falha avisada na tela.
- **Codex:** instala o KTX-Software com versão fixada e registrada (`toktx` e `basisu` faltam, GRAFICO-MASTER.md:51), gera os KTX2 a partir dos originais (UASTC nas normais) e publica no host.
- **Aceite:**
  - Imagem idêntica com o catálogo atual; com o WASM bloqueado, cai no WebP sem erro.
  - Memória estimada abaixo da meta (proposta: −60%), com os bytes de download informados.
  - 10 minutos em 2 celulares físicos sem recarga, conferidos pelo diário.

#### R11 — NPCs rigados no jogo, PC primeiro (`?npc=rig`) · Esforço M · Ganho alto
- **Claude:** clipe por nome, com um mixer por NPC; `SkeletonUtils.clone` nos dois empregados; `beckon` só nos braços; mistura idle/walk/run; olhar no espaço do mundo; `people.ts` como reserva.
- **Aceite:** draw calls dos planos pescadores e barco menores que a base; `cpuMs` p95 dentro da meta; `check_tripo.mjs` confere o esqueleto de cada NPC.
- **No toque:** só depois do R10 e do R13 e de um soak de 10 minutos sem recarga.

#### R12 — Água e margem sem passe extra (`?water=2`) · Esforço M · Ganho alto
- **Codex** (commit em `world.ts`, depois de fechar a atualização dele): duas camadas de normais, espuma pela profundidade, opacidade mínima na linha d'água, areia molhada e cáusticas.
- **Claude:** flag, testes e bench.
- **Aceite:** nenhuma draw call nova; `gpuMs` p95 no máximo +5%; `test/world-layout.test.ts` intacto; diferença de imagem (SSIM pelo sharp) e vídeo; água legível num celular físico.

#### R13 — Draw calls e sombras · Esforço M · Ganho médio
- **Codex:** LOD, instancing e menos materiais em `world.ts` (ASSETS.md:91). Também divide os grupos próximos (sombra até ~45 m) e tira a sombra das casas distantes.
- **Claude:** `?shadow=csm` com CSMShadowNode.
- **Aceite:** plano pescadores dentro da meta de draw calls do Alex (orçamento atual de 120: HANDOFF.md:99; TRIPO.md:34); `gpuMs` no máximo +8%; `?gl=1` sem erro.
- **Ordem:** se os 120 valerem no celular, o R13 vem antes do R11 no toque.

#### R14 — Celular: TAAU, DPR dinâmico, menu Gráficos e `?depth=rev` · Esforço M · Ganho médio
- **Claude:**
  - TAAU com nitidez (o nome é TAAU, nunca DLSS).
  - DPR dinâmico e "Gráficos: Automático / Alto / Baixo" na pausa.
  - `?depth=rev`, que provavelmente exige desligar a profundidade logarítmica (`main.ts:61`; não verificado).
- **Aceite:**
  - Em 1 Android e 1 iPhone físicos: p95 com TAAU a 67% no máximo X% do nativo e SSIM ou FLIP no mínimo Y contra o mesmo plano em DPR 2; 10 minutos sem recarga.
  - Com a CPU desacelerada pelo protocolo de depuração do Chrome, a resolução baixa em até X s sem oscilar. O viewport emulado só prova funcionamento.
- **Alex:** decide o padrão no toque. Hoje é o alto, por pedido dele (README.md:41).

#### R15 — Cinema nas falas e oclusão só na luz indireta · Esforço M · Ganho médio (depois do R11 e do R13)
- A oclusão passa a escurecer só a luz indireta, no lugar de `postfx.ts:49-50`.
- Profundidade de campo no plano da fala, respeitando movimento reduzido.
- Godrays só na direção do sol da cena.
- **Aceite:** `gpuMs` no máximo +10%; checagem de luminância sem halo nem luz sobre a cabeça de ninguém (TRIPO.md:27); vídeo do plano `fala`.
- Tarefa própria: testar as hipóteses do TRAA que apaga a água (GRAFICO-MASTER.md:95-99).
- A LUT fica com o Codex ou o Higgsfield, com créditos aprovados.

#### R16 — Jogo, save e acessibilidade · Esforço M · Ganho médio
- **Save v2** local, com id de partida e junção antes de enviar; muda `save.test.ts:83` junto, com teste de migração v1→v2. A nuvem continua desligada.
- **Pausa** com Esc, congelando `t` (`main.ts:348`). Tempo de leitura ×1, ×1,5 ou ×2. Gamepad, com teste de mapeamento.
- **Acessibilidade:**
  - Remapear teclas; campo de visão, sensibilidade e inversão da câmera; opção para desligar a volta automática da câmera.
  - "Reduzir movimento" dentro do jogo; legenda com tamanho e fundo opaco; joystick para canhoto.
  - A distância sai da região `aria-live`; fontes de pelo menos 11 a 12 px.
  - Rodada de VoiceOver e TalkBack pelo Alex, registrada no diário.
- **Missões por dados** (`reach` com fala): toda fala nova é fragmento literal da BLIVRE com referência, ou texto com "Narrativa do jogo", testado como em `test/journey.test.ts`.
- **Aceite:** testes de unidade dos ajustes e `check_touch` verde nos dois viewports.

#### R17 — Mundo vivo sem rig · Esforço M · Ganho médio
- **Claude:** barcos no lago com a malha que já existe (`main.ts:103`), fumaça e aves por código, tudo atrás de flag.
- **Codex:** arte.
- **Aceite:** custo em draw calls e `gpuMs` medido no bench.

### Fila condicionada (sem data)
- **Chão em camadas e vento; vila sem esticamento** (teste de proporção entre 0,9 e 1,1); **reflexo real na água**, só no perfil ultra do PC. O Codex faz em `world.ts`; o Claude faz a flag, o teste e o bench.
- **Trocar a mão em SVG provisória** (`index.html:41-50`) e o joystick pela arte do Codex ou do Higgsfield (ASSETS.md:75-76) antes de dar o HUD do celular por definitivo.
- **Moradores**, só adultos (TRIPO.md:26,195): no máximo ~8 com pele, perto da margem, medidos. Hoje não há teto de créditos autorizado pelo Alex.
- **Episódio 2** (Mc 2:1-12): depende do roteiro do Alex e de um teto de créditos.
- **Versão nativa em Unreal na RTX**, com os mesmos seis planos (GRAFICO-MASTER.md:59). Os termos de licença do Unreal não foram verificados.

## 4. Decisões só do Alex

1. **Base:** merge do PR #1 na `main` ou PRs empilhados sobre ele. O merge já é deploy de produção (PUBLICACAO.md:38-39) e leva junto `?bench`, `?fx`, o plano de cinema e a mão provisória.
2. **URL HTTPS dos celulares**, entre três opções:
   - (a) merge com tudo desligado por padrão e deploy aprovado;
   - (b) login na Vercel nos dois celulares (PUBLICACAO.md:45-46);
   - (c) link de compartilhamento da prévia (não verificado).
3. **Deploy e volta:** se a autorização "publicar cada incremento verificado" (HANDOFF-CODEX.md:8-9) vale para o Claude ou se cada deploy pede OK escrito; e se o rollback instantâneo da Vercel fica pré-autorizado.
4. **Metas por aparelho:** p95 ou FPS-alvo, memória total, draw calls por perfil, bytes e tempo da 1ª carga.
5. **Limiares:** +5% no p95 de GPU para céu e água, +8% para sombras, +10% para oclusão, −60% de memória de textura; os X e Y do R14.
6. **Máquina:** RTX 5060 ou 5060 Ti (GRAFICO-MASTER.md:17 contra :59), VRAM, taxa do monitor; e se haverá um PC mínimo para uma rodada.
7. **Celulares:** os modelos de 1 Android e 1 iPhone.
8. **Céu:** tone mapping (ACES, AgX ou Neutral) e fundo 4K LDR atual contra 2k HDR.
9. **Perfil PC:** a regra atual (`main.ts:45`) ou `(any-pointer: fine)`.
10. **Cada promoção a padrão** (PC no R8, toque no R11 e no R14), por escrito.
11. **Ritmo do herói e barco:** andar na velocidade natural do clipe ou manter 2,5/5,2 m/s; saída de Tiago e João pelo corte neutro, com o barco mais perto da margem ou com um clipe de descer.
12. **Créditos e arte:** teto novo para o rig; quem opera o Higgsfield e com quais créditos, com registro em ASSETS.md:71.
13. **Textura das pessoas:** 1024² (TRIPO.md:36) ou 2048 (catálogo; prepare_tripo.mjs:51).
14. **WebAssembly:** a exceção para o KTX2.
15. **Texto e voz:** versículos novos (Mc 1:18, 1:19, 1:21); diálogo autoral de Jesus com etiqueta; narração falada das citações.
16. **Áudio:** fontes (CC0, Higgsfield ou encomenda) e trilha.
17. **Escopo e idioma:** o que vem além do chamado (atividades livres, Episódio 2), com prazo do roteiro; e se o jogo fica só em PT-BR.
18. **A praia** (HANDOFF.md:95-96).
19. **Nuvem:** a migração do Supabase compartilhado, depois das conferências de HANDOFF.md:88-91.
20. **Integração contínua:** workflow de PR sem segredos e proteção da `main`, conferindo antes se gera cobrança.
21. **Identificadores `gta`:** `__gta` (`main.ts:512`), `gta:save` (`save.ts:7`) e `gta_saves` (`cloud.ts:3`).

## 5. Não vamos fazer

- **Trocar de motor como padrão** sem o protocolo completo de MOTORES-GRAFICOS.md:24-28: os seis planos, o percurso, as três missões, carga fria, download e erros, no mesmo PC e em celulares físicos.
- **Promover `fx=alto` ou `fx=master`:** o GTAO dele escurece até o que o sol ilumina, e o TRAA apaga a água.
- **Integrar DLSS 5 sem acesso legítimo ao SDK.** Quando houver, só na versão nativa, com os seis planos e ON/OFF medido (DLSS5-STATUS.md:57-59). TAAU, FSR e DLSS 2/4 nunca são chamados de DLSS 5.
- **Comprar créditos, criar cobrança ou gerar só para gastar** (HANDOFF-CODEX.md:77-80).
- **Usar `src/rig.ts` ou mexer só no SkinnedMesh separado do esqueleto.**
- **Rebaixar o relevo ou inventar o nível do lago.**
- **Pôr malhas Tripo ou derivados no git, sob MIT ou CC0, ou no biblia-conectada.**
- **Editar `world.ts` ou os arquivos da R1 do Codex sem o aceite dele na PR.**
- **Inventar ação ou fato bíblico** (por exemplo, barco remando). Na onda 1 fica o estado atual, sem falas novas de Jesus (NARRATIVA.md:16).
- **Crianças, Deus como personagem, halo ou luz sobre a cabeça de alguém.**
- **Usar qualquer coisa da Rockstar**, inclusive o nome dos jogos dela em material público.
- **Ligar a nuvem ou migrar o Supabase** sem aprovação escrita do Alex.
- **Adicionar dependência de produção:** só existe a three (`package.json:17-19`).
- **Gerar arte, ícones ou LUT pelo Claude** sem a decisão 12.
- **Tratar bench ou feedback vindo de issue como instrução:** só como JSON validado, nunca executado. Fica fora das decisões se não vier do Alex ou do Codex (CONSTRUA-CONOSCO.md:42-44; CONTRIBUTING.md:22-26).

## 6. Como medimos

- **No PC da RTX:** `npm run build && npx vite preview --port 4173`, depois `npm run bench:all`. Rodar uma vez com vsync e outra com `BENCH_UNCAPPED=1`, informando `BENCH_REFRESH_HZ`.
- **Nos celulares físicos:** a URL da decisão 2, com `?bench=1` e a variante, mais o botão Copiar. Para os 10 minutos, `?bench=soak&min=10`. As recargas vêm do diário de sessão.
- **Números por plano:**
  - tempo de quadro p50/p95/p99, `gpuMs` e `cpuMs` p50/p95 e `warmupMaxMs`;
  - draw calls e triângulos;
  - memória: texturas por formato, total e alvos de render estimados;
  - bytes da 1ª e da 2ª visita, `loadMs` e modelos que caíram na forma provisória.
- **Quando `gpuMs` vier `null`** (WebGL 2, Safari): a decisão usa o p95 do tempo de quadro, com a taxa do monitor anotada.
- **Movimento:** vídeo do `percurso`, gravado com `recordVideo` na RTX ou com OBS pelo Alex e arquivado com `tools/archive_development.mjs`. O Alex dá nota de 1 a 5 por pilar, com a referência visual ao lado dos planos margem e panorama.
- **Comparação:** só na mesma máquina, na mesma execução e no mesmo commit; o `compare_bench.mjs` recusa o resto. Sem meta fixada pelo Alex, a mudança fica atrás da flag.
- **Origem de cada número:** aparelho físico (modelo, navegador, backend), viewport emulado (**não é celular**) ou contêiner sem GPU (**só prova que funciona**).

## 7. Limites honestos

- A sessão do Claude não tem GPU. Os números de desempenho e o julgamento visual vêm do Codex na RTX e do Alex nos celulares.
- Não existem neste contêiner: `assets-src/tripo-r1`, as seis malhas de NPC, `toktx` e `basisu`. Não testei se a Poly Haven responde daqui.
- São estimativas, ainda não medidas:
  - os ~68° entre o sol e as sombras e o deslize do pé de ~2× (nenhum dos dois está em arquivo);
  - a segunda curva tonal no céu (só leitura de código);
  - os ≈940 MB das texturas Tripo (cálculo a partir dos GLBs) e os ~400 MB dos NPCs (hipótese).
- Os 85 a 95 FPS do Codex podem estar no teto do monitor dele.
- As draw calls divergem entre os registros e nenhuma vem deste plano:
  - 482–485: contador antigo;
  - ~166: Codex;
  - 54–216: contêiner, sem arquivo que registre.
- Não verificado:
  - comportamento do CSMShadowNode e do LightProbeGridNode neste jogo;
  - timestamp de GPU no Safari iOS e no Chrome do Windows;
  - profundidade invertida junto com a logarítmica;
  - custo em créditos e nomes de ossos do auto-rig;
  - termos de licença do Unreal;
  - link de compartilhamento de prévia da Vercel;
  - cache da Vercel para os GLB (`vercel.json` não define cabeçalhos);
  - WebGPU no Safari do iPhone;
  - custo de GitHub Actions;
  - se `npm i -g playwright` é encontrado pelo `createRequire` no Windows.
- O teto novo de créditos pode não cobrir o R9. Nesse caso, `people.ts` continua no jogo.

## Registro de verificação

V1 = fatos, V2 = regras, V3 = completude.

- **V1/V3, cabeçalho desatualizado:** agora `bbefb20` e 12 commits, com aviso para conferir o `git log`. O commit é só do diário; não confirmei que veio de outra sessão.
- **V1, MSAA impreciso:** corrigido com `q=low` e `postfx.ts:36`; só o `master` fica sem MSAA.
- **V1, limite de 8.000 triângulos:** agora diz que vale só para `runtime` (`models.test.ts:19`). A dependência R4 → R9/R11 entrou com os números do catálogo.
- **V1, orçamento por item:** a fonte passou a ser `modelos.json`, área do Codex. O conflito 1024² × 2048 virou a decisão 13, a resolver antes do guarda.
- **V1/V3, HDR pelo sharp:** confirmado que `sharp.format.rad` não tem entrada nem saída. O R6 agora baixa os `.hdr` oficiais com SHA-256, sem reamostrar. O 4K contra 2k virou a decisão 8.
- **V1/V3, `build_world.py`:** a derivação passou para TS, a partir de `versiculos`. As dependências externas estão listadas no §2.
- **V1, "Continuar explorando":** marcado como botão novo, com `index.html` e `hud.ts`.
- **V1, 54–216 e 1206 MB:** o grep não acha esses números em arquivo nem em commit; ficaram marcados como medição do contêiner sem registro. O "166–216" de GRAFICO-MASTER.md:74 ficou para corrigir, e os 482–485 foram atribuídos ao contador antigo (TRIPO-RUNTIME-R1.md:25).
- **V1, créditos:** agora cita HANDOFF-CODEX.md:77-80. O rig exige teto novo, e os lotes B e C viraram "sem teto autorizado".
- **V1, save:** marcado como latente com a nuvem desligada. O R16 muda `save.test.ts:83`.
- **V1, testes inexistentes:** os arquivos de teste novos estão marcados "(novo)". Entrou um teste concreto do crédito do HDR.
- **V1/V2/V3, link de issue do bench:** fica só um resumo de até 1000 caracteres, com o texto mostrado antes, consentimento próprio e título `[Bench]` (rótulos não passam pela URL, `feedback.ts:41`). O JSON completo fica só no Copiar e é dado não confiável.
- **V1, detecção de toque:** o risco agora vale nos dois sentidos e virou a decisão 9.
- **V1, ~939 MB:** recalculado lendo os 14 GLB (42 texturas WebP de 2048²): ≈940 MB, como cálculo. A convenção `mixamorig` agora diz que foi lida do GLB do herói.
- **V1, "por pedido dele":** mantido, porque a fonte existe: README.md:41 diz "por pedido de Alex".
- **V2/V3, licença do Basis:** corrigida para Apache-2.0 (README da basis, :43-45), com ATTRIBUTION.md, `credits.ts` e teste.
- **V2, merge é deploy:** as decisões 1 e 3 agora dizem isso, listam o que vai ao ar com o merge e perguntam sobre HANDOFF-CODEX.md:8-9.
- **V2, título com o nome do jogo de referência:** retitulado e retirado do material público; os identificadores `gta` viraram a decisão 21.
- **V2, tipo `narracao`:** trocado por `citacao.modo` (`discurso` ou `relato`), com teste de que Mc 1:20 nunca sai com "Narrativa do jogo".
- **V2, arquivos do Codex:** a coordenação entrou no R4, as guardas ficaram em arquivos novos e os módulos novos vão para a tabela do ASSETS.md.
- **V2, origem da memória no §1:** agora separa desktop (Codex) e viewport emulado, e diz que nunca foi medido em celular físico.
- **V2/V3, voz lendo a BLIVRE:** saiu de "não vamos fazer" e entrou na decisão 15. "Barco remando" continua proibido.
- **V2, DLSS:** reescrito conforme DLSS5-STATUS.md:57-59.
- **V2, Supabase:** virou a decisão 19, sem proibição permanente.
- **V2, Higgsfield:** quem opera e com quais créditos virou a decisão 12.
- **V2/V3, R14 sem critério:** o aceite agora exige aparelho físico, SSIM ou FLIP e 10 minutos sem recarga.
- **V2, fila sem dono:** o Codex fica com `world.ts` e o Claude com flag, teste e bench.
- **V2, protocolo de motor:** citado MOTORES-GRAFICOS.md:24-28 no §5.
- **V2, diário só no R8:** virou regra de todo marco, junto com PR em rascunho e commits pequenos.
- **V2, itens que faltavam:**
  - ícone da mão: na fila e na decisão 1;
  - `*.ktx2` no `.gitignore`: no R4 (a regra `*.glb` já é global, `.gitignore:18-19`);
  - como o Alex abre as variantes: decisão 2;
  - só adultos e sem halo: na fila e no R15;
  - falas do R16 literais ou etiquetadas;
  - Unreal com os seis planos.
- **V3, URL HTTPS (bloqueante):** virou a decisão 2 e a saída do R4. HTTP na rede local falha no `crypto.subtle` (`tripo-assets.ts:23`).
- **V3, ordem travada (bloqueante):** cada marco ganhou saída A e B; o p95 do R6 e a aprovação do R7 foram para o R8.
- **V3, sem registro de recarga (bloqueante):** entrou o diário de sessão no R4, com o soak de 10 minutos.
- **V3, bench sem GPU nem commit:** entraram o carimbo de build, a proposta de Playwright fixo e o `bench:all` em Node para o PowerShell.
- **V3, memória total e `cpuMs`:** entraram no R4, com `Info.js:136` e a estimativa dos alvos de render; o R11 passou a ser aceito também por `cpuMs`.
- **V3, sem redução de draw calls:** o R13 virou "Draw calls e sombras", com o Codex, e vem antes do R11 no toque se os 120 valerem.
- **V3, áudio incompleto:** manifesto e créditos no R7; fontes na decisão 16.
- **V3, acessibilidade rasa:** o R16 foi ampliado, com as linhas de `input.ts` e `main.ts` citadas no §2.
- **V3, sem menu de gráficos nem DPR dinâmico:** entraram no R14.
- **V3, defeitos de movimento em fotos paradas:** o `percurso` agora grava vídeo e é saída do R5, do R7, do R12 e do R15, com nota do Alex.
- **V3, onda 2 sem métricas:** agora há aceite medível do R10 ao R17.
- **V3, mundo vivo:** entrou o R17 e o escopo foi para a decisão 17.
- **V3, Codex no caminho crítico:** o Alex é reserva no bench e no céu; a instalação do KTX-Software entrou no R10.
- **V3, duas trilhas em `main.ts`:** a extração dos ganchos entrou no R4; sem ela, as trilhas correm em sequência.
- **V3, sem integração contínua:** virou a decisão 20.
- **V3, sem rollback:** decisão 3, o ID do último deploy bom no PUBLICACAO.md e `?perfil=anterior` no R8.
- **V3, rede de celular, PC mínimo e navegadores:** `BENCH_NET=4g`, decisões 4 e 6 e `check_touch` em webkit e firefox.
- **V3, idioma e não verificados:** o idioma está na decisão 17; os itens não verificados estão no §7.
