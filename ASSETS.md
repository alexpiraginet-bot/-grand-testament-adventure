# Malhas recebidas e divisão do trabalho

## Malhas recebidas

### `heroi.glb` (recebido do Alex em 12/11/2026, "robe-clad man 3d model.glb")

**Status: provisório no jogo, não aprovado.** Entrou porque é melhor que as formas simples, mas falta o rig de verdade.

| | Original (fora do git, `assets-src/heroi-original.glb`) | No jogo (`public/models/heroi.glb`) |
|---|---|---|
| SHA-256 | `a0135b61f1cbccd94b8aea31a3a51316d295c9e778dd9c35abe7ec66beaef613` | `b1dd708bd05ce9dd7f09ea52fc0cb44e97988c2700c7a540947dc63ad4cab10c` |
| Bytes | 22.328.008 | 867.416 |
| Gerador | gltfpack 1.2 (exportação do Tripo); exige `KHR_mesh_quantization` e `EXT_meshopt_compression` | gltf-transform 4.5.1 (`tools/optimize_model.mjs`) |
| Malhas / materiais | 1 / 1 | 1 / 1 |
| Triângulos | 1.959.077 | 17.991 (orçamento 18.000) |
| Vértices | 1.031.465 | ~15 mil |
| Texturas | cor 4096² JPEG, ORM 4096² JPEG, normal (GL) 4096² PNG | as mesmas em 2048² WebP |
| Rig / animações | **nenhum / nenhuma** | esqueleto provisório de 11 ossos gerado no código (`src/rig.ts`) |
| Pose | A-pose | braços abaixados pelo rig provisório |
| Orientação | de frente para **+X** (o glTF espera +Z) | girado no código (`src/data/modelos.json` → `frente`) |
| Escala / origem | 0,98 de altura (escala 0,49 no nó), origem no centro do corpo | 1,76 m, pés em y = 0 (feito no código) |

**O que confere com a folha de personagem:** cabelo escuro ondulado nos ombros, barba, túnica clara até o tornozelo com
cinto de corda, manto terracota sobre o ombro **esquerdo** e pelas costas, sandálias de couro (fotos de 4 lados em
`tools/check_model.mjs`).

**O que falta:**

1. Rig humanoide e as animações da ficha: parado, andando, correndo, chamando. O rig provisório é um palpite pela
   geometria. Ele anda e abaixa os braços, mas o manto e as mangas deformam junto com os ossos dos braços.
2. Frente em +Z e escala em metros no próprio arquivo, para não depender de correção no código.

**Regra:** um GLB com esqueleto próprio **não** passa por `bakedGeometry` (o código recusa e cai nas formas simples, com
aviso no console). Falta ligar o `AnimationMixer` quando chegar o primeiro arquivo rigado, testado contra ele.

## Divisão de arquivos (Claude × Codex)

Branch base `main`; cada um na sua branch (`claude/...`, `codex/...`), PR em rascunho. Antes de mexer na área do
outro, avise na PR.

| Área | Arquivos | Quem |
|---|---|---|
| Jogo, missões, HUD, controles, som | `src/main.ts`, `src/missions.ts`, `src/episode.ts`, `src/hud.ts`, `src/hud.css`, `src/input.ts`, `src/audio.ts`, `src/credits.ts`, `index.html` | Claude |
| Mundo a partir dos dados (relevo, margem, radar, textos) | `tools/build_world.py`, `src/terrain.ts`, `public/world/*`, `src/data/mc-pescadores.json`, `src/data/attribution.json`, `data/terrain-tiles.sha256` | Claude |
| Testes e prints do jogo | `test/*`, `tools/shots.mjs` | Claude (o Codex acrescenta testes de malha em arquivo próprio) |
| Malhas e manifesto | `public/models/**`, `src/data/modelos.json`, `ASSETS.md` (seção "Malhas recebidas"), `TRIPO.md` | Codex |
| Ferramentas de malha | `tools/optimize_model.mjs`, `tools/check_model.mjs`, `tools/viewer/`, `src/viewer.ts` | Codex (Claude escreveu a primeira versão) |
| Integração visual: personagens, rig, materiais, cenário, LOD, instancing | `src/people.ts`, `src/rig.ts`, `src/world.ts` | Codex, depois de avisar; Claude só corrige bug, avisando na PR |
