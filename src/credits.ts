// Credits shown in the game (start card link, HUD button, end card). The BLIVRE notice is the authors' text, to be
// copied exactly (biblia-conectada/ATTRIBUTION.md); test/data.test.ts checks it is here unchanged.

export const BLIVRE_NOTICE =
  "Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, http://sites.google.com/site/biblialivre/ - fevereiro de 2018. Licença Creative Commons Atribuição 4.0 Brasil (http://creativecommons.org/licenses/by/4.0/br/). Reprodução permitida desde que devidamente mencionados fonte e autores.";

// short lines for the end card, as in the reels' end card
export const SHORT = [
  "Texto: Bíblia Livre (CC BY 4.0 BR) · Geocodificação: OpenBible.info (CC BY 4.0)",
  "Relevo: SRTM/GMTED2010 (USGS), ETOPO1 (NOAA), Mapzen · Malhas: Alex / Tripo",
];

export const SECTIONS: { h: string; p: string[]; quote?: string }[] = [
  { h: "Texto bíblico", quote: BLIVRE_NOTICE, p: [
    "As falas na tela são trechos literais dos versículos citados. Os colchetes da BLIVRE (palavras acrescentadas pelos tradutores) não aparecem nas falas usadas aqui.",
  ] },
  { h: "Lugares", p: ["Geocodificação: OpenBible.info Bible Geocoding Data, CC BY 4.0. O nome em português de cada lugar é o que a BLIVRE escreve."] },
  { h: "Relevo", p: [
    "AWS Terrain Tiles (Mapzen): SRTM e GMTED2010 (USGS), ETOPO1 (NOAA). O chão e o horizonte vêm desses dados; o fundo do lago é nosso (os dados só têm a superfície da água).",
  ] },
  { h: "Modelos 3D", p: [
    "Herói com esqueleto e caminhada do Tripo. Casas, barco, vegetação, pedras e redes: malhas geradas por Alex no Tripo Pro. Os outros personagens ainda usam formas provisórias enquanto aguardam rig.",
    "As malhas e texturas têm licença separada do código MIT. A pose parada é derivada da caminhada; corrida e gesto de chamar ainda não possuem animações próprias.",
  ] },
  { h: "Cenário e materiais", p: [
    'Casas de basalto, pátios e vielas: referências arqueológicas apresentadas pelo <a href="https://cmc-terrasanta.com/en/media/news/13281/capernaum,-peter%27s-hometown" target="_blank" rel="noopener noreferrer">Studium Biblicum Franciscanum / Christian Media Center</a>. Pesca e redes: Marcos 1:16–20, na BLIVRE.',
    'Texturas de chão: Rocky Gravel, Dimitrios Savva e Dario Barresi / <a href="https://polyhaven.com/a/rocky_gravel" target="_blank" rel="noopener noreferrer">Poly Haven</a>, CC0. Material fotográfico usado como referência de superfície, não escaneamento de Cafarnaum.',
  ] },
  { h: "Código e fontes tipográficas", p: [
    "three.js (MIT). Space Grotesk e Space Mono (SIL Open Font License 1.1).",
  ] },
  { h: "O que é recriação", p: [
    "Este jogo é uma recriação, não uma reconstituição histórica.",
    "O traçado dos pátios, casas e caminhos é uma composição do jogo sobre o relevo medido em época moderna. Não representa uma planta comprovada do século I nem altera o nível do lago para aproximar a vila da água.",
    "Onde ficam Simão e André na praia, a distância de \"um pouco mais adiante\" (Marcos 1:19) e quantos empregados estão no barco (Marcos 1:20 não diz) são escolhas do jogo.",
  ] },
];
