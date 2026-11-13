# Lago e margem — amostra R13

13/11/2026, Codex. O lago ganhou um material próprio em `lake-surface.ts`,
mantendo o nível y=0 e a geografia existente. É tratamento artístico de água;
não simulação hidrodinâmica, levantamento histórico, ray tracing ou DLSS.

## Implementação e custo

- Normais direcionais periódicas em dois tamanhos, com direções cruzadas.
  Textura de 256×256 gerada deterministicamente; não há download adicional.
- Cor/visibilidade variam com a profundidade obtida do relevo existente.
  Água rasa permite ver o fundo; a região profunda fica mais azul. A borda
  tem uma variação suave de cor, sem uma faixa branca contínua de espuma.
- Malha mais densa somente ao redor da praia e dos encontros: espaçamento de
  3 m no desktop e 6 m no móvel, ondulação máxima de 4,5 cm. O deslocamento
  termina antes da borda densa, evitando interpolação sobre triângulos enormes.
- Reflexo planar opcional no desktop, a 25% das dimensões da viewport,
  mipmaps e intensidade contida. WebGL2 móvel/perfil baixo não cria esse alvo.
  Uma reflexão exige desenhar novamente parte da cena; não é efeito gratuito.
- Relógio acompanha o jogo e a pausa. A inicialização possui descarte de malha,
  mapas e refletor, inclusive ao cancelar ou falhar depois de criá-los.

O refletor usa a API instalada do Three 0.186.1:
[ReflectorNode](https://threejs.org/docs/pages/ReflectorNode.html), com
[WaterMesh](https://threejs.org/docs/pages/WaterMesh.html) como referência de
uso. Não houve atualização de dependências nem cópia de um jogo proprietário.

`shore-detail-r13.ts` reutiliza a malha de basalto de Alex em pequenos grupos
baixos próximos de praia/Simão. Tem um batch, nenhum mapa novo e nenhuma sombra
projetada; preserva os corredores. São até 90 grupos no desktop e 40 no móvel.
São enfeites baixos sem colisores, não uma nova forma de costa. O grupo guarda
sua contagem em `userData.shoreDetails`, mas a API pública de QA ainda não a
expõe; não atribuir o antigo contador `rocks` a essas pedras extras. O teto é
306.180 triângulos no desktop e 136.080 no móvel, reutilizando a mesma geometria.
Instâncias e triângulos sozinhos não medem trabalho GPU. O grupo herda a limpeza
do renderer na recarga, sem um disposer específico de geometria em abort.

## Revisões e limites observados

A primeira versão técnica passou suas verificações, mas foi rejeitada na
inspeção: refletia demais, ficou cinza e mostrava faixas longas. Mantivemos as
capturas em `shots/r13-water-wip-r1`. A revisão reduziu a contribuição do reflexo,
adicionou mipmaps e cruzou a ondulação mais fina. `r13-integrated-wip-r1` registra
o resultado seguinte, nas mesmas posições/câmeras da baseline.

Ainda há repetição na água, uma margem excessivamente reta e relevo distante
simples. A grade regional não oferece detalhe de centímetros; esta revisão não
altera suas alturas nem cria peixes. A autoria de uma costa local irregular,
rochas maiores com colisão e vegetação melhor pertence ao próximo passe.

`test/lake-surface.test.ts` cobre normais normalizadas/determinísticas, limites
de geometria e ondas, relógio e ausência de reflexão móvel. A verificação visual
integrada e as medições ficam em `QA-CAFARNAUM-R13.md`. Teste de viewport móvel
no PC não comprova estabilidade ou desempenho no iPhone físico.
