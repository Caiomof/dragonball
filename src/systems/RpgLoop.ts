/** Persisted, renderer-independent POC economy. JSON can later be migrated to Unreal. */
export type GameMode = 'creative' | 'survival';
export type ItemId = 'fang'|'pelt'|'venison'|'chitin'|'herbs'|'insignia'|'potion'|'senzu';
export type Item = {id:ItemId; name:string; icon:string; description:string; price:number; sell:number; heal?:number; ki?:number};
export const ITEMS: readonly Item[] = [
 {id:'fang',name:'Presa de lobo',icon:'◆',description:'Troféu de caça.',price:0,sell:26},
 {id:'pelt',name:'Couro de cervo',icon:'◈',description:'Material de criatura pacífica.',price:0,sell:32},
 {id:'venison',name:'Carne de caça',icon:'◕',description:'Alimento recuperador.',price:85,sell:16,heal:35},
 {id:'chitin',name:'Quitina',icon:'⬡',description:'Material resistente do deserto.',price:0,sell:40},
 {id:'herbs',name:'Ervas do campo',icon:'❧',description:'Ingrediente para comércio.',price:0,sell:12},
 {id:'insignia',name:'Insígnia de saqueador',icon:'⚔',description:'Troféu raro dos bandidos.',price:0,sell:65},
 {id:'potion',name:'Poção de vida',icon:'✚',description:'Recupera 60 pontos de vida.',price:105,sell:35,heal:60},
 {id:'senzu',name:'Feijão revitalizante',icon:'✦',description:'Restaura vida e Ki.',price:320,sell:100,heal:9999,ki:9999}
] as const;
export type RpgSave = {version:1; mode:GameMode; inventory:Partial<Record<ItemId,number>>; daySpeed:number; victories:number; bounty:number; contracts:number};
const create=():RpgSave=>({version:1,mode:'survival',inventory:{},daySpeed:1,victories:0,bounty:0,contracts:0});
const storageKey=(profileId:string)=>`dbrpg-poc-adventure-${profileId}`;
export class RpgLoop {
 private profileId='';
 data:RpgSave=create();
 get creative(){return this.data.mode==='creative';}
 get mode(){return this.data.mode;}
 get daySpeed(){return this.data.daySpeed;}
 load(profileId:string){
  this.profileId=profileId;this.data=create();
  try{
   const raw=localStorage.getItem(storageKey(profileId));if(!raw)return;
   const saved=JSON.parse(raw) as Partial<RpgSave>;
   this.data.mode=saved.mode==='creative'?'creative':'survival';
   this.data.daySpeed=Math.max(.25,Math.min(8,Number(saved.daySpeed)||1));
   this.data.victories=Math.max(0,Math.floor(Number(saved.victories)||0));
   this.data.bounty=Math.max(0,Math.min(3,Math.floor(Number(saved.bounty)||0)));
   this.data.contracts=Math.max(0,Math.floor(Number(saved.contracts)||0));
   for(const item of ITEMS){const amount=Number(saved.inventory?.[item.id]);if(Number.isFinite(amount)&&amount>0)this.data.inventory[item.id]=Math.min(999,Math.floor(amount));}
  }catch{ /* invalid save ignored */ }
 }
 save(){if(!this.profileId)return;try{localStorage.setItem(storageKey(this.profileId),JSON.stringify(this.data));}catch{window.dispatchEvent(new Event('origens:storage-error'));}}
 setMode(mode:GameMode){this.data.mode=mode;this.save();}
 setDaySpeed(speed:number){this.data.daySpeed=Math.max(.25,Math.min(8,Number(speed)||1));this.save();}
 amount(id:ItemId){return this.data.inventory[id]??0;}
 add(id:ItemId,quantity:number){this.data.inventory[id]=Math.max(0,Math.min(999,this.amount(id)+Math.floor(quantity)));this.save();}
 loot(kind:string):Item {
  const id:ItemId=kind==='wolf'?'fang':kind==='deer'?'pelt':kind==='scorpion'?'chitin':kind==='hare'?'venison':kind==='bandit'?'insignia':kind==='cow'||kind==='horse'?'venison':kind==='bull'?'fang':'herbs';
  if(!this.creative){this.add(id,1);this.data.victories++;if(['wolf','scorpion','bandit','orc','blob'].includes(kind))this.data.bounty=Math.min(3,this.data.bounty+1);this.save();}
  return ITEMS.find(item=>item.id===id)!;
 }
 purchase(id:ItemId,zeni:number):{ok:boolean;zeni:number;message:string}{
  const item=ITEMS.find(x=>x.id===id);if(!item||item.price<=0)return {ok:false,zeni,message:'Este item não está à venda'};
  if(!this.creative&&zeni<item.price)return {ok:false,zeni,message:'Zeni insuficiente'};
  if(!this.creative)this.add(id,1);
  return {ok:true,zeni:this.creative?zeni:zeni-item.price,message:this.creative?`${item.name} disponível sem custo no modo Criativo`:`${item.name} adicionado ao inventário`};
 }
 claimContract(zeni:number):{ok:boolean;zeni:number;message:string}{
  if(this.creative)return{ok:false,zeni,message:'Contratos só pagam Zeni no Sobrevivência'};
  if(this.data.bounty<3)return{ok:false,zeni,message:`Derrote mais ${3-this.data.bounty} ameaças para concluir o contrato`};
  this.data.bounty=0;this.data.contracts++;this.save();
  return{ok:true,zeni:Math.min(99999,zeni+160),message:'Contrato de caça concluído · +160 Zeni'};
 }
 sell(id:ItemId,zeni:number):{ok:boolean;zeni:number;message:string}{
  const item=ITEMS.find(x=>x.id===id);if(!item||this.amount(id)<1)return {ok:false,zeni,message:'Item não disponível'};
  if(this.creative)return {ok:false,zeni,message:'No Criativo, você não precisa vender itens'};
  this.add(id,-1);return {ok:true,zeni:Math.min(99999,zeni+item.sell),message:`+${item.sell} Zeni · ${item.name}`};
 }
 consume(id:ItemId):{ok:boolean;heal:number;ki:number;message:string}{
  const item=ITEMS.find(x=>x.id===id);
  if(!item||(item.heal===undefined&&item.ki===undefined))return{ok:false,heal:0,ki:0,message:'Este item não é consumível'};
  if(this.amount(id)<1&&!this.creative)return{ok:false,heal:0,ki:0,message:'Item não disponível'};
  if(!this.creative)this.add(id,-1);
  return{ok:true,heal:item.heal??0,ki:item.ki??0,message:`${item.name} utilizado`};
 }
}
