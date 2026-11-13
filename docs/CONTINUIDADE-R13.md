# Continuidade R13 — primeira amostra visual

Responsável: Codex. Data: 13/11/2026. Branch `codex/demo-direcao-r13`, PR #11.
Base main auditada: `9dcd6cc08e60eda562575813d07b6eba34d81d08`.

Alex aceitou a recomendação de concentrar produção numa área convincente antes
de expandir o mapa. Este passo começa o Marco A de `DEMO-CONVINCENTE-R13.md`:
solo com terra/areia distintas, entradas e pórticos nas fachadas iniciais,
correção da casa B virada para o lado e novo tratamento do lago. Não entrega
ainda o encontro completo de 5–10 minutos, interiores, um novo kit de casas
nem um mundo inteiro no acabamento desejado.

## Ownership e fontes

- Integrador: água, margem, loaders, descarte, diagnósticos e créditos.
- Revisão de solo: `ground-surface.ts`, `ground-materials.ts`, catálogo,
  derivados CC0 e testes; ver `SOLO-R13.md`.
- Revisão de arquitetura: módulos `village-*`, catálogo/madeira CC0 e testes;
  ver `FACHADAS-R13.md`.
- QA: `check_cafarnaum_r13.mjs`, capturador real e comparação baseline;
  ver `QA-CAFARNAUM-R13.md`.

Os módulos foram integrados em worktree própria, sem editar a baseline R12
nem sobrepor a sessão de Claude. Nenhum GLB proprietário foi adicionado ao Git.
Materiais CC0 têm origem, autores, hashes e scripts de reprodução. A carga
valida tamanho/hash/dimensões; os dois perfis usam os mesmos contratos.
Não houve geração Tripo, compra ou mudança de engine/dependências.

## Evidência e pendências

Acervo privado: `D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario/R13-AMOSTRA-20261113`.
A baseline é imutável. As capturas de diagnóstico posicionam a câmera para
comparar e não provam um trajeto inteiro. O vídeo curto separado usa entrada
real e será identificado pelo hash do build. Não há publicação social implícita.

A primeira água WIP foi tecnicamente válida e artisticamente rejeitada. A
primeira integrada revelou solo amarelado fora da faixa e portas com aparência
de grade; esses achados motivaram revisões, não uma alegação de qualidade pronta.
As casas ainda usam as três malhas anteriores; sua repetição/qualidade e a
margem reta continuam pendentes. Não acrescentar NPCs de primitivas para ocupar
o espaço, e não chamar este passo de demo completa ou qualidade AAA.

Runtime testado: commit `0b8f5a8b51306f8b28515856469b8ca41a8ac08d`; build completo
com **320 testes aprovados**. Bundle local `index-U3_FX1lA.js`, SHA-256
`9122cfe0add6c7566b11153accaa8c529f115a7ce475c9e39a3e764cd1476190`.
QA comparativa: 34 verificações, 18 PNGs; os 16 pares fixos conservaram câmera,
posição, viewport, backend e tempo. Smoke com os efeitos/câmera padrão: 18
verificações, incluindo joystick de toque emulado com deslocamento de 5,06 m.
Nenhum erro capturado nessas rodadas. A janela RAF ficou limitada perto de 100 Hz
no PC: não comprova ganho de desempenho nem FPS no Safari do iPhone.

Fontes de runtime estão congeladas após esse commit. Alterações documentais
posteriores e o merge têm outro carimbo de build; a publicação precisa de
verificação própria do bundle público. Ver QA/PR para recibos da publicação.

## Próxima unidade de produção

Produzir um quarteirão pequeno com kit de casas mais coerente: paredes e
coberturas revisadas, portas/escala corretas, cantos e pátio próprios. Integrar
o primeiro encontro autoral com ação e consequência observáveis, seguindo
`INTERACOES-E-ENCONTROS.md`. Validar uma caminhada completa antes de ampliar
a área. A comparação de outro editor/engine continua condicionada a um
benefício mensurável; não reiniciar o projeto por troca de nome do motor.
