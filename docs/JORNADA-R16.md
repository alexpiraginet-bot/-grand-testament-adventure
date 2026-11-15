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
- **Sete são vividas ao chegar** (a passagem só diz aonde ele foi). Chegou, está vivida: as orações ficam na tela até
  o fim mesmo que ele siga andando ou correndo. Nenhuma dessas fica no lugar da missão anterior: lugares de missões
  consecutivas ficam a pelo menos 21 m um do outro, mais que o alcance de uma (7 m), o quanto ele pode se afastar
  dela com as orações na tela (6 m) e o alcance da seguinte (7 m). Sem essa distância a jornada não é oferecida.
- **A Bíblia orienta e não tranca.** Nada pergunta se a passagem foi lida. Quem chega ao lugar age.
- **Ordem de Marcos**, a partir de 1:30. A jornada abre quando o ensino (R15) foi vivido e a casa de Marcos 1:29 foi
  alcançada; termina em 4:35 ("Passemos para o outro lado"), com o aviso de que a travessia ainda está em preparação.

## O que é texto e o que é do jogo

| Na tela | Origem | Rótulo |
|---|---|---|
| Orações das passagens | `src/data/mc-caminho.json`, gerado por `tools/build_story.py` do ZIP da BLIVRE (SHA-256 conferido); recortadas do versículo por `src/story-steps.ts` | "Bíblia Livre · referência" |
| Os versículos que a missão cita, inteiros | os mesmos dados, na Bíblia do jogo | Bíblia (painel) |
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
5. **Só o que foi encenado é marcado como vivido.** A Bíblia do jogo lista, de cada missão, os versículos que ela
   cita e nenhum outro. Ficam fora, e nunca aparecem como vividos: Marcos 1:23–28 (já estava fora), 1:43–45, 2:6–10,
   2:18–3:6, 3:8, 3:10–12, 3:15, 3:20–35 e 4:2–34. A referência de uma missão mostra o salto quando há
   ("Marcos 2:3–5, 11–12"), e a passagem é listada em trechos, cada um com a sua referência. Um versículo citado em
   parte é listado inteiro.
6. **A travessia de 4:35 não existe.** A jornada termina na margem.
7. **Sem trilha desenhada no radar** entre os lugares: o radar aponta o lugar e mostra a distância.
8. **O progresso é local** (registro do mundo, neste navegador), como o do ensino. A nuvem não o carrega.

## Módulos

| Arquivo | Papel |
|---|---|
| `tools/build_story.py` → `src/data/mc-caminho.json` | os 35 versículos citados, literais, com origem e hash; `--check` refaz e compara |
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
- Numa missão com ação, afastar-se mais de 13 m com as orações na tela as interrompe; nada é salvo e a missão
  recomeça da primeira oração. Numa missão vivida ao chegar, as orações vão até o fim.
- Uma distância que não é número (lugar ou posição ausente) nunca é "perto": nada é oferecido nem vivido.
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

## Verificação (árvore `a95b9e8`, 15/11/2026)

| Camada | Comando | Resultado |
|---|---|---|
| Dados contra a fonte | `python3 -I tools/build_story.py --check` | iguais ao ZIP da BLIVRE (SHA-256 conferido contra `fontes/SHA256SUMS`) |
| Tabela gerada | `node tools/build_story_table.mjs --check` | igual ao código e aos dados |
| Tipos | `npx tsc --noEmit` | sem erros |
| Testes | `node --test test/*.test.ts` | 472 de 472 |
| Mutações | 46 nos módulos da jornada e na Bíblia, uma por vez | 46 acusadas |
| Build | `npx vite build` (com e sem `VERCEL_ENV=production`) | concluído |
| **20 missões, 390×844 com toque** | `tools/check_story_r16.mjs` | **aprovado, 20 de 20**, 19,9 min |
| **20 missões, 1280×800 com teclado** | idem | **aprovado, 20 de 20**, 54,5 min (segunda execução, ver abaixo) |
| Exploração | `tools/check_roam.mjs` | aprovado nos dois tamanhos |
| Bíblia | `tools/check_bible.mjs` | aprovado nos dois tamanhos |
| Toque | `tools/check_touch.mjs` | aprovado (celular em pé, deitado e PC) |
| Layout da vila | `tools/check_town_life_r15.mjs` | aprovado nos dois tamanhos |
| Painel dos desenvolvedores | `tools/check_painel.mjs` | aprovado |
| Analytics | `tools/check_analytics.mjs` | aprovado |
| Carregamento | `tools/check_loading.mjs` | 5 de 7; os dois que falham são os mesmos que já falhavam antes das missões (abaixo) |

**O que a conferência das vinte missões faz, em cada tamanho:** compara os doze lugares do jogo em execução com os que o
Node calcula (iguais); testa cada lugar com a regra de movimento e os colisores do próprio jogo; caminha por
preenchimento da vila até cada lugar com esses colisores (326.345 células alcançadas, todos os doze lugares entre elas);
vive o ensino e as treze ações com um aperto real (tecla E, ou toque na mão); lê do HUD as 37 orações, uma vez cada, na
ordem, letra por letra contra o arquivo de dados, com a referência; confere o aviso de cena, o rótulo "JORNADA · n DE
20", a distância mostrada e que nada é oferecido fora do lugar; recarrega a página de verdade depois da 7ª e da 14ª
missão e no fim (o registro do navegador abre a missão seguinte, sem oração na tela); abre a Bíblia no meio (próxima
missão, trechos com referência, 28 versículos vividos, 1 agora, 14 adiante) e no fim ("Passagem vivida"); e confere que
a tela volta para a exploração da região.

**O que é emulação e o que não foi verificado**

- O episódio inicial é pulado pelo gancho de depuração que o "Explorar a região" usa, e o herói é levado a cada lugar por
  teletransporte de depuração: **nenhuma caminhada entre missões foi feita no navegador.** Que cada lugar é alcançável a
  pé está provado por preenchimento, não por um jogador andando.
- Chromium com renderizador por software e viewport emulado: **não é celular físico nem Safari**, e nenhum número de
  quadros desta sessão diz algo sobre um aparelho real (aqui o jogo roda a 0–2 quadros por segundo).
- A primeira execução em 1280×800 viveu as vinte missões e parou depois, num limite de 30 s **da ferramenta** para uma
  captura de tela, antes da última asserção. Corrigi o limite e executei de novo: é a execução aprovada acima.
- Uma bateria anterior foi cortada pelo limite de 2 h das tarefas em segundo plano no meio da Bíblia em PC; a Bíblia foi
  executada de novo inteira (aprovada).
- Carregamento: `slow-desktop` e `fail-retry` falham com "THREE.GLTFLoader: Couldn't load texture blob", efeito do
  limite real de 30 s dos assets opcionais neste renderizador; falhavam igual na árvore anterior às missões (`ac1f47e`).
  Não investiguei além de confirmar que é o mesmo par e a mesma mensagem.
- `tools/check_context_game_r15.mjs`, do Codex, **não foi executado**: aponta para o Playwright e o Chrome da máquina
  dele e usa o relógio real do jogo. Nada do que ele confere foi alterado de propósito, mas isso não é verificação.
- Não medidos: bytes do bundle, memória, tempo de carregamento. O cálculo dos lugares levou de 25 a 75 ms em Node, nas seis vezes em que foi cronometrado.
- A vegetação não desvia dos lugares das missões (não é colisor): pode haver um arbusto sobre o ponto, como no lugar
  deserto. Vegetação é do Codex.

## Revisão independente (15/11) e o que mudou por causa dela

Um revisor sem o meu contexto leu o código e simulou o motor no terreno. Não achou defeito crítico; achou quatro
pontos, todos corrigidos antes da verificação final, e um editorial:

| Achado | Correção | Teste que acusa a regressão |
|---|---|---|
| Missão vivida ao chegar era cancelada se o jogador não parasse (correndo, perdia 6 das 7; andando, 3), e a linha da missão mandava seguir | chegou, está vivida: só missão com ação é interrompida ao se afastar | `story-journey.test.ts`, as sete cruzadas a 2,5 e 5,2 m/s sem parar |
| A distância mínima entre missões consecutivas (18 m) era menor que o anel de onde a anterior ainda vale (20 m): do limite do anel da casa dava para viver a da rua | 21 m, e regra final sobre todos os pares consecutivos; sem isso, sem jornada | `story-places.test.ts`, anel inteiro e ponto válido a poucos passos das redes |
| O ponto da rua podia ser extrapolado para trás do começo da viela (não ocorre no mapa atual) | nunca antes do começo da viela | `story-places.test.ts`, casa no começo da viela com a frente construída |
| O jogo e a Bíblia decidiam separadamente se a jornada existe: com um versículo não citado ausente, o jogo tocava e a Bíblia dizia "vivida" | uma decisão só: a Bíblia lista exatamente os versículos que as missões citam | `story-bible.test.ts` e `story-steps.test.ts` |
| (Editorial) A Bíblia marcava como "Vivido" o trecho inteiro da missão, com versículos nunca encenados | os dados e a Bíblia passaram a ter só os versículos citados (35, eram 48) | `story-bible.test.ts`, "only what was staged is ever marked" |

Outros dois meus, antes da revisão: uma distância `NaN` contava como "perto" (missão vivida em qualquer lugar se um
lugar faltasse); e a ferramenta de navegador perdia uma oração curta entre duas leituras e travava (passou a ler um
registro feito na própria página a cada quadro).
