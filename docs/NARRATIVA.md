# História, jornada e autoria

Em 13/11/2026 Alex autorizou falas e narração próprias inspiradas nas passagens,
desde que a interface diferencie o texto bíblico da narrativa criada para o jogo.

## Duas origens explícitas

- **Bíblia Livre · referência:** fragmento literal da BLIVRE, conferido nos dados
  do episódio. Não modernizar ou completar a citação com palavras nossas.
- **Narrativa do jogo:** texto autoral inspirado no episódio; não apresentar como
  versículo ou transcrição histórica. Personagens podem receber diálogo autoral
  em revisões futuras, sempre com essa identificação visível durante a fala.
- **Orientação:** instruções de controles, proximidade e navegação. São ajuda ao
  jogador, não fala de personagem.

Nesta revisão a narrativa autoral é do narrador, sem falas novas atribuídas a Jesus.
As três apresentações curtas contextualizam a chegada à praia, o encontro com Simão
e André e a aproximação do barco de Tiago e João. Depois cedem espaço à orientação.
Durante uma citação bíblica a narração se oculta, evitando confundir as duas origens.

`src/journey.ts` mantém o texto editorial separado de `src/data/mc-pescadores.json`.
`src/hud.ts` exibe as etiquetas; `test/journey.test.ts` percorre o estado real do
episódio e verifica preservação das falas. `tools/shots.mjs` confere isso na UI.

## Depois do episódio: epílogo e exploração (Claude, 13/11/2026)

Concluída a terceira missão, o cartão final oferece **Continuar explorando**. Os quatro
chamados seguem com o jogador e a região fica aberta. Um caminho de volta é encenado a
partir do próprio texto: Marcos 1:21 começa com a entrada deles em Cafarnaum, então, ao
voltar à vila, o jogo mostra **só a primeira oração do versículo**, literal, com
"Bíblia Livre · Marcos 1:21". O trecho sai dos dados do episódio por código
(`src/freeroam.ts`, até o primeiro ponto e vírgula); `test/freeroam.test.ts` confere
que é o começo literal do versículo. O restante do versículo (o sábado e a sinagoga)
**não é encenado** e por isso não é mostrado.

Não foi criada missão nova nos dados do episódio: `src/missions.ts` e
`src/data/mc-pescadores.json` ficam como estavam. As duas frases do narrador nesse
trecho levam a etiqueta "Narrativa do jogo"; a contagem de lugares e o aviso do limite
da região levam "Orientação".

Quem já concluiu o episódio encontra, no cartão inicial, **Explorar a região**: entra
direto na região com os quatro, sem repetir as missões e sem reexibir a oração de
Marcos 1:21; o registro salvo não muda. Na exploração livre o painel e o radar apontam
o lugar mais próximo ainda não encontrado ("fica a noroeste"), até não faltar nenhum.

Os **lugares da região** (`src/places.ts`) declaram de que tipo de fato se trata:
"Lugar com fonte" (Cafarnaum, coordenadas do OpenBible), "Posição escolhida pelo jogo"
(a margem, as redes e o barco que a passagem cita; a posição é nossa, ver
`level_design`) e "Nome do jogo sobre o relevo real" (o mirante, ponto mais alto do
relevo a até 400 m de Cafarnaum; nenhum texto ou fonte fala dele). Nomes são montados
com os nomes de lugar e de pessoa dos dados, nunca digitados.

## Jogabilidade

O radar desenha o trajeto existente por terra, inclusive a curva que evita a enseada.
Ele não inventa uma conexão reta de um jogador fora da trilha até ela. A orientação
de chamar só aparece quando a lógica real libera a interação; no encontro com o
barco o jogador pode permanecer na margem. Não há missões ou fatos bíblicos novos
nesta atualização.
