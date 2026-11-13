# Horas, tokens e custos do desenvolvimento

O painel fica em **Colabore → Apoie o desenvolvimento**, junto da prestação de
contas. Há três medidas independentes: pagamentos informados, uso observado das
IAs e uma comparação teórica com preços de API. Não somar as três como despesas.

## Cobertura e limites

- A primeira coleta cobre exclusivamente a sessão Codex autorizada, a partir do
  marco do jogo em 12/11/2026 às 19:28:52.842 UTC. O histórico anterior de impressão
  3D fica fora. Outras sessões, Claude, subagentes, imagens e Tripo não estão somados.
- `inputTokens` já contém `cachedInputTokens`. O total é entrada + saída; não
  adicionar cache nem raciocínio novamente. O coletor usa diferenças entre
  contadores cumulativos, ignora duplicatas e exclui intervalos com reset.
- Horas são **atividade estimada de sessão**: intervalos entre incrementos de
  tokens, limitados a cinco minutos e unidos sem sobreposição. Não comprovam horas
  humanas, tempo de GPU ou trabalho contínuo durante todo o período aberto.
- A soma por agente é separada do tempo com alguma atividade sem sobreposição.
- Para GPT-6 Astra, a comparação publicada usa API Standard: US$10/milhão de
  entrada sem cache, US$1/milhão em cache e US$50/milhão de saída, consultados em
  13/11/2026 na [fonte oficial](https://developers.openai.com/api/docs/pricing).
  É uma hipótese de preço de API, não cobrança do plano, fatura ou valor exato
  do processamento usado. Não inclui ferramentas, imagens, impostos ou outras
  modalidades. Modelos sem tarifa confirmada ficam sem estimativa.
- Não há conversão para reais sem câmbio datado e fonte. As mensalidades gerais
  informadas por Alex (Claude R$799, Codex R$999, dia 6) estão separadas no registro
  contábil, sem atribuir automaticamente todo esse custo ao jogo.

## Coleta e publicação

Os registros brutos e o cursor são privados e ignorados pelo Git. Não copiar
prompts, conversas, credenciais, caminhos pessoais ou dados de outros projetos
para o arquivo público. Não fazer descoberta automática de sessões de terceiros.

```powershell
# Usar somente a fonte local desta sessão autorizada. Não consultar outros chats.
node tools/collect_project_usage.mjs --source CAMINHO_JSONL_AUTORIZADO --since 2026-11-12T19:28:52.842Z --out public/metrics/development.json --cursor assets-src/telemetry/cursor.json --once

# Valida o snapshot e preserva os registros já publicados por outros colaboradores.
node tools/publish_project_usage.mjs
# Publica apenas agregados; usa autenticação Git local, sem token no frontend.
node tools/publish_project_usage.mjs --push
```

`public/metrics/development.json` é a cópia de contingência incluída no build.
A branch independente `metrics/development` contém apenas `development.json`,
README e configuração que desativa deploy nessa branch. Uma atualização de uso
não reconstrói o jogo. Push normal rejeita conflitos; não usar force-push.

O navegador consulta o JSON público a cada 60 segundos **enquanto a aba de apoio
estiver aberta**. A coleta/publicação local é uma etapa explícita de trabalho;
não existe serviço permanente iniciado por essa entrega. Sem novas publicações,
aparece **Sem dados recentes** após 150 segundos. Não extrapolamos tokens ou
horas, nem trocamos a data de atualização quando não houve atividade observada.

## Obrigatório para Codex, Claude e colaboradores

1. No início, ler o diário e identificar revisão, tarefa, branch e arquivos sob
   sua responsabilidade. Usar worktree própria se houver outra sessão ativa.
2. Registrar início/fim e metadados reais de uso da sessão específica do jogo.
   Se não houver medição, declarar **sem medição**; nunca estimar tokens pelo
   tamanho do diff, duração da janela ou número de mensagens.
3. Nos marcos relevantes e ao encerrar, atualizar o diário e publicar o agregado
   revisado. Não marcar atualização ao vivo sem executar coleta e publicação.
4. Claude precisa de adaptador/importação **da sua própria sessão autorizada**:
   este coletor inicial aceita somente o log Codex original. Não trocar o nome
   do modelo para fingir cobertura Claude. Seguir o contrato de `src/effort.ts`,
   com ID estável exclusivo e intervalos sem duplicação; tokens desconhecidos e
   preço sem fonte devem ser `null`. Não atribuir tempo de espera a trabalho.
5. Não sobrescrever o snapshot de outro agente. O publicador junta registros por
   ID e usa a leitura mais recente, preservando sessões independentes. Publicar
   correções com histórico, sem apagar contagens para reduzir custos aparentes.
6. Recebimentos e gastos efetivos são revisados em `src/data/accountability.json`.
   Não transformar o equivalente de API em saída de caixa nem simular doações.

## Evidência

`test/project-usage.test.ts` verifica agregação; `test/effort.test.ts` verifica
contrato, união de intervalos, fallback e indisponibilidade. `tools/check_support.mjs`
confere o painel real em 1280×800 e 390×844. Fixtures são dados de teste e não
entram na publicação. Viewport móvel no PC não é benchmark em telefone físico.
