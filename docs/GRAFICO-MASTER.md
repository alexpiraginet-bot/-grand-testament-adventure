# Gráfico nível master — histórico Claude e revisão R11 (13/11/2026)

Pedido de Alex: "Precisamos do gráfico nível master! Descubra como! Não vamos economizar com gráficos e
jogabilidade." Complementa `docs/MOTORES-GRAFICOS.md` (análise documental do Codex) e `docs/ALTO-NIVEL.md`.
Regra que vale para tudo abaixo: **nenhuma troca de motor ou de efeito vira padrão sem a mesma cena medida antes e
depois**, no PC com a RTX e em celulares físicos.

## Estado R11: Alto corrigido; Master temporal preservado

A base Claude `7dc836b` foi congelada em `assets-src/r11/baseline-dist` antes de alterar o código. O ensaio
em Chrome usando a RTX 5060 Ti confirmou **erro de shader no Alto**: o GTAO tentava executar
`textureGather(texture_depth_multisampled_2d, sampler, vec2)` na profundidade MSAA 4x. As 14 mensagens de erro
ocorreram em cada viewport; os tempos desse perfil não representam uma imagem íntegra. `off` e Master temporal
tiveram zero erros de console nos dois viewports. Todas as variantes carregaram 14/14 modelos base, sem falha
de carga ou requisição. O relatório, hashes e limitações dos contadores estão em [QA-RTX-R11.md](QA-RTX-R11.md).

O defeito de água do TRAA descrito no histórico abaixo foi observado no renderizador por software.
**Não foi reproduzido nas capturas estáticas da RTX.** As sequências contínuas foram preservadas para revisão;
ausência de erro de shader não aprova transparência, movimento ou qualidade. O viewport móvel também usa a RTX:
não houve ensaio desta revisão em Android ou iPhone físico.

Uma tentativa de substituir o TRAA por SMAA foi medida em build isolado e **REJEITADA visualmente**: as capturas
do Master apresentaram pontos pretos sobre a água e granulação distante acentuada. O desaparecimento da água
não foi reproduzido nas estáticas da base RTX, portanto esse resultado não justifica trocar o antisserrilhado
original. O SMAA foi retirado do código, sem nova flag. A matriz e os PNGs da tentativa continuam preservados
em `shots/rtx-r11-candidate`; não são evidência do código final restaurado. As pranchas de revisão estão em
`shots/rtx-r11-review/visual`.

A fonte final em `src/postfx.ts` mantém `off`, preserva o TRAA do Master e deixa todas as flags opt-in. GTAO
continua em meia resolução e o bloom mantém os parâmetros anteriores. Permanecem a correção da profundidade
do Alto e a liberação dos recursos de pós-processamento:

| Variante final R11 | Passes de geometria | Profundidade/normal do GTAO | Antisserrilhado |
|---|---:|---|---|
| `fx=alto` | 2 | pré-passe opaco, sem MSAA | cor com MSAA 4x |
| `fx=alto&ao=indireta` | 2 | pré-passe opaco, sem MSAA | cor com MSAA 4x |
| `fx=master` | 1 | MRT de cor/normal/velocidade, sem MSAA | TRAA original, usando profundidade e velocidade do passe de cor |
| `fx=master&ao=indireta` | 2 | pré-passe opaco, sem MSAA | TRAA original, usando profundidade e velocidade do passe de cor |

O Alto final passa a desenhar a geometria opaca uma vez a mais. É um custo real de arquitetura, ainda sem ganho
ou perda de FPS atribuído à fonte final. O Master possui o mesmo alvo intermediário de cor e os dois alvos
do TRAA da base, agora com descarte explícito. Seus dados de profundidade, velocidade, câmera e opções do RTT
foram preservados. A metadata é `antialiasing: traa, temporal: true` para Master e `msaa4, false` para Alto.
**TRAA aqui é antisserrilhado temporal, não super-resolução nem DLSS.** O nome do preset não significa qualidade
superior já demonstrada. Não foi alterado o perfil padrão nem escolhido outro motor.

A relação entre transparência e o defeito antigo segue sendo uma **hipótese técnica**: o lago não escreve
profundidade; a cor mistura lago e fundo, enquanto as saídas de normal/velocidade do MRT não seguem a mesma mistura.
Isso pode fornecer informações incompatíveis ao TRAA, mas não prova a causa do resultado visto por software.
O **Master final restaurado** ainda recebe MRT com normal da água enquanto a profundidade pode continuar
sendo a do fundo. A hipótese de inconsistência de entradas GTAO/TRAA permanece aberta; o resultado por software
continua registrado como bloqueio daquele ambiente. O modo indireto tem pré-passe opaco coerente para GTAO,
mas o TRAA recebe profundidade/velocidade do passe de cor, como na base. Não declarar “água corrigida” apenas
porque um shader compila ou uma captura estática parece íntegra.

Verificação CPU: 11 testes específicos de pós-processamento e typecheck passaram. Os testes conferem profundidade
sem MSAA em todas as entradas do GTAO, entradas originais de profundidade/velocidade/câmera do TRAA, metadata
temporal correta e descarte único dos alvos, inclusive RTT/histórico/resolve, sem destruir materiais ou texturas
compartilhados. CPU não compila WGSL nem prova o resultado na tela. O build final conservador passou depois
em smoke próprio: Alto, seis poses e dois viewports; Master, 32 verificações jogáveis e um smoke com AO indireta.
Zero erros capturados, metadata TRAA/temporal real e hashes conferidos. Ver [QA-RTX-R11.md](QA-RTX-R11.md).
A aprovação não foi transferida do bundle SMAA rejeitado; cada build mantém identidade e resultados próprios.

Autoria da tentativa preservada em `assets-src/r11/rejected-smaa-source`: fonte e testes foram reconstruídos
pela reversão do patch local SMAA→TRAA da mesma rodada; **não são declarados como cópia byte a byte anterior**.
Um replay posterior dessa fonte reconstituiu o JavaScript com o mesmo SHA-256
`ad06dddb1826d6f160f20e43b3c609018ba4794de671995c2b9bce91bd9d5d4f` e 1.284.763 bytes.
O nome gerado diferiu; ambos os nomes e a proveniência foram registrados em `BUNDLE-BYTE-VERIFICATION.json`.
`RECONSTRUCTION.json` guarda essa proveniência, hashes e o bundle congelado. Os 11 testes desse arquivo
arquivado também passam. A reconstrução não usou JavaScript minificado. Essas fontes não devem substituir
os arquivos ativos nem ser publicadas como variante aprovada.

Fontes técnicas: implementações instaladas da three 0.186.1 (`GTAONode.js`, `SMAANode.js`, `MRTNode.js`,
`PassNode.js`, `RTTNode.js` e `RenderPipeline.js`) e documentação oficial de
[GTAO](https://threejs.org/docs/pages/GTAONode.html),
[SMAA](https://threejs.org/docs/pages/SMAANode.html) e
[TRAA](https://threejs.org/docs/pages/TRAANode.html). O descarte não é recursivo: cada efeito libera os recursos
que possui; o pipeline de saída sozinho não libera todo o grafo.

## Base histórica conferida antes do R11

- three.js 0.186.1 com `WebGPURenderer` (WebGPU, WebGL 2 de reserva). Até esta revisão o jogo desenhava a cena
  **direto na tela, sem nenhum pós-processamento** (`renderer.render` em `src/main.ts`).
- A própria three r186 instalada já traz, como nós TSL prontos em `three/addons/tsl/display/`: GTAO (oclusão de
  ambiente), SSGI (iluminação indireta em tela), SSR (reflexos em tela), TRAA (anti-serrilhado temporal), TAAU
  (super-resolução temporal), FSR1, SMAA, Bloom, Godrays, Lut3D (gradação de cor), DepthOfField, SSS (sombras de
  contato), MotionBlur e Denoise. Também `CSMShadowNode` (sombras em cascata), `KTX2Loader` com o transcodificador
  Basis, `HDRLoader`/`EXRLoader` e `UltraHDRLoader`.
- Medidas do Codex no PC dele (RTX 5060 Ti, `docs/TRIPO-RUNTIME-R1.md`, `docs/CAFARNAUM-CENARIO.md`): ~166 draw
  calls, ~1,66 milhão de triângulos, **texturas na GPU até ~1,2 GB** no desktop e ~1,05 GB no viewport móvel emulado.
- Produção em 13/11 (`4d7cf86`, medido por esta sessão pela rede pública): 16.733.496 bytes transferidos, 14 malhas
  conferidas, herói com 65 ossos e clipe `walk`, zero erros.

## Instrumentação e implementação original do Claude

1. **A mesma cena, medida** (`src/bench.ts`, `tools/bench.mjs`, `?bench`): seis planos fixos construídos só dos pontos
   do episódio e do relevo real (vila, viela, margem, pescadores, barco, panorama). Cada plano tem aquecimento separado
   (compilação de shader aparece como `warmupMaxMs`) e frames medidos; o relatório traz p50/p95/p99, draw calls,
   triângulos, memória de textura, bytes baixados, tempo até o primeiro frame e uma imagem por plano e variante.
   Os mesmos planos (posição do olho e alvo) servem para montar a cena em outro motor e comparar sem trapaça.
2. **Pós-processamento original sob medição** (`?fx=alto` ou `?fx=master`, com correções R11 descritas acima): um único passe da cena grava cor,
   normal e (no master) movimento; GTAO em meia resolução, bloom com limiar acima do céu LDR, e no master TRAA no lugar
   do MSAA. Sem `?fx` o jogo renderiza exatamente como antes. Os valores estão juntos em `FX_SETTINGS`.

Como rodar no PC da RTX (com o Chrome de verdade, para usar a placa):

```bash
npm run build && npx vite preview --port 4173 &
PLAYWRIGHT_CHANNEL=chrome node tools/bench.mjs http://localhost:4173/ shots/bench fx=off fx=alto fx=master
PLAYWRIGHT_CHANNEL=chrome BENCH_VIEWPORT=390x844 BENCH_DPR=3 BENCH_TOUCH=1 node tools/bench.mjs http://localhost:4173/ shots/bench-movel
```

O segundo comando é viewport emulado no PC, **não** é celular. Para celular físico: abrir
`?bench=1&fx=alto` no aparelho e ler `__gtaBench.results()` pelo depurador remoto (Safari/Chrome).

## Histórico das variantes de 13/11 por software, anterior à revisão R11

Medidas sobre a base integrada com a `main` (build `9c05537`, 1280×800, `tools/bench.mjs`, renderizador por software:
valem imagem, draw calls e memória informada, **não** tempo de quadro). Draw calls na ordem dos planos vila, viela,
margem, pescadores, barco, panorama; sem flags: 174/78/174/203/123/41, 1.215 MB de textura pelo renderer, 0 erros.

| Flag | O que faz | Resultado |
|---|---|---|
| `?atmo=1` | névoa por altura e distância num único nó de névoa, mais quente na direção do sol | mesmas draw calls da base; diferença média de pixel 0,16–0,54 (de 255) nos planos próximos e 4,27 no panorama: com os valores escolhidos **quase não aparece**; ajuste é decisão visual |
| `?tm=agx` / `neutral` / `off`, `?exp=` | curva tonal e exposição | mesmas draw calls; AgX na exposição 1,08 deixou a imagem lavada (medido na base antiga): **pior**, não promover sem gradação; `?exp` não age com `tm=off` |
| `?shadow=csm` | três cascatas do sol até 600 m no lugar da caixa de 56 m | 336/240/336/396/337/69 draw calls (três passes de sombra), 1.181 MB de textura; no panorama as casas e árvores passam a projetar sombra (a caixa não chega lá); nos planos próximos a imagem muda 0,09–0,18 em média. Custo de GPU: medir na RTX |
| `?fx=alto` | GTAO em meia resolução multiplicando a cor final, mais bloom | 187/91/187/216/136/54, 1.243 MB; escurece cantos e também o que o sol ilumina; **pontos escuros nas arestas** (GTAO sem filtro de ruído) |
| `?fx=alto&ao=indireta` | GTAO só na luz ambiente/indireta (`builtinAOContext` da r186) | 347/155/346/370/249/80 (segundo passe de geometria), 1.247 MB; escurece os cantos menos e preserva as paredes ao sol; os mesmos pontos escuros nas arestas: resolver o ruído antes de promover qualquer um dos dois |
| `?fx=master` original | o mesmo com TRAA | **bloqueado naquela rodada por software**: com a água R4 o TRAA desenha água sobre o chão no plano pescadores e a perde em outros (luminância média 117,7 contra 94,6 da base); não extrapolar este resultado para a RTX |
| `?cam=mola` | câmera com mola criticamente amortecida, exata a qualquer fps; entra na hora na parede e sai em ~0,34 s | `tools/check_camera.mjs`: 0 quadros dentro de casa nos dois modos; maior salto 0,49 m (fixa) contra 0,51 m (mola). O giro do teste não chegou a ser tapado por parede, então **o ganho ainda não tem prova de navegador**, só os testes de unidade |

O plano fixo "viela" hoje olha para dentro de uma construção a poucos metros: rever o enquadramento antes da próxima
rodada (pendência do bench, não do jogo).

## Próximos degraus, em ordem de ganho por esforço

Cada item entra como variante de `?fx` ou de qualidade, medido com `tools/bench.mjs`, e só então vira padrão.

| # | Degrau | Por quê | Quem | Estado |
|---|---|---|---|---|
| 1 | Medir `fx=off/alto/master` no PC da RTX e em 1 Android + 1 iPhone físicos | decidir padrão por aparelho com número, não impressão | Codex/Claude; Alex nos aparelhos físicos | base RTX medida; Alto corrigido; substituição SMAA rejeitada; Master TRAA preservado e smoke final aprovado tecnicamente; aparelhos físicos pendentes |
| 2 | Texturas KTX2 (UASTC nas normais, ETC1S/UASTC nas cores) + meshopt | as texturas ocupam ~1,2 GB na GPU; KTX2 fica comprimido na própria GPU, o que abre espaço para 4K no herói sem estourar o celular. Ganho a medir | Codex (derivados e host de assets) + Claude (`KTX2Loader`) | não iniciado; `toktx`/`basisu` não estão instalados nesta máquina |
| 3 | Céu HDR de verdade (a mesma fonte CC0 da Poly Haven tem versão HDR) para a luz ambiente | hoje o ambiente vem de um panorama LDR já tonemapeado: reflexos e luz rebatida ficam chapados | Claude | não iniciado |
| 4 | Sombras em cascata (`CSMShadowNode`) e sombras de contato (SSS) | uma sombra única de 56 m some na vila e no panorama | Claude | `?shadow=csm` em medição (`src/look.ts`): três cascatas até 600 m; a primeira versão deixava quase tudo sem sombra além de ~24 m (câmera de sombra com `far` 220), corrigido em `9c05537` e conferido por simulação com o `CSMShadowNode` real. Sombras de contato: não iniciado |
| 5 | Água: SSR na superfície, espuma e cáusticas por profundidade | o elemento mais visível da referência | Claude (código), Codex (direção de arte) | não iniciado |
| 6 | Godrays do sol, gradação de cor por LUT, profundidade de campo nas falas | linguagem de cinema dos reels | Claude; a LUT é arte: Codex/Higgsfield | não iniciado |
| 7 | TAAU no celular: renderizar a ~67% e reconstruir no tempo | proposta de reconstrução temporal para reduzir o custo; não é DLSS, e ganho/qualidade precisam de medição | Claude | não iniciado |
| 8 | SSGI só no PC (perfil "ultra") | luz rebatida entre casas e chão; caro | Claude | não iniciado |
| 9 | NPCs rigados, `idle`/`run`/`beckon`, vegetação menos facetada | motor nenhum corrige malha e animação | Codex (Tripo) | pendente |
| 10 | Sugestão histórica de versão nativa (Unreal 5 + DLSS na RTX 5060) usando `export/engine/` e **os mesmos seis planos** | comparação proposta, nunca medida como superior; registro técnico em `DLSS5-STATUS.md` não é integração demonstrada | Alex/Codex na máquina com a placa | **fora por decisão do Alex em 13/11/2026: só navegador** |

## Barra AAA de mundo aberto, pilar por pilar

Pedido de Alex em 13/11/2026 de elevar o jogo a um padrão de mundo aberto AAA. Lido como **barra de qualidade**,
não como cópia: continua proibido usar nome, logo, HUD, personagens, cidades ou músicas da Rockstar (regra do
`HANDOFF.md`). Um jogo desse porte é sobretudo volume de arte, animação e conteúdo; o motor é uma parte. Por pilar:

Esta tabela preserva o diagnóstico e o plano originais. No estado vigente R9–R11, **não há NPC humano aprovado
no mundo**: os seis candidatos em A-pose ficam fora da cena. O rig de Simão R11 é um candidato local independente,
ainda sem aprovação para runtime. Galinha e burro R8 já têm integração própria; sua presença não transforma os
candidatos humanos em atores disponíveis. Ver `CLAUDE.md` e `docs/DIAGNOSTICO-VISUAL-R9.md`.

| Pilar | Base histórica do plano | Próximo passo que dá para medir ou ver | Quem |
|---|---|---|---|
| Luz e atmosfera | sol com uma sombra de 56 m, céu fotográfico LDR, render direto sem pós | `?fx` medido no PC/celulares; sombras em cascata; céu HDR; godrays; névoa de altura | Claude |
| Apresentação das missões | legenda literal e HUD | **plano cinematográfico nas falas (esta revisão)**; transições entre missões; trilha e ambiente sonoro com licença registrada | Claude (código), Alex (trilha) |
| Personagens e animação | herói com 65 ossos e só `walk`; seis candidatos em pose A, atualmente excluídos do mundo | `idle`/`run`/`beckon`; olhar de quem fala (cabeça) e pés no chão (IK) | Codex (rig e clipes), Claude (IK/olhar) |
| Mundo vivo | discípulos e empregados; vila sem rotina | aldeões com rotinas (redes, jarros, conversa), barcos no lago, aves, fumaça; depende dos NPCs rigados | Codex (malhas), Claude (sistemas) |
| Jogabilidade | 3 missões lineares: andar e chamar | mais episódios, interações na vila e atividades livres, com "Narrativa do jogo" rotulada (`docs/NARRATIVA.md`) | Alex (roteiro), Claude |
| Desempenho | texturas ~1,2 GB na GPU; ~166 draw calls medidas pelo Codex na RTX (R1); 41–218 nos seis planos do bench neste contêiner sem GPU (registro no diário) | KTX2, LOD, TAAU no celular; bench em aparelhos físicos | Codex, Claude |

A sugestão histórica de versão nativa em `docs/ALTO-NIVEL.md` ficou fora do escopo por decisão do Alex em 13/11:
**o jogo continua no navegador**. Não houve comparação equivalente que prove um teto de qualidade entre motores.
O objetivo vigente é elevar a qualidade no PC e no celular com perfis medidos, sem transformar o limite de um
aparelho em limite obrigatório para todos.

O plano executável, marco a marco (R4–R17), com donos, critérios de aceite e as decisões que são só do Alex, está em
[PLANO-AAA.md](PLANO-AAA.md).

## Motores da lista do Alex

O Codex já registrou fontes e decisão em `docs/MOTORES-GRAFICOS.md`: seguir em three.js e testar o Babylon.js
isolado. Concordo, com um critério operacional: o candidato carrega os mesmos 14 GLB, o mesmo relevo e os mesmos
seis planos de `benchShots`, e entra só se `tools/bench.mjs` mostrar ganho reprodutível,
por exemplo 20% no p95, ou um recurso visual necessário que o three não tenha. Godot (web só em WebGL 2 na
exportação estável), O3DE (sem navegador), Bevy (reescrita em Rust), raylib e OGRE não cobrem o link direto no
navegador com o nível pedido na análise histórica. A exportação nativa permanece como registro, fora do plano
vigente; nenhuma troca de motor foi autorizada ou demonstrada melhor nesta revisão.

## Limites da rodada original por software e pendências vigentes

- A sessão original do Claude rodou sem GPU (Chromium com WebGL 2 por software, ~1 fps): ali só dava para conferir funcionamento (o bench
  percorre as três variantes e grava imagens; resultado registrado na PR), **não** desempenho nem qualidade final.
- Os valores de `FX_SETTINGS` continuam sendo um ponto de partida, não calibração. A oclusão final também escurece
  luz direta; a opção indireta preserva essa contribuição. A contagem de passes vigente é a tabela R11 acima:
  o Alto final agora também precisa do pré-passe por compatibilidade de profundidade com GTAO.
- **Master temporal bloqueado naquela rodada por software:** com o TRAA a água transparente do lago some na maioria dos quadros (medido por cor
  no plano "barco": chão R 76/G 56 contra água R 93/G 99; a água aparece só em quadros isolados). Refutado: histórico
  após corte de câmera e alfa da cor. Isolado: sem o TRAA a água aparece. Hipóteses restantes: o TRAA usa profundidade
  do fundo, mas cor e velocidade podem incluir a água (ela não grava profundidade e sobrescreve a velocidade no MRT
  sem a mistura usada na cor). Essas são hipóteses, não uma causa confirmada na RTX. O Alto não mostrou aquele
  defeito de água por software, mas falhou na RTX por outro motivo: o shader GTAO com profundidade MSAA.
- A tentativa SMAA sem histórico temporal foi rejeitada por artefatos visíveis. O Master preserva TRAA e exige
  revisão em movimento de água, arestas, herói e fauna. As capturas estáticas da base RTX não reproduziram
  o defeito temporal descrito acima; isso não o resolve no renderizador por software.
- Ícones e imagens: pedidos ao Codex ou Higgsfield (`ASSETS.md` → "Pedidos de arte").
