# R11 — ensaio gráfico na RTX, sem promoção automática de preset

Revisão em 13/11/2026. Dono desta evidência: Codex/browser QA. O runtime,
builds e publicação pertencem à integração; este ensaio não os altera.

## Contrato e versão

- Base congelada servida de `assets-src/r11/baseline-dist`, porta local 4196.
  JavaScript `index-Bizgc6U3.js`, SHA-256
  `751bc77a56e70acf9d354e742db111ea0643aa57fbefa85dc91bee3fb1d4aecd`.
- Root informou build completo com 269 testes CPU. O navegador verifica o
  hash recebido, não presume que o checkout editável ainda seja a base.
- `tools/check_rtx_r11.mjs` usa o Chrome instalado, via Playwright existente;
  não instala browser nem ferramenta. Cada execução exige pasta nova.
- Um Chrome/GPU por vez; consultas a `nvidia-smi` e `ollama ps` antes/depois.
  Nenhum modelo Ollama carregado. Aplicativos já abertos não foram fechados.
- O dispositivo observado em `GPUAdapter.requestDevice` é NVIDIA Blackwell,
  sem fallback. CDP identifica a GPU do Chrome como RTX 5060 Ti. A placa do
  sistema sozinha não seria evidência suficiente do renderizador usado.

## Pré-verificação jogável

`shots/rtx-r11-baseline-preflight`: harness R9 completo, Chrome desktop,
24 verificações aprovadas: 14 malhas antes de Começar, duas espécies após
Começar, herói com esqueleto nativo, zero humanos procedurais, zero colisores
de NPCs ausentes, trecho real com W e três missões com E. Os encontros foram
posicionados por debug; não é um percurso integral caminhado. As três missões
foram concluídas sem abrir a Bíblia.

`shots/rtx-r11-features`: 15 verificações por viewport, 30 no total. Desktop
1280×800 DPR1 e móvel emulado 390×844 DPR3 no mesmo PC. Confirmados:

- painel bíblico com seis versículos literais da BLIVRE;
- relógio da missão parado durante o painel e retomado ao fechar;
- congelamento explícito de debug segura o relógio narrativo;
- próximo trecho ainda não lido permite a ação real por E/toque;
- ação inicia cinematográfica, câmera fora de edifícios e legenda literal;
- gravação local e recarga oferecem continuar o progresso;
- hash do bundle, adaptador real e ausência de erros capturados.

As verificações não atestam sincronização na nuvem nem enviam formulários.

## Método gráfico

Seis poses existentes de `benchShots`: vila, viela, margem, pescadores,
barco e panorama. São derivadas dos mesmos pontos do episódio e relevo. O
enquadramento conhecido da viela é preservado mesmo quando desfavorável;
alterá-lo entre variantes invalidaria a comparação.

Para cada combinação de viewport e `fx=off`, `alto`, `master`: contexto e
cache novos, 300 quadros de aquecimento e 600 quadros medidos por pose.
O movimento da água continua em tempo real; não há equivalência de fase
pixel a pixel. O JSON preserva olho/alvo, dimensões e contadores.

O relógio do benchmark vem de `performance.now()`, antes do clamp de dt.
Há uma segunda janela de RAF nativo de cinco segundos no barco, após três
segundos de estabilização, sem screenshots ou screencast durante os tempos.
As seis capturas e duas sequências contínuas da água são feitas depois.
O indicador de FPS que aparece em uma captura pode incluir o custo das
capturas anteriores; não substitui a janela de medição separada do JSON.
CDP retém JPEGs e timestamps; MP4 VFR é montado por FFmpeg local sem criar
quadros interpolados. A gravação pode perder quadros e não mede desempenho.

O DPR emulado 3 é uma característica do contexto. O jogo limita o DPR móvel
a 1,25: registrar a dimensão real do canvas, sem vender o teste como render
nativo de 1170×2532 ou como um celular físico.

### Limites dos contadores revisados no código

1. `cpuMs` termina **antes** de `renderer.render`/pós-processamento. É tempo
   de atualização do lado CPU, não o custo completo de submissão de quadros.
2. `gpuMs` é a última resolução assíncrona da three. O pool calcula a soma
   dos passes do último frame resolvido; o jogo pode reutilizar esse valor
   em mais de uma amostra. O contador não expõe frescor por amostra.
3. `?bench` não chama Começar e não inicia fauna/áudio. A quantidade de
   malhas base e a ausência da fauna são registradas: estas são cenas de
   render estático, complementadas pelo preflight jogável.
4. O patamar próximo a 100 fps observado no Chrome não prova margem livre
   de GPU. Sem ensaio separado sem limite, não inferir ganho percentual ou
   capacidade de telefone a partir de médias encostadas nesse teto.
5. Memória de texturas/canvas é estimativa do código/renderer, não consumo
   exclusivo de VRAM medido. `nvidia-smi` inclui outros aplicativos.
6. O preset master temporal antigo é diagnóstico por defeito conhecido da
   água. Não é promovido nem chamado DLSS. Nenhum ensaio em Safari físico.
7. Os draw calls são acumulados no quadro pela implementação **common** da
   three r186, não apenas pelo último passe: `Animation.js:81` reseta antes
   do callback de RAF; `main.ts` reseta novamente antes de `fx.render`;
   `Renderer.js:1742` incrementa sem reset por passe e `Info.js:158` acumula
   draws. O benchmark guarda o último quadro medido de cada pose, não a
   média de chamadas nem um contador de instruções físicas da placa.

## Resultado da base congelada

Execução encerrada às 19:24:22 UTC, em seis combinações serializadas:
21.600 quadros medidos, 36 PNGs e 12 sequências da água. O manifesto cobre
6.043 arquivos, 434.880.578 bytes, incluindo 5.970 JPEGs de screencast.
Nenhum arquivo anterior foi sobrescrito. `BASELINE-VALIDATION.json` confere
retrospectivamente 14/14 modelos, zero falhas de carga/requisição e hash do
bundle em **todos** os runs, além de olhos/alvos idênticos entre as variantes.

| PC/viewport emulado | FX | RAF médio | GPU p95 informado | Texturas estimadas | Erros de console |
|---|---|---:|---:|---:|---:|
| 1280×800 DPR1 | off | 99,97 fps | 1,049 ms | 1.213.608.165 B | 0 |
| 1280×800 DPR1 | alto | 99,88 fps | **inválido como render íntegro** | 1.241.848.265 B | 14 |
| 1280×800 DPR1 | master temporal | 99,86 fps | 1,507 ms | 1.274.616.277 B | 0 |
| 390×844 DPR3, canvas 487×1055 | off | 99,99 fps | 0,655 ms | 213.652.596 B | 0 |
| 390×844 DPR3, canvas 487×1055 | alto | 99,97 fps | **inválido como render íntegro** | 227.804.500 B | 14 |
| 390×844 DPR3, canvas 487×1055 | master temporal | 100,00 fps | 0,918 ms | 244.245.632 B | 0 |

Esses valores não demonstram ganho de FPS: todos encostam no patamar de
100 Hz. Os tempos GPU apresentam quantização de aproximadamente 0,065536 ms
e a limitação assíncrona descrita acima. O custo CPU de atualização p95 foi
0,5–0,6 ms, **sem** a submissão de renderização. Cada perfil baixou os mesmos
18.257.661 bytes contabilizados por Resource Timing; baixar imagens iguais
e reduzi-las no decode não significa economia equivalente na rede.

### Falha reproduzida: GTAO do alto em WebGPU

Nos dois viewports, o baseline tenta chamar
`textureGather(texture_depth_multisampled_2d, sampler, vec2<f32>)`, sem
assinatura WGSL compatível. Isso invalida `fragment_GTAO` e o respectivo
pipeline. A cena ainda aparece, mas o efeito não é íntegro. Os dois runs
ficam reprovados; o benchmark retorna código 1 e preserva erros, imagens
e números brutos. Não se usa seu tempo como custo de um alto funcional.

### Inspeção da água

Nas capturas desktop pescadores/barco e amostras das sequências do master
antigo, não foi reproduzida a água invadindo o chão ou desaparecendo como
na observação anterior por software. Isso não prova ausência de defeito
em outros backends, movimentos de câmera ou cenas. O horizonte no master
mostra clareamento/granulação em relação ao off; a existência de mais
efeitos não equivale a melhor arte. Os presets continuam opcionais.

As sequências originais têm aproximadamente cinco segundos e 490–500
imagens reais por take. Os MP4s são derivados de inspeção: o concat do
FFmpeg usa resolução temporal de 25 fps, arredondando timestamps e
descartando imagens próximas, sem interpolação. Para tempos exatos e
análise por quadro, usar os JPEGs com o JSON CDP, não o relógio do MP4.

Evidência local (ignorada pelo Git):

- `shots/rtx-r11-baseline/report.json`, SHA-256
  `620692ab514bb019d8ca292b0663f99e83e69e87f0fa4093c8fe588b829cf162`;
- `shots/rtx-r11-baseline/MANIFEST.json`, SHA-256
  `7423b6481b4825479f3cca7a64ee7ffe24f11f961ba9a33aaf5c91464ed05af2`;
- `shots/rtx-r11-review/BASELINE-VALIDATION.json` e cópia exata do harness
  usado na base. Depois do run, somente os gates de validação, tratamento
  de vídeo vazio e seleção de FX no preflight foram reforçados no harness;
  poses, aquecimento, contagem de quadros e relógios não foram alterados.

## Candidata SMAA — rejeitada visualmente

Build informado pela integração: 279 testes CPU aprovados, fonte local
`7dc836b12db0340625f1ff24d59cbd80f2585ac9+alterado`. Identidade efetiva:
`index-CLpS_1B1.js`, 1.284.763 bytes, SHA-256
`ad06dddb1826d6f160f20e43b3c609018ba4794de671995c2b9bce91bd9d5d4f`.
Servido na porta 4197 e mantido inalterado durante a matriz.

Repetidos os seis presets/viewports e 21.600 quadros medidos. Todas as
combinações passaram os gates técnicos: zero erros de console/HTTP/página,
14 modelos completos, requisições íntegras e hash esperado. A comparação
automatizada confirma mesmas poses, canvas, qualidade e parâmetros de cor.
O PNG desktop `off/1-vila.png` é idêntico byte a byte nas duas versões,
SHA-256 `3fb9896d1d4b379659c68232025055b57e82a8989509c527d7eb0fcf52296112`.

| Resultado candidato | GPU p95 desktop | GPU p95 móvel emulado | Decisão |
|---|---:|---:|---|
| off | 1,049 ms | 0,655 ms | controle preservado |
| alto, MSAA4 + pré-passe opaco | 1,638 ms | 1,114 ms | erro WGSL corrigido; opcional, ruído distante ainda visível |
| master, SMAA espacial | 1,245 ms | 0,852 ms | **rejeitado por piora visual da água** |

O alto válido soma 85/79/84/70/63/80 draw calls nas seis poses desktop;
o off soma 44/41/44/35/31/42. O pré-passe extra existe no código e aparece
no custo. Não comparar o custo do alto íntegro como se o alto anterior,
que pulava um pipeline inválido, oferecesse a mesma imagem.

No master SMAA, os PNGs `4-pescadores` e `5-barco` exibem pontos escuros
dispersos e formas retangulares sobre a água; a granulação distante fica
mais forte. A revisão independente do outro agente confirmou o achado.
Não há base para afirmar que SMAA melhorou o jogo só porque seu tempo GPU
foi menor neste ensaio. FPS continua próximo do teto de 100 Hz. O plano
de integração voltou a preservar TRAA, mantendo apenas a correção do alto
e o descarte explícito dos recursos do pós-processamento.

Evidência: `shots/rtx-r11-candidate/` contém a matriz completa, fotos e
sequências. O relatório tem SHA-256
`5310757c196b5694eb35ae82e385a1c84376a8321ad6dc80ca7ad4df3c3d3178`;
seu manifesto, `2ad94cae6624dd1b5646c9797ad1f74a6cd11f2c1f59446d52fbcc6eaa09f795`.
`shots/rtx-r11-review/COMPARISON.json` registra aprovação técnica **separada**
da rejeição visual. As pranchas do revisor ficam em
`shots/rtx-r11-review/visual/` com fontes/hashes; não são capturas novas.

### Diagnóstico curto com AO indireta

Com o mesmo bundle rejeitado e `ao=indireta`, somente quatro poses foram
capturadas: pescadores/barco × alto/master desktop. Cada pose teve 60
quadros de estabilização e 60 intervalos registrados, sem matriz longa.
Zero erros e 14 modelos/hash conferidos. Evidência e script em
`shots/rtx-r11-indirect-smoke/` e
`shots/rtx-r11-review/smoke-water-indireta.mjs`.

Nas imagens inspecionadas, os pontos na água e a granulação forte do
horizonte desaparecem ou diminuem claramente. Isso apoia investigar a
aplicação da oclusão à cor final e a consistência normal/profundidade das
superfícies transparentes. É diagnóstico, não prova causal isolada: o modo
indireto altera mais de uma parte do caminho. Não atesta estabilidade
temporal, todas as cenas, desempenho equivalente ou qualidade aprovada.

## Build conservador final

Concluído. Integração informou 279 testes CPU e fonte funcional commitada
em `69d0840`, com docs/métricas locais ainda alterados. O bundle efetivamente
recebido foi `index-ClM63sgn.js`, SHA-256
`b996e4bfd93af8b6cd3b8fb3c7f6c85e8c76f4d0dfabf5a78fee4a50601b4b7a`,
servido de uma cópia final congelada na porta 4198. O teste não depende
de assumir que a branch mutável corresponde ao bundle.

- Alto desktop e móvel emulado: seis poses, 60 quadros de aquecimento e
  100 medidos por pose, 600 por viewport. Zero erros de shader, console,
  página, HTTP ou falha de requisição; 14 modelos e hash conferidos.
  Metadata `msaa4`, `temporal=false`. O GPU p95 curto voltou a informar
  1,638/1,114 ms; não se usa o smoke curto para afirmar ganho estatístico.
- Master com Começar real, nas duas dimensões: 16 verificações por
  viewport, 32 aprovadas. Duas espécies aprovadas após Go, herói GLB,
  Bíblia literal, pausa/retomada, próxima missão acionável sem ler,
  cinematográfica fora de edifícios, citação literal, persistência e
  oferta de continuar após recarga. Zero erros capturados.
- Master + AO indireta: uma pose curta no barco, sem erros; metadata
  **`traa`, `temporal=true`** e 14 modelos/hashes confirmam que o caminho
  temporal original foi restaurado. Não é promoção visual da AO indireta.

O final preserva o padrão sem efeitos, corrige o erro real do alto e
mantém os demais modos como opções experimentais. A candidata SMAA
rejeitada não foi tratada como melhoria entregue. A granulação do GTAO,
qualidade das malhas, repetição das casas e testes em celulares físicos
continuam pendentes; nenhum DLSS foi usado ou demonstrado aqui.

Evidência final: `shots/rtx-r11-final-alto` (12 PNGs),
`shots/rtx-r11-final-master-features` (6 PNGs) e
`shots/rtx-r11-final-indirect-smoke` (1 PNG), cada pasta com relatório e
manifesto SHA-256. Índice consolidado em
`shots/rtx-r11-review/FINAL-SUMMARY.json`. Todos os browsers foram fechados;
a GPU foi liberada explicitamente à integração. Nenhum commit, push ou
deploy foi feito por este agente de QA.

Para repetir o smoke alto com a cópia congelada ainda servida, a partir
da worktree, usando uma pasta de saída **nova**:

```powershell
$env:PLAYWRIGHT_PATH='C:/Users/R2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/check_rtx_r11.mjs http://127.0.0.1:4198/ shots/rtx-r11-recheck-alto --fx=alto --warmup=60 --frames=100 --no-water-video --expected-sha=b996e4bfd93af8b6cd3b8fb3c7f6c85e8c76f4d0dfabf5a78fee4a50601b4b7a
```

Omitir `--no-water-video` grava sequências após os tempos. Omitir
`--warmup/--frames` usa o protocolo longo 300/600. Para o preflight do
master, usar `--fx=master --features-only` e outra pasta nova. Não executar
outro renderer ou inferência local em paralelo.
