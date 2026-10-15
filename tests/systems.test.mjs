import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {load} from './load-ts.mjs';
const {SimulationClock}=await load('src/systems/SimulationClock.ts');
const {resolveCamera}=await load('src/systems/CameraRig.ts');
test('simulation advances equally at 60, 30 and 5 rendered frames per second',()=>{
 for(const fps of [60,30,5]){const c=new SimulationClock();let elapsed=0,steps=0;for(let i=0;i<fps*10;i++)for(const dt of c.advance(1/fps)){elapsed+=dt;steps++;}assert.equal(steps,600);assert.ok(Math.abs(elapsed-10)<1e-8);}
});
test('simulation bounds long stalls and clears partial time on pause',()=>{
 const c=new SimulationClock();assert.equal(c.advance(30).length,15);assert.equal(c.advance(NaN).length,0);assert.equal(c.advance(-1).length,0);c.advance(.01);c.reset();assert.equal(c.advance(.01).length,0);
});
test('camera retracts before obstacles, ignores broken obstacles and clears tall objects',()=>{
 const world={height:()=>0,obstacles:[{x:0,z:3,radius:1,height:4,active:true}]};
 const focus=new Vector3(0,2,0),desired=new Vector3(0,2,6);
 const blocked=resolveCamera(world,focus,desired);assert.ok(blocked.z<1.72&&blocked.z>1.4);
 world.obstacles[0].active=false;assert.ok(resolveCamera(world,focus,desired).distanceTo(desired)<1e-8);
 world.obstacles[0].active=true;assert.ok(resolveCamera(world,new Vector3(0,6,0),new Vector3(0,6,6)).z===6);
});
test('camera stops ahead of rising terrain along its entire boom',()=>{
 const world={height:(_x,z)=>z>2?3:0,obstacles:[]};const p=resolveCamera(world,new Vector3(0,2,0),new Vector3(0,2,6));assert.ok(p.z<=2&&p.z>1.7);
});
const {GuardianCycle,guardianCanHit}=await load('src/systems/Guardian.ts');
test('guardian telegraphs before one impact per cycle and resets when inactive',()=>{
 const c=new GuardianCycle();let warnings=0,hits=0;for(let i=0;i<481;i++){const s=c.update(1/60,true);if(s.warning>0)warnings++;if(s.impact){assert.ok(warnings>60);hits++;warnings=0;}}assert.equal(hits,2);c.update(.2,false);assert.deepEqual(c.update(.1,true),{warning:0,impact:false});
});
test('guardian shockwaves can be avoided by distance, flight or cover',()=>{
 assert.equal(guardianCanHit(5,0,true),true);assert.equal(guardianCanHit(10,0,true),false);assert.equal(guardianCanHit(5,3,true),false);assert.equal(guardianCanHit(5,0,false),false);
});
