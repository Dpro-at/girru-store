import test from 'node:test';
import assert from 'node:assert/strict';
import {ScrapingAntScraper} from '../../apps/seo/package/src/scrapers/scrapingant.js';
import {ScrapingRobotScraper} from '../../apps/seo/package/src/scrapers/scrapingrobot.js';
import {getScraper} from '../../apps/seo/package/src/scrapers/index.js';
import {ScraperService} from '../../apps/seo/package/src/services/scraper-service.js';
const document = (title, snippet) => `<div class="g"><a href="https://example.test/path"><h3>${title}</h3><div>${snippet}</div></div>`;

for (const [name, Scraper] of [['scrapingant',ScrapingAntScraper],['scrapingrobot',ScrapingRobotScraper]]) {
  test(`${name}: absent host parser refuses before any paid HTTP request`,async()=>{
    const scraper=new Scraper('synthetic-key');let calls=0;scraper.makeRequest=async()=>{calls++;throw Error('must not fetch');};
    await assert.rejects(()=>scraper.scrape('synthetic',{}),/htmlToText support/);
    assert.throws(()=>scraper.extractResults(document('title','snippet')),/htmlToText support/);assert.equal(calls,0);
  });
  test(`${name}: exact raw fragments flow through host parser and its refusals propagate`,()=>{
    const inputs=[];const scraper=new Scraper('synthetic-key',{htmlToText:html=>{inputs.push(html);return 'host-text-'+inputs.length;}});
    const result=scraper.extractResults(document('<b>title &amp; text</b>','<em>snippet</em>'));
    assert.deepEqual(inputs,['<b>title &amp; text</b>','<em>snippet</em>']);
    assert.deepEqual(result,[{position:1,url:'https://example.test/path',title:'host-text-1',snippet:'host-text-2',domain:'example.test'}]);
    assert.throws(()=>scraper.extractResults({}),/response must be a string/);
    assert.throws(()=>scraper.extractResults('x'.repeat(2*1024*1024+1)),/at most 2 MiB/);
    const refusing=new Scraper('synthetic-key',{htmlToText:()=>{throw Error('bounded-host-refusal');}});
    assert.throws(()=>refusing.extractResults(document('title','snippet')),/bounded-host-refusal/);
  });
}

test('registry passes the bounded capability without changing other provider data',()=>{
  const api={htmlToText:()=> 'host text'};
  assert.equal(getScraper('scrapingant','synthetic',api).extractResults(document('x','y'))[0].title,'host text');
  const other=getScraper('serper','synthetic',api);assert.equal(other.extractResults([{title:'A & B',link:'https://example.test',snippet:'plain'}])[0].title,'A & B');
});

test('scraper service supplies its host capability to the configured HTML provider',async()=>{
  const inputs=[],writes=[];const keyword={id:'keyword',user_id:'owner',domain_id:'domain',keyword:'test',country:'US',device:'desktop',history:'[]',position:0},domain={domain:'example.test',language:'en'};
  const db={prepare(sql){return {get(){if(sql.includes('seo_keywords'))return keyword;if(sql.includes('seo_domains'))return domain;throw Error('Unexpected query');},run(...args){writes.push({sql,args});}};}};
  const api={db,log(){},htmlToText:html=>{inputs.push(html);return 'host parsed';}};
  const service=new ScraperService(api);service.getUserSettings=async()=>({primary_scraper:'scrapingant',fallback_scrapers:'[]'});service.getCredentialValue=async()=> 'synthetic-key';
  const original=ScrapingAntScraper.prototype.makeRequest;
  ScrapingAntScraper.prototype.makeRequest=async()=>document('<b>title</b>','snippet');
  try{const result=await service.scrapeKeyword('keyword');assert.deepEqual(inputs,['<b>title</b>','snippet']);assert.equal(result.results[0].title,'host parsed');assert.ok(writes.some(w=>w.sql.includes('last_result')));}
  finally{ScrapingAntScraper.prototype.makeRequest=original;}
});

const hostHelper=process.env.GIRRU_TEST_HTML_TEXT_MODULE;
test('actual host parser composes with both providers without double encoding or HTML trust',{skip:!hostHelper},async()=>{
  const {htmlToText}=await import(hostHelper);
  for(const Scraper of [ScrapingAntScraper,ScrapingRobotScraper]){
    const scraper=new Scraper('synthetic-key',{htmlToText});const [result]=scraper.extractResults(document('  A &amp; B <b>bold</b>','<script>hidden</script>&lt;img src=x&gt; tail'));
    assert.equal(result.title,'  A & B bold');assert.equal(result.snippet,'<img src=x> tail');
    assert.throws(()=>scraper.extractResults(document('x'.repeat(65537),'ok')),/output_too_large/);
  }
});
