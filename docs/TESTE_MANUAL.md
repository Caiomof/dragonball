# Avaliação manual — 0.2.0

Execute `npm ci`, `npm run check` e `npm run dev`; no Windows, use também `JOGAR.bat`. Faça a avaliação no navegador e GPU de destino. Este roteiro complementa os testes automatizados e não deve ser marcado como executado apenas porque o build passou.

## Personagem e câmera

1. Crie um personagem de cada raça. Confira três cabelos e as opções sem barba, curta, cavanhaque e cheia nos humanos; confira antenas/orelhas e apêndice nas outras raças. Gire a prévia, aproxime, altere cores e proporções.
2. Salve, volte ao menu e edite um personagem existente. Nome, aparência, atributos e progresso devem continuar independentes dos outros perfis.
3. Ande, corra, pare, mude de direção, pule e aterrisse. Observe pés, contato com o solo e transições, incluindo encostas e margens.
4. Toque Espaço duas vezes; suba, flutue, acelere, faça curvas, freie e desça com Ctrl. Confira a postura de lado e por trás, transição para o solo, colisões, altura máxima e queda por falta de Ki.
5. Em terceira pessoa, aproxime a câmera de rochas, troncos e encostas. Alterne V, mire e ataque em primeira pessoa; verifique mãos, horizonte e ausência da cabeça bloqueando a visão.

## Técnicas, animais e derrota

1. No totem, execute três socos, incluindo o combo. O dano deve ocorrer no impacto; nenhum golpe deve acertar um alvo distante ou atrás de obstáculo.
2. Segure/solte 1–4 em solo e no ar. Observe as quatro poses, origem nas mãos, liberação, cooldown e consumo. Teste falta de Ki e rajada pelo botão direito.
3. Segure X em solo. Confira a postura, recuperação de Ki, gasto de stamina e áudio. Pause durante a carga: ao voltar, a técnica não deve disparar sozinha.
4. Observe lobo e cervo de perfil: a cabeça deve apontar para o movimento, a curva deve ser gradual e a cadência deve acompanhar a velocidade. Aproxime-se, afaste-se e provoque reação com golpe.
5. Observe antecipação de mordida, reação ao impacto, queda e reaparecimento. Voe acima do lobo ou coloque uma rocha entre ele e o jogador; não deve haver mordida atravessando o cenário ou alcançando grande altura.
6. Deixe o lobo esgotar a vida. A tela de derrota deve interromper o jogo; o botão deve restaurar o jogador no último santuário com recursos e progresso preservados.

## Água e mundo

1. Siga o rio do início ao lago, andando nas duas margens. Procure solo exposto no meio da água, descontinuidades, buracos escuros e degraus entre superfícies.
2. Entre e saia da água por diversos ângulos. Confira a passagem de caminhar para nadar, cabeça acima da superfície, nado parado/em movimento e ondas de contato. O lago deve permanecer nivelado.
3. Complete o objetivo de voo e natação. Percorra de fato o caminho da planície ao deserto e depois à neve, sem ferramentas de realocação. Confira limites do mapa, obstáculos, transições e orientação do HUD.
4. Visite os dois santuários. Não deve haver rochas bloqueando o centro ou checkpoint. Confirme vegetação e cores de cada bioma.
5. No guardião, espere o círculo laranja: saia da área ou voe para escapar da onda. Ficar no chão dentro do círculo deve causar dano. Derrote-o e verifique o encerramento da jornada.

## Configurações, estabilidade e desempenho

1. Abra K/O e feche pela mesma tecla, pelo botão ou Esc. Pause perto de um animal e com uma técnica ativa; inimigos, recursos, projéteis, objetivos e timers devem parar.
2. Troque de aba ou retire o foco durante combate. Ao voltar, confira pausa e ausência de teclas presas.
3. Compare qualidade baixa/média/alta, volume desligado/baixo/alto e redução de movimento. Recarregue e confirme persistência.
4. Recarregue depois de cada santuário. Confira checkpoint, atributos, aparência e etapas. Teste também um perfil anterior à versão 0.2.0.
5. Faça uma sessão de 15 minutos com viagens, edições e técnicas repetidas. Observe F3 e o gerenciador do navegador. Registre resolução, GPU, navegador, qualidade, FPS típico e quedas de desempenho; não compare números de SwiftShader com uma GPU real.
6. Confira resolução de 960×720, 1366×768 e 1920×1080, incluindo editor e painéis. O jogo requer teclado/mouse; não há controles móveis.
7. Ouça passos em terra/areia/neve/água, impactos, carga e ambiente. Verifique volume sem estalos e silêncio ao pausar/desativar som.

## Automação e diagnóstico

Com Python Playwright e Chromium instalados, execute `python tests/smoke_browser.py` enquanto `npm run dev` estiver ativo. `CHROMIUM_PATH` altera o executável e `ORIGENS_ARTIFACTS` altera o destino de capturas/relatório. A realocação de desenvolvimento apenas abrevia viagens; os objetivos e o combate são acionados pelos controles do jogo.

Ao relatar um problema, inclua versão, passos de reprodução, raça, técnica, bioma, modo de câmera, qualidade e mensagem do Console. Uma gravação curta é mais útil que uma imagem para problemas de animação.
