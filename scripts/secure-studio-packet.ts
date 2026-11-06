/** Public approval metadata only. Does NOT authorize a run or import a provider. */
import {writeFileSync} from 'node:fs';
import {FIRST_BRIEF,LIVE_POLICY,POLICY_HASH,RESERVATION_MICROS,briefHash} from '@/lib/privateStudio/policy';
writeFileSync('docs/architecture/secure-live-studio/approval-packet.json',JSON.stringify({status:'NOT APPROVED',brief:FIRST_BRIEF,briefHash:briefHash(FIRST_BRIEF),policy:LIVE_POLICY,policyHash:POLICY_HASH,reservationMicrosPerCall:RESERVATION_MICROS,maximumFiveReservationsMicros:RESERVATION_MICROS*5,paidCalls:0},null,2));
console.log('Wrote public approval packet; no approval granted and no paid calls');
