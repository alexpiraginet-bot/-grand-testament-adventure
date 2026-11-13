# QA Cafarnaum R13 — direção visual comparável

Responsável: Codex / r7_browser_checks. Data: 13/11/2026.

Estado: baseline R12 e candidata integrada WIP capturadas; build final,
caminhada final e vídeos ainda pendentes. Este documento não declara publicação
nem aprovação de qualidade final da demonstração ambiciosa.

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

Build final e take em movimento aguardam decisão do integrador. Não promover
uma candidata só por passar verificações ou produzir mais objetos.

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
W/200 RAF, sem janela de benchmark. A rodada completa final continua pendente.

### Vídeo preparado, ainda não executado

`tools/capture_cafarnaum_r13.mjs` passou `node --check` e exige SHA de build
aprovado. Usa Playwright `recordVideo` e FFmpeg/FFprobe já instalados. Guarda o
WebM inteiro e produz um recorte MP4 real de 10 s, sem interpolação nem mudança
de velocidade, a partir de um trecho interno de 12,5 s de W continuamente
pressionado. O posicionamento ocorre antes; nenhuma posição/câmera/tempo é
atribuída durante o take. O bruto inclui carregamento e staging, claramente
identificados. Os vídeos são silenciosos: Playwright não captura áudio do jogo.

Os dois perfis serão sequenciais. Amostras intermediárias comprovam movimento
e ausência de colisão; vídeo não serve como medição de FPS. Sem upload social.
O script ainda precisa da execução/inspeção reais antes de ser tratado como
validado; preparação e sintaxe não provam o resultado da gravação.

## Reprodução

PowerShell, a partir da worktree R13, com servidor baseline já ativo:

```powershell
$env:PLAYWRIGHT_PATH='C:/Users/R2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/check_cafarnaum_r13.mjs 'http://127.0.0.1:4201/' 'D:/BentoLabs/90-Trabalho-temporario/qa-r13-saida-nova' --source-root=D:/BentoLabs/90-Trabalho-temporario/gta-takeover-r12-20261113 --fixture=D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario/R13-AMOSTRA-20261113/baseline/scenario.json --expected-sha=3c94cc570581e98aa91ac857b978ab1d8b9c81cde8d8454022c2fbbab41db375
```

O diretório de saída deve ser novo. Flags `--profile=desktop|mobile`,
`--fixed-only` ou `--live-only` permitem verificações limitadas quando uma
alteração justifica repetição. Não executar GPU junto de outro agente.

