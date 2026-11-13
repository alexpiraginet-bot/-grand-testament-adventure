# Colaboração voluntária

O painel **Frentes abertas para colaboração** apresenta engenharia, gameplay,
gráficos WebGPU/three.js, arte e materiais 3D, rig/animação, testes/acessibilidade,
pesquisa histórica e bíblica, áudio e mapas/construção do mundo. São frentes
propostas pelo projeto; não são vagas de emprego, lugares reservados ou contagem
de pessoas já cadastradas.

`src/volunteers.ts` reúne as frentes, opções e validação. O integrador chama
`mountVolunteerPanel(container)` de `src/volunteersui.ts` uma vez dentro de
Colabore. A montagem não modifica o estado do jogo nem cria outro diálogo; pausa,
Escape e devolução do foco continuam sob responsabilidade do diálogo existente.

## Fluxo real

1. A pessoa escolhe uma frente e disponibilidade aproximada de 2, 5, 10 ou 20 horas
   semanais. Pode incluir um portfólio HTTPS e uma apresentação de 20 a 1.000
   caracteres. Não pedimos nome real, telefone, e-mail ou documento.
2. A pessoa confirma que entende a publicação no GitHub. O botão **Enviar
   candidatura pelo GitHub** abre um rascunho no repositório fixo do jogo, usando
   os parâmetros `title` e `body` da composição de issue.
3. É necessário entrar em uma conta GitHub, revisar e confirmar a publicação lá.
   Abrir o rascunho não equivale a enviar, aprovar ou aceitar a candidatura.
4. Mantenedores analisam a proposta e combinam um primeiro escopo pequeno em uma
   issue. Revisão de contribuição e merge seguem as regras do repositório.

Não há backend de inscrição, armazenamento permanente do formulário, envio de
e-mail, token GitHub, atribuição automática de permissões ou chamada de API.
O rascunho fica na página enquanto ela estiver aberta, inclusive se uma nova aba
for bloqueada. Um link manual continua disponível após a tentativa.

O template `.github/ISSUE_TEMPLATE/volunteer.yml` oferece a mesma entrada para
quem chega diretamente pelo GitHub. A página do jogo usa a composição de issue
com texto pré-preenchido, sem depender de pré-preenchimento de dropdowns do
template. A confirmação final sempre ocorre no GitHub.

Referência do mecanismo de URL:
[GitHub — criar uma issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query).

## Cenário de 200 colaboradores

200 pessoas é um cenário de planejamento solicitado por Alex, não população
atual, meta arrecadada, disponibilidade confirmada ou número de inscrições.
Uma eventual expansão exige tarefas pequenas com responsáveis, revisão de código,
controle de licenças dos assets, testes em aparelhos e integração gradual.
Não devemos converter esse cenário em contadores de membros ou prometer que
mais pessoas reduzem o prazo de forma proporcional.

## Verificação e limites

`test/volunteers.test.ts` cobre consentimento, opções permitidas, limites de texto,
URLs HTTPS sem credenciais e construção do rascunho no repositório correto. Texto
é sempre inserido na interface por `textContent`; o texto do usuário é codificado
como dado no link e nunca interpretado como código.

A conferência no navegador deve testar foco, formulário com teclado/toque, pausa
do jogo, rascunho preservado, bloqueio de popup, ausência de overflow e abertura
interceptada do GitHub. Nenhuma candidatura de teste deve ser publicada. Os testes
locais não comprovam uma inscrição real nem validação do template pela interface
do GitHub depois do deploy. O template do GitHub não impõe o limite de caracteres
por si só; a triagem dos mantenedores continua necessária.
