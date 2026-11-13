# R13 — Uma demonstração que sustente a ambição do jogo

Data: 13/11/2026. Responsável: Codex, com três revisões independentes.
Base auditada: árvore da main `9dcd6cc08e60eda562575813d07b6eba34d81d08`.
Estado: proposta de produção e diagnóstico de código. Nenhuma migração,
compra, geração paga, alteração de runtime ou teste comparativo de engine
foi realizado nesta revisão.

## Decisão proposta

Manter o objetivo de um mundo aberto dos Evangelhos. O próximo marco deve ser
uma demonstração curta que as pessoas queiram jogar e compartilhar: uma rua
estreita de Cafarnaum, um pátio de trabalho e a margem do lago, com uma interação
que produza consequência visível. Concentrar a produção nessa área antes de
ampliar a quantidade de casas, quilômetros, personagens ou missões.

Preservar o jogo público enquanto produzimos essa área separadamente. A base
Three atual é a referência inicial. PlayCanvas é o primeiro candidato a uma
comparação isolada se suas ferramentas reduzirem o trabalho de autoria; Babylon
continua como alternativa documentada. Não iniciar duas reescritas concorrentes.

Não há evidência de que atingimos o teto visual do navegador ou do Three.
Também não há evidência de que trocar o nome da engine resolveria a cena atual.
O critério novo inclui imagem em movimento, qualidade de conteúdo, tempo de
produção e interesse de jogadores, além de estabilidade e desempenho.

## Por que um mod pode começar tão à frente

Um mod aproveita partes de um jogo já produzido: renderer, ferramentas, mundo,
animação, controles, física, áudio e sistemas de personagens, conforme o que
o jogo-base e a plataforma de modificação expõem. Ele pode concentrar o esforço
numa alteração específica. Uma conversão para a Galileia ainda precisa de arte,
lugares, personagens e missões próprios; não é apenas trocar a roupa do herói.

O [OpenSA](https://github.com/Avatarchik/opensa) é uma referência esclarecedora:
usa Three.js e Rapier para carregar formatos e conteúdo de San Andreas. Seu
código é AGPL-3.0 e não inclui os arquivos da Rockstar. Ter o código aberto do
carregador não concede direitos sobre o jogo-base. Foi reconsultado como fonte;
não executamos seu mundo nesta revisão e não o incorporamos ao projeto MIT.

## O que a auditoria encontrou no nosso jogo

| Evidência na R12 | Consequência | Intervenção proposta |
| --- | --- | --- |
| `src/village-houses.ts`: três modelos completos repetidos, com escala e cor variáveis | Silhuetas e detalhes repetitivos | Kit de paredes, portas, coberturas, soleiras e pátios combináveis |
| `public/world/cafarnaum.json`: relevo regional com amostras a cada 12 m | O DEM não modela valas, degraus ou irregularidade sob os pés | Camada local de terreno e caminhos autorados, identificada como reconstrução artística |
| `src/world.ts` e `src/ground-surface.ts`: Rocky Gravel reaproveitado em várias superfícies | Terra, areia e fundações parecem variações da mesma superfície | Materiais distintos, escala coerente e transições pintadas |
| `src/world-layout.ts`: distribuição por fórmulas e lotes | Corredores regulares, pouca composição de lugares memoráveis | Trajeto desenhado com curvas, pátios, marcos e pequenas cenas de trabalho |
| `src/world.ts`: plano de água, ondas por normais e reflexo do céu | Pouca relação visual entre água, margem, barco e pedras | Água e margem produzidas juntas, com profundidade, ondulação e reflexos adequados ao perfil |
| `src/animated-actor.ts`: parada derivada da caminhada e mesma caminhada acelerada | Movimento e repouso limitam a presença do protagonista | Idle, deslocamento e gestos próprios, com transições e contato dos pés revisados |
| `src/missions.ts`: tipos `reach` e `call` | Pouca variedade de ação e consequência | Um encontro completo com estados persistentes, animação e reação |

Três modelos de casa não significam apenas três casas na cena. Os números
históricos de memória em `PLANO-AAA.md` não são medições atuais da R12.
Testes funcionais anteriores não constituem aprovação artística.

## Estruturas prontas que merecem aproveitamento

| Caminho | O que entrega | O que não elimina |
| --- | --- | --- |
| [PlayCanvas Engine](https://github.com/playcanvas/engine), MIT | Pipeline web, ferramentas de cena e animação; [controlador third-person oficial](https://developer.playcanvas.com/tutorials/third-person-controller/) e [starter Vite/TypeScript](https://developer.playcanvas.com/user-manual/getting-started/start-with-create-playcanvas/) | Autoria de cenário, animações próprias, integração das nossas missões e validação móvel |
| [Babylon.js](https://github.com/BabylonJS/Babylon.js), Apache-2.0 | [Controlador físico](https://doc.babylonjs.com/features/featuresDeepDive/physics/characterController/), [material de água](https://doc.babylonjs.com/toolsAndResources/assetLibraries/materialsLibrary/waterMat/), PBR e LOD | Conversão dos shaders e integração da lógica; água pronta não garante acabamento superior |
| [3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS), Apache-2.0 | Streaming e níveis de detalhe para Three, Babylon e PlayCanvas | Produção dos tiles, cenário histórico, colisões, navegação e gameplay |
| [Game Animation Sample da Unreal](https://dev.epicgames.com/documentation/en-us/unreal-engine/game-animation-sample-project-in-unreal-engine) | Referência funcional de locomação, Motion Matching e adaptação de personagens | Um jogo completo, nossas malhas e uma distribuição web local equivalente ao Three |

Licença da engine não licencia automaticamente os assets de cada demonstração.
PlayCanvas documenta WebGPU como beta; preservar o caminho WebGL e conferir
o suporte real antes de mudar o produto. Não foi instalado nenhum desses repos.

Uma fonte útil para materiais e objetos é a [Poly Haven](https://polyhaven.com/license),
com assets próprios CC0. Selecionar e revisar peças compatíveis com a direção
artística. Um pacote genérico não deve determinar a aparência histórica da vila.
Modelos do Tripo precisam de limpeza, materiais, escala, rig, animação e revisão;
uma geração isolada não equivale a um personagem pronto para o jogo.

## GTA V/FiveM e Unreal: escolhas de produto

FiveM exige GTA V instalado e cópia/licença válida; é um cliente de PC. Isso
muda o acesso por link no Safari que Alex definiu. Referências oficiais:
[instalação](https://support.cfx.re/hc/en-us/articles/360020992639-How-to-install-FiveM-on-PC),
[plataformas](https://support.cfx.re/hc/en-us/articles/8016397932444-FiveM-Client-and-Server-Platform-Support-FAQ)
e [termos](https://fivem.net/terms). Não é a recomendação para o produto público.

Unreal com [Pixel Streaming](https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-pixel-streaming-in-unreal-engine)
pode servir um jogo de alta fidelidade ao navegador: o servidor renderiza e
o aparelho recebe vídeo e envia comandos. Isso exige GPU remota, rede,
latência aceitável e capacidade para as sessões simultâneas. A
[infraestrutura de referência](https://dev.epicgames.com/documentation/en-us/unreal-engine/hosting-and-networking-guide-for-pixel-streaming-in-unreal-engine)
não equivale a hospedagem ilimitada ou operação pronta.

Esse seria um produto com operação diferente, considerado se Alex priorizar
fidelidade acima do custo e da independência de streaming. Um servidor de arquivos
maior, sozinho, não aumenta a capacidade gráfica do celular. Nenhuma demonstração
de DLSS 5 funcionando foi produzida nesta revisão.

## A primeira experiência que queremos entregar

Escopo de produção proposto, não contagens já presentes no jogo:

1. **Trajeto de 80–120 m:** viela de basalto, pátio e margem conectados. Poucas
   fachadas bem distintas, profundidade nas portas, coberturas e materiais coerentes.
2. **Entrada com vida:** Jesus com postura e animação convincentes; um trabalhador
   em atividade, som localizado e uma descoberta visível adiante. Chegar ao controle
   rapidamente; telas conceituais não substituem esse primeiro minuto jogável.
3. **Encontro de 5–10 minutos:** aproximar, ouvir e ajudar numa atividade cotidiana;
   a pessoa e o lugar mudam de estado depois da ajuda. Falas autorais recebem a
   etiqueta Narrativa do jogo; citações bíblicas mantêm texto e referência. Não
   condicionar a ação a leitura prévia. Integrar o encontro à jornada de Marcos.
4. **Margem convincente:** terra seca, areia molhada, pedras, água rasa e barco
   formando uma cena só. Pequeno cardume visível apenas depois de termos malha,
   movimento e revisão satisfatórios. Burro e galinha já produzidos passam pela
   mesma revisão no ambiente; sua existência em disco não basta para aprová-los.
5. **Interação, não só decoração:** objetos examináveis, resposta de um NPC,
   reação de um animal e consequência persistente da ajuda. Montaria fica para
   uma etapa própria se ainda faltarem animações de subir, conduzir e descer.
6. **Convite à comunidade:** encerrar a experiência com continuidade clara e
   Construa conosco. Testar voluntariamente com 5–10 pessoas, observar onde
   desistem e ouvir o que desejam fazer. Não prometer engajamento ou viralização.

Referência arqueológica orienta materiais e formas; não usar o DEM moderno ou
uma imagem gerada como comprovação da aparência do século I. Ponto de partida:
[levantamento acadêmico de Cafarnaum](https://rsc.byu.edu/ministry-peter-chief-apostle/simon-peter-capernaum-archaeological-survey-first-century-village).
Nenhum NPC de esferas/cilindros ou malha inacabada deve preencher o cenário.

## Ordem de produção e critério de parada

**Marco A — provar a direção.** Primeiro, uma fachada, um pedaço de caminho,
água e herói nos mesmos enquadramentos da R12. Produzir imagem real em movimento,
com interação simples. Curadoria e bloco inicial antes de gerar dezenas de assets.

**Marco B — avaliar ferramentas.** Se a base atual exigir trabalho excessivo
para o resultado necessário, reproduzir esse mesmo trecho em PlayCanvas, numa
branch isolada. Comparar conteúdo, câmera, resolução e iluminação equivalentes.
Registrar horas efetivamente medidas de autoria/integração; não decidir apenas
por screenshots diferentes ou FPS de um cenário mais vazio. Migrar somente com
ganho visual ou produtivo demonstrado e um custo de portabilidade explícito.

**Marco C — fechar o encontro.** Completar animações, som, estados, save e retorno
ao mundo. A primeira passagem de ponta a ponta deve usar controles reais,
sem teleportes de QA. Corrigir câmera e colisão junto da autoria dos lugares.

**Marco D — validar com pessoas e expandir.** Capturar antes/depois e teste
em PC e Safari físico. Aprovado o trecho, transformá-lo em kit reutilizável e
produzir novos setores. A expansão geográfica continua no plano do mundo aberto.

Se o Marco A não melhorar claramente a imagem em movimento, interromper a
expansão e revisar arte/iluminação. Se a experiência não despertar interesse,
revisar o encontro antes de aumentar o mapa. Mais testes automáticos ou mais
quilômetros não substituem esses dois critérios.

## Prazo: cenário de planejamento, não compromisso de entrega

- Reservar **3–5 dias úteis de trabalho efetivo** para uma prova pequena de
  direção, curadoria e decisão técnica. O prazo depende de assets utilizáveis;
  o resultado desse marco pode ser rejeitar um caminho, não entregar uma demo.
- Uma demo polida de 5–10 minutos pode ser planejada inicialmente em **4–8
  semanas**, com uma pessoa experiente em ambiente/arte técnica e outra em
  gameplay/integração, atuando com regularidade e assets adequados. É hipótese
  de baixa confiança até fechar o Marco A, não benchmark de produtividade de IA.
- Com apenas Alex e agentes, não assumir a disponibilidade de dois profissionais
  de arte e código: medir produção real no primeiro marco e reestimar. Malhas,
  animações, testes físicos e revisão artística podem dominar o prazo.
- O jogo completo, com dezenas de missões e regiões, permanece um projeto longo.
  Esta proposta não altera silenciosamente as estimativas públicas da campanha
  em `ESTIMATIVA-PROJETO.md`, nem autoriza compras ou contratações.

## Evidência exigida antes de anunciar qualidade

Um vídeo contínuo curto, captura do jogo com controles reais, imagens A/B nas
mesmas câmeras e o percurso completo do encontro. Medir carga fria, bytes,
frame time p95/p99, erros e degradação após uso prolongado. Orçamento inicial
proposto: modo visual de 30 FPS no celular e modo de 60 FPS no PC, sujeitos à
cena e ao hardware; não são resultados atuais.

Testar em 390×844 e 1280×800, e em iPhone físico. Emulação no PC não comprova
estabilidade de Safari, temperatura ou memória no telefone. Não chamar conceito
gerado de gameplay, DLSS ou resultado final. Arquivar captura real, conceito e
ensaio de teste com rótulos distintos para a série de Reels.

## Reaproveitamento e verificação desta proposta

Preservar GLBs e fontes, DEM, lugares, BLIVRE, licenças, dados de missões,
saves, interface HTML e casos de teste. Parte da lógica TypeScript pode ser
adaptada a outra base web; materiais TSL, renderer, sombras e animação precisam
de integração específica. Unreal exigiria portabilidade maior da implementação.

Verificações realizadas: leitura do código da R12, comparação de árvores Git,
consulta a documentação e repositórios oficiais e três revisões independentes.
Uma crítica local via Ollama não devolveu parecer utilizável e foi descartada.
Não executamos as engines alternativas, não medimos ganho gráfico, nem rodamos
novamente o jogo nesta etapa documental. Tokens e horas totais desta etapa não
foram medidos; não foram inventados valores para a prestação de contas.
