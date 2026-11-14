# Motores gráficos — registro de decisão, 13/11/2026

Atualização R13: após a crítica de Alex à qualidade da cena, consultar
[DEMO-CONVINCENTE-R13.md](DEMO-CONVINCENTE-R13.md). A recomendação atual é
produzir um trecho autorado na base vigente e priorizar PlayCanvas como candidato
a uma comparação isolada de produtividade; Babylon continua como alternativa.
Nenhuma migração foi aprovada por benchmark ou executada. O restante deste
documento registra a pesquisa anterior, com seu contexto histórico de branches.

Alex informou que Claude está pesquisando Godot, O3DE, Bevy, raylib, OGRE e Babylon.js.
Esta é uma análise documental; nenhum benchmark entre motores foi executado.

**Decisão desta entrega:** continuar o jogo em Three.js e reservar Babylon.js como
candidato a um experimento isolado com a mesma cena. Trocar o motor por si só não
resolve as silhuetas dos NPCs, variedade das malhas ou direção de arte.

- Three.js já usa WebGPU e fallback WebGL2 neste jogo. [Fonte r186](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgpu/WebGPURenderer.js).
- Babylon.js tem [WebGPU](https://doc.babylonjs.com/setup/support/webGPU/),
  [Inspector](https://doc.babylonjs.com/toolsAndResources/inspectorv2/) e
  [pipeline de pós-processamento](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/defaultRenderingPipeline).
  Pode reduzir o esforço de ferramentas; desempenho superior ainda precisa ser medido.
- Godot: a [exportação web estável consultada](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
  usa Compatibility/WebGL2, sem Forward+/Mobile/WebGPU nesse alvo.
- Bevy tem [exemplos WebGPU](https://bevy.org/examples-webgpu/), mas muda a cadeia de implementação.
- raylib usa [Emscripten para web](https://github.com/raysan5/raylib/wiki/Working-for-Web-(HTML5)).
- OGRE é um [motor de renderização](https://github.com/OGRECave/ogre), não fornece nossa jornada pronta.
- O3DE não lista navegador entre as [plataformas oficiais consultadas](https://docs.o3de.org/docs/welcome-guide/supported-platforms/).

## Experimento antes de migrar

Usar exatamente as mesmas malhas, texturas, resolução, caminho de câmera e iluminação
comparável. Medir frame time p95/p99, memória, download, carga fria e erros. Exercitar
câmera entre casas, rig, colisões, toque e três missões; comparar no mesmo PC, Android
e iPhone físicos. Propor migração somente com ganho reproduzível relevante (por exemplo
20% no p95) ou recurso visual necessário demonstrado, sem regressões de compatibilidade.

Essa meta é critério de avaliação proposto, não um resultado medido. Não houve nova
instalação de motor nem alteração de framework nesta revisão.

## Trabalho do Claude

Na consulta pública ao GitHub desta rodada não havia PR, issue ou comentário de commit
novo; só `main` e `codex/tripo-runtime-r1` em `424a096`. O bundle
`gta-claude-referencias-skills-visual.bundle` não estava nos Downloads C:/D:, nos anexos
da conversa ou no projeto. Os dois bundles antigos encontrados não contêm a branch
`claude/referencias-skills-visual`. Importar o arquivo novo quando ele chegar; os comandos
com `caminho/` são exemplos, não um caminho local resolvido. Esse é um registro pontual,
não monitoramento da conversa privada do Claude.
