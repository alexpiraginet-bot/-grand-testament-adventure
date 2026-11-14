import type {Receiver} from './interactions.ts';

/** The input belongs to the last painted label. Revalidate it against the current
 * world before dispatching: walking past a target must never activate its neighbour. */
export function sameAction(a:Receiver,b:Receiver):boolean {
  return a.to!=='none' && b.to===a.to && a.label===b.label
    && (a.to!=='target' || b.to==='target' && a.id===b.id);
}
export class ContextAction {
  private shown:Receiver={to:'none'};
  present(receiver:Receiver){this.shown={...receiver};}
  clear(){this.shown={to:'none'};}
  take(pressed:boolean,current:Receiver):Receiver {
    if(!pressed)return{to:'none'};
    const result=sameAction(this.shown,current)?{...current}:{to:'none' as const};
    this.clear();return result;
  }
  snapshot():Receiver{return{...this.shown};}
}

/** Curated fictional dialogue for the existing adult actor. Never a Bible quote.
 * No runtime generation, synthetic speech or scripture substitution. */
export const SIMAO_CONVERSATION={
  before:[
    'O trabalho das redes ocupa boa parte do nosso dia. Aqui na margem, cada par de mãos ajuda.',
    'Se quiser conhecer a vila, siga a trilha que sobe entre as casas.',
  ],
  following:[
    'Vou com você. Deixamos as redes e agora seguimos juntos.',
    'O caminho de volta à cidade passa pela trilha entre as casas.',
  ],
} as const;
export interface Conversation {actorId:'simao';lines:readonly string[];index:number}
export const beginConversation=(following:boolean):Conversation=>({actorId:'simao',lines:following?SIMAO_CONVERSATION.following:SIMAO_CONVERSATION.before,index:0});
export const conversationLabel=(talk:Conversation)=>talk.index+1<talk.lines.length?'Continuar conversa':'Encerrar conversa';
export function advanceConversation(talk:Conversation):Conversation|null {
  return talk.index+1<talk.lines.length?{...talk,index:talk.index+1}:null;
}
