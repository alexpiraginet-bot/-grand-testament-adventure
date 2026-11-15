# Créditos e licenças

O jogo mostra estes créditos no botão "Créditos" (sempre visível) e no cartão de "missão concluída".

## Texto bíblico: Bíblia Livre (BLIVRE), CC BY 4.0 Brasil

> Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, http://sites.google.com/site/biblialivre/ - fevereiro de 2018. Licença Creative Commons Atribuição 4.0 Brasil (http://creativecommons.org/licenses/by/4.0/br/). Reprodução permitida desde que devidamente mencionados fonte e autores.

Alteração indicada: os colchetes da BLIVRE (palavras acrescentadas pelos tradutores) são retirados no texto guardado em
`src/data/mc-pescadores.json` (ex.: "Tiago [filho] de Zebedeu" vira "Tiago filho de Zebedeu") e em
`src/data/mc-ensino.json` (Marcos 1:21, 1:22 e 1:29, gerado por `tools/build_teaching.py` com o SHA-256 da fonte
conferido). Nenhuma fala mostrada na tela tem colchete. A grafia do arquivo de origem é mantida mesmo onde parece um
descuido dele (Marcos 1:22 traz "temautoridade"): o jogo cita desse versículo só a oração anterior, sem corrigir o texto.

O mesmo vale para `src/data/mc-caminho.json` (Marcos 1:30–42, 2:1–5, 2:11–17, 3:7, 3:9, 3:13–14, 3:16–19, 4:1 e 4:35: os
35 versículos que a jornada depois do ensino cita, gerados por `tools/build_story.py` com o SHA-256 da fonte conferido).
Em 9 deles a BLIVRE traz colchetes, retirados como acima; as palavras ficam (ex.: "Dias depois, [Jesus] entrou" vira
"Dias depois, Jesus entrou"). Três versículos trazem no arquivo de origem um espaçamento que parece descuido dele
(Marcos 1:30 "a Jesus .", 1:41 "E Jesus , movido", 2:14 "Segue-me.Então"). A Bíblia do jogo mostra esses versículos
inteiros como estão na fonte; as orações que o jogo põe na tela (`src/story-steps.ts`) são recortadas de modo que
nenhuma traga um desses trechos, e um teste confere isso (`test/story-steps.test.ts`).

Na Bíblia do jogo (`src/data/biblia-cronologica.json`, gerado por `tools/build_bible.py`), os versículos dos outros
momentos da leitura são copiados da BLIVRE **sem alteração**, com os colchetes e a pontuação do arquivo de origem
(`fontes/blivre/porbr2018_vpl.zip` do Bíblia Conectada, SHA-256 conferido contra `fontes/SHA256SUMS`).

## Ordem de leitura: Bíblia Conectada

A ordem das passagens na Bíblia do jogo é o roteiro de leitura cronológica do
[Bíblia Conectada](https://www.bibliaconectada.company/cronologia) (`site/src/lib/chronological-reading.ts`): títulos,
fases, lugares e referências são os dele. É uma ordem editorial ampla, que o próprio roteiro descreve como "not a
harmonized historical chronology". A passagem jogada (Marcos 1:16–21) não é um dos momentos do roteiro; o jogo a põe
logo depois do último momento que o mesmo evangelho narra antes dela (o batismo, Marcos 1:9–11), sem fixar a relação
com os relatos dos outros evangelhos (`src/bible.ts`, `test/bible.test.ts`).

## Lugares: OpenBible.info Bible Geocoding Data, CC BY 4.0

"Geocodificação: OpenBible.info". Nome em português de cada lugar: o que a BLIVRE escreve.

## Relevo: AWS Terrain Tiles

SRTM/GMTED2010 (USGS), ETOPO1 (NOAA), Mapzen. Ladrilhos terrarium z14 e z11 de
`https://s3.amazonaws.com/elevation-tiles-prod/`, com SHA-256 em `data/terrain-tiles.sha256`. O fundo do lago e a
suavização da faixa da margem são nossos.

## Código de terceiros

- three.js (MIT).
- Space Grotesk e Space Mono (SIL Open Font License 1.1, licenças em `public/fonts/`), em subconjunto WOFF2.

## Superfícies e referência do cenário

- Rocky Gravel, Dimitrios Savva e Dario Barresi / Poly Haven, CC0. Mapas em
  `public/textures/ground/`, origem, modificações e hashes no `LICENSE.json` dessa pasta.
  https://polyhaven.com/a/rocky_gravel · https://polyhaven.com/license
- Arqueologia: Christian Media Center / Studium Biblicum Franciscanum e Israel Nature
  and Parks Authority. Fontes, escolhas de composição e limites em `docs/CAFARNAUM-CENARIO.md`.

Céu: Kloofendal 48d Partly Cloudy (Pure Sky), Greg Zaal e Jarod Guest / Poly Haven,
CC0. Panorama fotográfico contemporâneo; não representa um registro de Cafarnaum.
Derivados LDR em `public/textures/sky/`, com origem e hashes no `LICENSE.json`.
https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky · https://polyhaven.com/license

## Malhas 3D

Geradas no Tripo pela conta do Alex, com licença própria. **Não estão neste repositório público**, não ficam sob a MIT
do código nem sob as licenças das fontes acima, e nunca vão para o biblia-conectada. Registro, hashes e origem em
`ASSETS.md`. Sem elas, o jogo usa formas simples feitas no código.
