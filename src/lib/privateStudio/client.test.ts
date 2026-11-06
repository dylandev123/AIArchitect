import {expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {matchesApproval,readDraft,writeDraft,startOrAdvance} from './client';
it('retains exact project drafts across a remount without replacing them with the example',()=>{
 const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 const brief='Three spacious bedrooms.\n\nKeep the exact prompt.';
 writeDraft(storage,'owned',brief);
 expect(readDraft(storage,'owned','example')).toBe(brief);
 expect(readDraft(storage,'other','example')).toBe('example');
});
it('matches the exact approved description and project, not merely any unused approval',async()=>{
 const brief='Three spacious bedrooms';
 const approvals=[{projectId:'owned',briefHash:createHash('sha256').update(brief).digest('hex')}];
 expect(await matchesApproval(approvals,'owned',brief)).toBe(true);
 expect(await matchesApproval(approvals,'owned','built-in example')).toBe(false);
 expect(await matchesApproval(approvals,'other',brief)).toBe(false);
});
it('wires Start to start then one advance; a rejected start never advances or retries',async()=>{
 const post=vi.fn().mockResolvedValueOnce({runId:'offline',stage:0}).mockResolvedValueOnce({runId:'offline',stage:1});
 const saved=vi.fn();
 expect(await startOrAdvance(post,undefined,'owned','exact',saved)).toEqual({runId:'offline',stage:1});
 expect(post.mock.calls[0][0]).toEqual({action:'start',projectId:'owned',brief:'exact'});
 expect(post.mock.calls[1][0]).toMatchObject({action:'advance',runId:'offline',stage:1});
 expect(saved).toHaveBeenCalledWith({runId:'offline',stage:0});
 const denied=vi.fn().mockRejectedValue(Error('No explicit live approval'));
 await expect(startOrAdvance(denied,undefined,'owned','wrong')).rejects.toThrow('No explicit live approval');
 expect(denied).toHaveBeenCalledTimes(1);
});
it('retains the newly created run on an uncertain advance and never repeats it',async()=>{
 const post=vi.fn().mockResolvedValueOnce({runId:'offline',stage:0}).mockRejectedValueOnce(Error('connection lost'));
 const saved=vi.fn();
 await expect(startOrAdvance(post,undefined,'owned','exact',saved)).rejects.toThrow('connection lost');
 expect(saved).toHaveBeenCalledWith({runId:'offline',stage:0});expect(post).toHaveBeenCalledTimes(2);
});
