import type {Finding} from './validate';
import type {StageNo} from './pipeline';
/** Reviewable evidence for a future authorized correction; never dispatches a request. */
export function failureCategory(stage:StageNo,findings:Finding[],message=''){
 const codes=findings.map(f=>f.code).join(' ');
 if(/timeout|timed out|abort/i.test(message))return 'provider-timeout';
 if(/schema|incomplete-stage|unknown-component/.test(codes))return 'schema-validation';
 if(/designer-error/.test(codes))return /json|parse|format|schema|identifier|reference/i.test(message)?'model-formatting':'provider-execution';
 if(/construction-error|compile-failed|roof|relationship/.test(codes))return 'geometry-construction';
 if(stage===3)return 'room-solver';
 if(stage===5)return 'site-conflict';
 return 'architectural-contradiction';
}
