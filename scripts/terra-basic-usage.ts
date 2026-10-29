// Explicit read-only SQL: bypass usage-store initialization (which contains DDL).
import {loadEnvConfig} from '@next/env';
import {Client} from 'pg';
import {writeFileSync} from 'node:fs';
loadEnvConfig(process.cwd());
const db=new Client({connectionString:process.env.DATABASE_URL||process.env.POSTGRES_URL,connectionTimeoutMillis:8000});
try {await db.connect();await db.query('BEGIN READ ONLY');const {rows}=await db.query("SELECT created_at,model,stage,input_tokens,output_tokens,max_output_tokens,finish_reason,latency_ms,success FROM ai_usage WHERE stage LIKE 'villa-scene%' ORDER BY created_at DESC LIMIT 12");await db.query('ROLLBACK');writeFileSync('docs/villa-playground/terra-basic-diagnosis/scene-usage.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));}finally{await db.end();}
