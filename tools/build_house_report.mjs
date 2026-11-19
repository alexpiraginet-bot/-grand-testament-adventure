// The house kit in numbers, for review: docs/CASAS-R17-NUMEROS.md. Nothing in it is typed: every figure comes from
// src/house-kit.ts run on the village's real lots (rebuilt as the tests rebuild them) and from the catalogues.
//   node tools/build_house_report.mjs          writes the file
//   node tools/build_house_report.mjs --check  fails if the committed file differs (test/house-kit.test.ts runs it)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { read, scene } from "../test/fixtures/town-scene.ts";
import { HOUSE_KIT, houseDesign, houseMesh, mergeHouses, villageDesigns } from "../src/house-kit.ts";

const OUT = new URL("../docs/CASAS-R17-NUMEROS.md", import.meta.url);
const KIND = { sala: "um cômodo", "duas-salas": "dois cômodos, o segundo mais baixo e recuado", patio: "cômodo e pátio murado com forno", escada: "cômodo com terraço e escada de pedra", alpendre: "cômodo recuado atrás de um alpendre", sobrado: "cômodo com um quarto menor no terraço" };
const FINISH = { pedra: "pedra à vista", reboco: "reboco de barro até um rodapé de pedra", meio: "reboco só na parte de cima" };
const n = (v) => v.toLocaleString("pt-BR"), m = (v, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function render() {
  const town = scene(256), catalog = JSON.parse(read("src/data/tripo-assets.json").toString()), materials = JSON.parse(read("src/data/house-materials-r17.json").toString());
  const lots = town.plans.map((p, i) => ({ w: p.w, d: p.d, h: p.h, seed: i + 1, x: p.x, z: p.z }));
  const designs = villageDesigns(lots), meshes = designs.map(houseMesh), plain = lots.map((l) => houseDesign({ w: l.w, d: l.d, h: l.h, seed: l.seed }));
  const village = mergeHouses(meshes.map((mesh, i) => ({ mesh, x: town.plans[i].x, y: town.plans[i].y, z: town.plans[i].z, rot: town.plans[i].rot })));
  const count = (list, key) => { const out = new Map(); for (const d of list) out.set(key(d), (out.get(key(d)) ?? 0) + 1); return out; };
  const alike = (list) => { let pairs = 0; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (Math.hypot(lots[i].x - lots[j].x, lots[i].z - lots[j].z) < HOUSE_KIT.village.reach && list[i].look === list[j].look) pairs++; return pairs; };
  const range = (key) => `${m(Math.min(...lots.map((l) => l[key])))} a ${m(Math.max(...lots.map((l) => l[key])))}`;
  const tris = meshes.map((x) => x.triangles), total = tris.reduce((a, b) => a + b, 0), vertices = ["wall", "mud", "wood"].reduce((a, id) => a + village[id].positions.length / 3, 0);
  const bytes = ["wall", "mud", "wood"].reduce((a, id) => a + village[id].positions.byteLength + village[id].normals.byteLength + village[id].uvs.byteLength + village[id].colors.byteLength + village[id].indices.byteLength, 0);
  const sculpted = ["casa-basalto-a", "casa-basalto-b", "casa-basalto-c"], used = sculpted.map((_, v) => town.plans.filter((p) => p.variant === v).length), now = sculpted.reduce((a, id, v) => a + catalog.assets[id].triangles * used[v], 0);
  const over = meshes.map((x, i) => x.height - lots[i].h), kinds = count(designs, (d) => d.kind), finishes = count(designs, (d) => d.look.split("|")[1]), roofs = count(designs, (d) => d.look.split("|")[2]);
  const files = Object.entries(materials.materials).flatMap(([name, mat]) => Object.entries(mat.profiles).map(([profile, roles]) => ({ name, profile, size: Object.values(roles)[0].size, bytes: Object.values(roles).reduce((a, e) => a + e.bytes, 0) })));
  const lines = [
    "# Kit de casas R17 — números", "",
    "Gerado por `node tools/build_house_report.mjs` a partir de `src/house-kit.ts` nos lotes reais da vila. Não editar à mão:",
    "`test/house-kit.test.ts` falha se este arquivo diferir do que o código dá. Contexto, limites e decisões em `docs/CASAS-R17.md`.", "",
    "## Os lotes", "",
    `- ${n(lots.length)} lotes (os mesmos nos perfis de chão 256 e 192). Largura ${range("w")} m, profundidade ${range("d")} m, altura ${range("h")} m.`,
    `- Malhas esculpidas em uso hoje: ${sculpted.map((id, v) => `\`${id}\` em ${n(used[v])} lotes (${n(catalog.assets[id].triangles)} triângulos cada)`).join(", ")}.`, "",
    "## As casas que o kit dá a esses lotes", "",
    "| Tipo | O que é | Casas |", "|---|---|---:|",
    ...Object.keys(KIND).map((k) => `| \`${k}\` | ${KIND[k]} | ${n(kinds.get(k) ?? 0)} |`), "",
    "| Acabamento da parede | Casas |", "|---|---:|", ...Object.keys(FINISH).map((k) => `| ${FINISH[k]} (\`${k}\`) | ${n(finishes.get(k) ?? 0)} |`), "",
    `- Cobertura: ${n(roofs.get("laje") ?? 0)} com laje de terra batida até a borda, ${n(roofs.get("terraço") ?? 0)} com terraço dentro de um parapeito.`,
    `- Aparências distintas (tipo + acabamento + cobertura): ${n(new Set(designs.map((d) => d.look)).size)}. Desenhos distintos (com medidas, lado e aberturas): ${n(new Set(designs.map((d) => d.signature)).size)} em ${n(lots.length)} lotes.`,
    `- Vizinhas com a mesma aparência a menos de ${n(HOUSE_KIT.village.reach)} m: ${n(alike(plain))} pares se cada lote sorteia sozinho; ${n(alike(designs))} com \`villageDesigns\`, que fez ${n(designs.filter((d, i) => d.seed !== lots[i].seed).length)} lotes sortearem de novo.`,
    `- Entrada: ${n(designs.filter((d) => d.entrance.gate).length)} casas entram pelo portão do pátio, ${n(designs.filter((d) => d.entrance.inset > 0.5).length)} têm a porta sob o alpendre, as outras ${n(designs.filter((d) => !d.entrance.gate && d.entrance.inset <= 0.5).length)} têm a porta na fachada.`,
    `- Altura: ${n(over.filter((v) => v > 0.15).length)} casas passam da altura do lote (a mais alta, ${m(Math.max(...over))} m acima; a casa mais alta mede ${m(Math.max(...meshes.map((x) => x.height)))} m). O colisor que segura a câmera precisa do topo da malha (\`HouseMesh.height\`), não do lote.`, "",
    "## Custo", "",
    "| | Hoje (3 malhas esculpidas repetidas) | Kit |", "|---|---:|---:|",
    `| Triângulos das casas da vila | ${n(now)} | ${n(total)} |`,
    `| Triângulos por casa | ${sculpted.map((id) => n(catalog.assets[id].triangles)).join(" / ")} | ${n(Math.min(...tris))} a ${n(Math.max(...tris))} (média ${n(Math.round(total / tris.length))}) |`,
    `| Casas diferentes | 3 | ${n(new Set(designs.map((d) => d.signature)).size)} |`, "",
    `- O kit usa ${m((100 * total) / now, 1)}% dos triângulos de hoje. Juntas (\`mergeHouses\`), as ${n(lots.length)} casas são 3 malhas, uma por material: ${n(vertices)} vértices, ${m(bytes / 1048576, 1)} MiB de geometria na memória (posição, normal, UV, cor e índices), feita ao abrir o jogo e não baixada.`,
    "- A troca: hoje as três malhas são instanciadas, então a geometria de cada uma existe uma só vez; no kit cada casa tem a sua. Menos triângulos desenhados, mais memória de geometria.",
    "- Não medido aqui: quadros por segundo e memória de GPU no jogo real. As casas ainda não estão na vila.", "",
    "## Materiais gerados por código", "",
    "| Material | Perfil | Lado | Bytes (cor + normal + rugosidade) |", "|---|---|---:|---:|",
    ...files.map((f) => `| \`${f.name}\` | ${f.profile} | ${n(f.size)} px | ${n(f.bytes)} |`), "",
    `- Total: ${n(files.reduce((a, f) => a + f.bytes, 0))} bytes em ${n(files.length * 3)} arquivos; um jogador baixaria só o seu perfil: ${["mobile", "desktop"].map((p) => `${p} ${n(files.filter((f) => f.profile === p).reduce((a, f) => a + f.bytes, 0))} bytes`).join(", ")}. A madeira é a de \`facade-materials-r13\`, já no jogo.`,
    `- Tamanho no mundo: pedra ${m(HOUSE_KIT.tile.wall, 1)} m por repetição, reboco ${m(HOUSE_KIT.tile.mud, 1)} m, madeira ${m(HOUSE_KIT.tile.wood, 1)} m.`, "",
  ];
  return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = render();
  if (process.argv.includes("--check")) {
    if (readFileSync(OUT, "utf8") !== text) { console.error("docs/CASAS-R17-NUMEROS.md differs from the code: run node tools/build_house_report.mjs"); process.exit(1); }
    console.log("docs/CASAS-R17-NUMEROS.md matches the code");
  } else { writeFileSync(OUT, text); console.log(`wrote ${fileURLToPath(OUT)} (${text.length} characters)`); }
}
