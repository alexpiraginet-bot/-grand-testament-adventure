# Créditos e licenças

O jogo mostra estes créditos no botão "Créditos" (sempre visível) e no cartão de "missão concluída".

## Texto bíblico: Bíblia Livre (BLIVRE), CC BY 4.0 Brasil

> Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, http://sites.google.com/site/biblialivre/ - fevereiro de 2018. Licença Creative Commons Atribuição 4.0 Brasil (http://creativecommons.org/licenses/by/4.0/br/). Reprodução permitida desde que devidamente mencionados fonte e autores.

Alteração indicada: os colchetes da BLIVRE (palavras acrescentadas pelos tradutores) são retirados no texto guardado em
`src/data/mc-pescadores.json` (ex.: "Tiago [filho] de Zebedeu" vira "Tiago filho de Zebedeu"). Nenhuma fala mostrada
na tela tem colchete.

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
