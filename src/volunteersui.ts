import {VOLUNTEER_ROLES,VOLUNTEER_AVAILABILITY,VOLUNTEER_LIMITS,volunteerIssueUrl,type VolunteerField} from './volunteers.ts';

/** Mount inside Colabore. No backend, personal-contact collection or automatic issue publication. */
export function mountVolunteerPanel(container:HTMLElement):void {
  const doc=container.ownerDocument;
  const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,cls?:string)=>{
    const element=doc.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;
  };
  container.classList.add('volunteers');container.replaceChildren();
  const heading=node('h3','Frentes abertas para colaboração');heading.id='volunteer-heading';
  const intro=node('p','Quer construir este jogo com a gente? Escolha uma frente e conte como gostaria de contribuir. A proposta será analisada pelos mantenedores.','notice');
  const details=node('details',undefined,'volunteer-opportunities');
  details.append(node('summary','Conheça as frentes de trabalho'));
  const roles=node('ul',undefined,'volunteer-roles');
  for(const role of VOLUNTEER_ROLES){const item=node('li');item.append(node('strong',role.label),node('p',role.description));roles.append(item);}
  details.append(roles);
  const form=node('form',undefined,'volunteer-form');form.id='volunteer-form';form.noValidate=true;form.setAttribute('aria-labelledby',heading.id);
  const select=(id:string,label:string,options:readonly {id:string;label:string}[])=>{
    const field=node('label',label,'field');field.htmlFor=id;
    const input=node('select');input.id=id;input.required=true;
    const prompt=node('option','Selecione uma opção');prompt.value='';input.append(prompt);
    for(const option of options){const item=node('option',option.label);item.value=option.id;input.append(item);}
    field.append(input);form.append(field);return input;
  };
  const role=select('volunteer-role','Em que frente gostaria de ajudar?',VOLUNTEER_ROLES);
  const availability=select('volunteer-availability','Disponibilidade aproximada',VOLUNTEER_AVAILABILITY);
  const availabilityHelp=node('p','Uma estimativa para combinar as primeiras tarefas. Sua disponibilidade pode mudar.','notice');
  availabilityHelp.id='volunteer-availability-help';availability.setAttribute('aria-describedby',availabilityHelp.id);form.append(availabilityHelp);
  const portfolioLabel=node('label','Portfólio ou GitHub público (opcional)','field');portfolioLabel.htmlFor='volunteer-portfolio';
  const portfolio=node('input');portfolio.id='volunteer-portfolio';portfolio.type='url';portfolio.inputMode='url';portfolio.autocomplete='off';
  portfolio.maxLength=VOLUNTEER_LIMITS.portfolio;portfolio.placeholder='https://…';portfolioLabel.append(portfolio);
  const motivationLabel=node('label','Como gostaria de ajudar?','field');motivationLabel.htmlFor='volunteer-motivation';
  const motivation=node('textarea');motivation.id='volunteer-motivation';motivation.required=true;motivation.minLength=20;motivation.maxLength=VOLUNTEER_LIMITS.motivation;motivation.rows=4;
  motivation.placeholder='Conte um pouco da sua experiência ou do que quer aprender e construir.';motivationLabel.append(motivation);
  const privacy=node('p','Até 1.000 caracteres. Não inclua telefone, e-mail, documentos, senhas ou outras informações privadas. Não é necessário informar seu nome real.','notice');
  privacy.id='volunteer-privacy';motivation.setAttribute('aria-describedby',privacy.id);portfolio.setAttribute('aria-describedby',privacy.id);
  const consentLabel=node('label',undefined,'consent');consentLabel.htmlFor='volunteer-consent';
  const consent=node('input');consent.type='checkbox';consent.required=true;consent.id='volunteer-consent';
  consentLabel.append(consent,node('span','Entendo que estes dados serão públicos no GitHub e que a candidatura depende de análise dos mantenedores.'));
  const error=node('p',undefined,'message');error.id='volunteer-error';error.setAttribute('role','alert');
  const status=node('p',undefined,'message');status.id='volunteer-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const actions=node('div',undefined,'actions'),submit=node('button','Enviar candidatura pelo GitHub');submit.type='submit';actions.append(submit);
  const fallback=node('a','Abrir o rascunho no GitHub ↗');fallback.id='volunteer-github';fallback.hidden=true;fallback.target='_blank';fallback.rel='noopener noreferrer';
  const notice=node('p','Você precisará de uma conta no GitHub e deverá revisar e confirmar a publicação lá. Abrir o rascunho não envia a candidatura nem confirma sua entrada na equipe. Colaboração voluntária não é oferta de emprego.','notice');
  form.append(portfolioLabel,motivationLabel,privacy,consentLabel,error,status,actions,fallback,notice);
  const fields:Record<VolunteerField,HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>={role,availability,portfolio,motivation,consent};
  form.addEventListener('input',()=>{error.textContent='';status.textContent='';fallback.hidden=true;for(const field of Object.values(fields))field.removeAttribute('aria-invalid');});
  form.addEventListener('submit',event=>{
    event.preventDefault();error.textContent='';status.textContent='';fallback.hidden=true;
    const result=volunteerIssueUrl({role:role.value,availability:availability.value,portfolio:portfolio.value,motivation:motivation.value,acknowledged:consent.checked});
    if(!result.ok){error.textContent=result.error;fields[result.field].setAttribute('aria-invalid','true');fields[result.field].focus();return;}
    fallback.href=result.url;fallback.hidden=false;
    doc.defaultView?.open(result.url,'_blank','noopener,noreferrer');
    status.textContent='Revise o rascunho na aba do GitHub e confirme a publicação. A candidatura ainda será analisada. Se a aba não abriu, use o link abaixo; seu texto continua aqui.';
  });
  container.append(heading,intro,details,form);
}
