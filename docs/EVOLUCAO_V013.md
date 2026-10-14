# Evolução v0.1.3 — Personagem e experiência de combate

Esta atualização parte da v0.1.2. O mundo, as quatro raças, HUD, menu, progressão, voo e os quatro poderes foram preservados.

## Mudanças de implementação

- `src/characters/Character.ts`: animações esqueléticas GLTF com `AnimationMixer` e fade entre estados; uso de Idle, Walk, Run, Jump e Punch; calibração dos pés em idle; cabelo e detalhes das raças; partículas e anéis de Ki no corpo.
- `src/world/World.ts`: altura do solo derivada dos mesmos triângulos que o terreno renderizado, eliminando a divergência entre colisão analítica e malha.
- `src/core/Game.ts`: ao correr ladeira abaixo, personagem volta a acompanhar o solo; grandes quedas acionam gravidade; scroll alterna os quatro poderes; câmera em primeira pessoa recebe mãos, mangas e efeito de carregamento; início da rajada próximo às mãos.
- `src/style.css`: mira com círculo, braços de mira curtos e mudança de cor em alvo válido; indicação de scroll na barra de poderes.
- `JOGAR.bat`: instala o GLB humanoide CC0 com animações embutidas na primeira execução, caso disponível.

## Modelo de personagem

A v0.1.2 utilizava um humanoide externo que não tinha movimentos de animação reproduzidos pelo Three.js. A v0.1.3 tenta baixar o arquivo `human.glb` de um projeto CC0 baseado em Quaternius. Confirmamos no arquivo de origem as animações `Idle`, `Walk`, `Run`, `Jump`, `Punch`, `Death` e `Working`.

O modelo externo não está embutido neste ZIP: depende de um download inicial. Se o download falhar, o jogo mantém o personagem procedural anterior, agora com uma pose de ataque melhorada. Para usar o modelo CC0 posteriormente, coloque o GLB como `public/models/animated-hero.glb` e reinicie o servidor.

## Limitações e próximos passos

Ainda é necessário testar em um navegador Windows com GPU para verificar orientation real, transições esqueléticas, movimentação dos pés e resultados visuais das mãos em primeira pessoa. Os testes automáticos incluídos validam estrutura e presença da implementação, mas não substituem testes gráficos nem são provas de desempenho.

Para modelos anime mais refinados, sugerimos o pacote CC0 [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), com a Universal Animation Library. Esse pacote precisaria de preparação/retarget antes de uso e não está integrado a esta entrega.
