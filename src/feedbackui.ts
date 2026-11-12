import { COMMUNITY_REPO, FEEDBACK_LIMITS, feedbackIssueUrl } from "./feedback.ts";
import "./feedback.css";

export function setupFeedbackPanel(onOpenChange: (open: boolean) => void) {
  const dialog = document.getElementById("feedback") as HTMLDialogElement;
  const form = document.getElementById("feedback-form") as HTMLFormElement;
  const title = document.getElementById("feedback-title") as HTMLInputElement;
  const description = document.getElementById("feedback-description") as HTMLTextAreaElement;
  const nickname = document.getElementById("feedback-nickname") as HTMLInputElement;
  const kind = document.getElementById("feedback-kind") as HTMLSelectElement;
  const consent = document.getElementById("feedback-public") as HTMLInputElement;
  const error = document.getElementById("feedback-error")!;
  const status = document.getElementById("feedback-status")!;
  let opener: HTMLElement | null = null;
  let controlsSuspended = false;
  title.maxLength = FEEDBACK_LIMITS.title;
  description.maxLength = FEEDBACK_LIMITS.description;
  nickname.maxLength = FEEDBACK_LIMITS.nickname;
  (document.getElementById("community-issues") as HTMLAnchorElement).href = `${COMMUNITY_REPO}/issues`;

  document.querySelectorAll<HTMLElement>("[data-feedback-open]").forEach((button) => {
    button.addEventListener("click", () => {
      if (dialog.open) return;
      opener = button;
      document.exitPointerLock?.();
      dialog.showModal();
      controlsSuspended = true;
      onOpenChange(true);
      // Focus a heading rather than raising the phone keyboard before the player chooses a field.
      document.getElementById("feedback-heading")!.focus();
    });
  });
  const resume = () => {
    if (!controlsSuspended) return;
    controlsSuspended = false;
    onOpenChange(false); opener?.focus();
  };
  const close = () => { dialog.close(); resume(); };
  document.getElementById("feedback-close")!.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("close", resume);
  form.addEventListener("input", () => { error.textContent = ""; status.textContent = ""; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";
    const result = feedbackIssueUrl({ kind: kind.value, title: title.value, description: description.value,
      nickname: nickname.value, acknowledged: consent.checked });
    if (!result.ok) { error.textContent = result.error; return; }
    // Synchronous user gesture, no API request or token. Keep the draft even if the new tab is blocked.
    window.open(result.url, "_blank", "noopener,noreferrer");
    status.textContent = "Confirme a publicação na aba do GitHub. Se ela não abriu, permita a nova aba e tente de novo. Seu rascunho continua aqui.";
  });
  return { isOpen: () => dialog.open };
}
