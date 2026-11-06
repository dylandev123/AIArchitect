/** Unforgeable by HTTP headers: only server code can establish a reserved-call context. */
import {AsyncLocalStorage} from 'node:async_hooks';
interface Permit {model:string;maxOutputTokens:number;maxWireBytes:number;dispatched:boolean;onDispatch?:()=>void}
const context=new AsyncLocalStorage<Permit>();
/** One reservation = at most one provider request. `onDispatch` lets the ledger distinguish "never sent" from "outcome unknown". */
export function withReservedCall<T>(limits:Omit<Permit,'dispatched'>,fn:()=>Promise<T>){return context.run({...limits,dispatched:false},fn);}
/**
 * Deployment switch for the pre-existing public AI routes (scene, house, villa, assets...).
 * Off by default: those routes have no verified sessions or spending reservations. Turning it on
 * restores their previous behaviour in proxy and transport; it never relaxes Private Studio, whose
 * calls always require a reservation.
 */
export const legacyAiRoutesEnabled=()=>process.env.LEGACY_AI_ROUTES==='enabled';
export function authorizeProviderDispatch(body:unknown,opts:{requireReservation?:boolean}={}){
 const permit=context.getStore();
 if(!permit&&!opts.requireReservation&&legacyAiRoutesEnabled())return;
 if(!permit||permit.dispatched)throw Error('Paid provider dispatch denied: no unused server reservation');
 if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>permit.maxWireBytes)throw Error('Provider request exceeds reserved input ceiling');
 const wire=JSON.parse(body);
 if(wire.model!==permit.model||wire.max_output_tokens!==permit.maxOutputTokens||wire.stream===true)throw Error('Provider request differs from reserved model/output contract');
 permit.dispatched=true;permit.onDispatch?.();
}
