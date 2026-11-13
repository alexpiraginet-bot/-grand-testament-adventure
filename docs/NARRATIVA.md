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

## A Bíblia do jogo (pedido de Alex, 13/11/2026)

Alex pediu que, num mundo aberto, o jogador abra a Bíblia para saber o próximo passo, em ordem cronológica, em vez de
receber só um ponto no mapa. Como funciona nesta revisão:

- **O passo vem do texto.** A cada passo a linha da missão mostra "Abra a Bíblia" com a referência (por exemplo
  "Marcos 1:16"); o objetivo, a distância e o marcador do radar só aparecem depois que a Bíblia é aberta naquele passo.
  Quem anda até o lugar certo sem ler ainda consegue agir: a leitura revela a orientação, não tranca o mundo. O mapa
  do Codex continua listando as missões.
- **Quais versículos contam cada passo** sai dos dados, não de uma tabela digitada (`src/bible.ts`): um passo começa no
  primeiro versículo que nomeia as pessoas chamadas ou que traz a fala; vai até o versículo anterior ao próximo passo.
  Resultado conferido em `test/bible.test.ts`: descer à praia = Mc 1:16; chamar Simão e André = Mc 1:16–18; chamar
  Tiago e João = Mc 1:19–20; voltar a Cafarnaum = Mc 1:21.
- **Na Bíblia o versículo aparece inteiro e literal** (BLIVRE). No epílogo o jogo encena só a primeira oração de
  Mc 1:21, mas a Bíblia mostra o versículo todo, como Escritura; o que o jogo pede vem separado, em "No jogo".
- **A ordem** é o roteiro de leitura cronológica do Bíblia Conectada (10 momentos, de Belém aos reencontros), que é
  editorial e não uma cronologia histórica harmonizada; o painel diz isso. A passagem jogada entra depois do batismo,
  pela ordem do próprio Marcos. Os outros momentos trazem o texto literal e a marca "Ainda não jogável" ou "Antes
  desta passagem": nada é anunciado como pronto.
- Enquanto a Bíblia está aberta o jogo fica pausado.

Decisões registradas em 13/11/2026: Alex confirmou que **a Bíblia não tranca o mundo** (ela revela a orientação; quem
chega ao lugar certo sem ler ainda age) e deixou as demais escolhas com quem implementa, pelo que for melhor para a
evolução do jogo. Ficaram assim: (1) no epílogo o jogo encena só a primeira oração de Mc 1:21 e a Bíblia mostra o
versículo inteiro; (2) o mapa da região (módulo do Codex, com suíte própria) continua listando as três missões nesta
revisão. Alinhar o mapa à Bíblia, mostrando o objetivo só dos passos já lidos, é o próximo ajuste a combinar com o
Codex, porque muda a lista e as conferências dele; (3) a leitura não é guardada entre visitas: quem retoma um jogo
salvo abre a Bíblia de novo para ver o passo.

## Jogabilidade

O radar desenha o trajeto existente por terra, inclusive a curva que evita a enseada.
Ele não inventa uma conexão reta de um jogador fora da trilha até ela. A orientação
de chamar só aparece quando a lógica real libera a interação; no encontro com o
barco o jogador pode permanecer na margem. Não há missões ou fatos bíblicos novos
nesta atualização.
