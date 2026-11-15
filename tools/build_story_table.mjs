// The twenty steps of the story after the teaching, as a table for editorial review: docs/JORNADA-R16-MISSOES.md.
// Nothing in it is typed: the references, the clauses, the places and the distances come from the same modules and
// data the game runs (src/story-steps.ts, src/story-journey.ts, src/story-places.ts, src/data/mc-caminho.json), with
// the places computed on the real terrain against the town's colliders rebuilt as the tests rebuild them.
//   node tools/build_story_table.mjs          writes the file
//   node tools/build_story_table.mjs --check  fails if the committed file differs (test/story-table.test.ts runs it)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MARGIN, P, beach, routes, scene, start, t } from "../test/fixtures/town-scene.ts";
import { townLife } from "../src/town-life-layout.ts";
import { storyPlaces, STORY_PLACES } from "../src/story-places.ts";
import { STORY, storySteps } from "../src/story-journey.ts";
import { readingTime } from "../src/missions.ts";

const OUT = new URL("../docs/JORNADA-R16-MISSOES.md", import.meta.url);
const REVIEW = { cura: "cura ou expulsão narrada só com o texto", "controvérsia": "controvérsia narrada só com o texto" };
const PLACE = {
  casa: "porta da casa escolhida pelo jogo para Marcos 1:29", "rua-da-casa": "rua diante da casa, na viela da missão",
  "lugar-deserto": "chão aberto mais próximo da casa sem construção a menos de 60 m", encontro: "30 m de volta, na direção da casa",
  "caminho-das-aldeias": "chão aberto 120 m mais longe da casa que o lugar deserto", caminho: "60 m de volta, na direção da vila",
  praia: "praia onde a viela chega ao lago (ponto do primeiro episódio)", posto: "chão seco ao lado do caminho da margem, 70 m depois da praia",
  "casa-de-levi": "porta de outra casa, a mais próxima do posto", redes: "onde estão as redes (ponto do primeiro episódio)",
  barco: "margem junto ao barco (ponto do primeiro episódio)", monte: "o chão mais próximo do barco que sobe 15 m acima do lago",
};

export function render() {
  const data = JSON.parse(readFileSync(new URL("../src/data/mc-caminho.json", import.meta.url), "utf8"));
  const steps = storySteps(data);
  const town = scene(256), life = townLife({ terrain: t, start, beach, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN });
  const places = storyPlaces({ terrain: t, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN, beach,
    nets: { x: P.simao[0], z: P.simao[1] }, boat: { x: P.barco_margem[0], z: P.barco_margem[1] }, house: life?.onward ?? null });
  if (!steps || !places) throw new Error("the story is not available on this terrain: nothing to tabulate");
  const at = places.at, dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const f = (n) => (Math.abs(n) < 0.05 ? 0 : n).toFixed(1).replace(".", ",");            // no "-0,0" for the shore's -0.01
  const cell = (s) => s.replace(/\|/g, "\\|");
  let walked = 0, seconds = 0, prev = at.casa;
  const rows = steps.map((s, i) => {
    const here = at[s.def.place], leg = dist(prev, here);
    walked += leg; prev = here;
    const read = s.lines.reduce((n, l) => n + readingTime(l.texto), 0);
    seconds += read;
    const clauses = s.lines.map((l) => `“${cell(l.texto)}” (${l.ref})`).join("<br>");
    return `| ${i + 1} | \`${s.def.id}\` | ${s.ref} | ${cell(s.def.objective)} | ${s.def.action ? `**${cell(s.def.action)}** — ${cell(s.def.doing)}` : "chegar ao lugar"} | ${clauses} | \`${s.def.place}\` · ${Math.round(leg)} m | ${s.def.people ? "sim" : "não"} | ${s.def.review ? REVIEW[s.def.review] : "—"} |`;
  });
  const placeRows = Object.entries(at).map(([id, p]) => `| \`${id}\` | ${PLACE[id]} | ${f(p.x)} | ${f(p.z)} | ${f(t.heightAt(p.x, p.z))} |`);
  const clauses = steps.reduce((n, s) => n + s.lines.length, 0);
  return [
    "# Jornada R16 — as vinte missões (tabela gerada)",
    "",
    "> Gerado por `tools/build_story_table.mjs` a partir do código e dos dados que o jogo roda. Não editar à mão:",
    "> `node tools/build_story_table.mjs` refaz, `--check` confere, e `test/story-table.test.ts` falha se este arquivo ficar para trás.",
    "",
    `Texto: ${data.fonte_texto} (${data.alteracao}). Passagens: ${data.passagens.join("; ")}.`,
    `Origem: \`${data.origem.texto}\`, SHA-256 \`${data.origem.texto_sha256}\`, commit \`${data.origem.commit}\`.`,
    "",
    "Cada linha é uma missão: um lugar a alcançar no terreno real e, quando a passagem lhe dá algo a fazer, uma ação com o",
    "botão. O que aparece na tela como citação é a coluna **Na tela**: orações recortadas do versículo, ao pé da letra, cada",
    "uma com a sua referência (\"Bíblia Livre · referência\"). **Objetivo** e **Ação** são orientação do jogo, não texto bíblico.",
    "Nenhuma fala foi escrita para personagem algum. Nenhuma pessoa destas passagens está desenhada (só Simão tem modelo",
    "revisado): onde a coluna **Pessoas** diz \"sim\", o aviso \"Cena em desenvolvimento · personagens em preparação.\" aparece.",
    "",
    "| # | id (registro do mundo) | Passagem | Objetivo | Ação | Na tela (literal) | Lugar · trecho em linha reta | Pessoas | Revisão editorial pedida |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    `Totais calculados: ${steps.length} missões, ${steps.filter((s) => s.def.action).length} com ação e ${steps.filter((s) => !s.def.action).length} vividas ao chegar; ${clauses} orações na tela, ${Math.round(seconds)} s de leitura ao todo;`,
    `${Math.round(walked)} m em linha reta entre os lugares, na ordem (o caminho real contorna casas e é mais longo). O herói anda a 2,5 m/s e corre a 5,2 m/s (\`src/main.ts\`).`,
    `Uma missão é oferecida a ${STORY.radius} m do seu lugar; quem se afasta mais de ${STORY.radius + STORY.leave} m com as orações na tela as interrompe, sem nada salvo.`,
    "",
    "## Lugares",
    "",
    "Todos são **posição escolhida pelo jogo** no seu terreno com direção de arte: nenhuma fonte os situa aqui e nenhum é",
    "apresentado como o local histórico. Coordenadas em metros no mapa do jogo (x para leste, z para sul; altura acima do lago),",
    `calculadas por \`src/story-places.ts\`; iguais para o chão de 256 e de 192 segmentos. Cada lugar fica a pelo menos ${STORY_PLACES.edge} m do limite da região.`,
    "",
    "| Lugar | Regra | x | z | altura |",
    "|---|---|---|---|---|",
    ...placeRows,
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = render();
  if (process.argv.includes("--check")) {
    const had = (() => { try { return readFileSync(OUT, "utf8"); } catch { return null; } })();
    if (had !== text) { console.error("docs/JORNADA-R16-MISSOES.md differs from what the code and the data give: run node tools/build_story_table.mjs"); process.exit(1); }
    console.log("docs/JORNADA-R16-MISSOES.md matches the code and the data");
  } else { writeFileSync(OUT, text); console.log(`wrote ${fileURLToPath(OUT)}`); }
}
