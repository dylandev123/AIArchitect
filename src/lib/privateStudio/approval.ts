/** Local administrator operation only. Never exposed through HTTP or invoked automatically.
 * Codex may call this only AFTER the user explicitly authorizes the reviewed approval packet. */
import {randomUUID} from 'node:crypto';
import {StudioStore} from './store';
import {POLICY_HASH,briefHash,StudioError,policyHash,type StudioPolicy} from './policy';
export async function approvePrivateRun(store:StudioStore,brief:string,projectId?:string,policy?:StudioPolicy){
 const hash=policy?policyHash(policy):POLICY_HASH;
 return store.transaction(s=>{
  if(!s.account)throw new StudioError(409,'Set up private Studio sign-in before granting a live approval');
  if(projectId&&(!s.projects[projectId]||s.projects[projectId].owner!==s.account.owner||s.projects[projectId].runId))throw new StudioError(409,'Approval requires an owned project with no existing run');
  if(s.approvals.some(a=>!a.consumedBy))throw new StudioError(409,'An unused approval already exists');
  const approval={id:randomUUID(),owner:s.account.owner,projectId,briefHash:briefHash(brief),policyHash:hash,approvedAt:new Date().toISOString()};
  s.approvals.push(approval);return {id:approval.id,policyHash:hash};
 });
}
