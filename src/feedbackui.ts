import { COMMUNITY_REPO, FEEDBACK_LIMITS, feedbackIssueUrl } from "./feedback.ts";
import { SUPPORT, copyPixKey } from './support.ts';
import { renderAccountability } from './accountabilityui.ts';
import { mountEffort } from './effortui.ts';
import { renderProjectPlan } from './project-plan-ui.ts';
import { mountVolunteerPanel } from './volunteersui.ts';
import "./feedback.css";
import "./menus.css";

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
  (document.getElementById('community-diary') as HTMLAnchorElement).href=SUPPORT.diaryUrl;
  const tabs=[document.getElementById('community-ideas-tab')!,document.getElementById('community-support-tab')!,document.getElementById('community-volunteer-tab')!];
  const panels=[document.getElementById('community-ideas')!,document.getElementById('community-support')!,document.getElementById('community-volunteer')!];
  const setTab=(index:number,focus=false)=>{
    tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});
    if(focus)tabs[index].focus();
  };
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>setTab(index));
    tab.addEventListener('keydown',event=>{
      const key=event.key;
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(key))return;
      event.preventDefault();
      setTab(key==='Home'?0:key==='End'?tabs.length-1:(index+(key==='ArrowRight'?1:tabs.length-1))%tabs.length,true);
    });
  });
  const pixKey=document.getElementById('support-pix-key') as HTMLInputElement;
  const copyButton=document.getElementById('support-copy') as HTMLButtonElement;
  const supportStatus=document.getElementById('support-status')!;
  renderAccountability(document.getElementById('support-accountability')!);
  renderProjectPlan(document.getElementById('support-plan')!);
  mountVolunteerPanel(document.getElementById('community-volunteer')!);
  mountEffort(document.getElementById('support-effort')!);
  pixKey.value=SUPPORT.pixKey;
  copyButton.addEventListener('click',async()=>{
    copyButton.disabled=true;supportStatus.textContent='';
    const copied=await copyPixKey(navigator.clipboard?.writeText?.bind(navigator.clipboard));
    copyButton.disabled=false;
    // Clipboard permission can resolve after Escape or a tab change. Never steal focus back.
    if(!dialog.open||panels[1].hidden)return;
    if(copied){supportStatus.textContent='Chave Pix copiada. Cole no app do seu banco e confira o recebedor.';}
    else {
      pixKey.focus();pixKey.select();pixKey.setSelectionRange(0,pixKey.value.length);
      supportStatus.textContent='Não foi possível copiar automaticamente. A chave está selecionada; use Copiar no seu aparelho.';
    }
  });

  document.querySelectorAll<HTMLElement>("[data-feedback-open]").forEach((button) => {
    button.addEventListener("click", () => {
      if (dialog.open) return;
      opener = button;
      setTab(0);supportStatus.textContent='';
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
