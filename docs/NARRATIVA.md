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

## Jogabilidade

O radar desenha o trajeto existente por terra, inclusive a curva que evita a enseada.
Ele não inventa uma conexão reta de um jogador fora da trilha até ela. A orientação
de chamar só aparece quando a lógica real libera a interação; no encontro com o
barco o jogador pode permanecer na margem. Não há missões ou fatos bíblicos novos
nesta atualização.
