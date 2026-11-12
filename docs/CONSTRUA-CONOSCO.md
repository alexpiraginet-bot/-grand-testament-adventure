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

- **Implementado localmente:** botão nas telas inicial, de jogo e de conclusão;
  formulário com ideia/problema/opinião, título, descrição, apelido opcional e
  confirmação de texto público. Abre a composição de issue com o texto preenchido.
  O jogador precisa entrar no GitHub e confirmar a publicação lá. Não há envio
  automático nem confirmação de issue criada dentro do jogo.
- O jogo pausa controles e tempo de missão enquanto o formulário está aberto;
  fechar por botão ou Escape restaura os controles. O rascunho permanece nesta
  página ao fechar/reabrir ou se a nova aba for bloqueada, mas não sobrevive ao reload.
- Evolução futura: endpoint do servidor cria uma issue no repositório do jogo com
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

- `npm run build`: typecheck, **28/28 testes** e Vite passaram localmente.
- `tools/check_feedback.mjs`: teste de navegador em 390×844 e 1280×800. Confere
  campos obrigatórios, consentimento, destino GitHub, preservação de acentos,
  pausa ao digitar, Escape, foco devolvido, controles retomados e rascunho preservado.
  A abertura externa é interceptada: nenhum feedback fictício é publicado.
- Capturas e resultado em `shots/feedback/` (fora do Git). Viewport móvel em Chrome
  do PC não equivale a teste em celular físico. Leitor de tela real ainda não testado.
- Pendente: criar/publicar o repositório e fazer um envio identificado como teste
  ao GitHub autorizado para confirmar link,
  etiquetas e conteúdo; documentar o teste sem gerar feedback fictício de jogador.
- Formulário de issue já incluído em `.github/ISSUE_TEMPLATE/construa-conosco.yml`.
  O endpoint autenticado ainda não existe. Se for implementado, testar idempotência,
  respostas 4xx/5xx, limite de taxa e ausência de credenciais no frontend.

Referência da integração por link: [documentação oficial do GitHub](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query).
