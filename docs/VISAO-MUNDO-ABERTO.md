# Visão de expansão — mundo aberto da vida de Jesus

Direção solicitada por Alex em 13/11/2026: ampliar a fatia de Cafarnaum para um
mundo grande com a história de Jesus, incluindo a possibilidade de prólogo na
infância e etapas anteriores aos milagres. Este documento registra a ambição e
uma arquitetura proposta; não anuncia regiões, 24 capítulos ou servidores já prontos.

Alex esclareceu: **dezenas de missões pelos quatro Evangelhos e terrenos dos
lugares por onde Jesus passou**. Não limitar a visão a uma única região ou à
primeira campanha curta. A hipótese usada no orçamento é cerca de 60 missões e
10–15 áreas, para dimensionar trabalho; não é backlog fechado nem promessa de
quantidade. Ver `docs/ESTIMATIVA-PROJETO.md` e `src/data/project-plan.json`.

O atlas deve vincular lugares a passagens e registrar incertezas. O
[OpenBible.info](https://www.openbible.info/geo/) disponibiliza lugares por livro,
capítulo e possíveis identificações; há locais com múltiplas hipóteses, não um
traçado único comprovado de todas as viagens. Conferir as fontes de cada local e
suas licenças; as citações do jogo continuam na BLIVRE, não no texto de outra tradução
presente no atlas. Relevo moderno não prova a paisagem ou cota de água do século I.

Para uma equipe ampliada, frentes independentes devem compartilhar um mesmo guia
de arte, contrato de assets, dados de missões e rotina de revisão. O cenário de
200 voluntários considera pessoas ativas, não inscrições; liderança, integração,
pesquisa e QA são dependências explícitas. O jogo recebe candidaturas públicas
pelo GitHub, revisadas antes de qualquer ingresso ou permissão no repositório.

## Expansão por etapas jogáveis

1. Consolidar Cafarnaum e Marcos 1:16–20: navegação, personagens, escolhas de
   interação, fauna de qualidade, água, controles, câmera e desempenho medidos.
2. Definir o atlas de regiões e um grafo narrativo apoiado nas fontes: Galileia,
   Nazaré, Caná, entorno do Jordão, deserto da Judeia e Jerusalém são candidatos.
   Localização, cronologia e percurso exigem pesquisa; não completar lacunas como
   se fossem fato bíblico ou arqueológico.
3. Produzir uma nova região pequena por vez, com ciclo completo de missão,
   salvamento e conexão à anterior. Expandir a partir dos mesmos sistemas,
   preservando estado, acessibilidade e atribuições das fontes.
4. Avaliar prólogo e episódios de infância editorialmente: sem rostos de crianças,
   sem diálogo inventado apresentado como Escritura e sem Deus como personagem.
   Separar claramente narrativa própria e citações literais da BLIVRE.

## Proposta técnica a validar

- Dividir o mundo em setores carregáveis: malhas e texturas por proximidade,
  níveis de detalhe, limites de memória e descarte de recursos fora de uso.
- Separar dados narrativos/colisões da apresentação visual. Distâncias reais e
  compressões artísticas de viagem devem ser documentadas.
- Medir a mesma cena antes de ativar efeitos de alto custo. A PR #1 do Claude
  introduz benchmark e efeitos opcionais, ainda não incorporados à R4.
- Hospedagem/CDN distribui arquivos; um servidor maior não elimina limites de
  GPU, RAM ou bateria do navegador. Cloud gaming por vídeo seria outra arquitetura,
  com custos/latência próprios e decisão separada. Não contratar infraestrutura agora.
- Qualidade máxima selecionável no PC e qualidade adaptada comprovada no celular.
  Nenhum DLSS 5 foi demonstrado no jogo; qualquer simulação deve ser rotulada.

## Comunicação pública

Criar a série com o processo real, sem prometer data de um mundo completo.
Link permanente para a versão jogável e convite à colaboração. Conceitos do
deserto, pesca e Caná enviados por Alex em 13/11 são direção artística; a captura
do protótipo e os testes do navegador são evidência do estado presente.
Produção dos Reels segue em sessão separada, preservando o código do jogo.
