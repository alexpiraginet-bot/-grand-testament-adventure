# QA da vila R10 — comparação antes/depois

Estado: **comparação visual e QA funcional concluídas**. A candidata passou nas verificações descritas; a oscilação inicial de desempenho no WebKit não persistiu no par estabilizado. Não há alegação de ganho percentual ou prova de Safari físico.

## Método e referência

Data: 13/11/2026. O harness `tools/check_village_quality.mjs` usa Chrome instalado, uma janela por vez, em 1280×800 e 390×844 (UA iPhone e touch no segundo caso). O teste usa o build R9 preservado na worktree `gta-visual-quality-r9-20261113`, servido localmente na porta 4194. Não altera o runtime.

Há duas passagens por viewport:

1. **Visual fixa**, com `?debug=1&dtmax=0`: três poses derivadas da rota e dos dados de terreno. O relógio real não é alterado. A simulação, água e barco ficam em tempo zero; posição do herói e parâmetros de câmera são atualizados e conferidos a cada ponto. Sol estático do runtime: direção proporcional a `(0.45, 0.92, 0.7)`.
2. **Jogo normal**, sem `dtmax`: os mesmos pontos, com 2,5 s de acomodação e uma janela de RAF de pelo menos 5 s por ponto. São registrados timestamps nativos de `requestAnimationFrame`, `performance.now`, intervalos p50/p95/p99, contadores do renderer, avanço do tempo de jogo e uma caminhada real por W.

Os pontos são: começo da rua; metade da rota até a praia, olhando para a casa planejada mais próxima; e três metros antes do ponto da praia. `scenario.json` registra coordenadas, câmera, dimensão, rotas, hashes dos dados geográficos e derivação. A candidata usou exatamente esse arquivo via `--fixture`, hash do cenário serializado `e1338e60f74692033d7adc92af36880fda69c16ed20993db8c95079a4b1a025d`.

Os PNGs `screen` são capturas completas do navegador. Os PNGs `canvas` são o recorte do elemento pelo Playwright e **podem incluir overlays DOM sobrepostos**; não são um attachment sem HUD nem um passe de profundidade/material. O hash distinto entre os três pontos confirma atualização do quadro, não qualidade artística.

## Referência R9 observada

Quatro execuções passaram: 8 verificações em cada passagem fixa, 10 em cada passagem normal, **36 verificações no total**. Foram preservados 12 PNGs, relatório JSON, cenário e manifesto com hashes em `shots/village-r10-baseline/`.

- 14 GLBs centrais antes do botão Go; galinha e burro aprovados depois de Go, com os bytes exatos de cada perfil.
- Um único humano renderizado: herói GLB com SkinnedMesh. Zero NPCs ou primitivas humanas, colliders de NPC e marcas de seguidores.
- 2.262 sondas por execução nas linhas centrais e a ±0,8 m de todas as rotas: nenhum bloqueio. Centros representativos de construções continuaram sólidos.
- Caminhada real por W executada nas passagens normais; teleporte foi usado para preparar os pontos, sem alegar percurso contínuo de toda a jornada.
- Nenhum erro de página, console ou HTTP nas quatro execuções. Avisos de depreciação do Three ficam no relatório.

### RAF real e o indicador próximo de 100

O código R9 divide o total de quadros pelo tempo real de `performance.now`. O limite `DT_MAX` afeta a simulação, não esse contador. O harness confirmou aproximadamente **99,996 FPS** pelo RAF externo, com **p50 de 10 ms** e p95 em torno de **10,1–10,2 ms**, nas seis janelas normais. O tempo de jogo avançou aproximadamente 5 s em cada janela de 5 s.

Isso confirma o ritmo observado de apresentação neste Chrome/PC. Um platô perto de 100 FPS não mede a folga da GPU acima desse ritmo e não prova desempenho em telefone. Não foram usados clock virtual, `setTimeout` como substituto de frame ou desempenho da passagem congelada como benchmark de jogabilidade.

### Aparência antes da alteração

Na casa central, a captura mostra a fachada larga, porta baixa e base cinza retangular saliente. O solo tem detalhe marrom escuro e uniforme; perto da água, a transição é muito abrupta. As imagens servem de referência para julgar proporção das casas, acabamento das bases e variação do terreno na candidata. São imagens reais do jogo, não conceitos gerados.

## Candidata R10

O integrador informou build completo com **184/184 testes CPU** aprovados. A candidata foi servida localmente na porta 4195, bundle `index-BU735wiL.js`, SHA-256 `09d2b7be3ee6609ff63967fce0908c070146dcb4f70799fda668343ce4e38d17`. A referência usa `index-7Z8RWWVI.js`, SHA-256 `57262772fec1784854f16e42b6316a7201d6d5c6bf5af5143c51645fb0d83514`.

As quatro passagens Chrome da candidata passaram nas mesmas **36 verificações**. Foram repetidas as 2.262 sondas de rota por execução, centros sólidos de casas e caminhada W: aproximadamente 4,35 m, sem bloquear o jogador. Herói nativo, ausência de NPCs provisórios, 14 GLBs centrais e duas espécies aprovadas foram preservados. Nenhum erro de página, console ou HTTP apareceu. A captura de rua, casa e margem foi revisada em desktop e mobile; o herói continuou no ponto e a câmera solicitada manteve yaw/pitch/distância e dimensões idênticos.

### O que mudou na imagem

- A casa próxima ficou menos larga, mantendo a proporção da malha; a porta deixou de parecer achatada. O pedestal cinza saliente virou uma base mais estreita, com superfície texturada junto ao chão.
- A trilha ficou mais lisa e menos granulada, com bordas de transição; a margem ficou mais clara e arenosa. O detalhe de pedregulho permanece fora da trilha.
- As casas continuam sendo três modelos simplificados repetidos. As texturas das paredes ainda não têm a qualidade das referências artísticas. O contorno da água é limitado pelo relevo regional e continua bastante reto no take escolhido. Isso não foi apresentado como fotorrealismo nem como nova malha profissional.
- A redução dos footprints altera a rejeição dos objetos decorativos: algumas plantas/vasos mudam de lugar. Não tratar toda diferença de pixel ou de triângulos como efeito exclusivo do shader de solo.

`worldQuality()` confirmou 158 casas dos 158 lotes, três variantes presentes, escala uniforme de 0,75319 a 1,13125; três batches de casas e um batch de fundação. As fundações usam os mapas existentes. O solo registra três texturas, quatro amostras de textura no grafo, oito rotas e nenhum deslocamento da geometria do terreno.

Os caminhos de arquivos GLB, imagens e áudio observados foram os mesmos em cada par. O JavaScript descomprimido passou de 1.158.876 para 1.166.472 bytes; não houve nova imagem ou modelo baixado para esta revisão. Nas capturas congeladas, os draw calls aumentaram em um por vista (41→42 ou 39→40); o benchmark normal é separado porque os animais continuam animando e podem mudar o conjunto visível.

### RAF Chrome — execução normal

Cada valor usa os timestamps nativos da janela de 5 s, sem screenshots durante a medição. As duas revisões ficam perto do ritmo de apresentação do ambiente; não inferir capacidade de renderização acima dele.

| Perfil / ponto | R9 RAF FPS | R10 RAF FPS | R9 / R10 p95 do frame |
|---|---:|---:|---:|
| Desktop / começo | 100,00 | 100,00 | 10,1 / 10,1 ms |
| Desktop / casa | 100,00 | 100,00 | 10,1 / 10,1 ms |
| Desktop / margem | 100,00 | 99,79 | 10,1 / 10,1 ms |
| Mobile / começo | 100,00 | 100,00 | 10,1 / 10,1 ms |
| Mobile / casa | 100,00 | 99,80 | 10,2 / 10,1 ms |
| Mobile / margem | 99,99 | 100,00 | 10,1 / 10,1 ms |

Na janela normal do começo, o renderer estimou texturas em 1.247,50 MB→1.247,15 MB no desktop e 203,40 MB→203,05 MB no mobile. Essas diferenças pequenas não são uma medição de memória total do dispositivo. Os números brutos de cada ponto e os bytes de rede estão em `COMPARISON.json`.

### WebKit: shader e janela estabilizada

O smoke da candidata passou **12/12 verificações** em WebGL2, incluindo 14 GLBs centrais, fauna, herói, ausência de primitivas humanas e abertura do encontro. As imagens mostram o novo solo e as casas renderizados; nenhum erro de shader, console, página ou HTTP foi capturado. O WebKit Windows não tem Web Audio neste ambiente, e a interface continua informando “Som indisponível”.

O smoke curto levantou uma preocupação real: RAF de 47,67 FPS na candidata e 56,26 FPS na referência repetida logo depois. Por isso o integrador solicitou um segundo par, **referência primeiro, candidata depois**, no mesmo ponto inicial, WebGL2 low, 390×844, DPR 1 e 24 animais. Cada execução aguardou pelo menos **10 s após fauna pronta e posicionamento**, então mediu **10 s úteis sem capturas**:

| Versão | RAF FPS | Frames / janela real | p50 | p95 | p99 | Avanço do tempo de jogo |
|---|---:|---:|---:|---:|---:|---:|
| R9 referência | 54,49 | 545 / 10.007 ms | 16 ms | 30 ms | 31 ms | 10,014 s |
| R10 candidata | 62,80 | 629 / 10.008 ms | 16 ms | 17 ms | 30 ms | 10,015 s |

As duas execuções estabilizadas passaram 8 verificações cada e não registraram erros. A queda inicial **não se reproduziu** nesse par; a variação também impede anunciar um ganho geral. O resultado é funcional e local, não uma caracterização estatística ou ensaio de Safari em iPhone. Os relatórios curtos desfavoráveis foram preservados, não substituídos pelos posteriores.

## Evidências

- `shots/village-r10-baseline/`: referência Chrome, 12 PNGs + cenário/relatório/manifesto.
- `shots/village-r10-candidate/`: candidata Chrome, 12 PNGs + cenário/relatório/manifesto.
- `shots/village-r10-webkit/` e `shots/village-r10-webkit-baseline/`: smoke curto, três prints e relatório em cada pasta.
- `shots/village-r10-webkit-stable-baseline/` e `shots/village-r10-webkit-stable-candidate/`: ensaio sem capturas durante a medição, cenário/relatório/manifesto.
- `shots/village-r10-comparison/COMPARISON.json`: entradas equivalentes, custos e caminhos de recursos.
- `shots/village-r10-comparison/WEBKIT-STABLE.json`: par estabilizado, poses, dimensões, clocks e limites.

Os manifestos preservam hashes dos arquivos e do harness usado em cada fase. Depois da referência, o harness recebeu leitura opcional de `worldQuality()` e, para o par WebKit, opções de navegador/aquecimento/janela/ponto; as poses e o relógio de medição não foram substituídos.

## Limites

- Foram revisadas três vistas fixas; isso não prova contato perfeito das fundações de todas as 158 casas nem de todos os pés animados.
- A câmera exposta em R9 fornece yaw, pitch e distância solicitada; a matriz final após colisão não está exposta. Mudanças no volume das casas podem alterar a obstrução efetiva. Esse caso deve ser registrado, não escondido por uma suposta comparação pixel a pixel exata.
- A fauna fica congelada somente na passagem visual; na execução normal, posições, animações e áudio podem variar.
- `textureBytes` é estimativa do renderer, não medição de VRAM ou RAM do processo. Resource Timing cobre o caso inteiro, não apenas a primeira tela.
- Nenhum iPhone físico, suspensão do Safari ou ensaio térmico prolongado foi realizado. A parte móvel roda neste PC.
- Não houve geração Tripo, compra, chamada paga, envio de formulário, commit, push ou deploy por este harness. Tokens e custo monetário desta subtarefa: sem medição própria; não extrapolar pela duração.

## Reprodução

```powershell
$env:PLAYWRIGHT_PATH='C:/Users/R2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/check_village_quality.mjs http://127.0.0.1:4194/ shots/NOVA-baseline
node tools/check_village_quality.mjs http://127.0.0.1:4195/ shots/NOVA-candidate --fixture=shots/village-r10-baseline/scenario.json
# Repetir uma janela estabilizada, mantendo a saída nova e o preview pretendido:
node tools/check_village_quality.mjs http://127.0.0.1:4195/ shots/NOVA-webkit-stable --fixture=shots/village-r10-baseline/scenario.json --engine=webkit --profile=mobile --live-only --point=street-start --warmup-ms=10000 --measure-ms=10000
```

O harness recusa sobrescrever uma pasta de saída existente. Preserve `MANIFEST.json`, `scenario.json`, `report.json` e as capturas originais.
