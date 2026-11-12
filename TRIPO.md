# Malhas do Grand Testament Adventure para gerar no Tripo

Ficha de trabalho para quem gera as malhas no Tripo (site ou app, conta Pro, sem API). Cobre tudo o que a fatia
jogável **"Pescadores de gente" (Marcos 1:16–20, margem de Cafarnaum)** usa. Enquanto uma malha não chega, o jogo usa
a forma provisória que já está no código, então a ordem abaixo é só de prioridade: a de cima muda mais o jogo.

## Como trabalhar

1. Siga a ordem da tabela de resumo. Gere **um arquivo por item**, com o nome exato da coluna "Arquivo".
2. Para cada item, use o **prompt em inglês** (ou o texto em português, se preferir) e, quando houver, a **imagem de
   referência** indicada.
3. Gere algumas variações, escolha a que passa no **checklist de aceite** (fim do arquivo) e só então faça:
   - redução de polígonos / retopologia até o orçamento do item (se a conta tiver a opção);
   - texturas no tamanho do item;
   - rig e animações, **só nos itens que pedem**.
4. Exporte em **GLB** (binário, com as texturas embutidas).
5. Entregue: os GLB nomeados como na lista e, por item, um print da malha no visualizador do Tripo. Anote o que não
   deu para fazer (ex.: "animação de lançar rede não existe na biblioteca").

## Regras que valem para todas

- **Escala em metros**, Y para cima, origem no chão (pessoas: entre os pés; objetos: no meio da base; barco: no meio,
  na linha d'água). Se o Tripo não deixar escolher, tudo bem: eu corrijo no código, desde que a proporção esteja certa.
- **Século I, Galileia**: tecidos de lã e linho, couro, madeira, pedra basalto escura, barro. Nada moderno: sem
  zíper, botão, costura de máquina aparente, tênis, óculos, plástico, metal brilhante, texto ou logotipo.
- **Só adultos.** Nenhuma criança, em nenhum item.
- **Deus nunca aparece como personagem.** Nenhum halo, luz sobre a cabeça ou símbolo religioso nas roupas.
- Nada que lembre o jogo de outra empresa em que a série se inspira (personagens, roupas, logotipos).
- Personagens em **pose em T ou A**, corpo inteiro, de frente, para o rig funcionar.
- Cor "chapada" na textura (sem sombra nem luz pintadas), porque o jogo ilumina a cena.

## Orçamento (pensado no celular)

A cena inteira precisa caber em ~400 mil triângulos na tela e ~120 chamadas de desenho. Por isso: pessoas com 8–18 mil
triângulos, objetos únicos com poucos mil, e o que se repete centenas de vezes (árvores, pedras, plantas) bem leve.
Texturas: 2048² só no herói; 1024² nas pessoas e no barco; 512² no resto.

## Resumo, em ordem de prioridade

| # | Arquivo | O que é | Triângulos | Textura | Rig |
|---|---|---|---|---|---|
| 1 | `heroi.glb` | Jesus, o jogador (visto sempre de costas). **Recebido sem rig: falta exportar rigado e com animações** (ver `ASSETS.md`) | 18 mil | 2048² + normal | sim |
| 2 | `pescador-simao.glb` | Simão | 12 mil | 1024² | sim |
| 3 | `pescador-andre.glb` | André, irmão de Simão | 12 mil | 1024² | sim |
| 4 | `pescador-tiago.glb` | Tiago, filho de Zebedeu | 12 mil | 1024² | sim |
| 5 | `pescador-joao.glb` | João, irmão de Tiago | 12 mil | 1024² | sim |
| 6 | `barco-galileia.glb` | barco de pesca de Zebedeu | 8 mil | 1024² | não |
| 7 | `zebedeu.glb` | Zebedeu, pai, fica no barco | 10 mil | 1024² | sim |
| 8 | `empregado.glb` | trabalhador do barco (o jogo usa 2 cópias) | 8 mil | 1024² | sim |
| 9 | `rede-lancada.glb` | rede aberta na água, de Simão e André | 1,5 mil | 512² com transparência | não |
| 10 | `rede-amontoada.glb` | rede embolada dentro do barco | 1,5 mil | 512² | não |
| 11 | `casa-basalto-a.glb` | casa de Cafarnaum, 6 × 5 m | 4 mil | 1024² | não |
| 12 | `casa-basalto-b.glb` | casa maior, 8 × 5 m, com pátio murado | 5 mil | 1024² | não |
| 13 | `casa-basalto-c.glb` | casa pequena, 5 × 4 m, escada externa | 3,5 mil | 1024² | não |
| 14 | `oliveira-a.glb` | oliveira antiga | 2,5 mil | 512² | não |
| 15 | `oliveira-b.glb` | oliveira mais nova | 2 mil | 512² | não |
| 16 | `pedras-basalto.glb` | 5 pedras soltas de basalto | 300–800 cada | 512² | não |
| 17 | `muro-pedra.glb` | trecho de muro de pedra seca, 4 m | 1,5 mil | 512² | não |
| 18 | `arbusto-seco.glb` | arbusto baixo | 400 | 512² com transparência | não |
| 19 | `junco.glb` | touceira de junco da beira do lago | 400 | 512² com transparência | não |
| 20 | `arvore-espinhosa.glb` | árvore baixa e espinhosa da região | 2 mil | 512² | não |
| 21 | `objetos-pesca.glb` | cesto de vime, remo, âncora de pedra, poita de corda | 300–800 cada | 512² | não |
| 22 | `objetos-casa.glb` | jarro de barro, pote, pedra de moinho manual, banco | 300–800 cada | 512² | não |
| 23 | `morador-homem-a.glb`, `-b.glb` | moradores de Cafarnaum ao fundo | 8 mil | 1024² | sim |
| 24 | `moradora-mulher-a.glb`, `-b.glb` | moradoras de Cafarnaum ao fundo | 8 mil | 1024² | sim |

Os itens 1–10 completam todo mundo e tudo o que a passagem cita; 11–22 deixam a margem bonita; 23–24 dão vida ao
fundo (o texto de Marcos 1:16–20 não fala de moradores: eles são cenário).

---

## Fichas

### 1. `heroi.glb`: Jesus, o jogador

- **Referência**: a folha de personagem dos reels, `source/ref/personagem.png` (no biblia-conectada, pasta
  `estudos/biblia-grand-testament-adventure/`; fica fora do git, peça ao Alex). Use como imagem de entrada.
- **Prompt (EN)**: `Full body adult man from 1st century Galilee, dark wavy shoulder-length hair, short dark beard, ankle-length off-white wool tunic with a simple rope belt, terracotta-red wool mantle draped over the left shoulder and across the back, brown leather sandals, T-pose, plain neutral face, realistic proportions, game-ready character`
- **Texto (PT)**: homem adulto da Galileia do século I, cabelo escuro ondulado na altura dos ombros, barba curta
  escura, túnica de lã off-white até o tornozelo com cinto de corda, manto de lã terracota sobre o ombro esquerdo e
  pelas costas, sandálias de couro marrom, pose em T.
- **Medidas**: 1,76 m de altura.
- **Orçamento**: 18 mil triângulos; textura 2048² (cor) + normal map.
- **Rig**: humanoide automático. **Animações**: parado (respirando), andando, correndo, chamando (um braço estendido à
  frente, palma aberta, gesto de "vinde"). Se a biblioteca tiver "acenar" ou "apontar", serve para o chamado.
- **Cuidados**: o manto fica **no ombro esquerdo** (nos reels já saiu no direito uma vez). O jogo mostra ele de costas:
  confira o cabelo e o manto por trás.

### 2–5. Os quatro pescadores

Mesmo corpo-base, quatro pessoas diferentes. Prompt-base (EN), trocando só o trecho entre colchetes:

`Full body adult fisherman from 1st century Galilee, [TUNIC], knee-length work tunic, leather belt, barefoot or simple sandals, [HAIR AND BEARD], strong forearms, weathered skin, T-pose, realistic proportions, game-ready character`

| Arquivo | [TUNIC] | [HAIR AND BEARD] | Altura |
|---|---|---|---|
| `pescador-simao.glb` | `dark brown wool` | `dark curly hair, full thick beard` | 1,78 m |
| `pescador-andre.glb` | `sandy beige linen` | `dark straight hair, short beard` | 1,74 m |
| `pescador-tiago.glb` | `faded olive-green wool` | `black hair tied back, full beard` | 1,77 m |
| `pescador-joao.glb` | `reddish-brown wool` | `dark wavy hair, light short beard, younger adult in his twenties` | 1,73 m |

- **Orçamento**: 12 mil triângulos cada; textura 1024².
- **Rig**: humanoide. **Animações**: parado, andando, sentado (2 e 3 precisam também de "lançando rede": dois braços
  jogando algo à frente; 4 e 5 de "sentado mexendo nas mãos", para consertar redes). Se não houver animação de rede,
  entregue sem ela e anote.
- **Cuidados**: os quatro precisam ser **reconhecíveis entre si de longe** pela cor da túnica.

### 6. `barco-galileia.glb`: o barco de Zebedeu

- **Prompt (EN)**: `Ancient wooden fishing boat from the Sea of Galilee, 1st century, open hull without cabin, no sail, no mast, carvel wooden planks, rounded bow and stern, three wooden thwart benches, about 8 meters long and 2.3 meters wide, weathered dark wood, game asset`
- **Texto (PT)**: barco de pesca de madeira, aberto, sem cabine, sem vela e sem mastro, casco de tábuas, proa e popa
  arredondadas, três bancos, cerca de 8 m × 2,3 m, madeira escura gasta.
- **Orçamento**: 8 mil triângulos; textura 1024². Origem no meio do barco, na linha d'água.
- **Cuidados**: **por dentro precisa ser oco** (as pessoas sentam dentro). Sem rede embutida (a rede é o item 10).

### 7. `zebedeu.glb`

- **Prompt (EN)**: `Full body elderly fisherman from 1st century Galilee, grey hair and long grey beard, earth-grey wool tunic, leather belt, simple sandals, T-pose, realistic proportions, game-ready character`
- **Medidas**: 1,70 m. **Orçamento**: 10 mil; 1024².
- **Rig**: humanoide. **Animações**: sentado, sentado mexendo nas mãos (consertando rede).

### 8. `empregado.glb`

- **Prompt (EN)**: `Full body adult laborer from 1st century Galilee, plain beige short tunic to the knee, rope belt, barefoot, short dark hair, clean shaven, T-pose, realistic proportions, game-ready character`
- **Medidas**: 1,72 m. **Orçamento**: 8 mil; 1024².
- **Rig**: humanoide. **Animações**: parado, puxando corda (ou "puxar" da biblioteca), sentado.
- O jogo põe 2 cópias no barco: Marcos 1:20 diz "os empregados", sem número; 2 é escolha nossa.

### 9. `rede-lancada.glb`

- **Prompt (EN)**: `Circular fishing cast net lying flat and open, linen cord mesh, 3.5 meters in diameter, small lead weights along the edge, game asset`
- **Orçamento**: 1,5 mil; 512² **com transparência** nos buracos da malha (se o Tripo não fizer transparência, entregue
  assim mesmo: eu aplico a trama no código).

### 10. `rede-amontoada.glb`

- **Prompt (EN)**: `Heap of tangled fishing net made of linen cord, with a few cork floats and lead weights, about 1.5 meters wide, game asset`
- **Orçamento**: 1,5 mil; 512².

### 11–13. Casas de Cafarnaum

Prompt-base (EN): `Simple 1st century Galilean house built of dark basalt fieldstones, flat roof of wooden beams covered with packed mud and reeds, small wooden door, no glass windows, [VARIATION], game asset`

| Arquivo | [VARIATION] | Tamanho | Triângulos |
|---|---|---|---|
| `casa-basalto-a.glb` | `one room, 6 by 5 meters, 3 meters tall` | 6 × 5 m | 4 mil |
| `casa-basalto-b.glb` | `8 by 5 meters with a small walled courtyard in front` | 8 × 5 m + pátio | 5 mil |
| `casa-basalto-c.glb` | `5 by 4 meters with an outside stone staircase to the roof` | 5 × 4 m | 3,5 mil |

- Textura 1024². **Sem interior** (as portas podem ser fechadas). A base pode descer uns 30 cm abaixo do chão para
  assentar no relevo.

### 14–15. Oliveiras

- **Prompt (EN)**: `Ancient olive tree, thick twisted gnarled trunk, wide silvery grey-green canopy, 5 to 6 meters tall, low poly game asset` (b: `young olive tree, slender trunk, 3.5 meters tall`)
- **Orçamento**: 2,5 mil (a) e 2 mil (b); 512². Elas se repetem centenas de vezes: **não passe do orçamento**.

### 16. `pedras-basalto.glb`

- **Prompt (EN)**: `Set of five separate dark basalt rocks, rough porous surface, sizes from 20 centimeters to 1.2 meters, game assets`
- **Orçamento**: 300–800 triângulos cada; 512². As cinco pedras **separadas** (objetos distintos no mesmo GLB).

### 17. `muro-pedra.glb`

- **Prompt (EN)**: `Dry stone wall segment of stacked dark basalt fieldstones, 4 meters long, 1.2 meters tall, game asset`
- **Orçamento**: 1,5 mil; 512². Pontas limpas para encaixar um trecho no outro.

### 18–20. Plantas

| Arquivo | Prompt (EN) | Tamanho | Triângulos |
|---|---|---|---|
| `arbusto-seco.glb` | `Low dry Mediterranean shrub, small grey-green leaves, game asset` | 1 m | 400 |
| `junco.glb` | `Clump of tall lakeside reeds, green and straw colored, game asset` | 1,4 m | 400 |
| `arvore-espinhosa.glb` | `Small thorny jujube tree (Ziziphus spina-christi), dense twisted branches, small round leaves, game asset` | 4 m | 2 mil |

- Textura 512² com transparência nas folhas, se possível.

### 21. `objetos-pesca.glb`

- **Prompt (EN)**: `Set of 1st century fishing props: woven wicker basket, wooden oar, stone anchor with a hole and rope, coiled rope, separate objects, game assets`
- **Orçamento**: 300–800 cada; 512². Objetos separados no mesmo GLB.

### 22. `objetos-casa.glb`

- **Prompt (EN)**: `Set of 1st century household props: large clay water jar, small clay cooking pot, basalt hand millstone, simple wooden stool, separate objects, game assets`
- **Orçamento**: 300–800 cada; 512².

### 23–24. Moradores de Cafarnaum (fundo)

- **Homens (EN)**: `Full body adult man from 1st century Galilee, plain [COLOR] wool tunic, mantle over the shoulders, sandals, [HAIR], T-pose, game-ready character`
  - `morador-homem-a.glb`: `undyed grey-brown`, `short dark hair and beard`; `morador-homem-b.glb`: `muted blue`, `grey hair and beard, older`.
- **Mulheres (EN)**: `Full body adult woman from 1st century Galilee, long modest [COLOR] wool dress to the ankles, head covering veil over the hair, sandals, T-pose, game-ready character`
  - `moradora-mulher-a.glb`: `ochre`; `moradora-mulher-b.glb`: `deep red`.
- **Orçamento**: 8 mil; 1024². **Rig**: humanoide. **Animações**: parado, andando, carregando um jarro (se houver).
- **Só adultos.**

---

## Checklist de aceite (por arquivo)

- [ ] Nome exatamente como na lista, formato `.glb`, texturas embutidas.
- [ ] Triângulos dentro do orçamento (até 10% acima ainda serve; o dobro, não).
- [ ] Proporção certa: pessoa com a altura da ficha; barco com ~8 m; casa com a planta da ficha.
- [ ] Nada moderno, nenhuma criança, nenhum texto ou logotipo, nenhum halo.
- [ ] Personagem: rig funciona (anda sem o braço atravessar o corpo); animações pedidas presentes ou anotadas como
      faltando.
- [ ] Herói: manto no ombro **esquerdo**; cabelo na altura dos ombros.
- [ ] Barco: oco por dentro, sem vela e sem mastro.

## Uso comercial (conferir antes de publicar)

Não consegui ler os termos do Tripo desta sessão: o site recusou o acesso. As páginas de ajuda deles com os títulos
"Can I use the model for commercial purposes?" e "How to Use Tripo Models Commercially" existem, mas não li o conteúdo,
então **não afirmo** nada sobre o plano Pro. Antes de publicar o jogo, confira nos Termos de Serviço do Tripo, logado
na conta Pro: (1) se o plano pago dá uso comercial e a propriedade dos modelos; (2) se os modelos ficam privados;
(3) se modelos gerados quando a conta estava no plano grátis entram nisso.

O Codex leu os termos (https://www.tripo3d.ai/terms) e a ajuda
(https://www.tripo3d.ai/help/privacy-policy/can-i-use-models-commercially): segundo ele, a ajuda confirma uso comercial
em plano pago, condicionado aos direitos sobre o que se usa como entrada. Isso não garante exclusividade nem direito
autoral sobre a saída da IA. Eu não li essas páginas.

As malhas são do Alex: entram no repositório próprio do jogo, nunca no biblia-conectada (que só aceita fontes livres),
e não ficam sob a licença MIT do código.
