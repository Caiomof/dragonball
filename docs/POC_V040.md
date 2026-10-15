# POC v0.4.0 — escopo consolidado

## Já implementado nesta versão

| Sistema | O que o jogador percebe |
|---|---|
| Primeira pessoa | Câmera com malha filtrada para ver mãos/braços animados, sem a cabeça no enquadramento. |
| Voo | Decolagem, pairar, cruzeiro e impulso com transições mais suaves. |
| Criação | Três tipos de cabelo, barba/cor/olhos e prévia instantânea. |
| Energia | Núcleo, anéis, partículas e brilho mais definidos. |
| Duas regras | Criativo livre; Sobrevivência com economia e custos. |
| Inventário | Loot direto na mochila e consumo de cura. |
| Mercador | Bancada no mapa, NPC, comprar e vender por Zeni. |
| Objetivo repetível | Caçar três ameaças e receber recompensa. |
| População | Lobos/cervos extras e dois saqueadores; cervo/lobo já têm GLB. |
| Horário | Ajuste da velocidade do dia e noite menos embaçada. |

## Exemplos de um ciclo de jogo

1. Criar um guerreiro em **Sobrevivência**.
2. Explorar, enfrentar ameaças e receber troféus automaticamente.
3. Abrir a mochila **I** e usar um consumível.
4. Procurar o mercador na clareira, abrir a loja **B**, vender troféus.
5. Receber recompensa do contrato e investir Zeni nos atributos **U** ou poderes **K**.

No Criativo, o jogador testa ataques e atributos sem gastar recursos.

## Próximos cuidados antes de migrar

- Testar e aprovar visualmente braços da primeira pessoa, gestos e voo.
- Refinar roupas/cabelo para os personagens, sem substituir as animações aprovadas.
- Obter assets animais com estilo coerente, especialmente lebre, escorpião e futuros bois/ovelhas.
- Ajustar IA, dificuldade, interface de inventário e equilíbrio econômico a partir dos testes jogáveis.
- Validar `npm run check` e `tests/smoke_browser.py` no Windows.
- Migrar **dados e especificações primeiro**, reescrevendo sistemas na Unreal Engine em seguida.

Imagens em `docs/referencias` são **conceitos artísticos**, não prova de gráficos implementados.
