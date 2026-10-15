"""Capture racial accessories and each charge pose. Requires the development server and Python Playwright."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os
out=Path(os.environ.get('ORIGENS_ARTIFACTS','/tmp/origens-smoke'));out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':960,'height':720});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("localStorage.setItem('dbrpg-origens-settings-v012',JSON.stringify({quality:'low',sound:false}));")
 for race in ['saiyajin','terraqueo','namekuseijin','majin']:
  page.goto('http://127.0.0.1:5173/',wait_until='networkidle');page.locator('#start-button').click();page.locator('#character-create').click();page.locator(f'[data-race="{race}"]').click();page.locator('#creator-next').click();page.locator('#creator-next').click()
  page.wait_for_function('window.__DBRPG_DEBUG__().heroReady');page.wait_for_timeout(500)
  assert page.evaluate('window.__DBRPG_DEBUG__().race')==race
  accessories=page.evaluate("()=>{let names=[];window.__DBRPG_TEST__.scene().traverse(o=>{if(o.name==='AppearanceAccessories')names=o.children.map(x=>x.name)});return names}")
  assert ('Antenna' in accessories if race=='namekuseijin' else 'MajinCrest' in accessories if race=='majin' else 'HairCap' in accessories),accessories
  page.screenshot(path=str(out/f'race-{race}.png'));page.locator('#race-confirm').click();page.wait_for_function("window.__DBRPG_DEBUG__().state==='PLAYING'")
  print('PASS race',race,accessories,flush=True)
  if race=='majin':
   for key,name in [('1','kamehameha'),('2','galick'),('3','masenko'),('4','kienzan')]:
    page.keyboard.down(key);page.wait_for_function(f"window.__DBRPG_DEBUG__().animation.clip==='charge_{name}'");page.wait_for_timeout(400);page.screenshot(path=str(out/f'pose-{name}.png'));page.keyboard.up(key);page.wait_for_timeout(2500);page.keyboard.down('x');page.wait_for_timeout(2000);page.keyboard.up('x');page.wait_for_timeout(400)
   page.keyboard.down('x');page.wait_for_function("window.__DBRPG_DEBUG__().animation.clip==='power_charge'");page.screenshot(path=str(out/'pose-surge.png'));page.keyboard.up('x')
 assert not errors,errors
 print('PASS racial accessories and four charge clips; no page errors',flush=True);b.close()
