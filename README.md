# DRAGON BALL RPG: ORIGENS — POC v0.4.0

**Jogo 3D para navegador, desenvolvido em TypeScript + Three.js + Vite.** Esta versão evolui diretamente o projeto mais recente enviado pelo usuário; não recomeça do zero.

## Jogar no Windows

1. Extraia o ZIP inteiro para uma pasta.
2. Dê dois cliques em **`JOGAR.bat`**. Ele instala dependências do npm quando necessário, inicia o jogo e abre o navegador.
3. Para encerrar, feche a janela **DragonBallRPG - Servidor**.

Na primeira utilização, é necessário ter conexão com a internet para instalar as dependências. O inicializador tenta instalar Node.js LTS via `winget`, caso não esteja presente. Se o Node.js acabou de ser instalado, pode ser preciso abrir `JOGAR.bat` novamente.

Alternativamente, com Node.js 20.19+ instalado:

```powershell
npm ci
npm run dev
```

O jogo abre em http://127.0.0.1:5173. Para verificar testes e compilação, rode `npm run check`.

## Mudanças da v0.4.0

- **Primeira pessoa:** a renderização dos braços usa exclusivamente faces da malha animada ligadas a braços/mãos, sem mostrar o torso e a cabeça inteira diante da câmera. Gestos existentes acompanham socos e técnicas.
- **Voo:** transições mais suaves de decolagem, pairar, deslocamento e impulso; movimentos sutis de braços/pernas e menor inclinação de míssil.
- **Personalização:** três cabelos estilizados novos, galeria de seleção e prévia em tempo real; aparência e acessórios existentes preservados.
- **Combate:** efeitos de Ki com mais partículas, brilho, anéis e definição; técnicas e combos anteriores mantidos.
- **Criativo / Sobrevivência:** seleção na criação e troca nas configurações; no Criativo, Ki, vida, stamina, técnicas e evolução livres; no Sobrevivência, técnicas e atributos custam Zeni.
- **Ciclo de RPG:** mochila (I), pequeno mercador na clareira (B, próximo ao NPC), compra, venda, consumíveis, saques de criaturas e contratos de caça (3 ameaças = 160 Zeni).
- **Inimigos:** mais cervos e lobos distribuídos no mapa, além de dois saqueadores humanoides animados com os recursos já incluídos.
- **Mundo:** planície, deserto, neve, rios e missões mantidos; névoa excessiva da noite reduzida; velocidade do ciclo dia/noite ajustável no menu.

**Escopo visual real:** os novos cabelos são malhas estilizadas geradas a partir de curvas, não modelos de salão de beleza; o voo e as técnicas continuam usando animações adaptadas ao esqueleto existente. As imagens de conceito em `docs/referencias` indicam a direção artística desejada, **não são capturas do jogo**. O objetivo é consolidar uma POC técnica e jogável, não apresentar gráficos AAA.

## Controles

| Tecla | Ação |
|---|---|
| WASD / mouse | Movimentar e mirar |
| Shift | Correr / impulsionar voo |
| Espaço | Pular; toque duplo ativa/desativa voo |
| Espaço / Ctrl durante voo | Subir / descer |
| Clique esquerdo | Soco / combo |
| Clique direito (segurar) | Carregar e disparar rajada de Ki |
| 1 a 6 (segurar) | Carregar técnica selecionada; soltar para executar |
| X (segurar) | Carregar Ki no chão |
| V | Alternar primeira / terceira pessoa |
| Roda do mouse | Selecionar técnica na barra |
| I | Mochila / inventário |
| B | Loja do mercador, quando estiver perto (livre no Criativo) |
| K | Biblioteca / criação de poderes |
| U | Evolução de atributos |
| O | Configurações, modos e velocidade do dia |
| Esc | Fechar menu / pausar |
| F3 | Diagnóstico |

## Progresso e limitações

- Personagens e seu inventário são armazenados em **`localStorage`** por perfil. Use o mesmo navegador e endereço; limpar dados do site apaga o progresso.
- A partida é **single-player offline após instalar as dependências**; o código não exige API, banco ou servidor online.
- O criador de personagens tem quatro raças; algumas características raciais são acessórios estilizados, não anatomias completas diferentes.
- Animais existentes ainda usam assets de estilos diferentes: cervo e lobo são GLBs articulados, enquanto lebre/escorpião preservam malhas procedurais antigas. O novo saqueador usa o rig humanoide.
- Não existe loot físico no chão: o item aparece diretamente na mochila ao derrotar uma criatura.
- Modo Criativo é para testes. Alternar Criativo/Sobrevivência não constitui uma economia à prova de exploits.
- Há arquivos locais de modelos, texturas e animações. **Não é necessário baixar personagens para jogar.**

## Arquitetura para futura migração à Unreal

- `src/systems/RpgLoop.ts`: regras serializáveis de itens, contratos, modos e persistência.
- `src/world/ShopStall.ts`: mercador e ponto de comércio no cenário.
- `src/ui/RpgPanels.ts`: telas de mochila e comércio.
- `src/world/Wildlife.ts`: criaturas, movimentos, combate e saqueadores.
- `src/animation/HeroClips.ts`: clipes de animações; `src/characters/Character.ts`: avatar e câmera.
- `src/world/World.ts`: cenário, rios, iluminação e colisões.
- `src/core/Game.ts`: orquestração de gameplay e entradas.
- `src/data` e `docs/`: configuração, documentação e design.

A migração à Unreal vai **reimplementar renderização e código**. As regras, descrições, recursos exportáveis, parâmetros e referências artísticas serão aproveitáveis. Veja `docs/MIGRACAO_UNREAL.md` e `docs/POC_V040.md`.

## Testes

`npm run check` executa os testes Node e a compilação de produção TypeScript/Vite. `python tests/smoke_browser.py` executa um roteiro de navegador se Chromium e Playwright estiverem instalados.

**Limite desta entrega:** o ambiente de criação não pôde acessar o registro npm, então a compilação completa com todas as dependências e o resultado visual WebGL ainda precisam ser confirmados no Windows. Foram verificados a sintaxe TypeScript, integridade dos assets, estrutura HTML e lógica isolada da economia.

Protótipo experimental inspirado em Dragon Ball, sem afiliação aos detentores da marca. Verifique direitos autorais dos assets e personagens antes de divulgar comercialmente.
