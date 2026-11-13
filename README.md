# Grand Testament Adventure

Jogo de navegador em terceira pessoa com as missões da vida de Jesus, a partir dos reels da série (repositório
`biblia-conectada`, pasta `estudos/biblia-grand-testament-adventure`). Recriação, não reconstituição histórica.

**Fatia vertical (episódio 1): "Pescadores de gente", Marcos 1:16–20.** A margem do mar da Galileia em Cafarnaum com o
relevo real; três missões: descer até a praia, chamar Simão e André, chamar Tiago e João. HUD no desenho dos reels,
falas literais da Bíblia Livre, créditos das fontes no jogo.

**Código aberto, feito em conjunto.** Qualquer pessoa pode rodar, propor mudanças e abrir PR: veja
[CONTRIBUTING.md](CONTRIBUTING.md). O código é MIT; os dados seguem as licenças das fontes; as malhas 3D não estão neste
repositório (seção Licenças).

**Jogar:** https://grand-testament-adventure-lexprojects.vercel.app/
Publicação conectada à branch `main` deste repositório. Estado e limitações em
[docs/PUBLICACAO.md](docs/PUBLICACAO.md).

Integração atual: herói com esqueleto nativo, 13 modelos de cenário, vila mais densa e
caminhos estreitos sobre o relevo. Referências históricas e limites em
[docs/CAFARNAUM-CENARIO.md](docs/CAFARNAUM-CENARIO.md); evidência técnica em
[docs/TRIPO-RUNTIME-R1.md](docs/TRIPO-RUNTIME-R1.md). A imagem-alvo ainda não é o visual entregue.

Diário do processo e material para os Reels: [DIARIO-DESENVOLVIMENTO](docs/DIARIO-DESENVOLVIMENTO.md).
A distinção entre citações e narrativa autoral está em [NARRATIVA](docs/NARRATIVA.md).
Comparação documental de motores, ainda sem benchmark de migração: [MOTORES-GRAFICOS](docs/MOTORES-GRAFICOS.md).

## Rodar

Precisa de Node 24 (e Python 3 com numpy, scipy, opencv, scikit-image e Pillow só para refazer o mundo).

```bash
npm ci
npm run assets       # baixa 14 malhas revisadas e confere SHA-256; licença separada
npm run dev          # http://localhost:5173
npm test             # lógica das missões + dados (node --test)
npm run typecheck
npm run build        # confere/baixa assets + typecheck + testes + vite build -> dist/
npm run world        # refaz public/world/ e src/data/ a partir das fontes (precisa do biblia-conectada ao lado, em ../gta-src, ou o caminho como argumento)
npm run bench:all    # mesma cena medida (6 planos, PC e viewport de celular emulado, fx=off e fx=alto), com `npx vite preview` rodando;
                     # no PC da RTX: PLAYWRIGHT_CHANNEL=chrome. Relatórios trazem commit, GPU, navegador e memória estimada
node tools/compare_bench.mjs a/bench.json b/bench.json   # compara dois relatórios plano a plano; recusa máquina/tela/commit diferentes
node tools/check_session.mjs   # prova o diário de sessão: recarga limpa x queda do renderizador (base do teste de 10 min no celular)
node tools/check_roam.mjs      # depois do episódio: "Continuar explorando", epílogo de Marcos 1:21, lugares e limite da região
node tools/check_bible.mjs     # a Bíblia do jogo: linha da missão selada até a leitura, versículos literais, ordem da leitura, pausa
python3 -I tools/build_bible.py ../biblia-conectada           # refaz src/data/biblia-cronologica.json (roteiro + BLIVRE, hash conferido)
python3 -I tools/build_bible.py ../biblia-conectada --check   # confere se o arquivo versionado ainda bate com as fontes
node tools/check_painel.mjs    # painel de devs (painel.html) com respostas gravadas do GitHub; --live consulta o GitHub de verdade
```

`?q=low|high` muda a qualidade (padrão: high em ambos, por pedido de Alex); `?gl=1` força WebGL 2; `?fps` mostra o FPS;
em medição, todos desligados por padrão: `?fx=alto` (pós-processamento), `?atmo=1` (névoa por altura e distância),
`?tm=aces|agx|neutral|off` e `?exp=` (curva tonal e exposição), `?shadow=csm` (sombras do sol em três cascatas até 600 m),
ver `src/look.ts` e [docs/GRAFICO-MASTER.md](docs/GRAFICO-MASTER.md);
`?debug` liga os ganchos de teste (`window.__gta`; `&dtmax=0.25` deixa o tempo do jogo andar no renderizador por software). 
`tools/shots.mjs` joga o episódio com o Playwright e tira os prints em 1280×800 e 390×844 (precisa do `vite preview`
rodando e do Playwright instalado à parte: `npm i -g playwright && npx playwright install chromium`).

O herói usa seu esqueleto nativo de 65 ossos e a caminhada exportada no Tripo. Treze malhas de cenário substituem
as formas simples. Texturas mantidas em 2K, instâncias próximas detalhadas e versões simples ao longe. Os seis NPCs
ainda aguardam rig e, desde a R9, nenhum é desenhado: os encontros seguem jogáveis, com o aviso "Cena em
desenvolvimento" ([docs/QA-NPC-QUALIDADE-R9.md](docs/QA-NPC-QUALIDADE-R9.md)). Veja [docs/TRIPO-RUNTIME-R1.md](docs/TRIPO-RUNTIME-R1.md).

Os binários não vêm no Git. `npm run assets` baixa somente arquivos com hashes fixados no catálogo; o build faz a
mesma conferência antes de publicar. Se uma malha de cenário falhar no navegador, a forma simples preserva a partida; o herói não tem substituto: sem
ele a abertura mostra o erro e "Tentar novamente".

## Painel do projeto (área de devs)

`painel.html` (link "Painel do projeto" no rodapé do Colabore) mostra quem contribuiu e quanto: commits da branch
principal por autoria, coautoria (`Co-Authored-By`) e conta do GitHub, commits por dia no horário de São Paulo, pull
requests, issues e as contas de fora que participaram. Tudo é lido da API pública do GitHub pelo navegador de quem
abre a página, sem login e sem servidor do jogo; a contagem está em `src/project-stats.ts` e é testada com respostas
gravadas deste repositório (`test/fixtures/github/`, sem endereços de e-mail). A página não carrega o jogo.

**Acessos ainda não são medidos.** O jogo não tem contador e o Web Analytics da Vercel não está ativo neste projeto
(conferido pela API da Vercel em 13/11/2026; registro em `ACCESS`, `src/project-stats.ts`). O painel diz isso em vez
de mostrar um número. A escolha da fonte de medição é de Alex.

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

- **Bíblia:** a cada passo a linha da missão pede "Abra a Bíblia" e mostra a referência. Lendo o versículo, o
  objetivo, a distância e o marcador do radar aparecem. A Bíblia traz a passagem versículo a versículo (vivido, agora,
  a seguir) no lugar dela na leitura cronológica do Bíblia Conectada. Abre com **B** ou tocando na linha da missão.
- PC: WASD ou setas, Shift corre, arrastar o mouse olha (duplo clique trava o cursor), **E** age.
- Celular: joystick sempre visível no canto inferior esquerdo (tocar longe dele, ainda no lado esquerdo, traz a base
  para baixo do dedo durante o gesto); arraste no lado direito para olhar; o botão redondo com a mão aparece quando
  há uma ação. Conferência de navegador: `node tools/check_touch.mjs` (viewport emulado, não celular físico).

## Como é feito

- **three.js 0.186.1** com o `WebGPURenderer`: WebGPU quando o navegador tem um adaptador de verdade, WebGL 2 nos
  outros. Se o dispositivo WebGPU ou o contexto WebGL cair, o jogo mostra um erro com "Tentar novamente" e
  "Abrir modo compatível", sem recarregar sozinho. **Vite 8.3.5**, **TypeScript 7.0.2**.
  Versões travadas no `package-lock.json`.
- **Sem Rapier por enquanto.** `@dimforge/rapier3d-compat@0.21.0` pesa 1,66 MB com gzip (medido no `dist/rapier.mjs`),
  é uma dependência adicional ainda desnecessária. A fatia só precisa de chão por altura e colisão com casas, feitos em
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

Depois do episódio também são escolhas do jogo, com as constantes no código: a volta à vila termina a 25 m do ponto
onde a caminhada começou (`src/freeroam.ts`); um lugar conta como encontrado a 60 m (lugar com fonte), 25 m (redes,
barco, margem) ou 30 m (mirante); o mirante é o ponto mais alto do relevo a até 400 m de Cafarnaum; o aviso do limite
da região aparece a 40 m dele (`src/places.ts`). Ver [docs/NARRATIVA.md](docs/NARRATIVA.md).

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
