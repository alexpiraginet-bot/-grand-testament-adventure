# Gráfico nível master — caminho medido (Claude, 13/11/2026)

Pedido de Alex: "Precisamos do gráfico nível master! Descubra como! Não vamos economizar com gráficos e
jogabilidade." Complementa `docs/MOTORES-GRAFICOS.md` (análise documental do Codex) e `docs/ALTO-NIVEL.md`.
Regra que vale para tudo abaixo: **nenhuma troca de motor ou de efeito vira padrão sem a mesma cena medida antes e
depois**, no PC com a RTX e em celulares físicos.

## Onde estamos (conferido)

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

## O que esta revisão entrega

1. **A mesma cena, medida** (`src/bench.ts`, `tools/bench.mjs`, `?bench`): seis planos fixos construídos só dos pontos
   do episódio e do relevo real (vila, viela, margem, pescadores, barco, panorama). Cada plano tem aquecimento separado
   (compilação de shader aparece como `warmupMaxMs`) e frames medidos; o relatório traz p50/p95/p99, draw calls,
   triângulos, memória de textura, bytes baixados, tempo até o primeiro frame e uma imagem por plano e variante.
   Os mesmos planos (posição do olho e alvo) servem para montar a cena em outro motor e comparar sem trapaça.
2. **Pós-processamento sob medição** (`src/postfx.ts`, `?fx=alto` ou `?fx=master`): um único passe da cena grava cor,
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

## Próximos degraus, em ordem de ganho por esforço

Cada item entra como variante de `?fx` ou de qualidade, medido com `tools/bench.mjs`, e só então vira padrão.

| # | Degrau | Por quê | Quem | Estado |
|---|---|---|---|---|
| 1 | Medir `fx=off/alto/master` no PC da RTX e em 1 Android + 1 iPhone físicos | decidir padrão por aparelho com número, não impressão | Alex roda / Claude analisa | pendente |
| 2 | Texturas KTX2 (UASTC nas normais, ETC1S/UASTC nas cores) + meshopt | as texturas ocupam ~1,2 GB na GPU; KTX2 fica comprimido na própria GPU, o que abre espaço para 4K no herói sem estourar o celular. Ganho a medir | Codex (derivados e host de assets) + Claude (`KTX2Loader`) | não iniciado; `toktx`/`basisu` não estão instalados nesta máquina |
| 3 | Céu HDR de verdade (a mesma fonte CC0 da Poly Haven tem versão HDR) para a luz ambiente | hoje o ambiente vem de um panorama LDR já tonemapeado: reflexos e luz rebatida ficam chapados | Claude | não iniciado |
| 4 | Sombras em cascata (`CSMShadowNode`) e sombras de contato (SSS) | uma sombra única de 56 m some na vila e no panorama | Claude | não iniciado |
| 5 | Água: SSR na superfície, espuma e cáusticas por profundidade | o elemento mais visível da referência | Claude (código), Codex (direção de arte) | não iniciado |
| 6 | Godrays do sol, gradação de cor por LUT, profundidade de campo nas falas | linguagem de cinema dos reels | Claude; a LUT é arte: Codex/Higgsfield | não iniciado |
| 7 | TAAU no celular: renderizar a ~67% e reconstruir no tempo | é o equivalente web do DLSS Super Resolution; pode pagar os efeitos no telefone | Claude | não iniciado |
| 8 | SSGI só no PC (perfil "ultra") | luz rebatida entre casas e chão; caro | Claude | não iniciado |
| 9 | NPCs rigados, `idle`/`run`/`beckon`, vegetação menos facetada | motor nenhum corrige malha e animação | Codex (Tripo) | pendente |
| 10 | Versão nativa (Unreal 5 + DLSS na RTX 5060) usando `export/engine/` e **os mesmos seis planos** | teto real de qualidade no PC; o DLSS 5 segue sem SDK público (`DLSS5-STATUS.md`) | Alex/Codex na máquina com a placa | pendente |

## "Nível GTA6": a barra, pilar por pilar

Pedido de Alex em 13/11/2026: "Vamos melhorar o projeto a nível gta6". Lido como **barra de qualidade de mundo aberto
AAA**, não como cópia: continua proibido usar nome, logo, HUD, personagens, cidades ou músicas da Rockstar (regra do
`HANDOFF.md`). Um jogo desse porte é sobretudo volume de arte, animação e conteúdo; o motor é uma parte. Por pilar:

| Pilar | Hoje (conferido) | Próximo passo que dá para medir ou ver | Quem |
|---|---|---|---|
| Luz e atmosfera | sol com uma sombra de 56 m, céu fotográfico LDR, render direto sem pós | `?fx` medido no PC/celulares; sombras em cascata; céu HDR; godrays; névoa de altura | Claude |
| Apresentação das missões | legenda literal e HUD | **plano cinematográfico nas falas (esta revisão)**; transições entre missões; trilha e ambiente sonoro com licença registrada | Claude (código), Alex (trilha) |
| Personagens e animação | herói com 65 ossos e só `walk`; seis NPCs em pose A | `idle`/`run`/`beckon`; olhar de quem fala (cabeça) e pés no chão (IK) | Codex (rig e clipes), Claude (IK/olhar) |
| Mundo vivo | discípulos e empregados; vila sem rotina | aldeões com rotinas (redes, jarros, conversa), barcos no lago, aves, fumaça; depende dos NPCs rigados | Codex (malhas), Claude (sistemas) |
| Jogabilidade | 3 missões lineares: andar e chamar | mais episódios, interações na vila e atividades livres, com "Narrativa do jogo" rotulada (`docs/NARRATIVA.md`) | Alex (roteiro), Claude |
| Desempenho | texturas ~1,2 GB na GPU; 166–216 draw calls nos planos do bench | KTX2, LOD, TAAU no celular; bench em aparelhos físicos | Codex, Claude |

O teto fotorrealista no PC da RTX continua sendo a versão nativa (Unreal 5 + DLSS, `docs/ALTO-NIVEL.md`). No navegador,
a meta é o melhor que um celular sustenta, medido.

## Motores da lista do Alex

O Codex já registrou fontes e decisão em `docs/MOTORES-GRAFICOS.md`: seguir em three.js e testar o Babylon.js
isolado. Concordo, com um critério operacional: o candidato carrega os mesmos 14 GLB, o mesmo relevo e os mesmos
seis planos de `benchShots`, e entra só se `tools/bench.mjs` (ou o equivalente nativo) mostrar ganho reprodutível,
por exemplo 20% no p95, ou um recurso visual necessário que o three não tenha. Godot (web só em WebGL 2 na
exportação estável), O3DE (sem navegador), Bevy (reescrita em Rust), raylib e OGRE não cobrem o link direto no
navegador com o nível pedido; para o teto nativo o plano continua Unreal 5, que já tem o pacote de exportação.

## Limites desta revisão

- Esta sessão roda sem GPU (Chromium com WebGL 2 por software, ~1 fps): aqui só dá para conferir funcionamento (o bench
  percorre as três variantes e grava imagens; resultado registrado na PR), **não** desempenho nem qualidade final.
- Os valores de `FX_SETTINGS` são um ponto de partida, não calibração. A oclusão aplicada multiplica a cor final
  (barata, um passe só); a versão fisicamente mais correta aplica a oclusão só na luz indireta e precisa de um passe
  extra da cena: decidir com o bench.
- O TRAA usa o buffer de movimento da three; o rastro em partes animadas (herói, NPCs, água) precisa ser olhado nas
  imagens do PC antes de qualquer padrão.
- Ícones e imagens: pedidos ao Codex ou Higgsfield (`ASSETS.md` → "Pedidos de arte").
