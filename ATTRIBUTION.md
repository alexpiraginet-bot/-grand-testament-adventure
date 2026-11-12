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

## Malhas 3D

Nenhuma ainda: pessoas, casas, barco e plantas são formas simples feitas no código. As malhas do Tripo, quando
chegarem, são do Alex.
