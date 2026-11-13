# QA da fauna R8 no navegador — 13/11/2026

Responsável: Codex, subtarefa de navegador. Evidência obtida com Playwright,
Chrome instalado e WebKit do runtime, em Windows. Uma janela/browser por vez;
sem alteração de coordenadas dos animais e sem publicação nesta subtarefa.

## Revisão visual e de simulação testada

Build informado pelo responsável: **166/166 testes**. Bundle observado e
conferido localmente: `index-By9uYN8-.js`, SHA-256
`a37d1f42e4f442147d2aeda6c34a2a2be67f9c3ac4b538db305ac9d69c07d5a1`.
Esta revisão inclui galinha e burro com variantes próprias para desktop e
móvel, e a correção de retenção do slot PCM. Ainda tinha o problema de alcance
sonoro animal descrito abaixo; resultados visuais não o validam.

| Caso | Verificações | Evidência |
|---|---:|---|
| Chrome, 1280 × 800, WebGPU | 22 passaram | Movimento e avanço ponderado do AnimationMixer para **as duas espécies** |
| Chrome, 390 × 844, WebGL2 | 22 passaram | As duas espécies, texturas presentes, teto de 24 instâncias |
| WebKit Windows, 390 × 844, WebGL2 | 21 passaram | As duas espécies; sem Web Audio disponível nesse runtime |
| Chrome móvel, HTTP 404 somente no burro | 12 passaram | Galinhas permanecem; sem burro provisório, emissor de burro ou loop de tentativas |

Relatórios completos: `shots/fauna-r8-final/report-<caso>.json`. Há capturas de
abertura, animais próximos, fases durante movimento, mute e resultado final.
O teste de falha foi introduzido por interceptação de rede e é identificado
nos relatórios; não é uma falha pública inferida.

A abertura permaneceu em **14/14 recursos principais**, antes do clique real
em Jogar. Os modelos da fauna foram carregados depois desse gesto. Bytes GLB
medidos: **3.058.392** desktop; **1.783.012** móvel. Ao fim do caso desktop
havia 41 instâncias e 39 visíveis por distância (33 galinhas, seis burros);
no móvel, 24 (21 galinhas, três burros). Visibilidade por distância não prova
que cada animal está no enquadramento ou sem oclusão.

Durante dezenas de amostras intermediárias, os dois tipos se deslocaram por
simulação real e seus clips avançaram com peso de caminhada. As amostras
conferiram coordenadas/dimensões finitas, limite de instâncias/cache, raiz
apoiada na altura do terreno, centro fora de obstáculo estático e discos de
ocupação sem sobreposição. Créditos, mapa e feedback congelaram a fauna e o
mixer. Silenciar parou as vozes sem congelar os animais. O relógio geral
continua avançando nos créditos; mapa e feedback também congelam esse relógio.

Não houve exceção de página, crash ou erro HTTP inesperado nesses casos. O
aviso de depreciação `renderAsync()` permanece. WebKit também reportou avisos
de fontes pré-carregadas não usadas imediatamente. Não ocultamos esses avisos.

## Capturas próximas e apoio

`shots/fauna-r8-support-donkey-final/` contém oito fases e três capturas de
repouso do burro, com galinhas naturalmente próximas. O harness só posiciona
o jogador e a câmera de debug; não move ou congela o animal para obter a pose.
A espera por repouso usa velocidade zero e peso de caminhada abaixo de 0,01.
Nas três amostras de repouso, a posição ficou estável, `rate=0`, e o peso de
caminhada caiu de 0,000253 para aproximadamente 5,2e-9. A inspeção visual não
revelou flutuação grosseira ou penetração evidente nesse trecho.

Para a galinha, `shots/fauna-r8-support-chicken-r1/` oferece vistas laterais
com pés legíveis. A primeira tentativa, em `shots/fauna-r8-support-chicken/`,
ficou parcialmente encoberta pelo herói e foi preservada; não foi usada como
prova de contato dos pés. Capturas de detalhe são recortes nativos do navegador
em DPR 2, sem ampliação ou edição por IA, e não são um benchmark de desempenho.

Uma conferência CPU de 1.518 estados da etapa anterior, usando o grid real do
terreno, encontrou variação máxima de **7,24 cm** no disco conservador do corpo
de uma galinha (cerca de ±3,63 cm em relação à raiz). Esse disco também abrange
cabeça/cauda; o valor não mede a penetração de uma sola. Sem IK de contato,
apoio exato de todos os pés em todo declive **não foi certificado**. As provas
de altura da raiz e as imagens próximas têm alcance distinto.

## Falha de áudio encontrada pelo teste final

O ensaio com rastreamento do decode nativo por SHA-256 e de
`AudioBufferSourceNode.start()` encontrou um problema real: aves e água
iniciavam, mas nenhum MP3 de galinha era sequer solicitado com uma galinha a
cerca de três metros e o AudioContext em execução. A tentativa e sua captura
permanecem em `shots/fauna-r8-final-audio/`.

A causa foi a cópia de todos os campos de `FaunaAgent` para o emissor: o
`radius` físico do corpo passou a substituir o alcance acústico de 22/55 m.
O ouvido fica a aproximadamente 1,55 m do chão, fora desse pequeno raio físico.
O responsável corrigiu a montagem do emissor para copiar somente
`id/kind/x/y/z`, preservando o raio próprio dos habitats. Um teste CPU com
agentes completos reproduziu a falha antes e passou depois: galinha/burro a
três metros, ouvido elevado, e silêncio fora do alcance acústico. **19 testes
CPU de áudio** e typecheck passaram. A repetição real após rebuild consta no
anexo abaixo; não tratar a falha anterior como áudio aprovado.

### Anexo após correção do alcance

Build corrigido: **167/167 testes**, bundle `index-BvfTbjcg.js`, SHA-256
`fcb265ac2684fc11056d48a5831c081c82dd5aa381b74e5c1c304745f0340eb7`.
O navegador requisitou esse bundle nas execuções seguintes, em pastas novas:

| Caso | Resultado | Chamadas nativas identificadas |
|---|---|---|
| Chrome desktop 1280 × 800 | 33 verificações passaram | Galinha 10, burro 3, aves 1, água 1 |
| Chrome móvel 390 × 844 | 34 verificações passaram | Galinha 14, burro 3, aves 1, água 1 |
| WebKit Windows móvel, fumaça | 13 verificações passaram | Sem API de áudio; carregou 14 principais + duas espécies |

`shots/fauna-r8-audio-fixed/` preserva os relatórios, os hashes do MP3 atribuído
a cada decode e os registros da chamada **nativa** `source.start()`. O wrapper
de QA aguarda SHA-256 junto do decode nativo para identificar o buffer; não
fabrica áudio nem altera os contadores do jogo. Cada início de gravação animal
teve sua espécie visual aprovada presente. Aves/água também foram identificadas.

Mute, preferência persistida, créditos/mapa/feedback, ocultação sintética e
retomada por gesto passaram. Nenhuma exceção de página, crash, falha HTTP ou
erro de console capturado nesses três casos. Cache PCM final: **9.006.416 bytes**,
sem clipes marcados como falhos. O áudio transferido foi **905.088 bytes** no
desktop e **545.664 bytes** no móvel; o desktop recarregou o arquivo do burro
após expulsão do cache limitado. Esses números incluem pedidos repetidos e
não devem ser confundidos com o tamanho único dos quatro arquivos utilizados.

O teste de fumaça após a correção não repete a aprovação geométrica: confirma
o novo bundle, abertura, modelos selecionados e estado honesto de áudio
indisponível no WebKit Windows. A alteração acústica não mudou modelos,
geometria, shader ou simulação. As evidências completas dessas partes ficam
na revisão visual acima. **Safari físico e audição perceptual seguem pendentes.**

## Limites de desempenho e plataforma

As janelas medidas duram cinco segundos neste PC. Chrome desktop ficou perto
de 100 FPS; o móvel é viewport/toque/UA de iPhone executado no mesmo Windows,
não o desempenho de um telefone. O renderer informou cerca de 1,25 GB de
texturas no desktop e 204 MB no móvel; esses contadores não equivalem à memória
total do processo ou VRAM física. Não foi realizado ensaio térmico prolongado.

WebKit Windows abriu o jogo, os dois animais e a interface, mas não oferece
AudioContext/webkitAudioContext neste runtime. A interface mostrou corretamente
“Som indisponível”. Isso **não aprova nem reprova áudio no Safari físico**.
Sem teste de iPhone real, suspensão pelo iOS ou encerramento por memória.

Os testes usam teleporte de debug para montar a observação, não uma caminhada
contínua de missão. O evento de aba oculta do ensaio de áudio é sintético via
DOM. Disparos nativos, licenças, hashes, PCM e medições técnicas não substituem
audição perceptual e aprovação da mixagem, que continuam pendentes.

## Reprodução

```powershell
$env:PLAYWRIGHT_PATH='C:/Users/R2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/check_fauna_scene.mjs http://127.0.0.1:4191/ shots/nova-revisao --case=chrome-desktop
node tools/check_fauna_scene.mjs http://127.0.0.1:4191/ shots/nova-revisao --case=chrome-mobile
node tools/check_fauna_scene.mjs http://127.0.0.1:4191/ shots/nova-revisao --case=webkit-mobile
node tools/check_fauna_scene.mjs http://127.0.0.1:4191/ shots/nova-revisao --case=chrome-fauna-partial-404
node tools/check_fauna_audio.mjs http://127.0.0.1:4191/ shots/nova-revisao-audio --case=chrome-desktop
```

Executar somente depois de rebuild e com a GPU liberada por quem estiver
validando modelos. Manter pastas por revisão para não substituir evidências.
Não reutilizar a porta 4190 no WebKit: ela foi recusada como porta restrita.
