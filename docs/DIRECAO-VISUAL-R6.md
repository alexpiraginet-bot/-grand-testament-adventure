# Direção visual R6 — comunidade e entrada

Pedido de Alex em 13/11/2026: substituir a aparência escura de formulário por
uma interface clara, irisada e premium, com presença cinematográfica e navegação
de console. Referências estéticas citadas: cristal de iOS e menus de console.
É uma implementação web original, não uma interface oficial dessas plataformas.

## Auditoria e decisão

A R5 tinha uma coluna de 580 px, fundo verde muito escuro, amarelo em quase todas
as ações e grandes blocos consecutivos de texto. Funcionava, mas sua hierarquia
não convidava a participar. A abertura do jogo também usava uma máscara escura
uniforme que escondia o cenário. Preservamos fontes locais Space Grotesk/Mono,
nome, conteúdo, dados e todos os fluxos de colaboração.

Redesign visual amplo; linguagem: pérola, azul-tinta, cobalto e reflexos discretos.
Parâmetros de direção: variação 6/10, movimento 2/10, densidade 4/10. CSS nativo,
sem bibliotecas novas, fontes externas ou imagens geradas representando gameplay.

- Entrada: cenário real visível, luz lateral, título de missão e ação de jogar.
- Comunidade: composição ampla com convite à esquerda no PC; abertura compacta
  no celular. Três abas curtas, retorno ao jogo no topo, superfícies de leitura claras.
- Metas: números e condições principais visíveis, premissas extensas recolhíveis.
- Consentimento, incertezas, valores pagos e estimativas continuam separados.
- Cristal: transparência limitada, filetes irisados, foco cobalto e material de
  leitura quase opaco. Sem animação contínua ou blur empilhado no conteúdo.

## Critérios de verificação

Build/testes, screenshots reais em 1280×800, 390×844 e 320×740; campos de 16 px,
alvos de 44 px, ausência de cortes, navegação por teclado, Escape, retorno de foco,
rascunhos e pausa do jogo. Testar também contraste forçado e movimento reduzido.
Viewports de PC não comprovam Safari ou telefones físicos. Screenshots e testes
de geometria não equivalem a certificação completa de acessibilidade.

Referência de avaliação: [contraste de texto W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
e [contraste de controles W3C](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
O diário registra a revisão e o deploy depois da conferência final.
