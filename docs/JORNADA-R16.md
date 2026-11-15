# Jornada R16 — vinte missões depois do ensino (Marcos 1:30 a 4:35)

Pedido de Alex em 15/11/2026: "Preciso de mais 20 missões novas até o fim do dia. Sem falhas."

Este documento diz o que cada missão é, o que é texto bíblico e o que é do jogo, como foi verificado e o que **não**
está aqui. A lista das vinte, com as orações que aparecem na tela e os lugares calculados, é gerada do próprio código:
[`JORNADA-R16-MISSOES.md`](JORNADA-R16-MISSOES.md).

## O que é uma missão aqui

Um lugar a alcançar no terreno real e, quando a passagem dá a ele algo a fazer, uma ação com o botão; depois, as
orações da própria passagem na tela, uma por vez, literais, com a referência.

- **Treze missões têm ação.** A palavra do botão vem do verbo que a passagem dá a ele ("aproximou-se", "esteve a orar",
  "estendeu a mão", "chamou"). Não é um poder que o jogador tem em outro lugar: fora do lugar da missão o botão não a
  oferece. Não existe botão genérico de milagre.
- **Sete são vividas ao chegar** (a passagem só diz aonde ele foi). Nenhuma dessas fica no lugar da missão anterior:
  sempre pedem uma caminhada, e um teste garante que parado onde a anterior terminou ele ainda não está nela.
- **A Bíblia orienta e não tranca.** Nada pergunta se a passagem foi lida. Quem chega ao lugar age.
- **Ordem de Marcos**, a partir de 1:30. A jornada abre quando o ensino (R15) foi vivido e a casa de Marcos 1:29 foi
  alcançada; termina em 4:35 ("Passemos para o outro lado"), com o aviso de que a travessia ainda está em preparação.

## O que é texto e o que é do jogo

| Na tela | Origem | Rótulo |
|---|---|---|
| Orações das passagens | `src/data/mc-caminho.json`, gerado por `tools/build_story.py` do ZIP da BLIVRE (SHA-256 conferido); recortadas do versículo por `src/story-steps.ts` | "Bíblia Livre · referência" |
| Versículos inteiros de cada missão | os mesmos dados, na Bíblia do jogo | Bíblia (painel) |
| Objetivo, palavra do botão, "o radar aponta…" | escritos para o jogo | "Orientação" |
| Aviso de cena | `SCENE_DEVELOPMENT_NOTICE` | "Cena em desenvolvimento · personagens em preparação." |

Nenhuma fala foi escrita para personagem algum nesta rodada: não há texto com o rótulo "Narrativa do jogo" nas vinte
missões. As orações são **recortes** do versículo, nunca paráfrase: o código só diz onde o recorte começa e termina,
e um teste confere que cada uma é parte literal do versículo. Quatro versículos trazem na fonte um espaçamento que
parece descuido dela; os recortes passam ao largo desses trechos (ver `ATTRIBUTION.md`).

## O que não está aqui (limites declarados)

1. **Nenhuma pessoa destas passagens está desenhada.** Só Simão tem modelo revisado. Sogra de Simão, leproso,
   paralítico, Levi, escribas, multidões e os doze aparecem **só no texto**. O aviso de cena fica na tela nas
   dezessete missões cuja passagem fala de gente. Nenhum boneco, nenhuma malha em pose A.
2. **Curas, expulsões e uma controvérsia são narradas só com o texto.** Seis missões estão marcadas para revisão
   editorial de Alex (`review` em `story-steps.ts`, coluna da tabela): a sogra de Simão, o entardecer à porta, a
   pregação pela Galileia, o leproso, o paralítico e a resposta aos escribas e fariseus. A regra do projeto é que
   milagres pertencem a episódios definidos pela passagem e passam por revisão: **estão implementadas e verificadas,
   mas a decisão de mostrá-las ao público é de Alex.**
3. **Hora do dia não é simulada.** "Ao entardecer" e "De madrugada, ainda escuro" estão no objetivo e no versículo; a
   luz da cena não muda.
4. **Lugares são escolha do jogo.** Nenhuma fonte situa a casa, o lugar deserto, o posto de impostos ou "o monte" nesse
   terreno. O posto e o monte não têm objeto nem marco na cena: são pontos do chão.
5. **Trechos de Marcos não encenados** entre as missões (1:23–28 já estava fora; 2:18–3:6; 3:20–35; 4:2–34) não
   aparecem como vividos: a Bíblia do jogo nomeia cada trecho contado com a sua referência.
6. **A travessia de 4:35 não existe.** A jornada termina na margem.
7. **Sem trilha desenhada no radar** entre os lugares: o radar aponta o lugar e mostra a distância.
8. **O progresso é local** (registro do mundo, neste navegador), como o do ensino. A nuvem não o carrega.

## Módulos

| Arquivo | Papel |
|---|---|
| `tools/build_story.py` → `src/data/mc-caminho.json` | os 48 versículos, literais, com origem e hash; `--check` refaz e compara |
| `src/story-steps.ts` | as vinte definições: id estável, passagem, lugar, ação, objetivo, recortes |
| `src/story-places.ts` | os doze lugares calculados no terreno contra os colisores; `null` se algum falhar |
| `src/story-journey.ts` | motor puro: fases, eventos, registro, visão para o HUD |
| `src/story-bible.ts` | as vinte missões na Bíblia do jogo, depois das do ensino |
| `src/bible.ts` (`verseRuns`), `src/bibleui.ts`, `src/bible.css` | a passagem em trechos, cada um com a sua referência |
| `tools/build_story_table.mjs` → `docs/JORNADA-R16-MISSOES.md` | a tabela, gerada |
| `tools/check_story_r16.mjs` | as vinte missões no navegador, nos dois tamanhos |

Quando os lugares ou os recortes não existem (vila sem casa para 1:29, dado alterado), **a jornada inteira não é
oferecida** e o jogo fica como era, com um aviso no console. Nunca dezenove missões, nunca uma oração digitada.

## Contrato

```ts
storySteps(data): StoryStep[] | null                     // as vinte, ou nada
storyPlaces({ terrain, routes, plans, boxes, margin, beach, nets, boat, house }): StoryPlaces | null
restoreStory(steps, world): StoryState                    // primeira missão não vivida; fase "off"
beginStory(state, steps)                                  // abre (ou abre encerrada e calada, se já vivida)
stepStory(state, steps, places, { pos, action, clear }, dt)
recordStory(world, events, now): WorldState               // um fato "completed" por missão, pelo id
storyView(state, steps, places, pos, touch): StoryView | null   // TeachingView + { mark, step, total }
storyReading(base, steps, data, bibleData): StoryReading  // base de teaching-bible.ts + storyIndex
```

- `clear`: nada entre ele e o lugar da missão. Uma missão não é oferecida nem vivida através de uma parede.
- Afastar-se mais de 13 m com as orações na tela as interrompe; nada é salvo e a missão recomeça da primeira oração.
- Recarregar abre a primeira missão não vivida, da caminhada, nunca no meio de uma oração.
- Um registro com uma missão posterior vivida e uma anterior não (não se escreve jogando) abre na anterior.
- Ids das missões começam por `mc-` e não colidem com `ensino-cafarnaum` nem `casa-marcos-1-29`.

## Integração (commit isolado em arquivos do Codex)

`src/main.ts` e `src/hud.ts` são do Codex pela divisão da R15. A ligação da jornada está **num commit só dela**, para
ser revista ou revertida sem tocar no resto:

- `main.ts`: lugares e orações calculados ao lado de `townLife`; estado e registro ao lado dos do ensino; a ação
  roteada pelo mesmo destinatário único do quadro (`receiver`); `hud.teaching` recebe a visão da jornada quando ela
  existe e a do ensino quando não; a Bíblia recebe as missões por `storyReading`; gancho de depuração `__gta.story()`.
- `hud.ts`: `hud.teaching` aceita o rótulo do topo (padrão inalterado, "CAFARNAUM · ENSINAMENTOS"); em `hud.roam`,
  quando não há narrativa a orientação aparece logo (antes ficava 7 s em branco a cada mudança de fase).
- Não mexi em vegetação, colisores, câmera, pose, controles ou gráficos.

**Efeito sobre o que já existia:** depois da casa de 1:29 o painel de exploração ("Encontre os lugares da região") só
volta quando a jornada termina. Os lugares continuam sendo descobertos a pé durante as missões, e o aviso da borda da
região continua passando.
