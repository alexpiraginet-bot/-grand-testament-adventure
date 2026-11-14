# QA Cafarnaum R13 — direção visual comparável

Responsável: Codex / r7_browser_checks. Data: 13/11/2026.

Estado: baseline R12, candidatas WIP e build R13 final capturados. A matriz final
passou 34 verificações e o smoke de configurações padrão/toque passou mais 18.
Vídeo desktop real de 10 s gravado e conferido. Este documento não declara publicação nem
aprovação de qualidade final da demonstração ambiciosa.

## Baseline preservada

Servidor local somente leitura do `dist` existente em
`D:/BentoLabs/90-Trabalho-temporario/gta-takeover-r12-20261113`, porta 4201.
Não houve build, edição de fontes ou modificação de assets nessa worktree.
HEAD local observado: `d921d064a8d28420b2638945f309e988499b709b`.
Identidade efetivamente servida, independente do nome histórico da revisão:

- Bundle: `index-CGz5zYBb.js`.
- SHA-256: `3c94cc570581e98aa91ac857b978ab1d8b9c81cde8d8454022c2fbbab41db375`.
- Evidência: `D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario/R13-AMOSTRA-20261113/baseline`.
- `report.json`: `228816947134bd28b63f97a11c881fbe891116cb93ff6dec224dadd53f5a23f2`.
- `scenario.json`: `0fa77dc98d0b912e16b6fe3f6e5dd3d6e5d3108532fa36788c4cc783610d1748`.
- `MANIFEST.json`: `7b3ac865c62b559a84a9cc1b99ef633a03c9e176b31274968763e78dd28034d1`.

O manifesto inclui tamanhos e hashes de cada PNG, relatório, cenário e cópia
do harness realmente executado. A candidata deve usar esse `scenario.json`,
sem regenerar poses de uma distribuição de casas possivelmente alterada.

## Protocolo

`tools/check_cafarnaum_r13.mjs` usa Chrome instalado e Playwright existente.
Cada navegador/contexto termina antes do seguinte; nenhuma outra tarefa GPU
estava autorizada durante o par baseline. Nenhuma instalação foi feita.

Perfis: desktop 1280×800 e viewport móvel 390×844, DPR 1. O móvel usa UA de
iPhone, toque e WebGL2 no mesmo PC Windows. Desktop usou WebGPU. Isso não é
Safari físico nem um teste de memória/temperatura/desempenho de telefone.

As estáticas usam `?debug=1&cam=fixa&fx=off&dtmax=0`. São oito poses por perfil:
início da rua, fachada A, rua aos 45 m, rua aos 85 m, praia, Simão próximo e
fachadas B/C. Os avisos temporários de lugares expiram naturalmente antes da
captura. HUD, personagem, materiais e geometria não são escondidos ou trocados.
Posição solicitada, câmera efetiva, resolução, tempo, backend, diagnóstico do
mundo, NPC e fauna são registrados a cada pose. Água, barco e animação ficam
em tempo zero; não se substitui o relógio real do navegador.

Uma execução separada usa tempo normal. Após 10 s de aquecimento na rua,
mede 5 s de RAF nativo com `performance.now`, sem screenshots na janela.
Depois caminha por KeyW real durante aproximadamente 2 s e observa posições
intermediárias a cada 100 ms. A rota completa recebe apenas sondas de colisão;
não é apresentada como percurso completo jogado. O móvel também usa W nesse
ensaio, portanto não valida joystick.

## Resultado da baseline

34 verificações nomeadas, 18 PNGs, quatro contextos sequenciais, todos passaram.
Não são 34 testes unitários. Cada contexto carregou 14 assets centrais, as duas
espécies aprovadas e o perfil correto de Simão com bytes/hash conferidos.
Nenhum humano de primitivas apareceu. Os oito enquadramentos são distintos,
e as câmeras observadas ficaram fora dos volumes de casas.

| Janela ao vivo | Desktop / WebGPU | Móvel emulado / WebGL2 |
| --- | ---: | ---: |
| Tempo até abertura pronta, ms | 3.606 | 7.051 |
| RAF nativo médio, fps | 99,996 | 99,996 |
| Intervalo de quadro p95, ms | 10,1 | 10,1 |
| Caminhada W, m | 5,475 | 5,475 |
| Sondas de centro de rota livres | 754/754 | 754/754 |
| Resource Timing transferSize, bytes | 23.452.110 | 21.338.014 |
| Resource Timing encodedBodySize, bytes | 23.441.910 | 21.327.814 |
| Renderer textureBytes, estimativa | 1.247.154.207 | 203.050.584 |
| Draw calls no quadro observado | 124 | 88 |

O teto perto de 100 Hz impede inferir ganho de performance por pequenas
diferenças de FPS. `textureBytes` é estimativa do renderer, não VRAM exclusiva
ou memória do processo. Bytes incluem assets opcionais e, no transferSize,
cabeçalhos; não equivalem a download mínimo inicial nem custo de hospedagem.
Tempo de abertura local não é promessa para rede móvel. A ordem fixa/ao vivo
pode beneficiar caches do sistema, embora cada contexto de navegador seja novo.

Zero erros de página, console error, HTTP ≥400, requestfailed ou escrita
externa nos quatro contextos. Warnings foram preservados no JSON.
Analytics é explicitamente interceptado; não houve envio de formulários.

## Leitura visual da baseline

Inspeção real dos PNGs: início, praia e fachadas A/B/C no desktop; início e
Simão próximo no móvel. As demais imagens estão disponíveis para comparação.

- A rua ainda parece um corredor repetitivo. Faixas do chão muito uniformes
  e uma diferença abrupta entre a área central e o entorno prejudicam o conjunto.
- Fachadas A/C têm portas existentes, em posições diferentes; B apresenta uma
  parede contínua na face voltada para a rua escolhida. Isso foi comunicado ao
  autor das adições para evitar uma porta nova sobre uma abertura existente.
- A água apresenta ondas regulares repetidas, linha de margem reta e pouca
  diferenciação de água rasa. É uma evidência da baseline, não da nova água.
- Simão 512 continua íntegro na captura próxima; o HUD cobre parte dos pés.
  A estática não demonstra contato contínuo nem qualidade de todas as animações.

## Candidata

### Build final congelado

Runtime `0b8f5a8`, build com 320 testes CPU aprovados pelo integrador. Esta
rodada de QA não reconstruiu o dist. Preview somente leitura na porta 4203:

- `index-U3_FX1lA.js`.
- SHA-256 `9122cfe0add6c7566b11153accaa8c529f115a7ce475c9e39a3e764cd1476190`.
- Acervo: `D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario/R13-AMOSTRA-20261113/candidate-final`.
- Relatório SHA `8438ca1bc31460974d6bb9be964cc8c78f31f7058c516f2f8fff3fd97ee55ac3`.
- Manifesto SHA `7ccab797ab6534872daf979f35fadb3023f6c825b6156fa27963a6714b3700cb`.

34/34 verificações, quatro contextos Chrome sequenciais, 18 PNGs. Nos dois
perfis: 14 assets centrais, duas espécies, Simão correto por bytes/hash, nenhum
humano de primitivas. Nenhum erro de página, console error, HTTP/requisição ou
escrita externa foi capturado. Warning `renderAsync()` obsoleto preservado.

`FINAL-COMPARISON.json`, ao lado dos diretórios de evidência, compara os 16
pares estáticos: câmera efetiva idêntica, posição do jogador com delta zero,
mesmo viewport/canvas/DPR/backend e tempo zero. O cenário tem o mesmo SHA da
baseline. As sondas de colisão de 754 centros de rota continuaram livres em
ambos os perfis; isso não equivale a percorrer todas as rotas com um jogador.

| Janela final ao vivo | Desktop / WebGPU | Móvel emulado / WebGL2 |
| --- | ---: | ---: |
| Abertura pronta, ms | 4.292 | 5.711 |
| RAF nativo médio, fps | 99,996 | 99,996 |
| Intervalo de quadro p95, ms | 10,1 | 10,1 |
| Caminhada W real, m | 5,500 | 5,500 |
| Resource Timing transferSize, bytes | 28.965.791 | 22.513.031 |
| Resource Timing encodedBodySize, bytes | 28.953.491 | 22.500.731 |
| Renderer textureBytes, estimativa | 1.287.485.752 | 217.028.104 |
| Draw calls no quadro observado | 261 | 96 |

São janelas de build comparáveis ao protocolo da baseline, não os bytes do
Vite/WIP. Transferência cresceu 5.513.681 bytes no desktop e 1.175.017 no móvel.
Calls observadas passaram de 124 para 261 no desktop e de 88 para 96 no móvel;
o refletor desktop renderiza a cena adicionalmente, custo deliberado que deve
ser acompanhado. Não se atribui todo o delta a um único material, pois chão e
fachadas também mudaram. O teto de ~100 Hz impede alegar ganho ou ausência de
custo de GPU. Memória, abertura e FPS não foram medidos em aparelho físico.

Inspeção final dos PNGs de início, fachada C e praia no desktop, praia no móvel:
porta C agora é uma folha opaca contínua, sem a aparência de grade detectada
na WIP. Madeira e piso são mais coerentes e o solo fora da rua usa terra.
Água permanece visível nos dois backends. A integração recebeu aprovação como
melhoria incremental; repetição de casas, forma de corredor e margem reta
continuam limitações explícitas. Não é o acabamento cinematográfico pretendido.

### Entrada padrão e joystick

`tools/check_cafarnaum_default_r13.mjs`, acervo `default-final` no mesmo diretório
R13, adiciona somente `?debug=1` para observar estado. Nenhum `fx`, `cam`, `dtmax`,
clima, posição ou tempo é alterado. Abertura, Go real e pipeline padrão passaram
18/18 verificações em desktop/móvel, quatro PNGs, mesmo bundle/hash final.

KeyW real deslocou 5,425 m no desktop. No móvel, toque Chromium real sobre o
joystick visível, mantido por aproximadamente 2 s, deslocou 5,062 m; 20 amostras
intermediárias estavam livres de colisão estática e penetração da câmera.
O relógio do jogo avançou normalmente. Nenhum erro capturado ou envio externo.
Manifesto: `e603fc17521f5d78002672e8deb1d4cbf95c26fdc6edd1e7d98d8b8515e56bef`.

O `debug` expõe observação e indicador na tela, mas não seleciona outro
pós-processamento. Este smoke valida o padrão atual; não promove os modos
experimentais Alto/Master nem demonstra DLSS. Analytics foi interceptado.

### Integrada WIP r1

`shots/r13-integrated-wip-r1`, servidor de fontes Vite 4202. Chrome desktop e
móvel emulado, somente poses fixas: 14 verificações nomeadas, 16 PNGs, todos
passaram. 14 recursos centrais, duas espécies e perfil correto de Simão.
Zero erros de página, console, HTTP/requisição ou escritas externas.

Fontes locais `.ts/.css/.json` sob `src` mais HTML/package/lock/Vite foram
inventariadas antes e depois da captura, sem alterações no intervalo. Hash do
inventário: `69ab3ea5751b2b5fb043e97bd5b93f825fc6666103d72073f4db16b8ca75f331`.
Manifesto de evidência:
`bcc945090cca3e7b70013a1b30e08475859f71a6d30ffbc51cff9a3200cd7be7`.
Isso identifica a árvore WIP lida no período, não substitui um bundle final.

Comparação numérica em `shots/r13-wip-comparison-r1/camera-comparison.json`:
os 16 pares mantêm posição efetiva de câmera e jogador idênticas (delta zero),
mesmo backend, dimensões de canvas/viewport e tempo de simulação zero.
Não há comparação de performance nessa rodada: o integrador executava checks
CPU/build em paralelo e o Vite serve módulos de desenvolvimento. Seus bytes e
indicador de FPS são diagnóstico, não benchmark contra a baseline de produção.

Leitura dos PNGs de início, rua, fachadas A/B/C e praia no desktop; início,
fachada B e praia no móvel:

- O chão ganhou grão/variação visível e cor menos homogênea no centro da rua;
  a areia também se distingue melhor do piso da vila.
- Varandas de madeira geram silhuetas e sombras novas. B agora tem entrada na
  face da rua. A/C mantêm aberturas em posições diferentes.
- As ripas espaçadas da porta, sobretudo na C sobre a porta bege antiga, dão
  leitura de grade. Esse achado artístico foi enviado ao autor e integrador.
- A água perdeu o excesso cinza/espelhado da primeira WIP; ainda há margem reta
  e o conjunto mantém forte repetição das casas. É progresso incremental, não
  o acabamento cinematográfico que se deseja como resultado de produção.

Essa WIP foi preservada antes da correção das portas e do build final acima.
Não promover uma candidata só por passar verificações ou produzir mais objetos.

### Primeira água WIP, inspeção limitada

Por pedido do integrador, foi aberto o Vite de fontes na porta 4202, somente
para avaliar a água antes da integração de chão/fachadas. Evidência separada:
`shots/r13-water-wip-r1`, 13 verificações, três PNGs, dois contextos desktop
sequenciais. Estáticas praia/Simão nas poses da baseline e W real observado em
200 RAF consecutivos: 1.990 ms entre primeira e última amostra, deslocamento
4,180 m. Chrome WebGPU; zero erros capturados. Todos os navegadores foram fechados.

Não é build final pinado: o servidor de desenvolvimento serve fontes em
integração. Seus downloads incluem módulos de desenvolvimento e não devem ser
comparados aos bytes do build baseline. Esta rodada não mediu performance.

Inspeção dos três PNGs: reflexos de céu, rochas e vegetação aparecem e a água
permanece visível. Porém o aspecto ficou muito cinza/espelhado e há faixas longas
na superfície; ainda falta leitura de profundidade junto da margem. Portanto,
passar o teste técnico não aprova essa direção artística. O integrador recebeu
o achado antes do ajuste seguinte.

Uma linha horizontal fina à altura do peito de Simão chamou atenção, mas a
conferência posterior do PNG baseline mostrou a mesma linha na mesma posição.
Ela foi reclassificada como condição preexistente, não regressão do refletor.

Para essa rotina curta há `--water-wip --profile=desktop`: duas poses fixas e
W/200 RAF, sem janela de benchmark. A rodada completa final está registrada acima.

### Vídeo real de 10 segundos

`tools/capture_cafarnaum_r13.mjs` executado apenas no desktop, suficiente para o
acervo solicitado. Chrome encerrado antes da conversão CPU pelo FFmpeg existente.
O script é configurável para móvel, mas não se alega take móvel nesta rodada.

Entrega privada: `video-final/desktop/cafarnaum-r13-desktop-10s.mp4`, sob o acervo
R13. H.264, 1280×800, 25 fps de gravação, 10,000 s, 4.702.012 bytes.
SHA-256 `370f9833bd395df550173ed1cea257cdb1bd1c46a3f179813e87aa260022e923`.
Manifesto do take `2ee60f55dd054db1204491c3ca4c705e396b9ccc3971f7e0451410af53ab7714`.
O mesmo bundle final foi verificado antes de gravar. Zero erros capturados.

Playwright `recordVideo` preservou o WebM inteiro. O MP4 é um recorte interno
real de 10 s, sem interpolação ou mudança de velocidade, do final de 12,529 s
de KeyW continuamente pressionada. 126 amostras registraram 31,251 m no trecho
bruto controlado, sem colisão estática/penetração de câmera. Esse deslocamento
é do segmento bruto de 12,5 s, não uma medição da distância exata dos 10 s cortados.

O posicionamento ocorre antes; nenhuma posição/câmera/tempo é atribuída durante
o take. O bruto inclui carregamento e staging, identificados no relatório.
Vídeo silencioso: Playwright não captura o áudio do jogo. A gravação e seu
25 fps não são benchmark; quadros podem ser repetidos pelo gravador.

Conferência: FFprobe validou duração, resolução e codec; uma prancha de 20
quadros a cada 0,5 s foi realmente inspecionada (`VIDEO-FINAL-CONTACT.png`).
A rua se aproxima de modo contínuo nesses pontos e o herói permanece íntegro.
Isso não substitui uma revisão humana audiovisual contínua nem valida todos os
contatos dos pés. Sem geração de imagem, render externo, DLSS ou upload social.

## Reprodução

PowerShell, a partir da worktree R13, com servidor baseline já ativo:

```powershell
$env:PLAYWRIGHT_PATH='C:/Users/R2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/check_cafarnaum_r13.mjs 'http://127.0.0.1:4201/' 'D:/BentoLabs/90-Trabalho-temporario/qa-r13-saida-nova' --source-root=D:/BentoLabs/90-Trabalho-temporario/gta-takeover-r12-20261113 --fixture=D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario/R13-AMOSTRA-20261113/baseline/scenario.json --expected-sha=3c94cc570581e98aa91ac857b978ab1d8b9c81cde8d8454022c2fbbab41db375
```

O diretório de saída deve ser novo. Flags `--profile=desktop|mobile`,
`--fixed-only` ou `--live-only` permitem verificações limitadas quando uma
alteração justifica repetição. Não executar GPU junto de outro agente.

