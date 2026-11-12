// Credits shown in the game (start card link, HUD button, end card). The BLIVRE notice is the authors' text, to be
// copied exactly (biblia-conectada/ATTRIBUTION.md); test/data.test.ts checks it is here unchanged.

export const BLIVRE_NOTICE =
  "Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, http://sites.google.com/site/biblialivre/ - fevereiro de 2018. Licença Creative Commons Atribuição 4.0 Brasil (http://creativecommons.org/licenses/by/4.0/br/). Reprodução permitida desde que devidamente mencionados fonte e autores.";

// short lines for the end card, as in the reels' end card
export const SHORT = [
  "Texto: Bíblia Livre (CC BY 4.0 BR) · Geocodificação: OpenBible.info (CC BY 4.0)",
  "Relevo: SRTM/GMTED2010 (USGS), ETOPO1 (NOAA), Mapzen · Formas provisórias, sem modelos 3D finais",
];

export const SECTIONS: { h: string; p: string[]; quote?: string }[] = [
  { h: "Texto bíblico", quote: BLIVRE_NOTICE, p: [
    "As falas na tela são trechos literais dos versículos citados. Os colchetes da BLIVRE (palavras acrescentadas pelos tradutores) não aparecem nas falas usadas aqui.",
  ] },
  { h: "Lugares", p: ["Geocodificação: OpenBible.info Bible Geocoding Data, CC BY 4.0. O nome em português de cada lugar é o que a BLIVRE escreve."] },
  { h: "Relevo", p: [
    "AWS Terrain Tiles (Mapzen): SRTM e GMTED2010 (USGS), ETOPO1 (NOAA). O chão e o horizonte vêm desses dados; o fundo do lago é nosso (os dados só têm a superfície da água).",
  ] },
  { h: "Código e fontes tipográficas", p: [
    "three.js (MIT). Space Grotesk e Space Mono (SIL Open Font License 1.1).",
  ] },
  { h: "O que é recriação", p: [
    "Este jogo é uma recriação, não uma reconstituição histórica. Pessoas, casas, barco e plantas são formas provisórias até chegarem os modelos 3D.",
    "Onde ficam Simão e André na praia, a distância de \"um pouco mais adiante\" (Marcos 1:19) e quantos empregados estão no barco (Marcos 1:20 não diz) são escolhas do jogo.",
  ] },
];
