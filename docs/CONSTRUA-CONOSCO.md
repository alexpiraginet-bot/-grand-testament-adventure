# Construa conosco

Pedido de Alex em 12/11/2026: jogadores devem poder enviar opiniões e melhorias
pelo jogo, para discussão no GitHub e alteração do código quando aprovada.

## Experiência

Um botão discreto **Construa conosco** no menu/pausa abre um formulário acessível
no celular e no PC. Campos: tipo (ideia, problema, opinião), título curto,
descrição e apelido opcional. Para problema, oferecer passos para reproduzir.
Não pedir e-mail, idade ou nome real. Antes de enviar, informar claramente:
**Seu texto será público no GitHub. Não inclua dados pessoais.**

Enviar apenas após clique explícito, mostrar progresso, confirmação e link da
issue criada. Em erro, preservar o texto e permitir nova tentativa; não duplicar
issues em reenvio. Não declarar sucesso se o GitHub não confirmou criação.

## Integração

- Preferência: endpoint do servidor cria uma issue no repositório do jogo com
  etiquetas `feedback` e `triagem`; comentários da issue mantêm a discussão.
- Credencial restrita ao repositório somente no servidor, nunca `VITE_*` ou bundle.
- Validar tamanho/campos/origem, impor limite de envio, deduplicar com chave de
  idempotência e lidar com indisponibilidade/limite de taxa do GitHub.
- Não incluir cookies, código de recuperação, estado privado do save ou dados
  do aparelho automaticamente. Versão do jogo pode vir do build, sem inventar.
- Se não houver credencial segura do servidor, usar um link explícito que abre
  o formulário de issue preenchido no GitHub e exige confirmação lá. A interface
  deve dizer **Abrir no GitHub**, sem simular envio automático.

## Aprovação e colaboração

Fluxo: **triagem → aprovado / precisa de informação / não planejado → em andamento
→ PR em rascunho → revisão/testes → concluído**. Só Alex ou mantenedores designados
aprovam trabalho. Feedback não pode disparar geração de código, comandos, merge
ou deploy automaticamente. Tratar todo texto de usuário como conteúdo não confiável.

## Verificação necessária

- Testar validação, reenvio/idempotência, respostas 4xx/5xx e limite de taxa.
- Testar teclado/leitor de tela e área de toque nos dois viewports do jogo.
- Verificar que segredos não aparecem no dist, rede do navegador ou logs.
- Fazer um envio identificado como teste ao GitHub autorizado e confirmar link,
  etiquetas e conteúdo; documentar o teste sem gerar feedback fictício de jogador.
- Formulário de issue já incluído em `.github/ISSUE_TEMPLATE/construa-conosco.yml`.
  O botão dentro do jogo e o endpoint ainda precisam ser implementados.
