# Jornada de ensino em Cafarnaum — R15 (lógica pronta, ainda não ligada ao jogo)

14/11/2026 · Claude · pedido de Alex, coordenação com Codex R15.
**Estado: módulo puro com testes. Nada disto aparece no jogo até a ligação em `main.ts`/HUD, que é do Codex.**

## O que o jogador passa a ter depois do barco

1. O epílogo existente traz todos de volta à vila e mostra a primeira oração de Marcos 1:21 (`freeroam.ts`, sem mudança).
2. Quando a região abre, começa este passo: objetivo **“Vá ao lugar onde a cidade se reúne”**, com o trecho de rua
   ainda à frente pontilhado no radar.
3. No pátio aparece a ação **Ensinar** (E ou toque). Só aparece ali, onde pode executar.
4. Um toque mostra duas orações literais, cada uma pelo seu tempo de leitura:
   - “e assim que chegou o sábado, Jesus entrou na sinagoga e começou a ensinar.” · Bíblia Livre · Marcos 1:21
   - “E ficavam admirados com o seu ensinamento” · Bíblia Livre · Marcos 1:22
5. Concluído uma única vez, o jogo anuncia o que vem: Marcos 1:23–28 **não é encenado nesta versão**; o versículo
   seguinte que nomeia um lugar é citado inteiro (Marcos 1:29) e o objetivo vira **“Siga para a casa de Simão e de
   André”**, com a casa marcada como escolha do jogo e cena em preparação. Não há tela de fim sem próximo passo.

## Texto: o que é literal e o que é do jogo

- **Literal (Bíblia Livre · referência):** só `line` e `announce` de `TeachingView`. Saem de `src/data/mc-ensino.json`,
  gerado por `tools/build_teaching.py` a partir de `fontes/blivre/porbr2018_vpl.zip` do Bíblia Conectada, com o SHA-256
  conferido contra `fontes/SHA256SUMS`. `python3 -I tools/build_teaching.py --check` refaz e compara.
- Marcos 1:21 diz que ele ensinava e **não traz discurso**: o jogo não põe palavra nenhuma na boca de ninguém.
- **Achado na fonte:** Marcos 1:22 traz “temautoridade” (sem espaço) no arquivo da BLIVRE. Não foi corrigido nem
  mostrado: o jogo cita só a oração anterior, até a primeira vírgula. O versículo inteiro só poderá ir à tela (por
  exemplo na Bíblia do jogo) com esse defeito visível ou depois de a fonte ser corrigida na origem.
- **Do jogo (Narrativa do jogo / Orientação):** `narrative`, `guidance`, `objective` e o rótulo `Ensinar`. O nome do
  destino (“casa de Simão e de André”) é extraído do próprio versículo, não digitado.
- **Lugar:** o pátio é uma posição escolhida pelo jogo numa vila de direção de arte. Nenhuma fonte o localiza e
  nenhum prédio é apresentado como a sinagoga histórica; a narrativa do pátio diz isso na tela.
- Enquanto não houver pessoas desenhadas, `scene` devolve o aviso existente “Cena em desenvolvimento · personagens
  em preparação.” nas fases em que o texto fala de gente.

## API (`src/teaching-journey.ts`)

```ts
teachingLines(data): Fala[] | null                 // as duas orações; null = nada a encenar, ação nunca oferecida
freshTeaching(): TeachingState                     // fase "off"
restoreTeaching(saved: StableStage | null)         // estado de uma retomada: nunca no meio de uma oração
beginTeaching(s): { next, events }                 // região abriu; repetir não muda nada
stepTeaching(s, place, lines, { pos, action }, dt): { next, events }
teachingView(s, place, data, lines, pos, touch): TeachingView | null
recordTeaching(world, events, now): WorldState     // aplica os eventos "save" ao registro do mundo
teachingStage(s): StableStage | null
streetAhead(street, pos): Vec2[]                   // o que falta da rua, para o radar
```

Fases: `off → walk ⇄ ready → line → done`. Depois de `done`, o passo aponta a casa de Marcos 1:29 até o jogador
chegar a 12 m dela (evento `onward`, uma vez), diz por 12 s de jogo que a cena ainda não existe e então
`teachingView` volta a devolver `null`: a tela é de novo da exploração da região. Numa vila sem essa casa, as
palavras finais ficam 30 s de jogo e a devolução é a mesma. A chegada à casa é um fato próprio do registro do mundo
(`casa-marcos-1-29`); `restoreTeaching(salvo, casaSalva?)` recebe-o como segundo argumento opcional. Sair do pátio em `ready` tira a oferta (`left`); afastar-se mais de
12 m do ponto durante as orações interrompe (`interrupted`) sem guardar nada, e pode recomeçar. Segurar ou repetir o
botão não reinicia oração nem conclui duas vezes. `dt <= 0` (painel aberto, aba oculta) não move nada.

`TeachingPlace = { court, street, onward }` vem do layout da vila: `townLife(...).teaching` (seção seguinte).

## Lugar físico (`src/town-life-layout.ts`)

```ts
const life = townLife({ terrain, start: pt(P.start), beach: pt(P.beach), routes: keep,
  plans: town.plans, boxes: town.boxes, margin: movementMargin });   // TownLife | null
const place = life?.teaching ?? null;                                // null: não abrir o passo
```

Nenhuma coordenada é digitada: pátio, rua e casa são procurados no relevo medido, contra os colisores recebidos.
`null` quando não há pátio seguro ou rua segura; `onward: null` quando nenhuma casa tem porta livre.

Resultado nesta revisão da vila (casas R13, 158 footprints finais, 370 colisores com os acessórios):

| Item | Valor medido |
|---|---|
| Pátio (`court.at`) | x −39, z 85; 13,3 m livres até o colisor mais próximo; desnível ≤ 0,7 m no raio de 7 m |
| Rua (`street.points`) | (−9,1; 35,1) → (−10; 39) → (−29; 64) → (−39; 85); 58,7 m |
| Passagem mais estreita | 1,45 m livres de cada lado, em (−16,6; 47,7) |
| Casa de Marcos 1:29 (`onward`) | casa de índice 31 em `plans`; ponto a 2,2 m da fachada, em (−10,3; 242,3); 160 m do pátio |
| Ação oferecida | a até 6 m do pátio (folga 1,5 m); interrupção a 12 m; chegada à casa a 12 m |

Regras que o teste confere a cada 0,1 m da rua: herói não bloqueado pela regra de `main.ts` (caixas + 0,3 m),
terra seca (≥ 0,3 m acima do lago), dentro da margem jogável de 60 m, ≥ 1,3 m livres (raio conservador do burro,
0,91 m, mais margem) e percorrível pelo seguidor com as regras de `npc-navigation.ts`.

`keepClear` (rua + pátio) descreve o chão a manter livre. Não passar a `houses()` nem à máscara de caminho do solo.

**Achado depois da integração (14/11, 22:39 UTC):** `props()` em `world.ts` usa a lista que recebe para duas coisas.
Uma é manter a vegetação fora dos segmentos, que era a intenção. A outra é servir de eixo para espalhar árvores,
arbustos, pedras e capim “ao longo das rotas” (`alongRoutes`). Ao receber `[...keep, ...life.keepClear]`, como o
`main.ts` integrado faz, a vegetação é redistribuída: um terço dos sorteios passa a cair nos quatro segmentos novos.
Medido em Node com uma cópia fiel de `alongRoutes` e das regras de árvore e de pedra (as duas sem termo de ruído),
sobre os colisores reconstruídos, com qualidade 1:

| | Só as rotas da missão (R13) | Rotas + `keepClear` (integrado) |
|---|---:|---:|
| Árvores além da vila (z > 120), de 125 | 78 | 46 |
| Pedras além da vila, de 420 | 362 | 277 |
| Pedras a até 60 m do pátio | 45 | 110 |
| Pedras dentro dos 7 m do pátio | 2 | 0 |
| Sorteios perdidos no segmento de comprimento zero (pátio) | 0 | 22 e 73 |

Nenhuma posição inválida é criada (o segmento de comprimento zero dá `NaN`, que as regras rejeitam). O pátio fica
livre, como pretendido, mas a caminhada até a margem perde vegetação e a rua do pátio ganha pedras. A correção é
separar as duas funções da lista em `props()` (um parâmetro só de exclusão), em arquivos que são do Codex nesta
rodada: não alterei. Arbustos, juncos e capim usam ruído e não foram medidos; o efeito é do mesmo tipo.
`pois`: `quarteirao-inicial`, `passagem`, `patio-ensino`, `margem`, `casa-marcos-1-29`, todos com a nota
“Posição escolhida pelo jogo”.

**Limite da validação em Node:** os colisores do teste são reconstruídos como `village-houses.ts` faz, com caixas
do tamanho catalogado no lugar das malhas de muro, rede e pedras. Vegetação não tem colisor e não entra.

**Conferência no jogo integrado (14/11, 22:39 UTC, `tools/check_town_life_r15.mjs`):** com a `main` da PR #14 unida
a este branch (`e95035a`), o jogo foi aberto com `?debug=1` em 1280×800 e em 390×844 com toque emulado, sem jogar.
O layout que o jogo calculou com o `town.boxes` real é **igual** ao de Node com os colisores reconstruídos: pátio em
(−39; 85) com 13,3 m livres, rua de 58,7 m com 1,45 m livres no ponto mais estreito, casa de índice 31. Pela regra de
movimento do próprio jogo (`__gta.blocked`, sem o corpo do seguidor): 592 amostras da rua, 384 do pátio e o ponto
da porta, nenhuma bloqueada. A reconstrução dá 368 colisores nesta árvore (eram 370 antes das correções de apoio
de pedras e redes do Codex). Relatório local: `shots/town-life-r15-e95035a/report.json`, SHA-256
`f3b6dfd2f94ae67f93706a818c6b43dcd718a2c6c65be436bc1db5a3c4443db8`. Chromium com renderizador por software e
emulação de viewport; não é celular físico, e nada foi caminhado nem capturado em imagem.

## Contrato de ligação, para o Codex

Não editei `main.ts` nem `hud.ts`. O que a ligação precisa fazer:

1. **Carregar:** `const world = store.load(save.id, revision, Date.now())` e
   `let teaching = restoreTeaching(savedStage(world, TEACHING_ID))`; `const lines = teachingLines(ensino)`.
2. **Abrir:** quando `roam.phase` passar a `"free"` (evento `epilogue-done`, ou `startFree` de quem já concluiu),
   chamar `beginTeaching`. Passo e painel só valem com a região aberta: numa nova rodada do episódio o estado guardado
   fica parado até lá.
3. **Um leitor do botão:** a ação do quadro vai para este passo quando o destino do botão for a missão. Em
   `interactions.ts`, `receiver({ ..., mission: view.action ? { label: view.action } : null })`; se o resultado for
   `{ to: "mission" }`, passar `action: true` a `stepTeaching`. Este módulo não lê teclado.
4. **Por quadro:** `stepTeaching(teaching, place, lines, { pos, action }, dt)` com o mesmo `dt` de jogo dos outros
   sistemas (0 em pausa). Aplicar `recordTeaching`; se o registro mudou de objeto, `store.write`. Com `store.status`
   `"newer"` ou `"unavailable"` o passo continua jogável e o HUD deve dizer que vale só nesta visita.
5. **Mostrar:** `teachingView(...)`: `objective`, `dist`, `goal` (radar), `route` (pontilhado), `action` (rótulo do
   botão; `null` esconde), `line` e `announce` com “BÍBLIA LIVRE · REF”, `narrative`/`guidance` com as etiquetas de
   sempre, `scene` no aviso de cena. Durante `line`, a narração some, como já acontece nas outras citações.
6. **Bíblia:** a leitura não entra em nenhuma transição. Se o HUD quiser manter “Abra a Bíblia · Marcos 1:21–22”
   como orientação, a ação no pátio tem de continuar disponível sem leitura (o teste da primeira visita joga assim).

## Persistência

Usa o registro local e versionado do mundo (`world-state.ts`), id `ensino-cafarnaum`: `accepted` ao abrir,
`completed` ao concluir. O save de progresso v1 não é tocado (teste compara byte a byte). Registro de versão futura
não é sobrescrito; registro corrompido é guardado à parte e o passo recomeça; armazenamento negado deixa jogar sem
gravar. As duas correções de `world-state.ts` apontadas pelo Codex (`write()` diante de versão futura surgida entre
leitura e escrita; ids como `__proto__`) ficam com ele: os testes daqui não dependem do comportamento atual nesses
dois pontos.

## Verificação

`node --test test/teaching-journey.test.ts`: 12 testes (primeira visita sem abrir a Bíblia, ida e volta, interrupção,
conclusão única, pausa, retomada em cada fato salvo, save antigo, registro futuro, registro corrompido, armazenamento
negado, texto literal conferido contra os dados do episódio e o hash da fonte). Cinco mutações do módulo foram
aplicadas uma a uma e cada uma derrubou ao menos um teste (ver diário).

## Limites

- Não há captura de tela: sem ligação ao HUD nada disto é visível. Não foi testado em navegador.
- Não há multidão, ouvintes nem interior: só Simão tem ator aprovado. O aviso de cena fica ligado nessas fases.
- A Bíblia do jogo ainda não mostra Marcos 1:22; a referência do passo aparece, o painel não foi estendido.
- Marcos 1:23–28 e a cena da casa (1:29–31) não existem; o jogo diz isso em vez de sugerir que existem.

## Depois da integração: o passo precisa devolver a tela (15/11)

Revisando a integração com a lista de falhas silenciosas do ECC, apareceram duas regressões da exploração livre,
as duas na passagem de bastão entre este módulo e o laço do jogo:

1. **O painel de exploração nunca mais aparecia.** O laço mostra o painel da exploração só quando não há visão do
   ensino, e `teachingView` devolvia uma visão enquanto o passo estivesse aberto, vivido ou não. Desde a R15 a região
   aberta não dizia mais quais lugares faltam encontrar, quantos foram achados nem para que lado fica o mais próximo.
   Corrigido neste módulo (commit `b2974f9`): ver “Fases” acima.
2. **O aviso do limite da região sumia.** `hud.teaching` passava `null` no lugar do aviso. Corrigido com o aviso
   atravessando o painel do ensino (`hud.ts` e `main.ts`, duas linhas cada, em commit isolado para o Codex revisar).

No mesmo commit isolado: o laço passa a casa salva a `restoreTeaching` e avisa no console quando a vila não tem
pátio ou rua seguros (`townLife` nulo), em vez de o passo simplesmente não existir sem deixar rastro.
