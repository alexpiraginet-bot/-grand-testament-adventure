# Interações e encontros — proposta de primeira fatia

13/11/2026 · Pedido de Alex · **Plano, não funcionalidade entregue.**
Objetivo: explorar, conversar, cuidar de animais e ajudar pessoas, com mudanças
perceptíveis na vida cotidiana. Jesus é o agente dessa ajuda; esta primeira
fatia não inclui um botão genérico de milagre. Milagres pertencem a episódios definidos por suas
passagens e revisão editorial, sem poderes livres inferidos desta proposta.

## Ponto de partida e compatibilidade

**Existe na base R10:** caminhada/câmera; ação E ou botão de toque;
`Input.takeAction()` consumível uma vez; três missões em `missions.ts`;
orientação em `journey.ts`; save v1 em `save.ts`; galinha e burro próprios,
animados e carregados opcionalmente. `FaunaPopulation.update()` seleciona
agentes por setores, `stepFauna()` os movimenta e `FaunaScene.sync/update()`
controla clones/animação. A fauna hoje não bloqueia o jogador. Não existe
sistema geral de pegar objetos, montar, carregar animais ou conversar.

Os NPCs geométricos foram retirados. Seis candidatos humanos aguardam rig;
nenhum entra como estátua em A-pose. O herói possui `walk`, não animações
aprovadas de pegar, carregar ou montar. Burro possui caminhada/idle; galinha
possui caminhada e pose parada. Esses fatos limitam a primeira implementação.

**Trabalho de Claude consultado no commit `7c02464`:** preservar
`freeroam.ts`, `places.ts`, `bible.ts/bibleui.ts`, jornada e painel. A Bíblia
revela orientação; chegar ao lugar sem lê-la continua permitindo agir. Não
substituir a cronologia, epílogo, descoberta de lugares, progresso ou painel.
Os encontros serão uma camada lateral, sem reescrever a missão bíblica.
Conciliar `main.ts`/HUD com essa branch antes da integração; esta nota não
afirma que todos esses módulos já estão na base R10.

## Primeira história completa: “Uma rede fora do lugar”

**Conteúdo autoral proposto, não episódio bíblico nem evento histórico.**
Um pescador adulto precisa levar uma rede recolhida a um ponto seco do cais.
Jesus pode ajudar, seguir viagem ou voltar depois. O pedido não bloqueia a
rua, a missão principal ou o acesso à Bíblia. Duração de projeto: 2–3 minutos,
a medir; não promessa de tempo de produção.

Um único pátio seco junto à margem, fora das rotas obrigatórias. Escolher e
validar seus apoios no terreno real antes de fixar coordenadas. Usar um adulto
com malha/rig/gestos aprovados; avaliar reaproveitar o candidato `empregado`,
sem tratá-lo como pronto. A `rede-amontoada` existente é candidata a objeto
manipulável, sujeita a revisão de tamanho e encaixe nas mãos. Não simular pano
nem inventar uma malha provisória para liberar a interação.

| Estado proposto | Entrada e resposta observável |
| --- | --- |
| Disponível | Adulto e rede visíveis; uma fala ambiente curta ao aproximar-se. Pode ignorar. |
| Conversando | E/“Conversar”; adulto orienta corpo/olhar ao herói. “Posso ajudar” aceita; “Agora não” encerra. |
| Aceito | Marca discreta no objeto e no apoio de destino; instrução “Levar a rede ao ponto seco”. |
| Pegando | E/“Pegar rede”; conferir alcance/espaço, animar agachar e agarrar. Objeto só muda de dono no evento de contato. |
| Carregando | Rede presa ao encaixe de mãos, caminhada própria mais lenta; direção/câmera continuam livres. |
| Colocando | E/“Deixar a rede” somente no apoio válido; animar baixar e soltar. |
| Resolvido | Rede permanece no destino, pescador muda para cuidar dela e agradece. O registro do encontro persiste. |

Exemplos editoriais: pescador — “Esta rede ficou no caminho. Pode me ajudar
a levá-la até ali?”; depois — “Obrigado. Agora consigo preparar o trabalho.”
Ambos com **Narrativa do jogo** durante a fala. A resposta “Posso ajudar” é
uma escolha autoral do jogo; não apresentá-la como citação de Jesus. Não
incluir uma fala bíblica decorativa ou inventada. Citação futura exige texto
literal BLIVRE e referência verificável, com sua etiqueta própria.

A consequência é o objeto recolocado e a rotina retomada, não pontos de
santidade ou promessa de cura. A primeira fatia termina nessa mudança e na
persistência; não acrescentar uma cadeia de favores, economia ou reputação.

## Um comando contextual, sem disputar o E

Propor `interactions.ts` com alvos de ID estável, ações, âncora, alcance e
pré-condições; `encounters.ts` com estados/eventos puros; adaptadores de
animação/mundo separados. Não iniciar SDK, motor de física ou IA de diálogo.

`main.ts` deve ler `takeAction()` **uma vez por frame** e despachar para um
único destino. Ordem: ação em curso/soltar com segurança; alvo focado
explicitamente; ação da missão principal; conversa opcional. Entre alvos
concorrentes, o rótulo visível define quem recebe o comando. Trocar o foco
deve ser possível por teclado e toque, sem menu radial obrigatório.

Parâmetros iniciais para teste: ações a até 1,5 m da âncora; conversa a 2,5 m;
linha de visão livre; diferença de altura compatível com o gesto. São valores
propostos, não medidas dos GLBs. Revalidar quando a animação começa e no
contato. Nada de pegar através de parede, água profunda ou por trás do alvo.
Ao falhar, manter estado e explicar com instrução curta, sem teleporte.

Legenda e fala não prendem a exploração. Conversa opcional pode ser
dispensada/encerrada; abrir Bíblia/mapa/painel pausa ação, animação e relógio
como no jogo. Uma animação corporal curta pode controlar a locomoção durante
o gesto; não exigir esperar o tempo de leitura. Dois toques ou E repetido
não duplicam transação. Ação não aparece se malha/clip necessário não carregou.

Falas espontâneas usam textos autorais curados, não geração paga em runtime:
no máximo uma fala próxima por vez, sem sobrepor a Escritura; proposta de
intervalo mínimo 45 s entre falas ambientes e não repetir a mesma linha na
mesma visita. Sem conversa audível de ator ausente. Legendas funcionam com
som desligado; sons precisam de fonte/licença e revisão próprias.

## Animais: capacidades diferentes, próximas entregas

| Interação desejada | Dependências antes de habilitar |
| --- | --- |
| Acariciar o burro | Clip e encaixe de mão do herói, resposta/idle do animal, orientação e aproximação válidas. |
| Pegar e devolver a galinha | Agachar/pegar, suporte com duas mãos, pose confortável da ave, carregar/soltar; sem prender por asa/pescoço. Apoio seco livre para devolução. |
| Montar e desmontar o burro | Animações sincronizadas dos dois atores, encaixe do assento e pernas, controles montados, corpo/câmera com colisão, limites de declive/água e saída lateral realmente livre. |

Não basta prender o herói parado ao dorso. O burro ambiente atual é não
colisivo e lento; montar exige controlador próprio, não aumentar `speed`.
Manter pelo menos uma saída segura; sem saída, não desmontar dentro de muro
nem teleportar. Cada ação depende de aprovação visual dos clips nos rigs
atuais. Os modelos existentes não comprovam essas capacidades.

Introduzir uma reserva por ID com modos `ambient`, `interacting`, `carried`,
`ridden`, `releasing`: apenas um sistema escreve transformação/mixer por
vez. Um animal reservado sai do passo ambiente, sem duplicar clone. Reservar
uma vaga do teto atual (24 mobile/48 desktop) e impedir sua remoção pelo
streaming durante a ação. Ao liberar, validar corpo inteiro, terreno e
ocupação; depois devolver à população. Não alterar o array de agentes com
`splice`, nem usar `visibleApprovedAgents()` como prova de linha de visão:
esse método só garante modelo aprovado e visibilidade por distância.

## Persistência e entrega incremental

Primeiro adicionar um registro **local e versionado**, ligado ao `save.id`,
por exemplo `gta:world-state:v1:<saveId>`. Não modificar silenciosamente o
save v1 compartilhado com Claude. Campos mínimos propostos: `v`, `saveId`,
`contentRevision` e encontros por ID com etapa estável (`accepted`,
`returned`, `completed`) e data. Estado visual deriva desses fatos; IDs de
conclusão são únicos/idempotentes. Validar tamanho, campos e versão; manter
cópia anterior e não sobrescrever versão futura.

Salvar no aceite, ao concluir a colocação e ao resolver. Não gravar ossos,
timers, ponteiros ou poses intermediárias. Reabrir durante o transporte
restaura o último apoio estável registrado e o objetivo aceito, sem item
duplicado ou perda da conclusão. Durante a sessão, cancelar antes do
contato não move nada; depois de pegar, só liberar com gesto em apoio válido.
Caso o armazenamento falhe, avisar que o encontro vale apenas nesta sessão.
Essa extensão começa **local**; sincronização entre aparelhos só poderá ser
anunciada após adaptador/merge testados, conciliados com o save/nuvem do projeto.

Ordem de execução: (1) conciliar jornada de Claude e contratos de ação/save;
(2) aprovar um adulto, rede e animações mínimas; (3) implementar seleção,
reserva e estados puros; (4) fechar o único encontro com consequência/save;
(5) testar galinha; (6) montar burro. Não liberar botões para etapas ausentes.

## Critérios para liberar a primeira fatia

- Percurso inteiro com E real e com toque, sem teleporte; ignorar e retomar
  o encontro; agir sem abrir a Bíblia; missão e exploração principal preservadas.
- Contato de mãos/rede e pés/solo em vários frames, sem objeto atravessando
  corpo ou mudança instantânea de pose. Ator final aprovado; zero humano
  procedural/A-pose, colisor ou áudio de ator ausente.
- Testes de repetição/cancelamento, alvo atrás de muro, pausa/aba oculta,
  falha de asset, troca de setor e retomada de save em cada etapa estável.
- Reload após entrega mantém rede no destino e rotina concluída uma vez;
  save futuro/corrompido, armazenamento negado e migração preservam os dados.
- Revisão editorial distingue todas as falas autorais das citações literais;
  nenhum efeito de leitura obrigatório, milagre genérico ou texto inventado
  com referência bíblica.
- Medir build/bytes, frames e memória no mesmo cenário PC/mobile; testar
  Safari físico antes de prometer estabilidade no iPhone. Registrar baseline,
  candidato, vídeo curto real e limites no diário, sem substituir por conceito.

Fontes inspecionadas: `src/input.ts`, `missions.ts`, `journey.ts`, `save.ts`,
`fauna-simulation.ts`, `fauna-population.ts`, `fauna-renderer.ts`, manifesto
de fauna e catálogo Tripo; `docs/NARRATIVA.md`; arquivos/histórico da branch
de Claude em `7c02464`. Nenhuma implementação, geração, compra ou publicação
foi feita por este documento.
