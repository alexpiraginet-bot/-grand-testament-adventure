# Jornada R16 — as vinte missões (tabela gerada)

> Gerado por `tools/build_story_table.mjs` a partir do código e dos dados que o jogo roda. Não editar à mão:
> `node tools/build_story_table.mjs` refaz, `--check` confere, e `test/story-table.test.ts` falha se este arquivo ficar para trás.

Texto: Bíblia Livre (BLIVRE), CC BY 4.0 BR (colchetes da BLIVRE retirados; as palavras ficam). Passagens: Marcos 1:30–42; Marcos 2:1–5; Marcos 2:11–17; Marcos 3:7; Marcos 3:9; Marcos 3:13–14; Marcos 3:16–19; Marcos 4:1; Marcos 4:35.
Origem: `biblia-conectada, fontes/blivre/porbr2018_vpl.zip`, SHA-256 `99b62593c3cc6387bbd4aa6aff11103a5c3f5bda87d6257155bdb6576e3e1231`, commit `f0dce71971e0597482f4ba7cb852fb91e2bf531c`.

Cada linha é uma missão: um lugar a alcançar no terreno real e, quando a passagem lhe dá algo a fazer, uma ação com o
botão. O que aparece na tela como citação é a coluna **Na tela**: orações recortadas do versículo, ao pé da letra, cada
uma com a sua referência ("Bíblia Livre · referência"). **Objetivo** e **Ação** são orientação do jogo, não texto bíblico.
Nenhuma fala foi escrita para personagem algum. Nenhuma pessoa destas passagens está desenhada (só Simão tem modelo
revisado): onde a coluna **Pessoas** diz "sim", o aviso "Cena em desenvolvimento · personagens em preparação." aparece.

| # | id (registro do mundo) | Passagem | Objetivo | Ação | Na tela (literal) | Lugar · trecho em linha reta | Pessoas | Revisão editorial pedida |
|---|---|---|---|---|---|---|---|---|
| 1 | `mc-1-30-sogra-de-simao` | Marcos 1:30–31 | Vá à porta da casa de Simão e de André | **Aproximar-se** — Aproxime-se da sogra de Simão | “A sogra de Simão estava deitada com febre” (Marcos 1:30)<br>“Então ele aproximou-se dela, tomou-a pela mão, e a levantou; logo a febre a deixou, e ela começou a servi-los.” (Marcos 1:31) | `casa` · 0 m | sim | cura ou expulsão narrada só com o texto |
| 2 | `mc-1-32-ao-entardecer` | Marcos 1:32–34 | Ao entardecer, saia à rua diante da casa | chegar ao lugar | “Ao entardecer, quando o sol já se punha, trouxeram-lhe todos os doentes e endemoninhados” (Marcos 1:32)<br>“e toda a cidade se juntou à porta.” (Marcos 1:33)<br>“Ele curou muitos que se achavam mal de diversas enfermidades, e expulsou muitos demônios.” (Marcos 1:34) | `rua-da-casa` · 21 m | sim | cura ou expulsão narrada só com o texto |
| 3 | `mc-1-35-lugar-deserto` | Marcos 1:35 | De madrugada, vá a um lugar deserto | **Orar** — Fique ali em oração | “De madrugada, ainda escuro, ele se levantou para sair, foi a um lugar deserto, e ali esteve a orar.” (Marcos 1:35) | `lugar-deserto` · 85 m | não | — |
| 4 | `mc-1-36-todos-te-procuram` | Marcos 1:36–37 | Vá ao encontro dos que o seguiram | chegar ao lugar | “Simão e os que estavam com ele o seguiram.” (Marcos 1:36)<br>“Quando o acharam, disseram-lhe: Todos estão te procurando.” (Marcos 1:37) | `encontro` · 30 m | sim | — |
| 5 | `mc-1-38-aldeias-vizinhas` | Marcos 1:38 | Volte para junto dos que o acharam | **Responder** — Responda aos que o procuravam | “Vamos para as aldeias vizinhas, para que eu também pregue ali, pois vim para isso.” (Marcos 1:38) | `encontro` · 0 m | sim | — |
| 6 | `mc-1-39-por-toda-a-galileia` | Marcos 1:39 | Siga para as aldeias vizinhas | chegar ao lugar | “Ele pregava em suas sinagogas por toda a Galileia, e expulsava os demônios.” (Marcos 1:39) | `caminho-das-aldeias` · 150 m | sim | cura ou expulsão narrada só com o texto |
| 7 | `mc-1-40-leproso` | Marcos 1:40–42 | Siga pelo caminho de volta | **Estender a mão** — Estenda a mão ao leproso que se ajoelha | “Um leproso aproximou-se dele, rogando-lhe, pondo-se de joelhos diante dele, e dizendo-lhe: Se quiseres, tu podes limpar-me.” (Marcos 1:40)<br>“movido de compaixão, estendeu a mão, tocou-o, e disse-lhe: Quero; sê limpo.” (Marcos 1:41)<br>“Quando disse isso, logo a lepra saiu dele, e ficou limpo.” (Marcos 1:42) | `caminho` · 60 m | sim | cura ou expulsão narrada só com o texto |
| 8 | `mc-2-1-outra-vez-em-cafarnaum` | Marcos 2:1 | Entre outra vez em Cafarnaum e volte à casa | chegar ao lugar | “Dias depois, Jesus entrou outra vez em Cafarnaum, e ouviu-se que estava em casa.” (Marcos 2:1) | `casa` · 140 m | não | — |
| 9 | `mc-2-2-falava-a-palavra` | Marcos 2:2 | Volte à casa | **Falar a palavra** — Fale a palavra aos que se juntaram | “Logo juntaram-se tantos, que nem mesmo perto da porta cabiam; e ele lhes falava a palavra.” (Marcos 2:2) | `casa` · 0 m | sim | — |
| 10 | `mc-2-3-paralitico` | Marcos 2:3–5, 11–12 | Volte à casa | **Falar ao paralítico** — Fale ao paralítico que baixaram pelo telhado | “E vieram a ele uns que traziam um paralítico carregado por quatro.” (Marcos 2:3)<br>“Como não podiam se aproximar dele por causa da multidão, descobriram o telhado onde ele estava, fizeram um buraco, e baixaram por ele o leito em que jazia o paralítico.” (Marcos 2:4)<br>“Quando Jesus viu a fé deles, disse ao paralítico: Filho, os teus pecados te são perdoados.” (Marcos 2:5)<br>“A ti eu digo: levanta-te, toma o teu leito, e vai para a tua casa.” (Marcos 2:11)<br>“E logo ele se levantou, tomou o leito, e saiu na presença de todos, de tal maneira, que todos ficaram admirados, e glorificaram a Deus, dizendo: Nunca vimos algo assim.” (Marcos 2:12) | `casa` · 0 m | sim | cura ou expulsão narrada só com o texto |
| 11 | `mc-2-13-junto-ao-mar` | Marcos 2:13 | Saia outra vez para o mar | **Ensinar** — Ensine a multidão junto ao mar | “Jesus voltou a sair para o mar; toda a multidão veio até ele, e ele os ensinava.” (Marcos 2:13) | `praia` · 93 m | sim | — |
| 12 | `mc-2-14-levi` | Marcos 2:14 | Passe pelo posto de coleta de impostos | **Chamar** — Chame Levi | “E enquanto passava, ele viu Levi, filho de Alfeu, sentado no posto de coleta de impostos, e disse-lhe: Segue-me.” (Marcos 2:14)<br>“Então Levi se levantou e o seguiu.” (Marcos 2:14) | `posto` · 73 m | sim | — |
| 13 | `mc-2-15-a-mesa` | Marcos 2:15 | Vá à casa de Levi | chegar ao lugar | “E aconteceu que enquanto estava sentado à mesa na casa dele, muitos publicanos e pecadores também estavam assentados à mesa com Jesus e os seus discípulos” (Marcos 2:15) | `casa-de-levi` · 65 m | sim | — |
| 14 | `mc-2-16-os-que-estao-doentes` | Marcos 2:16–17 | Volte à casa de Levi | **Responder** — Responda aos escribas e fariseus | “Quando os escribas e os fariseus o viram comer com os publicanos e pecadores, disseram a seus discípulos: Por que é que ele come e bebe com os publicanos e os pecadores?” (Marcos 2:16)<br>“Os que têm saúde não precisam de médico, mas sim os que estão doentes. Eu não vim para chamar os justos, mas sim, os pecadores, ao arrependimento.” (Marcos 2:17) | `casa-de-levi` · 0 m | sim | controvérsia narrada só com o texto |
| 15 | `mc-3-7-para-o-mar` | Marcos 3:7 | Retire-se com os discípulos para o mar | chegar ao lugar | “E Jesus retirou-se com os seus discípulos para o mar” (Marcos 3:7) | `redes` · 221 m | sim | — |
| 16 | `mc-3-9-barquinho` | Marcos 3:9 | Vá até o barco | **Pedir o barquinho** — Peça que um barquinho fique por perto | “E disse aos seus discípulos que um barquinho ficasse continuamente perto dele, por causa das multidões; para que não o apertassem.” (Marcos 3:9) | `barco` · 191 m | sim | — |
| 17 | `mc-3-13-subiu-ao-monte` | Marcos 3:13 | Suba ao monte | chegar ao lugar | “Ele subiu ao monte” (Marcos 3:13) | `monte` · 482 m | não | — |
| 18 | `mc-3-13-os-doze` | Marcos 3:13–14, 16–19 | Volte ao alto do monte | **Chamar** — Chame os doze | “e chamou para si os que quis; então vieram a ele.” (Marcos 3:13)<br>“E constituiu doze para que estivessem com ele, para enviá-los a pregar” (Marcos 3:14)<br>“Eram eles: Simão, a quem pôs por nome Pedro” (Marcos 3:16)<br>“Tiago filho de Zebedeu, e João, irmão de Tiago; e pôs-lhes por nome Boanerges, que significa “filhos do trovão”” (Marcos 3:17)<br>“e André, Filipe, Bartolomeu, Mateus, Tomé; Tiago filho de Alfeu; Tadeu; Simão o zelote;” (Marcos 3:18)<br>“e Judas Iscariotes, o que o traiu.” (Marcos 3:19) | `monte` · 0 m | sim | — |
| 19 | `mc-4-1-junto-ao-mar` | Marcos 4:1 | Volte à margem, junto ao barco | **Ensinar** — Ensine outra vez junto ao mar | “Jesus começou outra vez a ensinar junto ao mar, e uma grande multidão se ajuntou a ele, de maneira que ele entrou num barco e ficou sentado no mar” (Marcos 4:1) | `barco` · 482 m | sim | — |
| 20 | `mc-4-35-o-outro-lado` | Marcos 4:35 | Ao entardecer, volte ao barco | **Falar aos discípulos** — Fale aos discípulos | “Naquele dia, chegando o entardecer, disse-lhes: Passemos para o outro lado.” (Marcos 4:35) | `barco` · 0 m | sim | — |

Totais calculados: 20 missões, 13 com ação e 7 vividas ao chegar; 37 orações na tela, 265 s de leitura ao todo;
2092 m em linha reta entre os lugares, na ordem (o caminho real contorna casas e é mais longo). O herói anda a 2,5 m/s e corre a 5,2 m/s (`src/main.ts`).
Uma missão é oferecida a 7 m do seu lugar. Numa missão com ação, quem se afasta mais de 13 m com as orações na tela as interrompe, sem nada salvo; numa missão vivida ao chegar, as orações vão até o fim.
Lugares de missões consecutivas ficam a pelo menos 21 m um do outro.

## Lugares

Todos são **posição escolhida pelo jogo** no seu terreno com direção de arte: nenhuma fonte os situa aqui e nenhum é
apresentado como o local histórico. Coordenadas em metros no mapa do jogo (x para leste, z para sul; altura acima do lago),
calculadas por `src/story-places.ts`; iguais para o chão de 256 e de 192 segmentos. Cada lugar fica a pelo menos 80 m do limite da região.

| Lugar | Regra | x | z | altura |
|---|---|---|---|---|
| `casa` | porta da casa escolhida pelo jogo para Marcos 1:29 | -10,3 | 242,3 | 1,7 |
| `rua-da-casa` | rua diante da casa, na viela da missão | -5,9 | 262,9 | 1,3 |
| `lugar-deserto` | chão aberto mais próximo da casa sem construção a menos de 60 m | -90,0 | 252,0 | 1,7 |
| `encontro` | 30 m de volta, na direção da casa | -60,2 | 248,4 | 1,6 |
| `caminho-das-aldeias` | chão aberto 120 m mais longe da casa que o lugar deserto | -210,0 | 258,0 | 2,2 |
| `caminho` | 60 m de volta, na direção da vila | -150,2 | 253,3 | 2,2 |
| `praia` | praia onde a viela chega ao lago (ponto do primeiro episódio) | -12,0 | 335,0 | 0,0 |
| `posto` | chão seco ao lado do caminho da margem, 70 m depois da praia | -84,0 | 324,0 | 0,3 |
| `casa-de-levi` | porta de outra casa, a mais próxima do posto | -20,6 | 311,1 | 0,5 |
| `redes` | onde estão as redes (ponto do primeiro episódio) | -204,5 | 433,8 | 0,0 |
| `barco` | margem junto ao barco (ponto do primeiro episódio) | -368,0 | 533,4 | 0,0 |
| `monte` | o chão mais próximo do barco que sobe 15 m acima do lago | -414,0 | 54,0 | 15,0 |
