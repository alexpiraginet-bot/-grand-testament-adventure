# Revisão independente do painel e da orientação — R12

Data: 13/11/2026. Escopo: leitura dos módulos de painel, estatísticas, analytics, diário local, Bíblia e exploração; ajuste mínimo em `src/painel.ts`.

## Correção do painel

A consulta de issues e pull requests continua sendo uma única página, com até 100 itens no conjunto. Quando a resposta contém 100 itens, o painel agora informa que os totais de issues, PRs e participantes são parciais e podem omitir registros anteriores. Não é possível concluir que o histórico terminou só porque a página veio cheia. Os números continuam sendo calculados da resposta recebida; não houve ampliação de consultas ou alteração de credenciais.

O aviso funciona também para uma resposta reaproveitada do cache local, pois usa a quantidade de tickets já validada pelo parser. A paginação de commits e o restante do cálculo foram preservados.

## Retificação do parecer sobre a Bíblia

A leitura de `docs/NARRATIVA.md`, seção “A Bíblia do jogo”, confirmou a decisão explícita: abrir a Bíblia revela a orientação, enquanto chegar ao local permite agir sem ler. Portanto, ocultar o objetivo e o marcador até abrir a leitura **não é um bloqueador nem uma regressão de requisito** nesta revisão. O parecer inicial que o classificou assim estava incorreto. Nenhum código de missão, radar ou leitura foi alterado por esta correção.

## Limites da revisão

A inspeção de fonte não encontrou segredo embutido nos módulos avaliados. O diário continua local em sessionStorage; o painel usa GET público sem credenciais e insere textos como texto. A revisão não confirma a ativação do Analytics no painel remoto da Vercel e não mede visitas reais. Build e conferência visual integrada ficam no registro de QA R12; não se atribui a esta inspeção uma execução de navegador.
