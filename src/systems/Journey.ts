import { LANDMARKS } from '../world/landscape';
export type JourneyProgress = {training:number; flight:number; swim:number; desert:boolean; snow:boolean; final:boolean};
export const newJourney = (): JourneyProgress => ({training:0,flight:0,swim:0,desert:false,snow:false,final:false});
export function journeyStage(p:JourneyProgress):number { return p.training<3?0:p.flight<6?1:p.swim<4?2:!p.desert?3:!p.snow?4:!p.final?5:6; }
export const JOURNEY_STEPS = [
 ['Desperte seu poder','Acerte 3 golpes no totem da clareira. M1: soco · segure e solte 1–4: técnicas.'],
 ['Conquiste o céu','Toque Espaço duas vezes e voe por 6 segundos. Espaço sobe · Ctrl desce.'],
 ['Encontre a serenidade','Entre no lago a leste e nade por 4 segundos. WASD para nadar.'],
 ['Atravesse as dunas','Explore o santuário no deserto a oeste. Aproxime-se do marco dourado.'],
 ['Alcance a aurora','Visite o farol na serra nevada ao norte do lago. Siga o marco azul.'],
 ['Prova do guerreiro','Derrote o guardião no farol usando suas técnicas. O círculo laranja avisa o ataque: afaste-se ou voe.'],
 ['Jornada concluída','Você dominou os três territórios. Continue explorando e experimentando seu guerreiro.'],
] as const;
export function journeyTarget(p:JourneyProgress) { const s=journeyStage(p); return LANDMARKS[s===0?0:s===2?1:s===3?2:3]; }
export function advanceJourney(p:JourneyProgress,dt:number,x:number,z:number,flying:boolean,swimming:boolean):boolean {
 const before=journeyStage(p);
 if(before===1&&flying)p.flight=Math.min(6,p.flight+dt);
 if(before===2&&swimming)p.swim=Math.min(4,p.swim+dt);
 if(before===3&&Math.hypot(x+119,z+24)<10)p.desert=true;
 if(before===4&&Math.hypot(x-43,z-124)<10)p.snow=true;
 return before!==journeyStage(p);
}
