# QA R12 — continuidade do trabalho de Claude

13/11/2026. Base recebida `b470f32`. Estado inicial: **preparação dos testes; navegador ainda não executado nesta revisão**.

## Escopo e limites

Preservar as funcionalidades herdadas da PR #1: Bíblia, jornada, epílogo,
exploração da região, controle por toque, câmera e painel de contribuições.
Adicionar evidência do primeiro NPC aprovado, Simão, quando sua integração
estiver pronta. A matriz longa RTX da R11 não será repetida: alto já teve o
erro WGSL corrigido; a candidata SMAA foi rejeitada e Master conserva TRAA.
Efeitos permanecem opcionais, sem DLSS demonstrado.

O agente de QA edita somente `tools/check_takeover_r12.mjs`, este relatório
e evidências em `shots/`. Integração, build, commit e publicação pertencem
ao responsável principal. Nenhum teste envia formulários, pagamentos,
issues ou dados de jogadores. Requisições de escrita são bloqueadas.

## Protocolo curto

1. Chrome instalado, 1280 × 800 e 390 × 844, em contextos novos. WebKit do
   Windows, 390 × 844, sequencialmente. Não são testes em celulares físicos.
2. Conferir hash do bundle servido, carregamento real dos 14 GLBs principais,
   herói nativo sem primitivas e duas espécies da fauna após Começar. Falhas
   opcionais de NPC não podem bloquear a abertura do jogo.
3. Percorrer três missões com E no desktop e toque real no botão de ação no
   móvel. Teleportes são somente preparação dos encontros; trechos curtos
   por teclado/joystick são registrados separadamente e não provam caminhada
   contínua por todo o mapa.
4. Abrir Bíblia pelo HUD, comparar os versículos com os dados BLIVRE e
   conferir pausa/retomada. A missão continua acionável sem leitura prévia.
   Falas bíblicas e narrativa autoral conservam suas etiquetas distintas.
5. Simão: observar raiz real anexada, rig, idle e caminhada; amostrar posição,
   apoio, colisões e mixer enquanto segue. Durante fala e menus, não caminhar.
   Acompanhante visual, colisor e radar devem refletir apenas ator presente.
   Fotos em repouso e movimento não substituem revisão dos pés em declive.
6. Final, epílogo e exploração livre: ação Continuar explorando, fala literal
   de Marcos 1:21, descoberta de lugares e limite da região. Persistir e
   recarregar sem perder progresso nem duplicar atores.
7. Falha de herói 404: estado terminal, botão de recuperação e nova tentativa
   real. Falha opcional Simão 404: jogar sem substituto geométrico e sem ciclo
   de requisições. Guardar erros intencionais separados dos inesperados.
8. Painel: fixtures de respostas públicas já versionadas, números calculados,
   cache de cinco minutos, recusa 403 e recuperação, sem email exposto ou
   rolagem lateral. Fixtures verificam comportamento, não estado atual do GitHub.
9. Guardar screenshots, eventos de página/console/rede, bytes Resource Timing
   e janela curta requestAnimationFrame/performance.now. FPS do PC não é FPS
   do iPhone. O backend, canvas e DPR efetivos acompanham o resultado.

## Parecer local auxiliar

Foi usada uma única chamada autorizada ao `gemma4:12b-it-qat`, com timeout de
60 segundos, `keep_alive=0` e nenhum download. O modelo estava instalado e
`ollama ps` voltou vazio. Texto e métricas ficam em
`shots/r12-local-review/gemma.json`. Não foi enviado código nem segredo.
O Ollama informou 143 tokens de entrada, 671 de saída e 26,76 segundos
totais, incluindo 13,75 segundos de carga. Esses são contadores locais;
nenhuma cobrança de API/crédito foi criada nem se estimou energia em reais.

Aproveitados como hipóteses: 404 do NPC/herói, save corrompido, pausa próxima
à transição fala/seguir. Descartadas sugestões sem base no projeto: centenas
de slots de save, uma suposta regra bíblica que impediria agir e métodos de
Playwright que não existem. O parecer **não é prova de funcionamento**;
os resultados abaixo dependerão dos testes reais.

## Resultados

O harness passou `node --check`. Revisão independente de leitura levou a
duas precauções: medir FPS durante gameplay com o NPC e estreitar a exceção
do console ao erro deliberado do herói, preservando qualquer outra falha.
Essa revisão não executou navegador.

### Primeira tentativa desktop — falha preservada

Bundle `index-ohH4KNkV.js`, SHA-256
`8bbdfa740c7c880abb2a7fdee098eb1196283dd962ca1671de9b20cb00a7da6b`.
Chrome 1280 × 800 abriu o jogo, com 14 assets principais e duas espécies.
O NPC não chegou a solicitar seu GLB: `npcManifest()` recusou a base `./`
usada pelo Vite, com o warning **NPC base must remain same-origin**.

Resultado: integração de Simão reprovada nesta tentativa. O jogo permaneceu
aberto sem substituto geométrico e sem erro de página/rede. Evidência em
`shots/takeover-r12-desktop-r1/report.json` e `chrome-desktop/failure.png`.
O problema foi entregue ao responsável pelo runtime; o navegador foi fechado
antes de novo build. Não se atribui essa tentativa ao próximo bundle corrigido.

### Build corrigido — aprovado nos ensaios delimitados

Fonte baseada em `b470f32` com alterações R12. A integração informou build
com **301 testes CPU aprovados** (300 no primeiro build, antes da correção
da base relativa). O agente de QA executou os navegadores e
`node --check`; não atribui a si a execução daquela suíte CPU.

Jogo recebido em cada execução: `index-DCAF9t8B.js`, SHA-256
`4447971877748d9c906758141d91e4cb6b3b5bb8ea3c0a02747f27e74cefb1b5`.
Painel: `painel-DGLr7N-_.js`, SHA-256
`9c1bfaecdd4048fe8f41208ba62eeea729072130dfa809a2fa8f49f304c77b6a`.
Serviço local `http://127.0.0.1:4199/`; nenhuma publicação por este agente.

| Caso final | Gates nomeados | Evidência em `shots/` |
| --- | ---: | --- |
| Chrome 1280 × 800, WebGPU | 43 | `takeover-r12-desktop-r3` |
| Chrome 390 × 844, UA iPhone, WebGL2 | 44 | `takeover-r12-mobile-r2` |
| WebKit Windows 390 × 844, WebGL2 | 44 | `takeover-r12-webkit-r1` |
| Herói 404 + recuperação real | 15 | `takeover-r12-hero404-r2` |
| NPC 404 sem fallback/bloqueio/retry infinito | 14 | `takeover-r12-npc404-r2` |
| Painel desktop, fixtures + 403 + página de 100 itens | 13 | `takeover-r12-panel-desktop-r1` |
| Painel móvel, mesmos casos | 13 | `takeover-r12-panel-mobile-r1` |
| Retrato próximo 512, composição debug | 13 | `takeover-r12-portrait-r2` |

**199 gates nomeados finais aprovados; 56 PNGs.** Existem ainda assertions
numéricas por amostra dentro desses gates; não são 199 testes unitários.
Cada pasta preserva relatório, cópia do harness utilizado e manifesto
SHA-256. O índice é `shots/takeover-r12-summary/SUMMARY.json`; a leitura do
bundle do painel está em `PANEL-BUNDLE.json` na mesma pasta.

As três execuções funcionais conferiram 14 assets principais, duas espécies,
Simão com perfil/hash correto, animação de repouso, ação real E/toque,
postura durante a fala, caminhada ponderada e pausa/retomada do mixer.
Somaram **137 amostras intermediárias de NPC**. A raiz coincide com a altura
do terreno e os segmentos amostrados não cruzaram o espaço estático bloqueado.
Velocidade e deslocamentos não indicaram salto de recuperação. Isso não é
prova de IK ou contato perfeito de todos os pés em todas as inclinações.

Save parcial restaurou exatamente um Simão visível próximo em solo válido;
os dois/quatro nomes da narrativa não criaram atores, colisores ou marcadores
ausentes. Três missões, epílogo de Marcos 1:21, cinco lugares, aviso do limite,
conclusão salva e Explorar a região após reload passaram. As citações foram
comparadas aos dados BLIVRE; a orientação continua sendo revelada ao ler e
a ação continua disponível sem leitura prévia.

As execuções normais não registraram erros de página, console, HTTP, requests
ou crash. O aviso de depreciação de `renderAsync()` do Three ficou registrado
como warning. Nos casos 404/403, as falhas deliberadas e cancelamentos da URL
injetada permanecem no JSON; somente esses eventos são classificados como
esperados. O teste não declara console/rede globalmente vazios nesses casos.

O painel usa fixtures, não números atuais do GitHub. Foram verificadas
contagem calculada, ausência de email, cache, layout sem rolagem lateral,
recusa e retry. Uma página sintética de 100 tickets mostrou o aviso explícito
de totais parciais. Nenhuma issue, candidatura ou formulário foi enviado.

### Medições curtas no PC

Janela nativa de aproximadamente 2,5 segundos após o trecho de caminhada,
sem screenshots durante a medição. `performance.now`/RAF independem do dt
limitado da simulação. Não é comparação de desempenho entre revisões.

| Contexto neste PC | FPS RAF curto | Resource Timing, primeiro documento |
| --- | ---: | ---: |
| Chrome desktop | 100,0 | 23.284.968 bytes |
| Chrome móvel emulado, UA iPhone | 100,0 | 21.170.872 bytes |
| WebKit Windows móvel emulado | 64,2 | 21.032.564 bytes |

O DPR de contexto foi 1, registrado junto do tamanho real do canvas. Chrome
ficou próximo do teto de 100 Hz: não se infere ganho nem folga de GPU.
Os bytes são `transferSize` das entradas Resource Timing do primeiro documento,
incluem cabeçalhos e downloads opcionais feitos naquela janela; não são tamanho
de instalação, RAM ou gasto de hospedagem. Recargas têm buffers de timing
separados. A diferença entre contextos não é economia isolada do NPC.
O GLB de Simão possui 1.763.628 bytes/1024 no desktop e 924.912 bytes/512 no móvel.

### Revisão visual e tentativas preservadas

Nos frames idle/fala/caminhada não apareceu deformação grosseira, A-pose ou
corpo de primitivas. O retrato móvel R2 deixa rosto, túnica, mãos e corda
legíveis; foi preparado com a câmera a aproximadamente 2,5 m à frente do
NPC, que ficou no ponto seco original. O herói foi posicionado atrás dele
em direção à margem. É composição debug, não um take de percurso espontâneo.
O HUD cobre parte dos pés nessa foto; os outros ângulos e diagnósticos são
complementares. A túnica escura tem detalhe de sombra modesto e o cenário
ainda é repetitivo; esta aprovação não afirma visual final fotorealista.

- `desktop-r2`: os 28 primeiros gates passaram, mas o harness leu a etiqueta
  antes do próximo frame do HUD. O PNG já mostrava Narrativa do jogo. Corrigiu-se
  a espera do teste, sem mudar a lógica narrativa do runtime.
- `mobile-r1`: o gesto curto andou 1,8 m e parou ainda na água do staging.
  Simão aguardou um trajeto seco, corretamente. A repetição usou 90% do raio
  do joystick por 2,8 s, abaixo do limiar de corrida; a proteção não foi relaxada.
- `portrait-r1`: os gates técnicos passaram, mas as imagens foram **rejeitadas
  visualmente** porque Simão ficou cortado na lateral. R2 substitui a prova visual.
- `hero404-r1` e `npc404-r1`: o fluxo de recuperação/jogo passou, mas o filtro
  de erros esperados do harness era incompleto. Ajustou-se para a mensagem exata
  do herói e o cancelamento da URL deliberadamente recusada; outros erros seguem
  reprovando. As primeiras pastas permanecem intactas.

### Cobertura herdada e o que não foi repetido

`check_roam`: cobertos três encontros, conclusão, retorno, frase literal,
exploração, cinco lugares, aviso de limite e reentrada pela opção Explorar.
Não repetimos cada comparação textual auxiliar do harness antigo, cada
contador de toast, nem uma caminhada completa de volta à vila. O roteiro
de teste usa preparação por teleporte entre locais.

`check_touch`: cobertos joystick fixo por toque no Chrome, deslocamento,
botão de ação por tap, caixas dos controles dentro da viewport, cinemática e
legendas. Não repetimos recenter do joystick em toque distante, arrasto à
direita para olhar, todos os hit-tests/overlaps, rotação de aparelho, todas
as opções de câmera ou saída da cinemática por caminhada. WebKit usa tecla W
no trecho de movimento e tap no encontro; não se afirma joystick WebKit verificado.

`check_loading`: cobertos conclusão real dos 14 assets, Go, herói 404,
erro terminal estável, retry real e falha opcional do NPC. Não repetimos
GLB retido/rede lenta, reduced motion, world JSON recusado, botão de modo
compatível nem `WEBGL_lose_context` durante/depois da abertura. Esses testes
existem na R7; sua evidência histórica não é reclassificada como R12.

Também pendentes: iPhone/Safari e Android físicos, uso prolongado, áudio
perceptivo, save corrompido no browser (há suíte CPU), todas as encostas e
trajetos grandes do seguidor, frontend da telemetria ao vivo em produção e
estado real atual das métricas do GitHub. WebKit Windows não dispõe de
AudioContext neste runtime e mostrou Som indisponível, como previsto.

Todos os browsers de QA foram fechados antes de liberar a GPU à integração.

O harness também oferece `--smoke` para a conferência curta depois do deploy:
Chrome desktop/móvel, Go, assets, Simão idle, um encontro E/tap, legenda e
seguidor. `--expected-commit=SHA` confere a marca do build dentro do bundle,
além do SHA-256. Esse modo substitui somente o script Vercel Insights por
uma resposta vazia para não contabilizar visitas artificiais; não valida a
entrega da telemetria. Não repete as 199 verificações nem os casos do painel.
