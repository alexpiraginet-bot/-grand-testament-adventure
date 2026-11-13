# Postura do herói R6

Pedido de Alex: dar a Jesus uma postura de comando durante o chamado. Direção:
presença serena, peito aberto, cabeça nivelada e um convite firme com a mão
direita. O gesto é direção artística do jogo, não uma descrição literal da passagem.

## Implementação

`src/hero-posture.ts` aplica rotações limitadas sobre oito ossos identificados no
GLB real do herói. O AnimationMixer continua responsável pelo clipe `walk`; a
camada de postura restaura sua base a cada quadro para não acumular rotação.
Hierarquia, skin, pesos, translações, GLB original e clipe recebido são preservados.

A postura de repouso corrige discretamente tórax, ombros, pescoço e cabeça. O
convite usa o braço direito, preservando o braço junto ao manto. Entra e sai por
interpolação e se desfaz ao caminhar. Menus pausam a animação junto do jogo.

O convite aparece na fala direta de **Marcos 1:17**, ainda literal da Bíblia Livre.
Marcos 1:20 é narração: o mesmo gesto de fala não é aplicado nesse trecho.
Quando parado durante a fala, o herói se orienta suavemente para os chamados.
Os discípulos escutam no lugar, olhando para Jesus, antes de começar a segui-lo.
Quem está no barco permanece no convés durante a fala. O desembarque posterior
ainda precisa de uma encenação própria, conforme a auditoria de jogabilidade.

Esta é uma camada procedural criada em código, não uma nova animação exportada
do Tripo. Não houve geração paga, alteração de malha ou reexportação do modelo.

## Verificação

O teste CPU carrega o esqueleto e a geometria reais sem imagens, confere a
hierarquia, a altura/direção da mão, estabilidade da pose, retorno ao repouso,
supressão ao caminhar, pausa e imutabilidade dos clipes. Isso não comprova pixels.

`tools/check_hero_gesture.mjs` usa o GLB completo no navegador, posiciona o
personagem nos locais por debug e aciona a missão com E. Captura frente, lado e
câmera de gameplay; verifica o gesto, os ouvintes parados, a pausa e a exclusão
da narração. Esse teste de pose não se apresenta como percurso contínuo.
As evidências ficam no acervo privado `shots/r6-gesture` e na cópia da publicação.
Datas, SHA e limites dos testes finais estão no diário de desenvolvimento.
