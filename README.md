# Grand Testament Adventure

Jogo de navegador em terceira pessoa com as missões da vida de Jesus, a partir dos reels da série (repositório
`biblia-conectada`, pasta `estudos/biblia-grand-testament-adventure`). Recriação, não reconstituição histórica.

**Fatia vertical (episódio 1): "Pescadores de gente", Marcos 1:16–20.** A margem do mar da Galileia em Cafarnaum com o
relevo real; três missões: descer até a praia, chamar Simão e André, chamar Tiago e João. HUD no desenho dos reels,
falas literais da Bíblia Livre, créditos das fontes no jogo.

## Rodar

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # lógica das missões + dados (node --test)
npm run typecheck
npm run build        # typecheck + testes + vite build -> dist/
npm run world        # refaz public/world/ e src/data/ a partir das fontes (precisa do biblia-conectada ao lado, em ../gta-src, ou o caminho como argumento)
```

`?q=low|high` muda a qualidade (padrão: low no celular, high no PC); `?gl=1` força WebGL 2; `?fps` mostra o FPS;
`?debug` liga os ganchos de teste (`window.__gta`; `&dtmax=0.25` deixa o tempo do jogo andar no renderizador por software). `tools/shots.mjs` joga o episódio com o Chromium do ambiente e
tira os prints em 1280×800 e 390×844 (precisa do `vite preview` rodando).

## Controles

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

Lista para o Tripo em [TRIPO.md](TRIPO.md). Até chegarem, tudo é forma simples.

## Licenças

Código: MIT ([LICENSE](LICENSE)). Créditos das fontes: [ATTRIBUTION.md](ATTRIBUTION.md). As malhas do Tripo, quando
chegarem, são do Alex e não entram sob a MIT.
