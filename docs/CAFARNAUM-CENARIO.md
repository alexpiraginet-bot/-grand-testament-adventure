# Cafarnaum — cenário R1

Pedido de Alex em 12/11/2026: menos descampado; ruas estreitas, materiais mais reais,
casas e pedras; seguir a referência visual enviada e publicar cada melhoria verificada.
Responsável desta revisão: Codex, `codex/tripo-runtime-r1`.

## Referência e grau de certeza

- **Texto do episódio:** Marcos 1:16–20, BLIVRE, já incluído em `src/data/mc-pescadores.json`.
  A pesca, barcos e redes vêm do texto. Não acrescentamos falas inventadas.
- **Arqueologia:** [Christian Media Center, entrevista com Eugenio Alliáta / Studium Biblicum Franciscanum](https://cmc-terrasanta.com/en/media/news/13281/capernaum,-peter%27s-hometown).
  Orienta o uso de pedra basáltica local, agrupamentos de casas, pátios e vielas. O trabalho
  ligado às azeitonas e à pesca também informa os objetos de ambiente.
- **Cronologia:** [Israel Nature and Parks Authority](https://en.parks.org.il/reserve-park/kfar-nahum-capernaum-national-park/).
  O edifício de sinagoga visível no sítio hoje é posterior à cena do jogo; não foi copiado
  para dentro do século I. As construções modernas do sítio também não entram.
- **Material:** [Rocky Gravel / Poly Haven](https://polyhaven.com/a/rocky_gravel), fotografia
  de Dimitrios Savva, processamento de Dario Barresi, [CC0](https://polyhaven.com/license).
  É referência fotográfica de uma superfície, não fotografia arqueológica de Cafarnaum.
  Cor, normal e rugosidade em 2048²; derivados WebP com hashes em
  `public/textures/ground/LICENSE.json`, reprodução em `tools/prepare_ground.mjs`.

## Composição do jogo

O traçado e a quantidade de casas, seus objetos e sua extensão em direção à praia são
composição artística, não uma planta arqueológica comprovada. O aviso aparece nos créditos.
As casas utilizam três malhas existentes do Tripo, repetidas com variações de escala e
orientação. Materiais e silhuetas ainda precisam de revisão artística para chegar à imagem-alvo.

- Vias com centro pisado estreito e transição irregular para cascalho.
- Casas com portas voltadas à passagem, pátios, muros baixos, jarros e armações de madeira.
- Pedras de basalto maiores, juncos e vegetação concentrados ao longo do percurso.
- Fundações calculadas a partir dos cantos de cada construção; elevação do terreno preservada.
- Caminho costeiro procura terra firme nos dados, evitando atravessar a enseada que a linha
  reta anterior cruzava. O novo traçado não muda as posições das missões.
- Câmera encurta o recuo ao encontrar construções, para não atravessar paredes nas vielas.
- Instâncias compartilham malha/material; os grupos de vegetação usam detalhe maior próximo.

## Verificação reproduzível

`npm run build` verifica tipos, testes e gera o build. `test/world-layout.test.ts` confere
o corredor caminhável, contato das fundações, preservação do DEM e integridade dos mapas PBR.
`tools/check_world.mjs` amostra o predicado real de colisão do jogo no corredor e fotografa
vila, pátios, caminho e margem em 1280×800 e 390×844. Os NPCs que ocupam a área de interação
não são considerados bloqueio do cenário nesse teste; as missões são exercitadas separadamente.

Não é prova de desempenho em telefone físico, reconstrução histórica exata, nem aprovação
artística da imagem-alvo. Personagens secundários continuam provisórios aguardando rig.

## Coordenação com Claude

Alex informou que Claude pesquisa repositórios de gameplay. Nesta rodada, a sessão dele
não apareceu nas ferramentas de chat disponíveis; não alegamos ter lido seus resultados.
O remoto ainda só apresentava `main` antes deste envio. Para evitar colisão, esta revisão
concentra a integração visual em `src/world.ts`, `src/world-layout.ts`, `src/animated-actor.ts`,
`src/tripo-assets.ts` e seus pontos de integração em `src/main.ts`.

Pesquisar controle de personagem, câmera, navegação e interação continua útil. Antes de
copiar código, registrar licença, commit de origem e teste no nosso navegador. Nenhum repo
pesquisado foi importado por suposição. Novas contribuições devem partir da `main` publicada
e manter a licença própria das malhas separada do código aberto.
