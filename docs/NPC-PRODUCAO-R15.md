# Pessoas de Cafarnaum — população, conversa e produção dos modelos (R15)

14/11/2026 · Claude · pedido de Alex, coordenação com Codex R15.
**Estado: lógica pura com testes; nada ligado ao jogo. Hoje o único humano desenhável além do herói é Simão.**

## Quem aparece e quem não aparece

`src/npc-population.ts` separa três coisas: **identidade** (pessoa, id estável), **modelo** (malha com rig e clipes
revisados no jogo) e **rotina**. Uma pessoa só está presente quando um modelo aprovado que a retrata está carregado.
As demais ficam **ausentes, com o motivo**, e um ausente não é nada: sem malha, colisor, marca no radar, voz ou alvo
do botão. Nenhum substituto é criado. A malha de uma pessoa nomeada nunca veste outra pessoa (`de-outra-pessoa`), e
uma malha de adulto sem nome só se repete até o número de cópias para o qual a arte foi revisada.

Elenco de hoje, conferido em teste: `simao` presente; `andre`, `tiago`, `joao`, `zebedeu`, `empregado1` e
`empregado2` ausentes por `sem-modelo`. Não existe morador de rua aprovado: a vila continua sem transeuntes.

## API para a ligação (Codex)

```ts
import { cast, settle, select, stepResidents, placeMission, presence, animationRate, episodeIdentities,
  NPC_MODELS, NPC_BUDGET } from "./npc-population.ts";
import { townPlaces, townNpcGround } from "./town-life-layout.ts";

const who = cast(episodeIdentities(names, meta.level_design.empregados), NPC_MODELS, loadedModelIds);
const places = townPlaces(input, life), ground = townNpcGround(terrain, town.boxes, movementMargin);
const { residents } = settle(who.present, places, ground, seed);
// por quadro
placeMission(residents, { simao: actualNpc() ? { pos: simNav.pos, heading: simNav.heading, speed: simNav.speed } : null });
const sel = select(residents, player.pos, startupProfile.mobile ? NPC_BUDGET.mobile : NPC_BUDGET.desktop, previous, talk.pinned);
stepResidents(residents, new Set(sel.active), places, ground, player.pos, dt, talk.busy);
const here = presence(residents, new Set(sel.active));   // drawn[] e colliders[]: só quem está desenhado
```

- **Orçamento inicial de teste:** 8 pessoas próximas no celular, 20 no desktop. É ponto de partida para medir, não
  população histórica nem capacidade medida. Carga a 70/110 m, descarga a 85/130 m (sem piscar na borda).
- **Setores de 64 m:** quem está em setor fora de alcance nem é medido. Fora de vista o mixer fica suspenso
  (`animationRate`); perto e em vista roda todo quadro; mais longe, em taxa reduzida.
- **Quem não some:** pessoas da missão e quem está em conversa (`pinned`) ficam mesmo além do orçamento.
- **Rotinas:** esperar num ponto, conversar em dupla (dois pontos feitos um para o outro), cuidar da rede (só com o
  clipe `net` revisado), caminhar numa rua pelo lado, virando no fim. O caminhante para quando o jogador está à
  frente e retoma depois; ninguém entra em colisor, água ou outra pessoa; não há teleporte. As regras de chão são as
  do seguidor (`npc-navigation.ts`).
- **Lugares** (`townPlaces`, no relevo real): 7 pontos em anel no pátio olhando para o centro (o do caminho de
  entrada fica de fora), 2 duplas ao lado da rua, 2 pontos na margem para rede e as ruas `rua-do-patio` e
  `rua-da-vila`. Todos são posição escolhida pelo jogo e passam na regra de apoio do seguidor.

Para Simão nada muda: ele é pessoa da missão, a rotina não o move e `presence()` não o lista; continua com o
`NpcNavigation` do R12. **Posição real (correção pedida na revisão do Codex):** uma pessoa de missão não tem lugar
até a cena dizer onde ela está (`placeMission`, com a posição do seguidor enquanto o ator está visível, `null` caso
contrário). Antes disso ela não está em lugar nenhum (não na origem do mapa), não aparece como ativa e não bloqueia
ninguém; colocada, os caminhantes da vila desviam dela. A vaga dela no orçamento fica reservada nos dois casos, para
ninguém da vila sumir quando o seguidor aparece. `select` e `stepResidents` aceitam as listas `pinned` e `busy` da
conversa como vetor ou como `Set`.

## Primeira conversa (`src/conversations.ts`)

Conversa curta e opcional com quem está desenhado, pelo mesmo caminho do botão único (`interactions.ts`):

```ts
const targets = talkTargets(TOWN_LINES, people, talk, { scripture, taught });  // Target[] kind "talk", "Conversar"
// se receiver(...) devolver { to: "target", id } ou { to: "ongoing" } e houver toque:
apply(talkPress(talk, TOWN_LINES, people, id, ctx));
apply(talkStep(talk, TOWN_LINES, people, player.pos, dt, ctx));
const v = talkView(talk, TOWN_LINES, people, player.pos, poiById);  // speech, ongoing, busy, pinned, facing
```

- O alvo só fica disponível quando o toque abriria a conversa: pessoa desenhada, com fala ainda não dita, ninguém
  falando, nenhum versículo na tela, intervalo de 45 s cumprido. Alcance, frente e parede são do `interactions.ts`.
- **Reação visível com o que existe:** quem fala vira-se para o herói; lida a fala, vira-se por 3 s para o lugar que
  citou. Nenhum gesto é inventado para malha sem clipe.
- Termina por leitura, dispensa (segundo toque), afastamento (4,5 m), versículo na tela ou sumiço do ator.
- **Falas (autoria do jogo, etiqueta “Narrativa do jogo”, sujeitas à revisão editorial de Alex):**
  - Simão, antes do ensino: “O lugar onde a cidade se reúne fica logo depois da passagem estreita.”
  - Simão, depois do ensino: “Nossa casa fica mais abaixo, no caminho do lago.”
  Nenhuma fala é atribuída a Jesus e nenhuma traz referência bíblica. Marcos 1:29 cita a casa de Simão e de André em
  Cafarnaum; a posição dela no jogo é escolha nossa.
- Sem áudio: nenhuma voz foi criada. Som ambiente com proveniência e botão de silêncio fica para quando houver fonte.

O primeiro encontro com objeto (“Uma rede fora do lugar”, `encounters.ts`) continua bloqueado pelo que sempre o
bloqueou: adulto aprovado, objeto e clipes de pegar, carregar e soltar.

## Diagnóstico dos candidatos já pagos

Dados do catálogo versionado (`src/data/tripo-assets.json`), tabela gerada por código:

| Pessoa | Arquivo no catálogo | Tamanho | Triângulos | Altura | Envergadura | Skins | Clipes | Textura | Estado |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| André | `pescador-andre-c1c40eb58456.glb` | 897.304 B | 11.476 | 1,74 m | 1,70 m | 0 | 0 | 2048 px | `awaiting-rig-not-used-in-game` |
| Tiago | `pescador-tiago-5c2caa6e1e3e.glb` | 864.956 B | 11.446 | 1,77 m | 1,72 m | 0 | 0 | 2048 px | `awaiting-rig-not-used-in-game` |
| João | `pescador-joao-0c83cad2fde6.glb` | 985.100 B | 11.856 | 1,73 m | 1,62 m | 0 | 0 | 2048 px | `awaiting-rig-not-used-in-game` |
| Empregado (o jogo desenha 2) | `empregado-14a340c88dca.glb` | 751.948 B | 7.688 | 1,72 m | 1,66 m | 0 | 0 | 2048 px | `awaiting-rig-not-used-in-game` |
| Zebedeu | `zebedeu-1a2035745bd3.glb` | 840.608 B | 9.866 | 1,70 m | 1,62 m | 0 | 0 | 2048 px | `awaiting-rig-not-used-in-game` |

Leitura: os cinco são malhas estáticas, sem esqueleto e sem animação. A envergadura próxima da altura indica braços
abertos (pose em T, como a fonte de Simão antes do R11). Nenhum pode entrar em cena assim.

**Não verificado nesta sessão:** os arquivos em si. O host de assets devolve 404 para os cinco (só os modelos de
runtime são publicados) e `assets-src/tripo-r1/` não existe neste contêiner; não há Blender aqui. Hash, textura,
escala real, frente e topologia de cada arquivo precisam ser conferidos no acervo local de Alex.

## Tarefas exatas de arte (cadeia local do Simão R11/R12)

Ordem pedida: discípulos que faltam, depois um trabalhador adulto para o encontro cotidiano, depois adultos de rua.

Para **cada** malha (André, Tiago, João; depois `empregado`; depois Zebedeu):

1. Conferir o SHA-256 da fonte contra o catálogo e preservar a fonte em T.
2. Rig próprio: reaproveitar a armação de 22 juntas do Simão como ponto de partida e **refazer os pesos nesta
   malha** (ombros, manto, barra da túnica, barba). Copiar o esqueleto não basta: proporções e roupa diferem.
3. Pose de descanso com braços relaxados; no máximo 4 influências por vértice; skin e esqueleto sob o mesmo ancestral.
4. Clipes: `idle` (respiração, 3–4 s), `walk` no lugar com a passada medida em m/s, e um gesto curto de conversa
   (`talk`). Para o `empregado`, se for o adulto do encontro da rede: também pegar, carregar e soltar, com o
   instante de contato marcado.
5. Exportar GLB em metros, Y para cima, frente −Z, origem nos pés, chão em Y = 0, recursos embutidos.
6. Gerar os perfis 1024 px (desktop, ≤ 2.000.000 B) e 512 px (mobile, ≤ 1.000.000 B) com a ferramenta do R12,
   nome com os 12 primeiros dígitos do hash, e registrar hashes e tamanhos.
7. Revisar **no jogo**: frente, costas e lado; vários quadros de idle e de caminhada; pés no chão em rampa; sombra;
   ao lado do herói para conferir escala. Só então marcar `reviewed-integration-candidate`.
8. Entregar: os dois GLBs no host de assets, o catálogo do ator e uma linha em `NPC_MODELS` com `portrays` igual ao
   id da pessoa e os clipes que realmente existem.

**Adultos de rua:** não há fonte. Exigem malhas novas com roupas e identidades distintas; não derivar de Simão nem
dos discípulos. O teto de 1.200 créditos Tripo foi consumido: gerar exige novo teto confirmado por Alex.

## O que o código ainda precisa para um segundo ator

`npc-assets.ts` e `npc-actor.ts` são do R12 e estão presos a Simão de propósito (id, hash da fonte, nomes dos
clipes, pasta `npc-r12`, `id='simao'` no ator). Quando o segundo modelo existir: um registro de modelos revisados
no lugar das constantes, `id` e pasta vindos do catálogo, e um dono compartilhado de geometria e textura com
contagem de uso para cópias do mesmo modelo (hoje cada ator é dono do seu GLB, o que serve para um). Não fiz essa
mudança agora: sem um segundo modelo ela não pode ser exercitada no jogo e mexeria em arquivos que a integração do
Codex está usando.

## Verificação

`node --test test/npc-population.test.ts test/conversations.test.ts`: 11 + 5 testes, com o relevo real e os
colisores reconstruídos da vila. A multidão dos testes é feita de dublês (`teste-*`) e existe só nos testes.
Mutações aplicadas uma a uma: 12 na população (8 na primeira entrega, 4 na correção da pessoa de missão), 5 na conversa; uma da conversa sobreviveu na primeira rodada (alvo
oferecido enquanto alguém fala) e ganhou asserção própria.

## Limites

- Nada foi visto no navegador; não há medição de quadros, bytes ou memória com população, porque não há população.
- Os números 8 e 20 não foram medidos; são o ponto de partida do teste de carga quando houver modelos.
- Anel do pátio, duplas e ruas foram validados contra colisores reconstruídos em Node, não contra `town.boxes` real.
- Vegetação não tem colisor: um ponto de espera pode coincidir com uma árvore.
