# DRAGON BALL RPG: ORIGENS — v0.2.0

Protótipo 3D de aventura e combate em TypeScript, Three.js e Vite, com personagens personalizáveis, três biomas conectados e uma jornada demonstrativa de seis etapas.

## Jogar e desenvolver

No Windows, extraia a pasta inteira e execute `JOGAR.bat`. Os modelos, animações e uniformes usados pelo jogo estão incluídos. Não é necessário executar os geradores de assets.

Para desenvolvimento, use Node.js 20.19+ (ou 22.12+, recomendado Node 24):

```sh
npm ci
npm run dev
```

O servidor usa a porta 5173. Para validar: `npm run check` executa testes e compilação TypeScript/Vite. `npm run preview` serve a compilação na porta 4173. Os dados ficam no armazenamento local da origem do navegador; trocar host, porta ou navegador altera o conjunto de perfis disponível.

## Novidades da versão

- Cabelos, três estilos de barba e traços raciais ligados ao osso da cabeça; editor com rotação, aproximação e edição dos perfis existentes.
- Clipes próprios para voo e técnicas, transições, inclinação nas curvas, decolagem, frenagem e recuperação de Ki. Socos aplicam dano no momento do impacto.
- Animais voltados para o deslocamento, curvas graduais, perseguição/fuga e ataques sujeitos a distância, altura e obstáculos. Cervo articulado incluído em GLB.
- Planície, deserto e neve em um mundo de 340 × 340 unidades jogáveis, com santuários e objetivos guiados.
- Leito, margens, superfície e natação calculados a partir das mesmas funções. Lago nivelado, rio contínuo e ondas de contato.
- Pausa da simulação, derrota e retorno ao checkpoint, carregamento dos recursos, ajustes de qualidade/volume/movimento e migração dos perfis antigos.

A jornada começa com três golpes no totem, seis segundos de voo e quatro segundos de natação; continua pelos santuários do deserto e da neve e termina no guardião. O círculo laranja anuncia seu ataque de área: saia dele ou voe para evitar a onda. A direção e a distância do próximo destino aparecem no HUD.

## Controles

| Comando | Efeito |
|---|---|
| W A S D / Shift | Caminhar / correr |
| Mouse | Câmera e mira |
| Clique esquerdo | Soco / combo |
| Clique direito, segurar e soltar | Carregar e disparar rajada de Ki |
| 1, 2, 3, 4, segurar e soltar | Kamehameha, Galick Gun, Masenko, Kienzan |
| X, segurar | Recuperar Ki usando stamina, em solo |
| Roda do mouse | Destacar técnica na barra |
| Espaço | Pular |
| Dois toques rápidos em Espaço | Ativar/desativar voo |
| Espaço / Ctrl durante voo | Subir / descer |
| V | Primeira / terceira pessoa |
| K / O | Abrir e fechar atributos / configurações |
| Esc | Pausar / voltar |
| F3 | Diagnóstico |

Os atributos podem ser ajustados gratuitamente com K nesta demonstração. Os perfis salvam aparência, atributos, progresso e checkpoint. Falhas de gravação são exibidas na interface. Apagar os dados do site remove os perfis; não há servidor de contas.

## Arquitetura e assets

- `src/core/Game.ts`: coordenação da partida e entradas.
- `src/animation/HeroClips.ts`: clipes adicionais construídos sobre uma cópia do esqueleto.
- `src/characters/Appearance.ts`: acessórios ajustados à geometria da cabeça.
- `src/world/landscape.ts`: altura, biomas, água e marcos compartilhados.
- `src/world/World.ts`, `Wildlife.ts`: cenário, colisões e fauna.
- `src/systems/`: jornada, câmera, relógio de simulação, qualidade e regras de combate.
- `src/data/profiles.ts`: normalização, migração e armazenamento.

O humanoide e a biblioteca de animações existentes ficam em `public/models/hero` e `public/models/anims`. Os novos clipes de voo e técnicas são poses articuladas produzidas em código; não são captura de movimento. O cervo é um asset original articulado, gerado por `node scripts/export_deer.mjs` (Node 24). O lobo mantém os clipes `idle` e `move` do asset existente, com reações adicionais de deslocamento/inclinação. O arquivo legado `origens-warrior.glb` não é o humanoide principal carregado nesta versão.

Origens/licenças dos recursos existentes: [Universal Animation Library, Quaternius — CC0](https://quaternius.com/packs/universalanimationlibrary.html); [lobo, anyCreature — MIT](https://github.com/Ariescar/anyCreature). Consulte também os avisos incluídos junto aos assets. O cervo novo não depende de download de modelos externos.

## Validação

`npm run check` cobre regras, progressão, persistência, câmera, relógio, água, biomas e integridade dos assets. O roteiro automatizado `python tests/smoke_browser.py` exige Python Playwright, Chromium e o servidor de desenvolvimento ativo; ele testa o fluxo completo usando comandos de jogo e realoca o personagem entre pontos distantes por uma ferramenta exclusiva de desenvolvimento. As capturas e o relatório são gravados em `/tmp/origens-smoke` por padrão (`ORIGENS_ARTIFACTS` altera o destino).

Veja [implementação e limites](docs/IMPLEMENTACAO_V020.md) e [roteiro de avaliação manual](docs/TESTE_MANUAL.md). A validação em Chromium com WebGL por software confirma o fluxo, mas não representa desempenho de GPU nem substitui a avaliação visual e sonora no computador de destino.

Projeto experimental de fã, sem afiliação aos proprietários de Dragon Ball.
