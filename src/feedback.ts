// Only explicit form fields leave the game, after the player's confirmation.
// No save, recovery code, nickname from storage, device data or credential is read here.
export const COMMUNITY_REPO = "https://github.com/alexpiraginet-bot/grand-testament-adventure";
export const FEEDBACK_LIMITS = { title: 90, description: 1000, nickname: 32, url: 7000 } as const;
export const FEEDBACK_KINDS = { idea: "Ideia de melhoria", problem: "Problema encontrado", opinion: "Opinião" } as const;

export type FeedbackDraft = {
  kind: string;
  title: string;
  description: string;
  nickname: string;
  acknowledged: boolean;
};
export type FeedbackResult = { ok: true; url: string } | { ok: false; error: string };

/** GitHub's issue composer still requires sign-in and an explicit publish there. */
export function feedbackIssueUrl(draft: FeedbackDraft): FeedbackResult {
  if (!Object.hasOwn(FEEDBACK_KINDS, draft.kind)) return { ok: false, error: "Escolha o tipo de contribuição." };
  const title = draft.title.trim(), description = draft.description.trim(), nickname = draft.nickname.trim();
  if (title.length < 4 || title.length > FEEDBACK_LIMITS.title || /[\r\n]/.test(title)) {
    return { ok: false, error: `Escreva um título de 4 a ${FEEDBACK_LIMITS.title} caracteres em uma linha.` };
  }
  if (description.length < 10 || description.length > FEEDBACK_LIMITS.description) {
    return { ok: false, error: `Conte um pouco mais, entre 10 e ${FEEDBACK_LIMITS.description} caracteres.` };
  }
  if (nickname.length > FEEDBACK_LIMITS.nickname || /[\r\n]/.test(nickname)) {
    return { ok: false, error: `Use um apelido de até ${FEEDBACK_LIMITS.nickname} caracteres em uma linha.` };
  }
  if (!draft.acknowledged) return { ok: false, error: "Confirme que seu texto pode ficar público no GitHub." };

  const kind = FEEDBACK_KINDS[draft.kind as keyof typeof FEEDBACK_KINDS];
  const body = [
    "### Tipo de contribuição", kind,
    "### Relato do jogador", description,
    ...(nickname ? ["### Apelido informado", nickname] : []),
    "---", "Enviado pelo formulário Construa conosco. Proposta para análise; ainda não aprovada.",
  ].join("\n\n");
  const url = new URL(`${COMMUNITY_REPO}/issues/new`);
  url.searchParams.set("title", `[Comunidade] ${title}`);
  url.searchParams.set("body", body);
  // Do not set labels/assignees: ordinary players may not have that permission.
  if (url.href.length > FEEDBACK_LIMITS.url) {
    return { ok: false, error: "Esse texto ficou grande demais para abrir no GitHub. Encurte um pouco; seu rascunho continua aqui." };
  }
  return { ok: true, url: url.href };
}
