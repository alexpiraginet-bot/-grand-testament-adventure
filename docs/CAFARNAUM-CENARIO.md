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

### R3 — 13/11/2026

Rua inicial com desvios suaves, frentes assimétricas, variação de altura e rotação.
O gerador atual produz 158 casas, 20 pequenos pátios com muros, 89 jarros e 69 toldos;
essas quantidades vêm do código e não representam dados de população antiga.
Os detalhes seguem a rotação da fachada; somente postes/objetos ao nível do chão
recebem barreiras de movimento, e os muros usam os limites reais da malha.
Os oito trechos do percurso passaram na verificação de colisão e preservam o DEM.

NPCs provisórios receberam trama de tecido compartilhada, baixo-relevo, pregas,
cordas, tiras nas sandálias e cabelo mais detalhado. Ainda não são as malhas humanas
Tripo com rig; o herói nativo foi preservado. Jornada e etiquetas em `NARRATIVA.md`.

Build/typecheck e 39 testes passaram. Chrome local em 1280×800, 390×844 com toque
e WebGL2: 14 recursos carregados, movimento, animação e pausa sem erros. Três missões
completaram nos dois viewports; testes por teleporte/ação de depuração, sem simular
uma caminhada manual completa. Capturas verificaram espaço móvel e separação das falas.
Na amostra de integração local: 87,3–94,7 FPS desktop WebGPU, 47,7–93,9 móvel emulado,
89,8–95,5 WebGL2; 17.887.926 bytes de recursos transferidos. Não é teste em telefone.
Evidências: `shots/r3-final-build.log`, `shots/r3-final-world/`, `shots/r3-final-episode/`,
`shots/r3-final-integration/`. Publicação e arquivo do diário devem registrar o SHA final.

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

### Céu e água — R2

- Céu fotográfico CC0 de [Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky),
  Greg Zaal e Jarod Guest / Poly Haven. A imagem é referência contemporânea do céu,
  não um registro de Cafarnaum. Derivado WebP 4096×2048 para fundo, 1024×512 para
  reflexos, total de 306.662 bytes; fonte, hashes e reprodução em `tools/prepare_sky.mjs`.
  São imagens LDR já tonemapeadas, não iluminação HDR; o sol direto continua separado.
- O fundo usa material sem nova curva tonal para não lavar duas vezes a fotografia.
  Os reflexos usam a versão menor, evitando gerar o ambiente a partir do panorama 4K.
- A água revela o fundo no raso e aumenta a opacidade com a profundidade. O mapa
  usa os mesmos dados de fundo já existentes no jogo, com coordenadas nos centros
  dos texels. Não mudamos o nível do lago, o relevo nem as colisões.
- Há ajuste de ondulação, cor da neblina distante, exposição e altura do sol.
  Não há ray tracing, refração física ou DLSS nesta implementação.
- Verificação local final: build e 34 testes passaram; Chrome WebGPU desktop,
  viewport móvel 390×844 com toque e WebGL2 carregaram os 14 assets, caminharam,
  animaram/pararam o herói e pausaram sem erros de página, rede ou console.
  Amostra desktop WebGPU 87,6–95,2 FPS; móvel emulado 63,5–94,9; WebGL2 74,7–95,8.
  Recursos transferidos: 17.885.144 bytes; panorama+reflexos representam 306.662.
  Texturas reportadas pelo renderer: até ~1,21 GB desktop / ~1,05 GB móvel emulado.
  Evidências: `shots/sky-water-r2-final/` e `shots/sky-water-r2-build.log` (locais).
  O consumo ainda exige teste em telefone físico; os FPS vêm da RTX deste PC.

### Comandos e limites

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
