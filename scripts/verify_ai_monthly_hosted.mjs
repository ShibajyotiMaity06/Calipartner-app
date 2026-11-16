// Only disposable private fixtures are changed. Credentials stay in the OS wrapper/in memory.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/verify_ai_features_hosted.mjs', 'utf8');
const marker = 'try {\n  const pro = await account(true);';
if (!source.includes(marker)) throw new Error('Hosted fixture harness changed');
const setup = source.slice(0, source.indexOf(marker));
const suffix = `
try {
  const pro=await account(true),free=await account(false);
  const messages=[{role:'user',content:'Suggest one simple, safe beginner exercise.'}];
  await request('POST','/functions/v1/ai-coach',{messages,request_id:randomUUID()},free.token,403);
  await request('POST','/functions/v1/ai-coach',{messages,request_id:randomUUID()},pro.token,403);
  await rpc('accept_ai_processing_consent',{p_version:'1.1-monthly-audit'},pro.token);
  const access=await rpc('check_ai_coach_access',{p_user_id:pro.id},pro.token);
  assert.equal(access.allowed,true);
  for(const key of ['daily_cap','used_today','remaining','monthly_cap']) assert.ok(!(key in access));
  console.log('PASS Hosted Pro/consent gates and hidden allowance counters');

  const body={messages,request_id:randomUUID()};
  const answer=await request('POST','/functions/v1/ai-coach',body,pro.token);
  assert.ok(answer.message?.content?.trim());
  assert.deepEqual(await request('POST','/functions/v1/ai-coach',body,pro.token),answer);
  const second={messages:[{role:'user',content:'Suggest a simple warm-up before walking.'}],request_id:randomUUID()};
  const warm=await request('POST','/functions/v1/ai-coach',second,pro.token);
  assert.ok(warm.message?.content?.trim());
  let usage=await request('GET','/rest/v1/ai_usage?user_id=eq.'+pro.id+'&feature=eq.coach',undefined,service);
  assert.equal(usage.reduce((sum,row)=>sum+row.count,0),2);
  console.log('PASS Real coach responses, reusable-prefix API compatibility and retry replay billed once');

  const today=new Date().toISOString().slice(0,10);
  await request('POST','/rest/v1/ai_usage?on_conflict=user_id,day,feature',{user_id:pro.id,day:today,feature:'coach',count:899,tokens:0,estimated_cost:0});
  const finalChat={message:'Who are you?',request_id:randomUUID()};
  const identity=await request('POST','/functions/v1/ai-coach',finalChat,pro.token);
  assert.match(identity.message.content,/CaliPartner/);
  const denied=await request('POST','/functions/v1/ai-coach',{messages,request_id:randomUUID()},pro.token,429);
  assert.equal(denied.code,'MONTHLY_LIMIT_REACHED');
  assert.match(denied.error,/responsible.*next month/);
  assert.doesNotMatch(denied.error,/300|900/);
  assert.deepEqual(await request('POST','/functions/v1/ai-coach',finalChat,pro.token),identity);
  usage=await request('GET','/rest/v1/ai_usage?user_id=eq.'+pro.id+'&feature=eq.coach',undefined,service);
  assert.equal(usage.reduce((sum,row)=>sum+row.count,0),900);
  console.log('PASS Hosted chat boundary, polite monthly denial and replay at cap');

  await request('POST','/rest/v1/ai_usage?on_conflict=user_id,day,feature',{user_id:pro.id,day:today,feature:'food_photo',count:299,tokens:0,estimated_cost:0});
  const imageResponse=await fetch('https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=480&q=70',{signal:AbortSignal.timeout(20000)});
  assert.ok(imageResponse.ok,'Public apple fixture');
  const photo={image:Buffer.from(await imageResponse.arrayBuffer()).toString('base64'),mime_type:'image/jpeg',request_id:randomUUID()};
  const analysis=await request('POST','/functions/v1/ai-food-photo',photo,pro.token);
  assert.ok(analysis.candidates?.some(item=>/apple/i.test(item.matched_food.name)));
  assert.ok(!('usage' in analysis),'Client response hides numerical allowance');
  assert.deepEqual(await request('POST','/functions/v1/ai-food-photo',photo,pro.token),analysis);
  const photoDenied=await request('POST','/functions/v1/ai-food-photo',{description:'2 boiled eggs',request_id:randomUUID()},pro.token,429);
  assert.equal(photoDenied.code,'MONTHLY_LIMIT_REACHED');
  assert.match(photoDenied.error,/responsible.*next month/);
  assert.doesNotMatch(photoDenied.error,/300|900/);
  usage=await request('GET','/rest/v1/ai_usage?user_id=eq.'+pro.id+'&feature=eq.food_photo',undefined,service);
  assert.equal(usage.reduce((sum,row)=>sum+row.count,0),300);
  assert.deepEqual(await request('GET','/rest/v1/food_entries?select=id',undefined,pro.token),[]);
  console.log('PASS Hosted photo boundary, real apple analysis, replay without another charge and no automatic diary write');
  console.log('Hosted monthly AI audit: all checks passed.');
} finally {
  for(const id of users) await request('DELETE','/auth/v1/admin/users/'+id);
  console.log('Hosted monthly AI fixture cleanup completed.');
}
`;
fs.mkdirSync('.artifacts/ai-monthly', { recursive: true });
const generated = '.artifacts/ai-monthly/hosted-fixture.mjs';
fs.writeFileSync(generated, setup + suffix);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit', env: process.env });
process.exitCode = result.status ?? 1;
