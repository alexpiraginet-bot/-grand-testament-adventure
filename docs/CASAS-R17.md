# Casas R17 — kit de casas feito por código (protótipo, fora da vila)

19/11/2026. Claude, branch `claude/quirky-hamilton-bt0y7w`, PR #10. Pedido de Alex: "Consegue criar casas mais
realistas e diferentes para popular a cidade toda?"

**Estado: proposta para aprovação. Nenhuma casa do kit está no jogo.** `village-houses.ts`, `world.ts`, `main.ts` e os
demais arquivos do Codex não foram tocados; a vila continua com as três malhas esculpidas. O que existe são módulos
novos, testes, uma página de revisão fora do jogo e imagens. Entrar na vila depende da palavra de Alex e de combinar
com o Codex, dono das casas.

Os números desta nota que descrevem o kit estão em `docs/CASAS-R17-NUMEROS.md`, gerado por código e conferido por
teste. Aqui ficam o contexto, os limites e as decisões.

## A resposta curta

Sim para "diferentes" e para "a cidade toda": o kit dá uma casa a cada um dos 158 lotes, de seis tipos e três
acabamentos, sem duas de mesma aparência à vista uma da outra, com cerca de um terço dos triângulos de hoje.

"Mais realistas" tem um limite que precisa ficar dito. As casas do kit são arquitetura coerente (paredes que se
inclinam, portas e janelas com espessura, vigas, terraços, pátios, alpendres), mas a pedra é uma textura estilizada
que se repete e as arestas são mais limpas que as das malhas esculpidas. Não é pedra esculpida nem fotografia. Malhas
esculpidas novas exigiriam o Tripo, cujos créditos autorizados acabaram; nada foi gerado nem comprado.

## O que o kit faz

`src/house-kit.ts`, puro (sem three.js), devolve geometria em vetores, uma parte por material (pedra, reboco, madeira).

| Tipo | Forma |
|---|---|
| `sala` | um cômodo, com laje de terra ou terraço |
| `duas-salas` | cômodo principal e um segundo, mais baixo e recuado |
| `patio` | cômodo e pátio murado ao lado, com portão na rua, forno, mó e jarros |
| `escada` | cômodo com terraço e escada de pedra encostada na lateral |
| `alpendre` | cômodo recuado atrás de um alpendre de postes, com cobertura de terra |
| `sobrado` | cômodo com um quarto menor num canto do terraço e escada de mão |

Acabamentos: pedra à vista, reboco de barro até um rodapé de pedra, reboco só na parte de cima. Sobre os telhados e
nos pátios: rolo de pedra, esteira enrolada, jarros, às vezes uma cabana de varas.

O que cada casa mantém (é o que os testes conferem):

- fica dentro da planta do lote e no chão, então o colisor do lote continua verdadeiro na horizontal;
- a fachada é o lado `+Z` do lote, como a vila já convenciona; a entrada está onde o desenho diz, e no centro da
  fachada quando o lote pede (`centredEntrance`), que é o que as casas das missões precisam;
- o mesmo lote com a mesma semente dá sempre a mesma casa, e construir o mesmo desenho duas vezes dá a mesma malha;
- não se vê através dela da rua nem dos fundos, e vista de fora a primeira face encontrada está virada para quem olha;
- pedra e reboco são desenhados num só tamanho, sem textura esticada.

### Origem das formas

A referência documentada do projeto (`docs/CAFARNAUM-CENARIO.md`, Studium Biblicum Franciscanum e Israel Nature and
Parks Authority) orienta pedra basáltica local, agrupamentos de casas, pátios e vielas. O kit segue isso.

`Assumption:` laje de terra sobre vigas, terraço com parapeito, escada externa, quarto no terraço, alpendre e reboco
de barro são escolhas de composição minhas, a partir do que é comumente desenhado de casas da Galileia do século I.
**Não conferi fonte para elas nesta sessão.** O kit é artístico, como o resto do cenário: não é levantamento de
Cafarnaum nem fonte. Se Alex quiser rigor arqueológico em algum desses elementos, é revisão a fazer antes de publicar.

## Para quem integrar

```ts
import { villageDesigns, houseMesh, mergeHouses } from "./house-kit.ts";
const designs = villageDesigns(town.plans.map((p, i) => ({ w: p.w, d: p.d, h: p.h, seed: i + 1, x: p.x, z: p.z,
  centredEntrance: /* as casas das missões */ false })));
const meshes = designs.map(houseMesh);
const village = mergeHouses(meshes.map((mesh, i) => ({ mesh, x: plans[i].x, y: plans[i].y, z: plans[i].z, rot: plans[i].rot })));
```

- `houseDesign(lot)` desenha um lote sozinho; `villageDesigns(lots)` desenha a vila e faz um lote sortear de novo
  quando a casa sairia com a aparência de outra a menos de 15 m.
- `mergeHouses` gira e posiciona como `buildingPoint` (o mesmo giro dos lotes) e devolve três malhas para a vila
  inteira, uma por material.
- `design.entrance`: posição, largura livre, `inset` (quanto atrás da linha da fachada: a profundidade do alpendre,
  quando há) e `gate` (portão de pátio em vez de porta).
- `design.base`: o retângulo construído. Na página de revisão, as fundações do próprio jogo (`foundationMeshData`)
  foram usadas com esse retângulo no lugar do contorno da malha esculpida, sem mudar `village-house-placement.ts`.
- Materiais: `src/data/house-materials-r17.json` (pedra e reboco, perfis 512 e 1024, com hash) e a madeira de
  `facade-materials-r13`, já no jogo. Material padrão com cor por vértice.

O que a integração precisa resolver, e que este protótipo não resolve:

1. **Topo do colisor.** `main.ts` só afasta a câmera de uma caixa abaixo do `top` dela, e `houseObstacle` usa a altura
   do lote. Casas com cabana no terraço ou quarto alto passam dessa altura (quantas e quanto, em
   `CASAS-R17-NUMEROS.md`). O topo tem de vir de `HouseMesh.height`.
2. **Casas das missões.** A porta da casa de Simão e a da casa de Levi são calculadas do centro da fachada
   (`story-places.ts`, `town-life-layout.ts`). Esses dois lotes precisam de `centredEntrance: true`. Com ele o kit
   garante a entrada no centro; se o tipo sorteado não puder, o lote recebe um cômodo simples.
3. **Detalhes que já existem em volta das casas.** `settlementDetails` e `villageDetailsR13` põem muros, jarros,
   toldos e madeira de fachada pensados para as malhas esculpidas. Com casas que trazem pátio, jarros e alpendre
   próprios, é preciso decidir o que fica, para não dobrar.
4. **Pátio dentro do colisor.** O colisor continua sendo a planta inteira do lote: o pátio se vê, mas não se entra.
   É coerente com o jogo de hoje (o herói não entra em casa), mas é uma escolha.
5. **Carga dos materiais** por perfil, com descarte de resultado tardio, como os materiais R13.
6. **Luz.** Na página de revisão o relevo da pedra está em `normalScale` 0,8 (ver "Limites").

## Como foi verificado

Tudo abaixo foi executado nesta sessão, na árvore que está no commit.

- `npx tsc --noEmit`: limpo.
- `node --test test/house-kit.test.ts`: 13 testes, nos 158 lotes reais e em mais 420 lotes sintéticos (mais estreitos,
  rasos, baixos, largos e fundos que os da vila, com e sem entrada pedida no centro).
- Mutação: `house-kit.ts` quebrado de 28 maneiras, uma por vez (script em rascunho, fora do repositório); os testes
  acusaram as 28.
- `node tools/build_house_textures.mjs --check`: os 12 arquivos de textura são os que o código gera.
- `node tools/build_house_report.mjs --check`: a tabela de números é a que o código dá.
- `npm run build` (o comando do projeto: tipos, suíte inteira e os dois builds): passou, com 485 de 485 testes. O
  pacote do jogo não contém o kit (nenhum arquivo do build o nomeia).
- Imagens da página de revisão em 1280×800 e 390×844, olhadas uma a uma.

### Defeitos meus que os testes acharam antes de qualquer imagem ir para Alex

A primeira versão do kit já tinha imagens aceitáveis. Escrever os testes mostrou que estava errada em vários pontos:

| Defeito | Como apareceu | Correção |
|---|---|---|
| 885 triângulos dobrados em 45 casas | a borda ondulada do reboco passava da fileira de pontos de cima | a ondulação nunca chega à fileira vizinha; zero nas quinas e nas aberturas |
| Frestas de até 4,4 cm entre os dois cômodos, de até 1,4 cm junto à escada e de até 1,2 cm junto ao muro do pátio | cada parede se inclina e ondula do seu jeito; duas que só se encostam deixam ver através | o que encosta num cômodo entra 12 cm nele |
| Quina compartilhada fora da linha (o teste exige menos de 0,001 mm; o desvio anterior não foi medido) | o desvanecer da ondulação não era reto entre as alturas de referência | a quina é uma linha quebrada exata, igual vista das duas paredes |
| Tampas de cilindro com textura esticada ou borrada | UV degenerado nas tampas (mó, rolo, vigas) | tampas com pontos e UV próprios |
| Degraus de até 3 cm em fileiras a milímetros uma da outra | relevo sorteado ponto a ponto, e pontos fixos ao lado de pontos livres | relevo contínuo, que some aos poucos junto de bordas e aberturas |
| Paredes de dois cômodos no mesmo plano atravessando uma à outra | cômodo baixo alinhado com a fachada do principal | o segundo cômodo, a escada, o muro do pátio e o quarto do terraço ficam fora dos planos do cômodo principal |
| Porta de rua de uma casa de pátio passando da ponta do cômodo | entrada pedida no centro num lote onde o centro cai na borda do cômodo | porta de rua só onde cabe; senão o lote recebe um cômodo simples |
| Poste do alpendre, jarro ou escada de mão na frente da porta | posições sorteadas sem olhar a porta | nada fica no vão da porta |
| Casa diferente a cada construção do mesmo desenho | um sorteio era feito durante a construção do alpendre | todo sorteio é feito ao desenhar |
| Escada "curta" passando do fundo do lote | caminho de código que nenhum lote da vila exercia | removido; a escada só é sorteada onde o lance inteiro cabe |
| Ponto sem uso no topo de fornos e jarros; lintel sem a face de baixo | sobras | removidos; face incluída |
| Pátio, alpendre e recuo seriam buracos em lote inclinado | o piso do lote fica acima do terreno | toda casa tem o chão de terra batida da sua base |

### Tentativas rejeitadas

- Textura da parede em fiadas regulares e arredondadas: lia como calçamento. Trocada por pedras de campo (Voronoi).
- Pedra escura demais; depois, pedras "almofadadas", com cara de desenho. Paleta cinza, faces planas com chanfro curto.
- Tom de cada casa sorteado canal a canal: uma casa saiu verde. Agora só mais clara ou escura, mais quente ou fria.
- Pedras de quina e de ombreira como blocos salientes: com a textura de alvenaria liam como caixas. Removidas.
- `normalScale` 1,15 na pedra: numa parede que o sol só raspa, vista a um palmo, as arestas das pedras viravam riscos
  claros. Medido num recorte: 1,58% dos pontos claros com 1,15; 0,66% com 0,6. Mudar o viés da sombra não alterou
  (1,53%). A página de revisão usa 0,8, valor que não medi nesse recorte.
- Vista aérea da vila inteira com a caixa de todos os lotes: as casas sumiam na distância. Reenquadrada no núcleo.

## Limites e o que não foi verificado

- **Não está no jogo.** Não há medida de quadros por segundo, memória de GPU ou bytes baixados com o kit na vila.
- As imagens são da página de revisão, num renderizador por software. As vistas "vila" têm só lotes, chão real e
  fundações: sem água do jogo, plantas, pessoas, muros nem céu. Mostram forma, luz e material, não a cena do jogo.
- 390×844 é viewport de navegador, não celular físico.
- A textura da pedra é estilizada e se repete a cada 2,4 m. Paredes grandes de pedra à vista são o ponto mais fraco.
- As arestas das casas são mais limpas que as das malhas esculpidas: ao lado delas o kit parece mais "construído"
  e menos "modelado à mão".
- Dois planos de parede muito próximos não se atravessam por construção, mas isso não tem teste próprio.
- Os riscos claros em parede rasante ao sol diminuem com o relevo mais suave e não somem (medido em 0,6).
- Sem interior: portas e janelas são fechadas por uma folha de madeira ou um fundo escuro.
- Memória: cada casa tem geometria própria, enquanto hoje as três malhas são instanciadas (números na tabela).
- A licença dos materiais gerados está como MIT no catálogo, por serem saída do código do repositório. É decisão de
  Alex se a arte gerada deve ter outra licença.
- As texturas estão em `public/`, então vão para o deploy mesmo sem uso (o jogo não as pede). Podem sair de lá até a
  integração, se preferirem.

## Evidência e como refazer

```bash
node tools/build_house_textures.mjs --check
node tools/build_house_report.mjs --check
node --test test/house-kit.test.ts
npx vite --port 5179 --strictPort &
node tools/shoot_casas.mjs http://127.0.0.1:5179/ shots/casas-r17
```

Página: `tools/casas/index.html` (só no servidor de desenvolvimento). Vistas `rua`, `meio`, `alto`, `porta` (rua de
teste), `comparar` (malha atual ao lado da casa do kit) e `vila`, `vila-alto`, `vila-rua` (os 158 lotes reais). As
imagens ficam em `shots/casas-r17/`, fora do Git, como a outra evidência local.

## Decisão pedida a Alex

1. O kit substitui as três malhas esculpidas na vila, convive com elas (por exemplo, esculpidas nas casas das missões
   e kit no resto) ou fica como está?
2. Se entrar: quem integra, o Codex no arquivo dele ou eu num commit isolado combinado com ele?
3. Algum tipo ou acabamento a tirar, ou a tornar mais raro ou mais comum?
