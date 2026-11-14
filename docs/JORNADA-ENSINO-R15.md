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

Fases: `off → walk ⇄ ready → line → done`. Sair do pátio em `ready` tira a oferta (`left`); afastar-se mais de
12 m do ponto durante as orações interrompe (`interrupted`) sem guardar nada, e pode recomeçar. Segurar ou repetir o
botão não reinicia oração nem conclui duas vezes. `dt <= 0` (painel aberto, aba oculta) não move nada.

`TeachingPlace = { court, street, onward }` vem do layout da vila (`town-life-layout.ts`, próximo commit desta rodada).

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
