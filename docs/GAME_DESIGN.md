# Game Design Document · Origens v0.1

## Fantasia principal

Começar como um guerreiro de origem escolhida, explorar uma paisagem natural de fim de tarde e realizar o primeiro ataque de energia. A visão futura inclui treinamento, exploração, sobrevivência, transformação, voo e destruição progressiva de cenários, mas **nenhum desses sistemas futuros** deve comprometer o protótipo.

## Loop jogável v0.1

`Menu → Raça → Mundo → Explorar → Atingir totem → Recuperar Ki → Repetir`.

A seleção não é cosmética: cada raça determina HP, Ki e poder inicial. A HUD deve refletir esses dados. O treinamento não atribui experiência nessa versão.

## Raças

| Raça | Vida | Ki | Poder | Identidade visual |
|---|---:|---:|---:|---|
| Saiyajin | 100 | 120 | 10 | Cabelo alto, armadura laranja/azul |
| Terráqueo | 110 | 100 | 5 | Cabelo castanho, traje verde/creme |
| Namekuseijin | 140 | 90 | 8 | Pele verde, antenas e vestimenta roxa |
| Majin | 130 | 110 | 7 | Pele rosa, apêndice craniano, traje escuro |

## Combate

Kamehameha: custa 25 Ki, causa 30 de dano, alcance 32 unidades, cooldown 2s. Possui fase de carregamento de 0,22s e feixe visível por 0,57s. O totem tem 100 HP e reaparece após 8s. O Ki se recupera gradualmente durante descanso de combate, facilitando testes.

## Mundo

Planície Esmeralda: campo 3D de aproximadamente 210 unidades para cada lado, centro seguro para treinamento, colinas de borda, árvores, rochas, gramíneas, nuvens e pôr do sol. Composição procedural determinística pelo seed no gerador de cenário. Objetos naturais utilizam InstancedMesh para evitar milhares de draw calls.

## Estados

`MAIN_MENU`, `RACE_SELECTION`, `LOADING`, `PLAYING`, `PAUSED`.

## Direção artística

Cartoon low-poly; cores suaves e quentes, turquesa para Ki, pôr do sol, vegetação estilizada, personagem simplificado e legível. Não confundir com realismo ou fidelidade total aos designs da franquia.

## Não escopo

Inventário, craft, base, habilidades adicionais, narrativa, inimigos com IA, mundo infinito, salvamento, multiplayer, destruição física de terreno, modelo de monetização, publicação Steam.
