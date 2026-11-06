import {privateHandlers} from '@/lib/privateStudio/http';
import {studioStore} from '@/lib/privateStudio/store';
export const runtime='nodejs';
export const maxDuration=180;
const handlers=privateHandlers(studioStore);
export const GET=handlers.GET;
export const POST=handlers.POST;
