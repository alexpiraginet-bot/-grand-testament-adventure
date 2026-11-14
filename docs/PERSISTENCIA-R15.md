# Persistência dos encontros — correção R15

14/11/2026. Revisão limitada a `src/world-state.ts` e seu teste. O save principal,
nuvem, missões, HUD, runtime e laboratório R14 não foram alterados por esta parte.

## O que mudou

1. `write()` relê a chave antes de salvar. Se essa leitura encontrar versão
   superior à suportada, retorna false e define status `newer`, preservando o
   conteúdo e a cópia `:prev`. Cobre uma aba atualizada que escreveu depois do
   `load()` desta instância.
2. `parseWorldState()` cria os IDs como propriedades próprias de dados com
   `Object.defineProperty`. Um encontro chamado `__proto__` agora é preservado
   no JSON sem mudar o protótipo do mapa. `constructor`, `toString` e
   `hasOwnProperty` também continuam IDs válidos. `savedStage()` e `recordStage()`
   só consultam fatos próprios; propriedades herdadas não contam como progresso.
3. A escrita combina fatos válidos já encontrados na chave com o snapshot
   recebido. Para cada ID prevalece o estágio mais avançado. Se o estágio é
   igual, a data já persistida não é alterada; se avança, conserva-se a data
   trazida pelo novo fato. IDs independentes de duas abas são mantidos.
4. Entrada e resultado do merge são validados antes de qualquer `setItem`.
   Payload inválido/serialização impossível ou união acima dos limites retorna
   false, sem modificar a chave, backup ou status operacional. A validação de
   saveId exige texto não vazio até80 caracteres; limite de64KiB mede UTF-8.
   O merge não modifica o snapshot recebido pelo chamador.

API de retorno preservada: `write` continua boolean; status segue
`ok | unavailable | newer`. Payload inválido não representa recusa do navegador
e deixa status inalterado. A revisão de conteúdo fornecida pelo chamador continua
sendo a gravada; strings de revisão não são ordenadas como versões semânticas.

## Como foi verificado

`node --test test/world-state.test.ts`:16 testes, incluindo os8 anteriores e
8 regressões. Casos novos verificam versão futura após load, IDs especiais,
propriedades herdadas, snapshots defasados, datas iguais, entradas inválidas,
união acima de500 encontros e texto multibyte acima de64KiB. Verificam tanto a
chave principal como `:prev` quando uma gravação é recusada.

Typecheck explícito:

```text
node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --strict --target ES2022 --module preserve --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck --types node src/world-state.ts test/world-state.test.ts
```

A primeira conferência de tipos identificou uma inferência ampliada de strings
numa asserção do teste; o esperado recebeu `as const`, preservando os estágios
literais. Nenhum comportamento de produção foi relaxado para fazer o teste passar.

## Limites e próximo passo

**Não é uma transação entre abas.** `localStorage` não oferece compare-and-swap
nesse contrato síncrono. Outra aba ainda pode escrever entre nossa última leitura
e `setItem`; o merge protege apenas o estado efetivamente observado. A gravação
do backup e da chave também não é atômica. Falha do navegador mantém a resposta
false/status unavailable; não é alegado sincronismo entre aparelhos.

Os testes usam armazenamento em memória com a mesma interface. Ainda é necessário
integrar essa base ao encontro real, informar falha de gravação e testar recarga/
duas abas no navegador. Não houve GPU, geração local, download ou publicação.
