# Simão no jogo — integração R12

13/11/2026. Escopo: um adulto com malha e rig revisados, sem substituir os demais participantes por cópias ou primitivas. A origem, os hashes, os perfis de textura e as limitações artísticas constam em [NPC-ASSETS-R12.md](NPC-ASSETS-R12.md). A validação no navegador é registrada separadamente em [QA-R12.md](QA-R12.md).

## Comportamento implementado

Após **Começar/Explorar**, a fila opcional carrega primeiro a fauna já existente e depois Simão. Nenhum deles entra nos 14 assets obrigatórios da abertura. O loader aceita somente o perfil local aprovado, confere tamanho exato e SHA-256, rejeita recursos externos no GLB e limita a textura pelo `LimitedTextureLoader` (512 px mobile, 1024 px desktop). Timeout padrão de 20 segundos, máximo de 30; cancelamento e falhas descartam os recursos, inclusive um parse que termine atrasado. `./`, base real do Vite, e subpastas locais são permitidas; hosts arbitrários, `..` e escapes de caminho não são.

O ator usa o ancestral comum de malha e esqueleto, clona a skin e aplica o idle antes de ficar visível. Não há transformação isolada dos vértices da skin. O `AnimationMixer` mistura os clipes revisados `simao-idle-r11` e `simao-walk-r11`; deslocamento e passada usam 0,70 m/s. A orientação da simulação é convertida para a frente −Z do GLB com rotação Y de sinal inverso.

Antes do convite, Simão espera próximo do lugar narrativo. Durante a fala fica parado e olha para o herói; a respiração continua. Depois da fala, segue uma trilha validada. O estado persistido de missões continua contando quatro discípulos, mas colisão, radar, enquadramento do ator e diagnóstico visual consideram apenas o Simão realmente carregado, anexado e visível. André, Tiago e João continuam ausentes até terem malhas adequadas. O aviso existente de cena em desenvolvimento e as falas literais/etiquetadas são preservados.

Menus, aba oculta, pausa de QA e tomada cinematográfica congelam o mixer e o deslocamento. Silenciar áudio não pausa o personagem. Distância superior a 100 m oculta o ator e retira seu colisor/radar; sua navegação segue física, sem aproximação instantânea. O jogador pode agir sem ler: esta revisão não altera a política existente de revelar orientação pela Bíblia.

## Terreno e orçamento da navegação

`npc-navigation.ts` é independente de Three. Sua integração recebe o DEM real, limite jogável e caixas orientadas do cenário. Caixas são agrupadas em células de 24 m para a consulta local; segmentos têm teste exato contra caixas expandidas pelo raio do corpo, além das sondas do terreno. Isso impede cortes diagonais de quinas estreitas.

| Parâmetro | Valor |
|---|---:|
| Raio conservador / afastamento do jogador | 0,38 m / 1,55 m |
| Velocidade / dt máximo | 0,70 m/s / 0,05 s |
| Intervalo máximo entre sondas de percurso | 0,18 m |
| Terreno seco mínimo / variação máxima no apoio | 0,015 m / 0,18 m |
| Inclinação máxima de segmento | 0,42, com tolerância vertical de 0,015 m |
| Breadcrumb / teto da fila | 0,55 m / 2.048 pontos |
| Grade de reparo / enlace máximo | 0,65 m / 28 m |
| Busca mobile / desktop | 800 / 1.600 nós visitados por tentativa |
| Limite absoluto da função de busca | 2.600 nós |
| Repetição de busca bloqueada | no máximo a cada 1,5 s |
| Atalho verificado | até quatro pontos, 6 m, a cada 0,35 s |
| Projeção de jogador na água | terra seca em até 3 m, recalculada a cada 0,7 s |

Ao entrar no lago ou cruzar uma rota desconectada, o jogador não arrasta Simão pela água. Sem enlace seguro, o ator espera e o diagnóstico informa o motivo. A fila pode manter o trajeto longo sem uma busca por todo o mapa a cada quadro. O herói corre mais rápido; não existe corrida inventada ou teleporte para alcançá-lo.

A posição inicial é validada **antes da primeira aparição**, inclusive ao retomar progresso: fora do corpo do jogador, em terra seca. No DEM atual, o ponto narrativo de Simão tem Y≈0,00641 m; o ponto validado fica 1,5 m para o interior, Y≈0,01916 m. Essa diferença de implantação não modifica o DEM e não desloca um ator já visível. Se não há lugar seguro, a carga opcional falha e ele permanece ausente.

## Diagnóstico para QA

Somente nas condições de debug já existentes, `__gta.npc()` retorna:

```ts
{
  status: 'not-started' | 'loading' | 'ready' | 'unavailable' | 'disposed',
  error, profile: 'mobile' | 'desktop',
  actor: { id, visible, weight, idleTime, walkTime, mixerTime,
           clips: { idle, walk }, textureLimit, bytes, sha256 } | null,
  navigation: { pos: {x,z}, heading, speed, following, reason, queued } | null,
  y, groundHeight, constants
}
```

`__gta.characters()` mede humanos anexados à cena e inclui `npcVisuals`, `npcColliders` e `radarFollowers`. `__gta.npcPositions()` só lista o ator visível, com apoio e navegação; `__gta.followers()` só lista seguidores realmente visíveis. `__gta.blocked(x,z,false)` exclui o colisor do NPC para verificar o cenário separadamente. Nenhum contador de debug é prova visual de deformação ou desempenho.

## Evidência e limites desta implementação

CPU: **18/18** testes direcionados passaram, junto de `npm run typecheck`. Cobertura: skin real/clonagem/idle inicial, pausa e descarte, erro HTTP/hash/rig, parse após cancelamento, catálogo e base real do Vite, obstáculos finos/quinas, água/apoio do corpo, reparo com progresso, limites de busca, ausência de teleporte, DEM real, missões e ausência de fallback humano.

A primeira execução integrada no navegador encontrou uma falha de contrato: `BASE_URL='./'` era recusada antes do download. A correção aceita apenas caminhos locais e acrescenta teste catálogo→loader→fetch com o valor lido de `vite.config.ts`; exige rebuild antes da próxima rodada. Essa reprovação fica preservada no relatório QA.

Ainda dependem da rodada de navegador: aparência final nas texturas reduzidas, chão em movimento, enquadramento da fala, toque/tecla E, retomada, 404 opcional, pausas e custo em milissegundos da navegação. Não houve execução de GPU por este autor. WebKit emulado não prova iPhone físico. Sem IK, corrida, atuação facial ou novas animações; a aprovação R11 é para caminhada/idle controlados. Publicação e encerramento da validação ficam com a sessão principal.
