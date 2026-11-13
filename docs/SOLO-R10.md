# Solo R10 — trilha compactada e margem úmida

13/11/2026. Subtarefa de materiais na base `a1c5b21`, branch de integração
`codex/village-quality-r10`. Implementação: `src/ground-surface.ts`.
O diagnóstico de origem está em [DIAGNOSTICO-VISUAL-R9.md](DIAGNOSTICO-VISUAL-R9.md).

## Problema e mudança

O material anterior mudava a cor da trilha, mas preservava o normal map de
cascalho com intensidade 0,72. Isso mantinha o aspecto pedregoso do piso onde
o caminho deveria parecer pisado. O novo material comprime o contraste do
albedo e reduz o normal no centro; a intensidade retorna gradualmente nas
bordas. Duas ondas largas e uma amostra macro quebram a regularidade da borda,
sem deslocar as rotas nem redesenhar o terreno.

Perto da superfície do lago, a altura real do fragmento governa uma transição
de cascalho para areia e depois para solo úmido, mais escuro e menos áspero.
As cores por vértice do terreno continuam multiplicando o material. O DEM,
as normais geométricas e os pontos de navegação permanecem intocados.

São escolhas artísticas de superfície, não uma classificação geológica ou
reconstituição arqueológica de Cafarnaum. A elevação isolada também pode
tingir uma depressão em terra próxima à cota do lago: não há uma nova máscara
hidrológica ou simulação de chuva nesta revisão.

## Contrato de integração

```ts
import {createGroundSurface,type GroundTextures} from './ground-surface.ts';
const material=createGroundSurface(maps,routes);
const mesh=new THREE.Mesh(existingTerrainGeometry,material);
```

`maps` contém `albedo`, `normal` e `roughness`, objetos `THREE.Texture` já
carregados. `routes` aceita `readonly Segment[]`, usando o raio `r` de cada
segmento. Entradas não finitas ou raios não positivos são ignorados e
contabilizados no diagnóstico. Segmentos de comprimento zero produzem uma
mancha redonda, sem divisão por zero. Rotas vazias não criam trilha.

**A geometria deve manter UV `(x / 3.6, -z / 3.6)`**, igual ao groundMesh
existente: esse é o referencial tangente do normal map, embora as amostras
usem coordenadas de mundo. Não mudar a orientação dos UVs isoladamente.
O material possui `vertexColors=true`; não alterar a geração de cores do DEM.
O helper não instancia geometria, canvas, textura, carregador ou callback
por frame. O carregador continua dono das texturas; descartar o material não
descarta os três mapas compartilhados.

Diagnóstico derivado disponível em `material.userData.groundSurface`:
revisão, quantidade de rotas aceitas/ignoradas, três texturas, quatro pontos
de amostragem no grafo, zero bytes adicionais de textura, intensidades de
normal e declaração de ausência de deslocamento geométrico. Isso descreve
o grafo; não é uma medição de instruções finais da GPU, FPS ou VRAM.

## Parâmetros exatos

Fonte única de constantes: `GROUND_SURFACE_DEFAULTS`.

| Parâmetro | Valor |
| --- | --- |
| Repetição de detalhe / macro | 3,6 m / 27 m |
| Núcleo / fim da transição da rota | `r - 0,70 m` / `r + 0,25 m` |
| Amplitudes de irregularidade | onda longa 0,16 m; curta 0,095 m; textura ±0,175 m |
| Frequências espaciais das ondas, em rad/m | longa `(0,117; 0,083)`; curta `(0,47; -0,31)`, fase 1,7 |
| Areia plena / fim da areia | y = 0,15 / 1,25 m |
| Úmido pleno / fim do úmido | y = -0,08 / 0,25 m |
| Variação vertical da borda da margem | irregularidade × 0,12; limite ±0,0516 m |
| Intensidade do normal: cascalho / trilha / areia / úmido | 0,65 / 0,16 / 0,10 / 0,06 |
| Contraste residual fotografado: trilha / areia | 0,24 / 0,18 |
| Roughness: cascalho / trilha / areia / úmido | 0,80–1,00 / 0,92–0,96 / 0,94–0,98 / 0,62–0,68 |
| Variação macro de brilho | 0,94–1,06 |
| Multiplicador do albedo úmido | 0,72 |

O custo estrutural fica em quatro amostras: albedo de detalhe, albedo macro,
normal e roughness. A amostra macro do mesmo albedo substitui a textura
procedural de grão anterior. Há duas operações seno adicionais por fragmento;
o cálculo de distância continua uma passagem pelas rotas como antes. Não há
nova passagem de sombra, render target, textura ou segundo material de solo.
Não foi medido ganho de desempenho; o custo depende da compilação e da GPU.

## Verificação desta subtarefa

Executado sem GPU:

- `node --test test/ground-surface.test.ts`: **4/4 testes passaram**.
- `npm run typecheck`: passou.
- Inspeção do grafo real TSL: quatro nós de amostragem referenciam exatamente
  as três texturas fornecidas; normal variável, vertex colours ativos,
  nenhuma posição/displacement substituída e nenhum descarte dos mapas.
- Probes CPU: centro compacto, variação nas bordas, transições contínuas de
  umidade, junções/raios, segmentos degenerados, valores inválidos e limites.

`probeGroundSurface()` é ferramenta analítica para QA. Recebe coordenadas de
mundo e, opcionalmente, amostras normalizadas de macro/roughness. Com os
valores padrão 0,5, não reproduz um pixel real da textura. Não usar o probe
como captura, medição de FPS ou resultado de compilação GLSL/WGSL.

Ainda pendentes na integração: build completo; compilação WebGL2/WebGPU;
mesmo enquadramento antes/depois no início da rua e junto à margem; inspeção
da escala dos grãos, repetição e contraste com casas/herói; telemetria PC e
viewport móvel. Viewport/WebKit no PC não equivale a Safari no iPhone físico.
O agente principal registra a atividade no diário compartilhado e guarda
as capturas; esta subtarefa não publicou nem alterou `world.ts`/`main.ts`.

## Fontes e limites

Mapas existentes de **Rocky Gravel**, Poly Haven, autores Dimitrios Savva e
Dario Barresi, **CC0-1.0**. Créditos, hashes e origem preservados em
`public/textures/ground/LICENSE.json`; nenhum mapa foi baixado ou substituído.
As misturas não transformam essa fotografia de cascalho em uma fotografia
nova de areia/terra: a revisão visual deve decidir se o contraste residual é
aceitável antes de ampliar o trecho. Não há sulcos geométricos, pegadas ou
mudança no contato físico com o solo.
