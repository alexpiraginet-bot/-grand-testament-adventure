# Encontros — base lógica (14/11/2026)

Sessão Claude na nuvem, a pedido de Alex ("tem algo que possa continuar? manda ver"), seguindo os passos 1 e 3 de
[INTERACOES-E-ENCONTROS.md](INTERACOES-E-ENCONTROS.md): conciliar os contratos de ação e save com a jornada e
implementar seleção e estados puros. **Nada disto aparece para quem joga.** Não há botão novo, alvo, fala, ator ou
objeto: o primeiro encontro continua dependendo de um adulto com malha, rig e gestos aprovados e das animações do
herói de pegar e carregar, que não existem. Os três módulos não são importados pelo `main.ts` e não entram no bundle.

## O que existe

| Módulo | O que decide | Teste |
|---|---|---|
| `src/interactions.ts` | Quem recebe o botão de ação neste quadro, e portanto o que o botão diz | `test/interactions.test.ts` |
| `src/encounters.ts` | Em que etapa um encontro está e o que cada passo pede ao resto do jogo | `test/encounters.test.ts` |
| `src/world-state.ts` | O registro local e versionado do que foi feito no mundo | `test/world-state.test.ts` |

**Um só destino para o botão.** O `main.ts` já lê `input.takeAction()` uma vez por quadro e entrega à missão. Com
encontros, `receiver()` passa a decidir o destino a partir de dados simples, na ordem do plano: o que está em curso
(um gesto, algo nas mãos); o alvo que o jogador escolheu; a missão; por fim o candidato mais provável. O HUD mostra o
rótulo desse mesmo resultado, então o que está escrito no botão é quem recebe o toque. Com algo nas mãos e sem lugar
válido para deixar, o botão não faz nada; ele não é entregue a outra coisa.

**Alcance e motivo.** `reach()` responde se um alvo pode ser usado de onde o herói está e, se não, o primeiro motivo
(longe, altura, água, por trás, algo no caminho, de costas), cada um com uma instrução curta. Sem teleporte.

**Etapas.** As sete da tabela do plano: disponível, conversando, aceito, pegando, carregando, colocando, resolvido.
O objeto só muda de mãos no contato do gesto, nunca quando o gesto começa. Cancelar antes do contato não move nada;
depois dele o objeto só sai das mãos sendo colocado. Um evento que não se aplica à etapa não muda nada e não pede
nada: dois toques ou E repetido não executam um passo duas vezes.

**O que é salvo.** Só fatos: `accepted` (no aceite), `returned` (objeto no destino) e `completed` (depois do
agradecimento). Nenhum osso, temporizador ou pose. Recarregar com a rede nas mãos volta ao pedido aceito com o objeto
no apoio de origem, sem duplicar nada. A chave é `gta:world-state:v1:<id do save>`, separada do save de progresso
(que não foi tocado); a cópia boa anterior fica guardada, um registro corrompido é posto de lado sem ser apagado, um
registro de versão mais nova não é sobrescrito, e as etapas só andam para a frente. Só local: nada sincroniza entre
aparelhos. Se o navegador recusa o armazenamento, a loja informa (`status`), para o jogo avisar que vale só nesta visita.

## Escolhas desta sessão que o plano não fixa

- **Distâncias**: 1,5 m para agir e 2,5 m para conversar são os valores iniciais do plano. A diferença de altura que um
  gesto alcança (0,5 m) e o quanto um alvo pode estar fora da frente do herói (100°) são valores iniciais **meus**; o
  plano não dá número. Todos precisam ser revistos com as malhas e os gestos reais.
- **Coisas a fazer antes de conversas** na ordem dos candidatos: depois de aceitar, pegar o objeto não deve perder o
  botão para uma conversa ao lado.
- **`returned` e `completed` são momentos distintos**: o objeto no lugar é um fato antes de a pessoa agradecer. Quem
  recarrega entre os dois encontra a rede no destino e o agradecimento por vir.
- **Tempos dos gestos entram de fora** (`Gestures`): duração e instante do contato vêm dos clipes reais quando
  existirem. Nenhuma duração foi inventada no código; os testes usam números próprios.

## O que falta para o primeiro encontro existir

1. Ator adulto e objeto aprovados no jogo (malha, rig, gestos), e as animações do herói: agachar e pegar, carregar,
   baixar e soltar. Sem elas nenhum alvo fica `available`.
2. Um adaptador que transforme o encontro e a cena em alvos (`Target`), leia os tempos dos clipes e dispare os eventos
   de contato; e a ligação no quadro do `main.ts`, onde hoje está a leitura única de `takeAction()`: a missão só recebe
   o toque quando `receiver()` responde `mission`.
3. HUD: rótulo do botão vindo do `receiver()`, troca de foco por tecla e por toque, a instrução curta do motivo.
4. Chamar a loja nos três fatos e na abertura; avisar quando o armazenamento falhar.
5. Textos do encontro revisados por Alex, com a etiqueta **Narrativa do jogo**. Nenhuma fala foi escrita aqui.
6. Conferência de navegador do percurso inteiro com E e com toque, ignorar e retomar, recarregar em cada fato.

## Como foi verificado, e o limite

`node --test`: 344/344 (23 novos nestes três arquivos), `tsc --noEmit` limpo, `vite build` ok. Os valores esperados
dos testes foram feitos à mão; duas regras foram quebradas de propósito (ordem do destino, cancelar depois do contato)
e os testes acusaram as duas. Como nada muda no jogo, **não houve conferência de navegador**: isto é lógica provada em
CPU, não um encontro jogável.
