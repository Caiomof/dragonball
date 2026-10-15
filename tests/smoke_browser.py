"""Development integration smoke. Requires Python Playwright + Chromium; start npm run dev first.
Diagnostics only relocate the player between distant test sites; progression and combat use gameplay input.
Screenshots/reports go outside the checkout unless ORIGENS_ARTIFACTS is supplied.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path(os.environ.get('ORIGENS_ARTIFACTS','/tmp/origens-smoke'));out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':960,'height':720})
 errors=[];failed=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.on('requestfailed',lambda r:failed.append({'url':r.url,'reason':r.failure}))
 def state():return page.evaluate('window.__DBRPG_DEBUG__()')
 def wait(expr):page.wait_for_function(expr,timeout=30000)
 def tap_flight():page.evaluate("""() => {for(let i=0;i<2;i++){window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));}}""")
 def move(x,z,y=None):page.evaluate('([x,z,y])=>window.__DBRPG_TEST__.teleport(x,z,y??undefined)',[x,z,y])
 try:
  page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
  page.evaluate("localStorage.setItem('dbrpg-origens-settings-v012',JSON.stringify({quality:'low',sound:false}));")
  page.reload(wait_until='networkidle')
  assert '0.3.0' in page.title()
  page.locator('#start-button').click();page.locator('#character-create').click()
  page.locator('#creator-next').click();page.locator('#hero-name').fill('Smoke Aurora');page.locator('#creator-next').click();page.locator('#hero-hair').select_option('2');page.locator('#hero-beard-style').select_option('3')
  wait('window.__DBRPG_DEBUG__().heroReady');page.screenshot(path=str(out/'creator.png'))
  page.locator('#race-confirm').click();wait("window.__DBRPG_DEBUG__().state==='PLAYING'")
  assert state()['animation']['accessories']>10
  print('PASS creation and real loading',flush=True)
  move(0,-12.7);page.evaluate('window.__DBRPG_TEST__.look(0,0)')
  page.locator('#game-canvas').click(position={'x':450,'y':350})
  for i in range(3):
   page.mouse.click(450,350);wait(f'window.__DBRPG_DEBUG__().progress.training>={i+1}');page.wait_for_timeout(500)
  print('PASS timed melee and training objective',flush=True)
  tap_flight();wait('window.__DBRPG_DEBUG__().flying');page.keyboard.down('Space');page.wait_for_timeout(1500);page.keyboard.up('Space')
  page.keyboard.down('w');wait("window.__DBRPG_DEBUG__().animation.clip==='flightcruise'");page.screenshot(path=str(out/'flight.png'));page.keyboard.up('w')
  wait('window.__DBRPG_DEBUG__().progress.flight>=6')
  page.keyboard.down('1');wait("window.__DBRPG_DEBUG__().animation.clip.includes('charge_kamehameha')");page.screenshot(path=str(out/'charge.png'))
  page.keyboard.press('Escape');wait("window.__DBRPG_DEBUG__().state==='PAUSED'");page.keyboard.up('1')
  before=state();page.wait_for_timeout(700);after=state();assert before['stats']==after['stats'];assert after['charging'] is None;assert before['wildlife']==after['wildlife']
  print('PASS flight, charge and paused simulation',flush=True)
  page.locator('#resume-button').click();wait("window.__DBRPG_DEBUG__().state==='PLAYING'");tap_flight();wait('!window.__DBRPG_DEBUG__().flying')
  move(31,30);wait("window.__DBRPG_DEBUG__().animation.clip==='swimidle'");wait('window.__DBRPG_DEBUG__().progress.swim>=4');page.screenshot(path=str(out/'lake.png'))
  head=page.evaluate("()=>{let y=0;window.__DBRPG_TEST__.scene().traverse(o=>{if(o.name==='Head')y=o.getWorldPosition(o.position.clone()).y});return y}");assert head>.4,head
  move(-119,-24);wait('window.__DBRPG_DEBUG__().progress.desert');page.screenshot(path=str(out/'desert.png'))
  move(43,124);wait('window.__DBRPG_DEBUG__().progress.snow');page.screenshot(path=str(out/'snow.png'))
  print('PASS lake, desert, snow and checkpoints',flush=True)
  page.evaluate('window.__DBRPG_TEST__.look(0,0)')
  for i in range(4):
   if state()['progress']['final']:break
   page.keyboard.down('x');page.wait_for_timeout(2000);page.keyboard.up('x')
   page.keyboard.down('1');page.wait_for_timeout(1700);page.keyboard.up('1');page.wait_for_timeout(2200)
  wait('window.__DBRPG_DEBUG__().progress.final');print('PASS final challenge',flush=True)
  page.keyboard.press('v');page.wait_for_timeout(500);assert state()['mode']=='first';page.screenshot(path=str(out/'first-person.png'));page.keyboard.press('v')
  page.keyboard.press('Escape');wait("window.__DBRPG_DEBUG__().state==='PAUSED'");page.locator('#open-settings').click();page.locator('#quality-select').select_option('medium');page.locator('#settings-close').click();page.locator('#exit-to-menu').click()
  page.locator('#start-button').click();page.locator('.profile-play').click();wait("window.__DBRPG_DEBUG__().state==='PLAYING'")
  page.reload(wait_until='networkidle');page.locator('#start-button').click();page.locator('.profile-play').click();wait("window.__DBRPG_DEBUG__().state==='PLAYING'")
  final=state();assert final['progress']['final'];assert final['quality']=='medium';assert abs(final['position'][0]-43)<1
  profiles=page.evaluate("JSON.parse(localStorage.getItem('dbrpg-origens-characters-v017'))");assert profiles[0]['appearance']['beardStyle']==3
  # Let real wolf attacks reach defeat, then use the actual checkpoint button.
  for attempt in range(24):
   snapshot=state()
   if snapshot['state']=='DEFEATED':break
   wolf=snapshot['wildlife'][0]['position'];move(wolf[0]+1,wolf[2]);page.wait_for_timeout(1800)
  wait("window.__DBRPG_DEBUG__().state==='DEFEATED'")
  page.screenshot(path=str(out/'defeat.png'));page.locator('#respawn-button').click();wait("window.__DBRPG_DEBUG__().state==='PLAYING'")
  recovered=state();assert recovered['stats']['health']==recovered['stats']['maxHealth'];assert abs(recovered['position'][0]-43)<1;assert recovered['progress']['final']
  print('PASS wolf combat, defeat and checkpoint recovery',flush=True)
  assert not errors,errors;assert not failed,failed
  print('PASS edit, persistence, settings, first person; no browser errors',flush=True)
  (out/'report.json').write_text(json.dumps({'passed':True,'final':final,'errors':errors,'failed':failed},indent=2))
 finally:
  if errors:print('ERRORS',errors,flush=True)
  browser.close()
