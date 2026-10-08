import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPayment, identity, flatten } from '../scripts/source.mjs';
test('strict payment parsing preserves unknown and resolves conflicts',()=>{
 for(const value of [false,0,'0']) assert.equal(classifyPayment({is_pay_subscribe:value},'free'),'free');
 for(const value of [true,1,'1']) assert.equal(classifyPayment({is_pay_subscribe:value},'free'),'unknown');
 assert.equal(classifyPayment({},'free'),'unknown');
 assert.equal(classifyPayment({is_pay_subscribe:0},'paid'),'unknown');
 assert.equal(classifyPayment({is_pay_subscribe:1},'paid'),'paid');
 assert.equal(classifyPayment({is_pay_subscribe:'false'},'free'),'unknown');
});
test('identity is stable across titles and tracking query',()=>{
 const link='https://mp.weixin.qq.com/s?__biz=abc&mid=123&idx=2&sn=xyz';
 assert.equal(identity({link,title:'a'}),identity({link:link+'&scene=1',title:'b'}));
 assert.throws(()=>identity({link:'https://mp.weixin.qq.com/s/short'}));
});
test('flatten preserves raw payment field absence and grouped article identities',()=>{
 const rows=flatten([{publish_info:JSON.stringify({sent_info:{time:100},appmsgex:[{title:'A',is_pay_subscribe:'0'},{title:'B'}]})}]);
 assert.equal(rows.length,2);assert.equal(rows[0].is_pay_subscribe,'0');assert.equal(Object.hasOwn(rows[1],'is_pay_subscribe'),false);
});
