Ambos os GLB utilizados estão incluídos no projeto.

wolf.glb: asset existente do exemplo anyCreature, licença MIT.
Fonte: https://github.com/Ariescar/anyCreature/blob/main/example/wolf.glb
Clipes originais: idle e move. Reações de impacto/ataque e queda são complementadas pelo controlador Wildlife.ts.

deer.glb: cervo articulado original criado para este projeto, sem modelo externo.
Fonte editável: src/world/DeerAsset.ts.
Regeneração opcional (Node 24): node scripts/export_deer.mjs
Clipes: idle, walk, run, attack, hit, death.

Os modelos usam frente +Z. O controlador converte a velocidade real para a orientação com atan2(x,z).
A partida espera o carregamento dos dois assets antes de liberar o controle.
