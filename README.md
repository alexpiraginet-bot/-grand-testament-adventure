# Grand Testament Adventure

Jogo de navegador em terceira pessoa com as missões da vida de Jesus, a partir dos reels da série (repositório
`biblia-conectada`, pasta `estudos/biblia-grand-testament-adventure`). Recriação, não reconstituição histórica.

**Fatia vertical (episódio 1): "Pescadores de gente", Marcos 1:16–20.** A margem do mar da Galileia em Cafarnaum com o
relevo real; três missões: descer até a praia, chamar Simão e André, chamar Tiago e João. HUD no desenho dos reels,
falas literais da Bíblia Livre, créditos das fontes no jogo.

**Código aberto, feito em conjunto.** Qualquer pessoa pode rodar, propor mudanças e abrir PR: veja
[CONTRIBUTING.md](CONTRIBUTING.md). O código é MIT; os dados seguem as licenças das fontes; as malhas 3D não estão neste
repositório (seção Licenças).

## Rodar

Precisa de Node 22 (e Python 3 com numpy, scipy, opencv, scikit-image e Pillow só para refazer o mundo).

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # lógica das missões + dados (node --test)
npm run typecheck
npm run build        # typecheck + testes + vite build -> dist/
npm run world        # refaz public/world/ e src/data/ a partir das fontes (precisa do biblia-conectada ao lado, em ../gta-src, ou o caminho como argumento)
```

`?q=low|high` muda a qualidade (padrão: low no celular, high no PC); `?gl=1` força WebGL 2; `?fps` mostra o FPS;
`?debug` liga os ganchos de teste (`window.__gta`; `&dtmax=0.25` deixa o tempo do jogo andar no renderizador por software). 
`tools/shots.mjs` joga o episódio com o Playwright e tira os prints em 1280×800 e 390×844 (precisa do `vite preview`
rodando e do Playwright instalado à parte: `npm i -g playwright && npx playwright install chromium`).

Sem as malhas (elas não vêm no git), o jogo roda com as formas simples. Quem tiver o `heroi.glb` põe em `public/models/`.

## Progresso salvo

O jogo salva sozinho no aparelho (`src/save.ts`): a cada missão concluída, a cada 15 s andando e quando a página sai da
tela. O save tem versão e é conferido toda vez que é lido; um save quebrado fica guardado à parte e volta a cópia
anterior. A cópia na nuvem, sem cadastro, usa um código de recuperação para continuar em outro aparelho
(`src/cloud.ts`, `supabase/migrations/`). Ela está **desligada** em `src/data/nuvem.json` até a migração ser aplicada.

## Alto nível (PC com RTX)

O DLSS 5 ainda não foi validado neste jogo; o teste experimental WebGPU e seus impedimentos estão em
[docs/DLSS5-STATUS.md](docs/DLSS5-STATUS.md). O plano para uma versão em Unreal Engine 5, que herda mundo, missões e save daqui,
está em [docs/ALTO-NIVEL.md](docs/ALTO-NIVEL.md). Os arquivos que ela importa saem de `python3 -I tools/export_engine.py`.

## Controles

**Construa conosco:** no início, durante a partida e na conclusão, o botão abre um
formulário de ideias, opiniões e problemas. O jogo fica pausado enquanto você escreve.
O texto abre preenchido no GitHub, onde você revisa e confirma a publicação com sua
conta. As propostas passam por análise; alterações no jogo dependem de aprovação.
Detalhes em [docs/CONSTRUA-CONOSCO.md](docs/CONSTRUA-CONOSCO.md).

- PC: WASD ou setas, Shift corre, arrastar o mouse olha (duplo clique trava o cursor), **E** age.
- Celular: arraste no lado esquerdo para andar (joystick aparece onde o dedo toca), no lado direito para olhar, botão
  redondo para agir.

## Como é feito

- **three.js 0.186.1** com o `WebGPURenderer`: WebGPU quando o navegador tem um adaptador de verdade, WebGL 2 nos
  outros (e se o dispositivo WebGPU cair, a página recarrega em WebGL 2). **Vite 8.3.5**, **TypeScript 7.0.2**.
  Versões travadas no `package-lock.json`.
- **Sem Rapier por enquanto.** `@dimforge/rapier3d-compat@0.21.0` pesa 1,66 MB com gzip (medido no `dist/rapier.mjs`),
  sete vezes o jogo inteiro (230 KB). A fatia só precisa de chão por altura e colisão com casas e pessoas, feitos em
  `src/main.ts`. Rapier volta quando houver física de verdade (barco na água, rede, empurrar coisas).
- `tools/build_world.py` gera tudo o que o jogo trata como fato:
  - relevo de 3 km × 3 km em volta do ponto de Cafarnaum (AWS Terrain Tiles z14, ~8 m por pixel; a fonte é o SRTM
    de 30 m) e o horizonte de 30 km × 30 km (z11), com os SHA-256 dos ladrilhos em `data/terrain-tiles.sha256`;
  - a linha d'água, os pontos das missões e o mapa do radar;
  - `src/data/mc-pescadores.json`: missões, falas e contador vindos do `data/passagens.json` do biblia-conectada
    (conferido lá pelo `tools/check.py`), mais os versículos inteiros de Marcos 1:16–21 da BLIVRE, para o teste
    conferir que cada fala é trecho literal;
  - `src/data/attribution.json`: o aviso da BLIVRE copiado do `ATTRIBUTION.md` do biblia-conectada.
- Número na tela vem de dado ou código: distância até o objetivo (calculada), contador (quantidade de nomes na prova
  do versículo), coordenadas do lugar (OpenBible).

## O que é escolha do jogo (e não do texto)

Onde Simão e André estão na praia (260 m a oeste do ponto da praia), quanto é "um pouco mais adiante" (520 m),
quantos empregados estão no barco (2; Marcos 1:20 não diz), o ponto de partida (300 m terra adentro) e o fundo do lago
(os dados só têm a superfície). Tudo isso está em `public/world/cafarnaum.json` → `level_design`.

## Malhas

Recebidas, métricas e quem cuida de quê: [ASSETS.md](ASSETS.md). Para pôr uma malha nova:
`node tools/optimize_model.mjs <original.glb> <nome>` (orçamento em `src/data/modelos.json`), depois `npx vite` e
`node tools/check_model.mjs /models/<nome>.glb <altura> shots/modelo/<nome>` (fotos dos 4 lados). Originais ficam em
`assets-src/`, fora do git.

Ficha das 24 malhas para o Tripo em [TRIPO.md](TRIPO.md) (prompt, orçamento, rig, checklist).

## Licenças

- **Código** (`src/`, `tools/`, `test/`, configuração): MIT, [LICENSE](LICENSE).
- **Dados** (`public/world/`, `src/data/`, `data/`): derivados de fontes abertas, que pedem crédito. Ficam sob as
  licenças delas: [LICENSE-DATA.md](LICENSE-DATA.md) e [ATTRIBUTION.md](ATTRIBUTION.md). A MIT não se aplica a eles.
- **Fontes tipográficas** (`public/fonts/`): SIL Open Font License 1.1, com as licenças ao lado.
- **Malhas 3D**: geradas no Tripo pela conta do Alex, com licença própria. **Não estão neste repositório** e não são
  relicenciadas como código aberto (ver [ASSETS.md](ASSETS.md)).
- **Dependências**: no jogo publicado só entra o three.js (MIT). As ferramentas de build trazem pacotes MIT, ISC,
  Apache-2.0, BSD, BlueOak, MPL-2.0 (lightningcss, do Vite) e LGPL-3.0 (libvips, via sharp, do gltf-transform); elas
  rodam só na máquina de quem constrói e não vão para o `dist/`.
