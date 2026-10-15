import {ITEMS,type GameMode,type ItemId,type RpgLoop} from '../systems/RpgLoop';

export class RpgPanels {
 private current:'inventory'|'shop'|null=null;
 readonly root:HTMLElement;
 constructor(private readonly economy:RpgLoop,private readonly callbacks:{onClose:()=>void;onMode:(mode:GameMode)=>void;onBuy:(id:ItemId)=>void;onSell:(id:ItemId)=>void;onUse:(id:ItemId)=>void;onClaim:()=>void}){
  this.root=document.getElementById('rpg-venture-panel')!;
  this.root.addEventListener('click',event=>{
   const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-item]');
   if(button){const id=button.dataset.item as ItemId;switch(button.dataset.operation){case'buy':this.callbacks.onBuy(id);break;case'sell':this.callbacks.onSell(id);break;case'use':this.callbacks.onUse(id);break;}return;}
   if((event.target as HTMLElement).closest('[data-contract-claim]')){this.callbacks.onClaim();return;}
   if((event.target as HTMLElement).closest('[data-rpg-close]'))this.close();
  });
 }
 get open(){return this.current!==null;}
 show(panel:'inventory'|'shop',zeni:number){this.current=panel;this.root.classList.remove('hidden');this.refresh(zeni);}
 close(){if(!this.current)return;this.current=null;this.root.classList.add('hidden');this.callbacks.onClose();}
 refresh(zeni:number){
  if(!this.current)return;
  const inv=this.current==='inventory';
  document.getElementById('rpg-venture-title')!.textContent=inv?'MOCHILA DO GUERREIRO':'MERCADOR DO CAMPO';
  document.getElementById('rpg-venture-subtitle')!.textContent=inv?'Seus troféus, consumíveis e materiais.':'Venda recursos de criaturas e compre suprimentos.';
  document.getElementById('rpg-venture-zeni')!.textContent=this.economy.creative?'∞ ZENI':`${Math.round(zeni)} ZENI`;
  const rows=ITEMS.filter(item=>inv?(this.economy.amount(item.id)>0||(this.economy.creative&&(item.heal!==undefined||item.ki!==undefined))):this.economy.amount(item.id)>0||item.price>0);
  document.getElementById('rpg-venture-items')!.innerHTML=rows.length?rows.map(item=>{
   const n=this.economy.amount(item.id),canBuy=item.price>0;
   const canUse=item.heal!==undefined||item.ki!==undefined;
   return `<div class="venture-item"><span class="venture-icon">${item.icon}</span><div class="venture-item-details"><strong>${item.name}</strong><small>${item.description}</small><small>Em posse: ${this.economy.creative&&canUse?'∞':n} · Valor: ${item.sell} Z</small></div><div class="venture-actions">${(inv&&canUse)?`<button type="button" data-item="${item.id}" data-operation="use">USAR</button>`:''}${!inv&&canBuy?`<button type="button" data-item="${item.id}" data-operation="buy">COMPRAR · ${item.price} Z</button>`:''}${!inv&&n>0?`<button type="button" data-item="${item.id}" data-operation="sell">VENDER · ${item.sell} Z</button>`:''}</div></div>`;
  }).join(''):'<p class="venture-empty">Seu inventário está vazio. Derrote criaturas para obter materiais.</p>';
  const contract=document.getElementById('rpg-contract');
  if(contract){contract.classList.toggle('hidden',inv);contract.innerHTML=`<div><b>CONTRATO DO CAMPO · ${this.economy.data.bounty}/3</b><small>Derrote três lobos, escorpiões ou saqueadores. Recompensa: 160 Zeni.</small></div><button type="button" data-contract-claim="1" ${this.economy.data.bounty<3?'disabled':''}>RECEBER RECOMPENSA</button>`;}
  this.root.querySelector('[data-panel-which="inventory"]')?.classList.toggle('selected',inv);
  this.root.querySelector('[data-panel-which="shop"]')?.classList.toggle('selected',!inv);
 }
}
