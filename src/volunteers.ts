import {COMMUNITY_REPO} from './feedback.ts';

/** Open areas proposed by the maintainers, not job vacancies or a live member count. */
export const VOLUNTEER_ROLES=[
  {id:'engineering',label:'Engenharia e ferramentas',description:'TypeScript, revisão de código, testes e ferramentas para colaborar com segurança.'},
  {id:'gameplay',label:'Gameplay e jornada',description:'Movimento, câmera, interações e missões que deixem a aventura mais gostosa de jogar.'},
  {id:'rendering',label:'Gráficos · WebGPU e three.js',description:'Luz, água, efeitos e desempenho medidos no PC e em celulares.'},
  {id:'art3d',label:'Arte 3D e materiais',description:'Modelos, texturas, materiais e versões otimizadas, com origem e licença registradas.'},
  {id:'animation',label:'Rig e animação',description:'Esqueletos, movimentos e integração das animações de personagens e animais.'},
  {id:'qa',label:'Testes e acessibilidade',description:'Testar aparelhos reais, teclado, toque, legibilidade e caminhos acessíveis.'},
  {id:'research',label:'Pesquisa histórica e bíblica',description:'Conferir fontes, citações da Bíblia Livre e referências do século I, separando história e recriação.'},
  {id:'audio',label:'Áudio e paisagem sonora',description:'Sons, ambientes e música originais ou com licença compatível e crédito.'},
  {id:'world',label:'Mapas e construção do mundo',description:'Relevo, caminhos, arquitetura e composição dos lugares do jogo.'},
] as const;
export const VOLUNTEER_AVAILABILITY=[
  {id:'2',label:'Cerca de 2 horas por semana'},
  {id:'5',label:'Cerca de 5 horas por semana'},
  {id:'10',label:'Cerca de 10 horas por semana'},
  {id:'20',label:'Cerca de 20 horas por semana'},
] as const;
export const VOLUNTEER_LIMITS={motivation:1000,portfolio:500,url:7000} as const;
export type VolunteerDraft={role:string;availability:string;portfolio:string;motivation:string;acknowledged:boolean};
export type VolunteerField='role'|'availability'|'portfolio'|'motivation'|'consent';
export type VolunteerResult={ok:true;url:string}|{ok:false;field:VolunteerField;error:string};

/** Builds a public GitHub draft; neither publishes it nor accepts the candidate. */
export function volunteerIssueUrl(draft:VolunteerDraft):VolunteerResult {
  const role=VOLUNTEER_ROLES.find(item=>item.id===draft.role);
  if(!role)return {ok:false,field:'role',error:'Escolha uma frente em que gostaria de colaborar.'};
  const availability=VOLUNTEER_AVAILABILITY.find(item=>item.id===draft.availability);
  if(!availability)return {ok:false,field:'availability',error:'Escolha sua disponibilidade semanal aproximada.'};
  const rawPortfolio=draft.portfolio.trim();let portfolio='';
  if(rawPortfolio) {
    if(rawPortfolio.length>VOLUNTEER_LIMITS.portfolio||/[\r\n\t]/.test(rawPortfolio))return {ok:false,field:'portfolio',error:'Use um link HTTPS de até 500 caracteres, em uma linha e sem dados de acesso.'};
    try {
      const parsed=new URL(rawPortfolio);
      if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password)throw new Error('Invalid public portfolio');
      portfolio=parsed.href;
    } catch {return {ok:false,field:'portfolio',error:'O portfólio é opcional. Se preencher, use um link HTTPS público, sem usuário ou senha na URL.'};}
  }
  const motivation=draft.motivation.trim();
  if(motivation.length<20||motivation.length>VOLUNTEER_LIMITS.motivation||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(motivation)) {
    return {ok:false,field:'motivation',error:'Conte como gostaria de ajudar, entre 20 e 1.000 caracteres.'};
  }
  if(!draft.acknowledged)return {ok:false,field:'consent',error:'Confirme que entende que sua candidatura ficará pública no GitHub.'};
  const body=[
    '### Frente de colaboração',role.label,
    '### Disponibilidade aproximada',availability.label,
    ...(portfolio?['### Portfólio público (opcional)',portfolio]:[]),
    '### Como gostaria de ajudar',motivation,
    '### Ciência da publicação','Entendo que estas informações serão públicas no GitHub e que a candidatura depende de análise dos mantenedores.',
    '---','Proposta voluntária enviada pelo Colabore. Não representa entrada confirmada na equipe, contratação ou tarefa já atribuída.',
  ].join('\n\n');
  const url=new URL(`${COMMUNITY_REPO}/issues/new`);
  url.searchParams.set('title',`[Voluntariado] ${role.label}`);url.searchParams.set('body',body);
  // No labels, assignees, tokens, saved-game data, contact details or API call.
  if(url.href.length>VOLUNTEER_LIMITS.url)return {ok:false,field:'motivation',error:'O link ficou grande demais para abrir no GitHub. Encurte um pouco o texto; seu rascunho continua aqui.'};
  return {ok:true,url:url.href};
}
