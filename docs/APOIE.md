# Colabore — apoio voluntário

Horas estimadas, tokens observados e comparação de preços de API ficam na mesma
aba, conforme `docs/ESFORCO-E-CUSTOS.md`. Estes valores não são saídas de caixa e
não alteram o saldo da prestação de contas.

Alex autorizou a exibição pública da chave Pix de e-mail
`Alexpiraginet@outlook.com` na seção **Apoie o desenvolvimento**. A configuração
está em `src/support.ts`; não é uma credencial secreta do aplicativo.

O diálogo Colabore tem duas abas: **Ideias e melhorias**, preservando o formulário
GitHub, e **Apoie o desenvolvimento**, com finalidade dos recursos, chave visível,
cópia e link para o diário do projeto. O apoio é voluntário, o jogo continua livre
e não há vantagem de gameplay vinculada à contribuição.

Não recebemos nome de beneficiário nem dados bancários adicionais. Não inferimos
nome, CPF, instituição, QR ou código Pix copia-e-cola. O botão copia somente a
chave de e-mail. O jogador confere o recebedor no aplicativo do banco antes de
confirmar; o jogo não processa, acompanha ou confirma transferências. Não pedimos
comprovante, valor, e-mail do apoiador ou qualquer dado de pagamento.

Sem meta de arrecadação, saldo fictício, SDK de pagamento, endpoint, token,
analítica de doação ou solicitação automática à rede. Não houve transferência de teste.

## Acessibilidade e comportamento

- Abas com `tablist`, `tab`, `tabpanel`, `aria-selected` e navegação por setas,
  Home/End; todos os botões são utilizáveis por teclado e toque.
- Campo de chave somente leitura, selecionável manualmente.
- Falha/ausência de Clipboard API seleciona a chave e informa como copiar;
  sucesso de cópia nunca aparece como pagamento recebido.
- Abertura pausa o jogo; Escape/Voltar devolvem foco e controles. Mudar de aba
  mantém o rascunho do feedback e seu consentimento na página.

## Verificação

`test/support.test.ts` verifica o destino copiado e a falha segura da Clipboard API.
`tools/check_support.mjs` cobre abas/teclado, rascunho, pausa, cópia simulada e
fallback manual em 1280×800 e 390×844. É teste em Chrome do PC; não comprova o
Clipboard real de um telefone nem uma transferência bancária. O teste intercepta
o clipboard e não envia Pix. Relatório e screenshots ficam no diretório informado.

## Prestação de contas na mesma aba

`src/data/accountability.json` é o registro público revisado manualmente. A interface
não consulta bancos: apresenta os registros publicados no código e um link para
o histórico desse arquivo no GitHub. Recebimentos, gastos e saldo ficam como **—**
enquanto `status` for `awaiting-records`; isso significa dados ainda não publicados,
não arrecadação zero. O arquivo inicial não contém recebimentos nem despesas do jogo.

Para publicar o primeiro fechamento:

1. Conferir os registros e comprovantes reais fora do repositório público.
2. Usar `currency: "BRL"`, `status: "reviewed"` e `updatedAt` em data ISO
   (`AAAA-MM-DD` ou timestamp UTC). `lastReviewedAt` é opcional e só deve ser
   preenchido com uma conferência real.
3. Preencher `openingBalanceCents` apenas quando conhecido e marcar
   `openingBalanceVerified: true` apenas após conferi-lo. Sem isso, o saldo
   permanece desconhecido mesmo que já existam entradas e gastos publicados.
4. Em `entries`, informar `id` único e neutro, `date` ISO, `type` (`income` ou
   `expense`), `category`, `label` e `amountCents` inteiro positivo. R$ 12,34
   corresponde a 1234 centavos. Valores negativos, frações de centavo e somas fora
   da faixa de inteiros seguros são recusados. Não registrar um mesmo pagamento
   duas vezes, inclusive sob identificadores diferentes.
5. Para recebimentos, usar obrigatoriamente `category: "apoio"` e
   `label: "Apoio voluntário"`. Não colocar nomes, CPF, e-mail, chave Pix,
   identificadores bancários ou outros dados de doadores em IDs, descrições ou
   campos extras. Registros de gastos devem descrever a finalidade, não dados
   pessoais de fornecedores.
6. `evidenceUrl` é opcional e aceita somente link HTTPS sem credenciais. Antes de
   publicar, ocultar dados pessoais do documento e conferir o arquivo e a própria
   URL. A validação de URL não verifica nem anonimiza o conteúdo do comprovante.
   Sem arquivo público real, omitir o campo; a interface mostra “Não publicado”.
7. Executar `node --test test/accountability.test.ts` e `npm run typecheck`, revisar
   o diff e publicar via revisão do Git. Correções ficam rastreáveis no histórico.

O saldo exibido é `abertura conferida + recebimentos − gastos do projeto`, calculado
em centavos inteiros. É uma apuração dos registros divulgados, não uma consulta ao
saldo bancário. A existência de um registro ou de um link não é prova automática
de pagamento, e nenhum comprovante é fabricado pelo jogo.

### Assinaturas da estrutura de desenvolvimento

Em 13/11/2026, Alex informou os planos Claude de R$ 799/mês e Codex de R$ 999/mês,
pagos todo dia 6. O JSON registra esses custos em `subscriptionCosts`, com
`source: "owner-reported"`, período mensal e sem comprovante publicado. A soma de
R$ 1.798/mês é calculada pelo código, sem número de total fixado na interface.

As ferramentas também podem atender a outros trabalhos. A parcela atribuída ao
jogo ainda não foi definida (`allocationToGameCents: null`), portanto esses custos
gerais **não entram nas despesas do jogo nem reduzem o saldo dos apoios**. Uma
futura alocação exige valor e critério confirmados e revisão explícita do registro;
não se presume 100% para este projeto. Créditos de outras ferramentas não são
convertidos em reais sem custo real documentado.

`test/accountability.test.ts` verifica o estado inicial real, reconciliação em
centavos, abertura não conferida, anonimização dos rótulos, datas, duplicações,
links e overflow. Os números de suas fixtures são sintéticos e nunca entram no
JSON público. O teste não confere documentos bancários nem a existência de recibos.
