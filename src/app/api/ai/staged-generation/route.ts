/** Defence in depth: there is deliberately no live-provider import or enable flag.
 * The proxy also blocks this route. Implement and verify the security plan before replacing this handler. */
export async function POST(){
 return Response.json({error:'Live staged generation is disabled pending verified sessions, project ownership and atomic spending reservations.'},{status:403,headers:{'Cache-Control':'no-store'}});
}
