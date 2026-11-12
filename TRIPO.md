# Malhas para gerar no Tripo (site ou app, conta Pro)

Ordem = prioridade: a de cima é a que mais muda o jogo. Enquanto uma malha não chega, o jogo usa a forma provisória
que já está no código (`src/people.ts`, `src/world.ts`), e nada para.

**Regras para todas**
- Formato **GLB**, uma malha por arquivo, nome exatamente como na lista.
- Escala em **metros**, origem no chão (no meio dos pés, ou no meio da base), em pé no eixo Y.
- Textura de cor (base color) embutida no GLB. Se o Tripo oferecer, **normal map** também; nada de 4K.
- No Tripo, depois de gerar: **retopologia / low poly** até o orçamento abaixo (contagem em triângulos).
- Personagens: **adultos do século I**, sem nada moderno (sem zíper, botão, tênis, óculos), sem texto nem logotipo.
  Nenhuma criança. Deus não aparece como personagem.
- Mande para mim os GLB (pode anexar na conversa); eu confiro tamanho, triângulos e escala no código antes de usar.

**Orçamento do celular (a cena inteira)**: até ~400 mil triângulos na tela e ~120 chamadas de desenho. Por isso as
pessoas ficam em 10–18 mil triângulos e as árvores/pedras, que se repetem centenas de vezes, ficam bem leves.

| # | Arquivo | O que pedir no Tripo | Triângulos | Textura | Rig e animações |
|---|---|---|---|---|---|
| 1 | `heroi.glb` | **Imagem**: a folha de personagem dos reels (`source/ref/personagem.png` do biblia-conectada). **Texto**: "homem adulto do século I, cabelo escuro ondulado na altura dos ombros, barba curta, túnica de lã off-white até o tornozelo com cinto de corda, manto terracota sobre o ombro esquerdo, sandálias de couro, pose em T, corpo inteiro". Altura 1,76 m | 18 mil | 2048² cor + normal | **Sim**: rig humanoide automático do Tripo + animações **parado, andando, correndo, chamando (braço estendido)** |
| 2 | `pescador-simao.glb` | "pescador adulto da Galileia do século I, túnica curta marrom-escura até o joelho, cinto de couro, pés descalços, barba cheia, braços fortes, pose em T". 1,78 m | 12 mil | 1024² | **Sim**: parado, andando, **lançando rede** (se houver), sentado |
| 3 | `pescador-andre.glb` | igual ao 2, túnica bege-escura, barba mais curta. 1,74 m | 12 mil | 1024² | igual ao 2 |
| 4 | `pescador-tiago.glb` | igual ao 2, túnica verde-oliva desbotada. 1,77 m | 12 mil | 1024² | parado, andando, **sentado consertando rede** |
| 5 | `pescador-joao.glb` | igual ao 2, túnica marrom-avermelhada, mais jovem (adulto). 1,73 m | 12 mil | 1024² | igual ao 4 |
| 6 | `barco-galileia.glb` | **Texto**: "barco de pesca de madeira do mar da Galileia, século I, aberto, sem cabine, sem vela, casco de tábuas, 8 m de comprimento e 2,3 m de largura, bancos de madeira, rede amontoada na popa". Origem no centro, na linha d'água | 8 mil | 1024² | Não |
| 7 | `zebedeu.glb` | "pescador idoso do século I, cabelo e barba grisalhos, túnica cinza-terra, sentado". 1,70 m | 10 mil | 1024² | Sim: sentado, consertando rede |
| 8 | `empregado.glb` | "trabalhador adulto do século I, túnica curta bege, sem barba". 1,72 m (o jogo usa a mesma malha 2 vezes) | 8 mil | 1024² | Sim: parado, puxando corda |
| 9 | `casa-basalto-a.glb`, `-b`, `-c` | "casa de pedra basalto escura de Cafarnaum do século I, um cômodo, telhado plano de vigas e barro, porta de madeira, sem janela de vidro". a: 6×5 m; b: 8×5 m; c: 5×4 m com escada externa para o telhado | 3–5 mil cada | 1024² | Não |
| 10 | `oliveira-a.glb`, `oliveira-b.glb` | "oliveira antiga, tronco retorcido, copa cinza-esverdeada". 5–6 m de altura | **2,5 mil** (repete centenas de vezes) | 512² | Não |
| 11 | `rede-lancada.glb` | "rede de pesca de fio de linho aberta em círculo, 3,5 m de diâmetro, plana, com pesos de chumbo na borda" | 1,5 mil | 512² com transparência | Não |
| 12 | `pedras-basalto.glb` | "conjunto de 5 pedras de basalto escuro, tamanhos de 20 cm a 1,2 m", separadas | 300–800 cada | 512² | Não |
| 13 | `arbusto.glb`, `junco.glb` | "arbusto seco do Oriente Médio, 1 m"; "touceira de junco da beira do lago, 1,4 m" | 400 cada | 512² com transparência | Não |

Depois da lista 1–8, o jogo já tem todo mundo da passagem com a cara final; 9–13 deixam a margem bonita.

**Uso comercial**: não consegui ler os termos do Tripo daqui (o site recusou o acesso desta sessão). As páginas de
ajuda deles com os títulos "Can I use the model for commercial purposes?" e "How to Use Tripo Models Commercially"
existem, mas não li o conteúdo, então **não afirmo** nada sobre o plano Pro. Antes de publicar o jogo, confira nos
Termos de Serviço do Tripo, logado na conta Pro: (1) se o plano pago dá uso comercial e a propriedade dos modelos,
(2) se os modelos ficam privados, (3) se os modelos gerados quando a conta estava no plano grátis entram nisso.
