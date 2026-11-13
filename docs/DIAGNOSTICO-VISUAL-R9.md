# Diagnóstico visual R9 — qualidade antes de quantidade

13/11/2026. Auditoria de Codex sobre a base `ea39f63`, catálogo e GLBs locais, código de materiais e evidências R8. **Sem geração Tripo, gasto, GPU ou alteração de runtime nesta auditoria.** Os 1.200 créditos anteriores foram consumidos; ampliação ainda pendente não autoriza uso.

## Conclusão

O aspecto atual não demonstra um limite do navegador. Há problemas concretos de malha, proporção, integração e composição: três casas repetidas e esticadas, fundações lisas expostas, um único material de chão e seis humanos detalhados que ainda não têm rig. Aumentar resolução de saída, colocar mais objetos ou mudar de motor não corrige essas causas.

A prioridade é melhorar um trecho de rua, seus personagens e seus materiais, comparando o mesmo enquadramento. O mapa e seu relevo real podem permanecer grandes; a região com detalhes de perto pode ser menor e carregar conforme a caminhada.

## O que foi visto, e o que é hipótese

Capturas reais conferidas no checkout R8, em `shots/fauna-r8-final/` e `shots/fauna-r8-support-donkey-final/`:

- `chrome-desktop-near-animal.png`: pedras com formas grandes/angulosas, telhados simplificados, caixas lisas sob casas, repetição de fachadas e textura granular muito uniforme no chão. Isso é observação visual, não estimativa de FPS.
- `chrome-mobile-near-animal.png`: paredes próximas mais borradas e cenário amplo com pouca variação. O indicador momentâneo de 8 FPS nessa captura não representa a janela estável de desempenho registrada depois.
- `donkey-idle-0.png`: burro e herói têm detalhe de superfície superior às casas e ao vaso simplificado próximos. Essa diferença torna a cena inconsistente. Não foi detectado estiramento grosseiro no animal nesse take.
- `chrome-desktop-intro.png`: a abertura usa uma imagem identificada como **conceito visual**; não é gameplay. A distância estética para o cenário real é grande. Manter essa identificação e não usar a imagem para provar qualidade implementada.

Não foi recebido nesta subtarefa um novo print específico do usuário. As observações acima referem-se às evidências R8 identificadas, não a uma captura supostamente atual. Causas de iluminação/material abaixo são sustentadas pelo código; o impacto visual de cada ajuste isolado ainda precisa de comparação A/B.

## Casas: quantidade de pixels não resolve a forma

Os GLBs do catálogo foram abertos por CPU; hashes, imagens e dados de materiais conferem com `src/data/tripo-assets.json`.

| Casa | Triângulos | Dimensões-base, L×A×P | Mapas | Mediana de pixels por metro nas paredes a 2K | Equivalente a 512 |
| --- | ---: | --- | --- | ---: | ---: |
| Basalto A | 3.824 | 6×3×5 m | 3×2048² | 140 | 35 |
| Basalto B | 4.910 | 8×3×5 m | 3×2048² | 91 | 23 |
| Basalto C | 3.262 | 5×3×4 m | 3×2048² | 133 | 33 |

A densidade foi calculada como `2048 × sqrt(áreaUV / áreaWorld)` por triângulo, mediana ponderada por área. Foram considerados triângulos quase verticais (`abs(normal.y)<0,4`) e transformações do GLB, antes do esticamento de cada instância. É uma medida aproximada de densidade de atlas, não uma nota subjetiva de qualidade.

`settlementLayout()` gera **158 casas**: 58 A, 36 B e 64 C. As dimensões usadas variam de 5,81–8,95 m de largura, 2,46–3,40 m de altura e 4,82–7,45 m de profundidade. `houses()` aplica escala independente nos três eixos; a relação entre o maior e menor fator chega a **2,15×**. Portas, pedras e proporções são deformadas junto da malha. As fundações lisas têm **0,33–2,14 m** de altura, explicando os pedestais visíveis; não se deve simplesmente apagá-las e deixar a casa suspensa em declives.

Recomendação prioritária:

1. Preservar proporções de portas/pedras e limitar escala não uniforme. Trabalhar módulos de fachada, canto, telhado, porta e varanda com medidas coerentes.
2. Usar pedra/madeira com UV repetível por metro, acabamento de borda e variação localizada, em vez de esticar um atlas de casa inteira. Manter detalhes únicos em atlas/trims.
3. Integrar fundação ao chão com pedra, encontros, degraus e detritos plausíveis, sem alterar o DEM para esconder problemas.
4. Produzir/revisar primeiro uma casa de perto. Mais variantes da mesma forma inadequada multiplicariam o problema.

Não há evidência de que os mapas estejam inteiramente metálicos: o canal azul medido do metallic/roughness tem média aproximada de 1–4% nas casas. A aparência escura não deve ser atribuída a “metalness=1 em tudo”. Não há `occlusionTexture` nesses três materiais; o efeito de acrescentar AO deve ser avaliado sem duplicar sombras já presentes no albedo.

## Chão, luz e contato

- `groundMesh()` aplica **um material Rocky Gravel** por todo o terreno próximo, repetido a cada **3,6 m**, com variação macro em 27 m. A máscara de trilha muda a cor, mas mantém o mesmo normal map e intensidade **0,72** no centro e nas bordas. Isso explica o piso visualmente uniforme e pedregoso mesmo onde seria solo compactado.
- O chão já tem três mapas 2048², totalizando **5.387.930 bytes** transferidos. Aumentar sua resolução não cria terra, areia, lama ou transições. Primeiro reduzir relevo/contraste na faixa pisada, criar bordas e variações de material coerentes; depois comparar necessidade de texturas adicionais.
- Terreno próximo: 3.072 m, grid 257², passo **12 m**. Há relevo regional real; isso não fornece sulcos, margens e pedras de centímetros. Detalhe local deve ser uma camada artística identificada, preservando os dados de origem.
- Luz R8: ACES, exposição 1,08, ambiente de céu LDR 0,55, hemisfério 1,25 e sol 2,7. O céu de fundo é 4096×2048; o ambiente é 1024×512, **LDR tonemapeado**, não HDR. Não há SSAO/GTAO ou outra passagem de oclusão no runtime auditado.
- Sombra solar: 4096² desktop/1024² mobile cobrindo 56 m. Isso equivale a aproximadamente **1,37 cm / 5,47 cm por texel**, antes de projeção/filtro; normal bias é 3 cm. Contato pequeno fica limitado no móvel. Uma sombra próxima mais concentrada ou AO localizado pode ajudar, com custo e perda de sombra distante a testar.
- Vasos, vigas e coberturas de `settlement-details.ts` usam materiais de cor simples. Melhorar o chão sem esses objetos manteria a diferença de acabamento junto da câmera.

## Humanos e animais

| Humano disponível | Triângulos | Skin / clips na fonte de runtime |
| --- | ---: | --- |
| André | 11.476 | 0 / 0 |
| João | 11.856 | 0 / 0 |
| Simão | 11.460 | 0 / 0 |
| Tiago | 11.446 | 0 / 0 |
| Zebedeu | 9.866 | 0 / 0 |
| Empregado | 7.688 | 0 / 0 |

Todos possuem três mapas 2048² e status `awaiting-rig-not-used-in-game`. A base R8 não os carrega; `main.ts` construía NPCs com `makePerson()` de cápsulas/esferas/cilindros. **A retirada desses humanos provisórios já está em andamento na R9 por outro agente.** Não confundir essa mudança com entrega dos seis personagens animados, nem substituir por A-pose visível ou por cópias do herói.

O herói tem 17.481 triângulos, uma skin e somente `walk`; a pose parada é derivada do ciclo, com ajuste procedural de postura. Melhorar personagens envolve rig, animações, transições e materiais, não apenas texturas. Priorizar os quatro discípulos necessários às missões; ampliar população depois de aprovar indivíduos e medir custo real.

Galinha e burro R8 são malhas próprias, com 7.886/17.688 triângulos, variantes 1024/512 e animações corrigidas. Estão estruturalmente muito além dos antigos animais simples rejeitados. Ainda há diferenças de iluminação/contexto, repetição de indivíduos e falta de IK de terreno. Rever na cena antes de gastar em novas gerações; aumentar polígonos por si só não resolve esses pontos.

## Custos medidos, sem inventar gargalo

Fonte: `shots/fauna-r8-final/report-{chrome-desktop,chrome-mobile,webkit-mobile}.json`, bundle R8 `index-By9uYN8-.js`. Alteração posterior de áudio não mudou geometria/shader; estes números permanecem evidência dessa execução, não benchmark novo R9.

| Caso R8 no mesmo PC Windows | Janela | FPS amostrado | Chamadas reportadas | Triângulos reportados | Texturas reportadas |
| --- | --- | --- | ---: | ---: | ---: |
| Chrome 1280×800, WebGPU | 5 s | ≈100 | 117 | 3.834.249 | 1.248.551.959 B |
| Chrome 390×844, WebGL2 | 5 s | ≈99–100 | 87 | 2.800.297 | 204.448.336 B |
| WebKit Windows 390×844 | 5 s | ≈43–62 | 87 | 2.800.297 | 204.448.336 B |

Esses são contadores do renderer, não geometria única do mapa ou VRAM total do processo. Não há aqui medição separada de tempo CPU/GPU que permita afirmar qual etapa limita o frame. Viewport/UA móvel no PC **não comprova desempenho, memória ou temperatura no iPhone físico**. O histórico de encerramento no Safari não prova sozinho que a causa foi VRAM.

As 14 malhas principais têm **42 imagens 2048²**. A conta teórica RGBA8+mipmaps é aproximadamente **896 MiB**, antes de chão, céu, sombras, fauna e outros recursos; é coerente com pressão de memória, não uma medida física adicional. WebP reduz download, mas os pixels deixam de estar comprimidos como WebP durante uso gráfico convencional.

No mobile, o loader limita o herói a 1024 e cenário a 512 antes do upload, mas ainda baixa os mesmos GLBs 2K principais. Já a fauna usa arquivos menores por perfil. O total `resourceEncodedBytes` observado foi ≈21,47 MB desktop e 20,17 MB Chrome móvel; inclui os pedidos desse ensaio, não é um tamanho único garantido para toda visita.

## Sacrifícios propostos para ganhar qualidade

São opções de produção e hipóteses a testar, **não ganhos já medidos**.

| Escolha | Qualidade que permite buscar | O que se abre mão |
| --- | --- | --- |
| Trecho próximo de 100–150 m muito bem acabado, mapa regional mantido e carregamento por setores | Materiais, objetos e arquitetura de perto com orçamento previsível | Não mostrar todo o mundo em detalhe máximo ao mesmo tempo |
| Poucos humanos aprovados primeiro, começando pelos quatro discípulos | Rig, roupa, rosto adulto, gesto e contato coerentes | Multidão imediata; nenhum NPC geométrico para preencher quantidade |
| Perfil visual de 30 FPS em aparelhos escolhidos | Orçamento-alvo de 33,3 ms contra 16,7 ms a 60 FPS, potencial para efeitos/detalhes | Fluidez e resposta de 60 FPS; reduzir o alvo não garante dobrar qualidade nem corrige memória |
| 2K seletivo perto da câmera, 1K/512 mais longe | Nitidez onde aparece, sem multiplicar todas as imagens | Mesmo detalhe à distância; transições de LOD precisam revisão |
| KTX2/Basis com suporte detectado e comparação de normal maps | Investigar redução de memória residente mantendo resolução útil | Tempo de conversão/transcode, ajustes de loader e possibilidade de artefatos; não está integrado hoje |
| PC máximo e mobile com orçamento próprio | Aproveitar GPU/memória maior no PC mantendo entrada viável no celular | Paridade visual total entre dispositivos |
| Menos casas/objetos longínquos processados, oclusão e LOD de verdade | Espaço de frame para casas/personagens próximos melhores | Detalhe distante e custo de implementar/testar streaming/culling |

KTX2 não exige trocar de motor: a versão local do Three tem `KTX2Loader`, `detectSupport(renderer)` e `GLTFLoader.setKTX2Loader()`, mas eles não são usados pelo projeto. É uma rota técnica a prototipar, não promessa de economia específica. Um servidor maior também não transforma automaticamente gráficos renderizados no aparelho; streaming de vídeo seria outra arquitetura, com custos/latência próprios.

## Ordem sugerida

1. Concluir a política R9 sem humanos provisórios e manter a narrativa honesta sobre participantes ainda não representados.
2. Uma rua de referência: casa com proporção e encontro no chão corretos, fachada/material repetível, trilha compactada e objetos próximos com o mesmo acabamento.
3. Rig e aprovação dos quatro discípulos; testar transições e falas com os modelos reais.
4. Perfil de memória: variantes físicas por dispositivo e protótipo KTX2; preservar 2K onde traz diferença observável.
5. Comparar iluminação/contato em A/B fixo, então ampliar densidade e área. Medir PC e iPhone físico antes de prometer 30/60 FPS.

Não forçar mudança de engine ou DLSS: nenhum resultado novo dessas tecnologias foi demonstrado nesta auditoria.

## Fontes locais

`src/data/tripo-assets.json`, GLBs referidos em `public/models/tripo-r1/`, `tools/prepare_tripo.mjs`, `src/tripo-assets.ts`, `src/asset-loading.ts`, `src/world.ts`, `src/world-layout.ts`, `src/settlement-details.ts`, `src/animated-actor.ts`, `src/people.ts` e `src/main.ts` da base auditada; `public/world/cafarnaum*.json`; licenças/medidas em `public/textures/{ground,sky}/LICENSE.json`; `docs/QA-FAUNA-R8-NAVEGADOR.md`, `docs/QA-GALINHA-R8-BIRDWALK.md`, `docs/QA-BURRO-R8-WALK.md` e `docs/FAUNA-PRODUCAO-R8.md`. Evidências brutas R8 estão no checkout `gta-fauna-r8-20261113`, fora do Git. O único arquivo criado por esta auditoria R9 é este documento.
