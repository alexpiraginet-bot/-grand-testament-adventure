# Malhas recebidas e divisão do trabalho

## Estado vigente — integração R1, 12/11/2026

Por novo pedido de Alex, o Codex assumiu a integração na branch `codex/tripo-runtime-r1`.
O herói de produção usa agora seu rig nativo (65 ossos) e `AnimationMixer`; não passa por `rig.ts`.
Treze malhas de cenário foram incorporadas: casas A/B/C, oliveiras A/B, árvore espinhosa, arbusto,
junco, pedras, muro, barco e duas redes. Os seis humanos estáticos continuam reservados até receber rig.

Fontes preservadas em `assets-src/tripo-r1/`; os derivados do jogo ficam em `public/models/tripo-r1/`,
fora do Git. O catálogo versionado `src/data/tripo-assets.json` fixa origem, hash, bytes, dimensões e estado.
O host estático `grand-testament-assets.vercel.app` mantém somente os 14 derivados usados no jogo.
`tools/fetch_assets.mjs` confere bytes/SHA-256 antes de cada build. Detalhes, licença e limites em
[docs/TRIPO-RUNTIME-R1.md](docs/TRIPO-RUNTIME-R1.md).

As seções seguintes preservam o histórico da malha de teste; não descrevem o carregador atual.

As malhas 3D são geradas no Tripo pela conta do Alex e têm licença própria, separada da do código: **não entram neste
repositório público** (`.gitignore`: `public/models/*.glb`). Cada uma é registrada aqui com hash, métricas e origem;
o arquivo circula entre quem trabalha nele. Sem o arquivo, o jogo usa as formas simples.

## Malhas recebidas

### `heroi.glb`, teste (do Alex, 12/11/2026, "robe-clad man 3d model.glb")

**Status: teste, não é o de produção** (o Alex confirmou). Ele serviu para ligar o carregamento de GLB no jogo. O
`heroi.glb` de produção, rigado, vem do Codex. O rig provisório de `src/rig.ts` não recebe mais trabalho.

| | Original (fora do git, `assets-src/heroi-original.glb`) | No jogo (`public/models/heroi.glb`) |
|---|---|---|
| SHA-256 | `a0135b61f1cbccd94b8aea31a3a51316d295c9e778dd9c35abe7ec66beaef613` | `f886eaa0b4095d463fb40781324658397ff4ba80a9ace7d42266845bbdf7869e` |
| Bytes | 22.328.008 | 1.112.912 (sem meshopt: o jogo não depende de WebAssembly) |
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

**Regra:** um GLB com esqueleto próprio **não** passa por `bakedGeometry`: o código recusa e cai nas formas simples,
com aviso no console. O `AnimationMixer` vai ser ligado quando chegar o primeiro arquivo rigado, e testado contra ele.

### `heroi.glb`, produção (Codex, em andamento)

Gerado pelo Codex no site do Tripo (geração `6e66af13-ed12-46ee-9240-19b1d627a830`, privada). Segundo ele, o site mostra
17.481 triângulos e o original estático exportado tem 3.756.732 bytes. O Codex ainda vai rigar e conferir a pele e
as animações. **Não conferido aqui; não está pronto.**

## Referências visuais

| Arquivo (fora do git) | SHA-256 | O que é |
|---|---|---|
| `assets-src/referencias/conceito-visual-01.png` | `ea81dd752e8342e9737f62bcc65d21128ac625811fb26ad9e50021dbe859bee6` | conceito em imagem gerada, enviado pelo Alex em 12/11/2026 como referência final; análise em `docs/ALTO-NIVEL.md` |

## Divisão de arquivos

Branch base `main`; cada um na sua (`claude/...`, `codex/...`, `feature/...` de quem mais vier), com PR em rascunho.
Antes de mexer na área de outra pessoa, avise na PR dela.

| Área | Arquivos | Quem |
|---|---|---|
| Jogo, missões, HUD, controles, som | `src/main.ts`, `src/missions.ts`, `src/episode.ts`, `src/hud.ts`, `src/hud.css`, `src/input.ts`, `src/audio.ts`, `src/credits.ts`, `index.html` | Claude |
| Mundo a partir dos dados (relevo, margem, radar, textos) | `tools/build_world.py`, `src/terrain.ts`, `public/world/*`, `src/data/mc-pescadores.json`, `src/data/attribution.json`, `data/terrain-tiles.sha256` | Claude |
| Integração das malhas no jogo (carregar, esqueleto, `AnimationMixer`, posição na cena) | `src/rig.ts`, `src/people.ts`, o trecho de carregamento em `src/main.ts` | Claude |
| Testes e prints do jogo | `test/*`, `tools/shots.mjs` | Claude (testes de malha novos em arquivo próprio, de quem os escrever) |
| Produção das malhas: geração no Tripo, rig, animações, validação, manifesto | arquivos GLB (fora do git), esta seção "Malhas recebidas", `TRIPO.md`, orçamentos em `src/data/modelos.json` | Codex |
| Ferramentas de malha | `tools/optimize_model.mjs`, `tools/check_model.mjs`, `tools/viewer/`, `src/viewer.ts` | Codex (Claude escreveu a primeira versão) |
| Visual e desempenho do cenário: materiais, LOD, instancing, menos chamadas de desenho | `src/world.ts` | Codex propõe na branch dele, medindo antes e depois; Claude revisa |
