const express=require('express'),pool=require('../config/db'),crypto=require('crypto');
const {loadChannel,lineRequest,signatureValid}=require('../services/line_channels');
const router=express.Router();
router.post('/:branch',express.raw({type:'application/json',limit:'1mb'}),async(req,res)=>{
 const branch=req.params.branch;if(!['navamin','rangsit'].includes(branch))return res.sendStatus(404);
 if(!Buffer.isBuffer(req.body))return res.sendStatus(400);let body;try{body=JSON.parse(req.body.toString('utf8'));}catch{return res.sendStatus(400);}
 if(!Array.isArray(body.events))return res.sendStatus(400);
 const relevant=body.events.filter(e=>['follow','unfollow'].includes(e.type)&&e.source?.type==='user');
 // Ignored chat content causes no database or LINE API work and no state change.
 if(body.events.length&&!relevant.length)return res.status(200).json({ok:true});
 try{const channel=await loadChannel(pool,branch);if(!signatureValid(req.body,req.get('x-line-signature'),channel.secret))return res.sendStatus(401);if(channel.bot_user_id&&body.destination!==channel.bot_user_id)return res.sendStatus(401);
 for(const event of relevant){const user=event.source.userId;if(!/^U[0-9a-f]{32}$/i.test(user))continue;const timestamp=Number(event.timestamp);if(!Number.isSafeInteger(timestamp)||timestamp<=0)continue;const eventId=typeof event.webhookEventId==='string'?event.webhookEventId:crypto.createHash('sha256').update(branch+'|'+user+'|'+event.type+'|'+timestamp).digest('hex');
 let name='';if(event.type==='follow'){const profile=(await lineRequest(channel,'/v2/bot/profile/'+encodeURIComponent(user))).data;name=String(profile.displayName||'ลูกค้า LINE').slice(0,200);}
 const client=await pool.connect();try{await client.query('BEGIN');const inserted=await client.query('INSERT INTO public.line_customer_events(branch,event_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[branch,eventId]);if(inserted.rows.length){if(event.type==='follow')await client.query('INSERT INTO public.line_customers(branch,line_user_id,display_name,last_event_ms) VALUES($1,$2,$3,$4) ON CONFLICT(branch,line_user_id) DO UPDATE SET display_name=EXCLUDED.display_name,is_active=true,last_event_ms=EXCLUDED.last_event_ms,updated_at=CURRENT_TIMESTAMP WHERE line_customers.last_event_ms<=EXCLUDED.last_event_ms',[branch,user,name,timestamp]);else await client.query('UPDATE public.line_customers SET is_active=false,last_event_ms=$3,updated_at=CURRENT_TIMESTAMP WHERE branch=$1 AND line_user_id=$2 AND last_event_ms<=$3',[branch,user,timestamp]);}await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 res.json({ok:true});
 }catch(error){console.error('LINE follow webhook failed:',error.code||error.upstreamStatus||'unavailable');res.sendStatus(503);}
});module.exports=router;
