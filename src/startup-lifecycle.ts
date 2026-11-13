import {abortable} from './asset-loading.ts';

/** A failed startup is terminal. Own both ready resources and values resolving after cancellation. */
export class StartupLifecycle {
  private controller=new AbortController();
  private disposers=new Set<()=>void>();
  readonly signal=this.controller.signal;
  check(){this.signal.throwIfAborted();}
  cancel(reason:unknown):boolean {
    if(this.signal.aborted)return false;
    this.controller.abort(reason);
    for(const dispose of this.disposers){try{dispose();}catch(error){console.warn('Resource cleanup failed',error);}}
    this.disposers.clear();return true;
  }
  track<T>(task:Promise<T>,dispose:(resource:T)=>void):Promise<T>{
    const tracked=task.then(resource=>{
      if(this.signal.aborted){dispose(resource);this.check();}
      this.disposers.add(()=>dispose(resource));return resource;
    });
    return abortable(tracked,this.signal);
  }
}
