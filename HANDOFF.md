# HANDOFF: Grand Testament Adventure (12/11/2026, fim da sessão 1)

Para a sessão que continua daqui (Claude Code com acesso a tudo) ou para uma pessoa. **Ordem de leitura:** este
arquivo → `README.md` → `ASSETS.md` → `docs/ALTO-NIVEL.md` → `CONTRIBUTING.md` → `TRIPO.md`.

Fale com o Alex em PT-BR, direto, com gíria. Feche cada rodada com **O que mudou / Como verifiquei / Riscos / Próximo
passo**. "Pronto" só com evidência executada.

---

## 1. O pedido (palavras do Alex, 12/11/2026)

- "Qual seria a viabilidade da gente criar esse jogo real para rodar no navegador com bons gráficos somente aqui em
  código?" → "Vamos começar então a escrever o código do jogo! As malhas podemos gerar todas no Tripo que temos conta
  pro! Mas não api, direto pelo site ou app!"
- Primeira entrega pedida: protótipo jogável com formas simples, missão com HUD e legenda, e a lista de malhas.
- "Defina em um md todas malhas que vai precisar que vou colocar nosso agente para gerar no Tripo" → `TRIPO.md`.
- "Publique no gh também tudo em seguida vercel em um link publico para irmos dando sequência em conjunto com @codex".
- "Mantenha o código aberto e que outros membros possam também construir juntos conosco o game" → repositório
  **público**, aberto a contribuições; malhas do Tripo e fontes com licença separada.
- "O jogo tem que ser link direto! Precisamos só de uma forma da pessoa preservar seu progresso no jogo! Mas
  profissionalmente" → save local + nuvem sem cadastro; **apelido + código de recuperação** (aprovado).
- Nuvem: "Usa outro projeto já existente com menor uso" → Supabase **Bento WhatsApp** (`upidmpzzcpotuwetherp`).
- Referência visual final: `assets-src/referencias/conceito-visual-01.png` (fora do git). "Ao fim vamos rodar ele com
  dlss5 local na nossa Nvidia 5060! Então prepare tudo de alto nível" → `docs/ALTO-NIVEL.md`.
- "Vamos retomar isso aqui tudo pelo code, me dê um Handoff que vamos iniciar outra sessão que tenha acesso a tudo."

Regras que vieram do pedido original e continuam valendo:
- nada da Rockstar (nome "GTA VI", logo, Vice City, personagens, músicas, HUD deles); o nome é Grand Testament
  Adventure;
- só adultos do século I, sem rosto de criança; Deus nunca aparece como personagem;
- falas literais da Bíblia Livre (BLIVRE), com referência;
- número na tela vem de dado ou de código, nunca digitado;
- nada de segredo no repositório;
- as malhas do Tripo nunca vão para o `biblia-conectada`.

## 2. Onde está o código

- **Não está no GitHub ainda.** A sessão 1 não tinha acesso ao repositório `alexpiraginet-bot/grand-testament-adventure`
  (o `git ls-remote` pediu credencial) nem como criá-lo (proibido pela configuração da sessão).
- O repositório inteiro vai no `grand-testament-adventure.bundle` (branch `main`) entregue junto com este arquivo.
  Para publicar:

```bash
git clone grand-testament-adventure.bundle grand-testament-adventure
cd grand-testament-adventure
git remote set-url origin https://github.com/alexpiraginet-bot/grand-testament-adventure.git
git push -u origin main
```

- O repositório deve ser **público** (pedido do Alex). Antes de dar push, conferir que nenhum `.glb`, `assets-src/` ou
  `export/` entrou (`git ls-files | grep -E "glb|assets-src|export/"` não pode mostrar nada).
- Depois: proteger a `main` (PR obrigatória), ligar a Vercel ao repositório (framework Vite, `npm run build`, saída
  `dist`), e trabalhar em branches `claude/...` com PR em rascunho. O Codex usa `codex/...`.
- Página jogável atual (privada do Alex; ele compartilha pelo menu Share): https://claude.ai/artifact/KPTnZkZfSfd978JQ2moYVA
  (versão 3: herói do Tripo, save local; a nuvem está desligada nessa versão).

## 3. Estado (conferido na sessão 1)

Stack: three.js 0.186.1 (`WebGPURenderer`, WebGL 2 quando não há WebGPU de verdade), Vite 8.3.5, TypeScript 7.0.2,
testes com `node --test`. Sem Rapier (1,66 MB com gzip; volta quando houver física de verdade). Node 22.

| Peça | Estado |
|---|---|
| Episódio 1, "Pescadores de gente" (Mc 1:16–20), 3 missões, do início ao "Missão concluída" | funciona; jogado de ponta a ponta com Playwright em 1280×800 e 390×844 |
| Relevo real de Cafarnaum (3 km) + horizonte (30 km), radar, linha d'água | funciona; `tools/build_world.py`, SHA-256 dos ladrilhos em `data/terrain-tiles.sha256` |
| HUD dos reels, legenda literal, créditos, controles PC e celular | funciona |
| Herói do Tripo (arquivo de **teste** do Alex) com esqueleto provisório (`src/rig.ts`) | funciona; não investir mais nesse esqueleto: o Codex faz o rigado de produção |
| Save local (versionado, à prova de corrompido, "Continuar", "Começar do zero", "Jogar de novo") | funciona; testado no navegador (recarregar → continuar → terminar) |
| Nuvem sem cadastro: código de recuperação + apelido | **código pronto e testado contra servidor falso; desligado** (`src/data/nuvem.json` → `enabled: false`), porque a migração não foi aplicada |
| Tela "Apelido e outro aparelho" | escrita e com testes de unidade; **não exercitada no navegador** |
| Export para versão nativa (Unreal 5, DLSS) | `tools/export_engine.py` gera heightmap 16 bits, máscara da água, missões em cm do Unreal e o contrato do save; conferido por leitura de volta |
| Repositório aberto: `CONTRIBUTING.md`, `LICENSE` (MIT, código), `LICENSE-DATA.md` (dados), `ATTRIBUTION.md` | pronto |

Verificação na última rodada: `npm run build` → typecheck limpo, **24/24 testes**, build do Vite.

## 4. Pendências, em ordem

1. **Publicar o código** (seção 2) e abrir a PR desta branch, se trabalhar em branch.
2. **Aplicar a migração da nuvem** `supabase/migrations/20261112210000_gta_saves_v1.sql` no projeto Supabase
   `upidmpzzcpotuwetherp` (Bento WhatsApp). A sessão 1 foi barrada duas vezes pela trava de permissão do ambiente, por
   ser recurso de produção compartilhado. Caminhos: o Alex aprova quando o pedido aparecer, ou cola o SQL em
   https://supabase.com/dashboard/project/upidmpzzcpotuwetherp/sql/new.
   - É **só aditiva**: cria `gta_saves` e as funções `gta_*`; não toca no bot. É idempotente.
   - Foi testada num Postgres 16 local com as permissões padrão do Supabase: tabela fechada para `anon`, só o hash do
     código guardado, apelido único ignorando maiúscula e acento, nomes reservados e palavrões barrados, funções
     internas sem acesso público.
   - Antes de aplicar, conferir de novo (só leitura) que as tabelas do Bento WhatsApp continuam com RLS ligada e sem
     regra para `anon`: a chave publicável dele vai no jogo público, e o banco tem `contatos` e `mensagens` de clientes.
   - Depois de aplicada: `enabled: true` em `src/data/nuvem.json`; testar contra o Supabase real (salvar, recuperar em
     outro navegador, apelido ocupado); apagar só as linhas de teste criadas; rodar `get_advisors` (segurança).
3. **Testar no navegador a tela do apelido** (formato, disponível, ocupado, salvar) com a nuvem ligada.
4. **Integrar o herói rigado do Codex**: `AnimationMixer`, clipes parado/andando/correndo/chamando. Um GLB com pele
   própria hoje é recusado por `bakedGeometry` de propósito (cai nas formas simples).
5. **Decisão do Alex: a praia.** O relevo (SRTM 2000, lago a −213 m) mostra uma faixa plana de ~300 m em Cafarnaum; a
   referência põe as casas na água. Opções em `docs/ALTO-NIVEL.md`. Não rebaixar terreno nem inventar nível de lago.
6. **Visual web rumo à referência**: água rasa com cáusticas e espuma, céu com nuvens, joystick fixo e botão com ícone
   de mão no celular (desenho próprio, sem emoji).
7. **Desempenho**: 482–485 chamadas de desenho medidas, contra um orçamento de 120. Medir antes e depois de cada troca
   (instancing, LOD, menos materiais). **FPS real nunca foi medido**: a sessão 1 não tinha GPU (o navegador por
   software deu 0,5–1,2 fps). Usar `#fps` no aparelho.
8. **Versão nativa (Unreal 5 + DLSS na RTX 5060)**: nasce na máquina com a placa e lê `export/engine/`. Conferir antes
   se há plugin de DLSS 5 para Unreal.
9. Opcional: conta de verdade (e-mail, Google, Apple) num projeto Supabase só do jogo, adotando o código.

## 5. Quem faz o quê

Tabela em `ASSETS.md` → "Divisão de arquivos". Resumo:
- **Claude**: gameplay, HUD, mundo a partir dos dados, integração das malhas, save e nuvem, testes;
- **Codex**: produção das malhas no Tripo (site, sem API; teto de 1.200 créditos no primeiro lote), rig e
  animações, validação, manifesto, e propostas de visual e desempenho em `src/world.ts`.

Herói de produção do Codex: geração `6e66af13-ed12-46ee-9240-19b1d627a830`, 17.481 triângulos segundo o site do Tripo,
ainda sendo rigado. Não validado aqui.

## 6. Fora do git (entregues à parte ou com o Alex)

| Arquivo | Onde | Por quê |
|---|---|---|
| `public/models/heroi.glb` (teste, otimizado, 1.112.912 bytes, SHA-256 `f886eaa0…f7869e`) | anexo deste handoff | malha do Tripo: licença própria, repositório público |
| `assets-src/heroi-original.glb` (22,3 MB) | com o Alex (ele enviou) | original |
| `assets-src/referencias/conceito-visual-01.png` | com o Alex (ele enviou) | referência visual final |
| `export/engine/*` | gerar com `python3 -I tools/export_engine.py` | derivado |
| cache dos ladrilhos de relevo | `npm run world` baixa de novo e confere o hash | derivado |

Para a página do claude.ai (que não serve `.glb`), o modelo vai como `models/heroi.glb.json` (`{ b64 }`); o jogo tenta
`.glb` e depois `.glb.json`.

## 7. Comandos

```bash
npm ci
npm run dev                      # http://localhost:5173 ; ?debug=1 liga window.__gta ; #fps mostra FPS
npm run build                    # typecheck + testes + build
npm run world                    # refaz public/world/ e src/data/ (precisa do biblia-conectada, branch claude/grand-testament-adventure)
node tools/optimize_model.mjs <original.glb> <nome>      # malha ao orçamento de src/data/modelos.json
node tools/check_model.mjs /models/<nome>.glb <altura> shots/modelo/<nome>   # 4 lados (com o dev rodando)
node tools/shots.mjs             # joga o episódio e fotografa (com `npx vite preview` rodando)
python3 -I tools/export_engine.py                        # pacote para o Unreal
```

## 8. Riscos e não verificado

- FPS real em celular e PC: não medido.
- WebGPU num navegador de verdade: não testado (só a volta para WebGL 2).
- Nuvem e apelido contra o Supabase real: não testados (migração não aplicada).
- Página do claude.ai no iPhone do Alex: a versão 1 foi aberta por ele; a 2 e a 3, não confirmadas.
- O filtro de apelido é uma lista curta: tem falso positivo (por exemplo, qualquer nome com "puta" dentro) e não
  pega tudo.
- A praia larga é dado real e diverge da referência: decisão pendente do Alex.
- Os termos do Tripo foram lidos pelo Codex, não pela sessão 1 (resumo em `TRIPO.md`).
