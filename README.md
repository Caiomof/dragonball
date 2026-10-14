# DRAGON BALL RPG — ORIGENS

**Protótipo jogável v0.1 · Windows 10 · 3D estilizado · projeto pessoal de fã**

Um pequeno RPG de aventura em terceira pessoa com quatro raças, cenário procedural, ataque de energia, HUD dinâmica e totem que recebe dano. Desenvolvido com Three.js e TypeScript para facilitar experimentação antes de uma futura reimplementação em Unreal Engine.

## ▶ Como jogar no Windows

1. Extraia **o ZIP inteiro** para uma pasta, preferencialmente `C:\GameDev\DragonBallRPG-Web`.
2. Execute **`JOGAR.bat`** com dois cliques.
3. O script instala automaticamente as dependências necessárias na primeira execução e abre o navegador.
4. Clique em **COMEÇAR JORNADA**, selecione uma raça e clique em **INICIAR AVENTURA**.

O `JOGAR.bat` verifica Node.js. Se não estiver instalado, tenta instalar o LTS com o **winget** do Windows. A instalação pode exigir permissão do Windows e, se o PATH ainda não tiver sido atualizado, uma segunda execução do `.bat`. É necessária internet para a instalação inicial do Node.js e das dependências. O jogo em si não faz chamadas obrigatórias a APIs externas.

**Mantenha aberta a janela `DragonBallRPG - Servidor` enquanto joga.** Fechá-la encerra o servidor local do Vite.

### Controles

| Controle | Ação |
|---|---|
| WASD | Andar |
| Shift segurado | Correr |
| Espaço | Pular |
| Mouse | Controlar a câmera (com ponteiro capturado) |
| Clique esquerdo | Kamehameha (25 Ki) |
| Esc | Pausar e liberar o mouse |
| F3 | Painel técnico de diagnóstico |

Ao iniciar, o jogo tenta capturar o ponteiro do mouse. Se o navegador bloquear essa solicitação, clique na área 3D. `Esc` libera o cursor e abre a pausa. O Ki se recupera gradualmente após um intervalo sem ataques.

## Execução manual opcional

Requer Node.js 20.19 ou superior:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173`.

Para testar e compilar:

```powershell
npm test
npm run build
npm run preview
```

O build fica em `dist/` e deve ser servido por HTTP local, não aberto diretamente como `file://`.

## Escopo implementado na v0.1

- Menu principal, tela de seleção, carregamento e pausa.
- Quatro raças: Saiyajin, Terráqueo, Namekuseijin e Majin.
- Personagens humanoides procedurais com silhuetas, roupas, tons de pele e detalhes distintos.
- Cenário natural de baixo polígono com colinas, árvores instanciadas, rochas, grama e iluminação ao pôr do sol.
- Jogabilidade em terceira pessoa, corrida e salto com colisão simplificada.
- HUD ligada aos atributos reais da raça escolhida.
- Kamehameha estilizado com carregamento, feixe luminoso, cooldown, custo e dano.
- Totem de treinamento com vida, feedback e regeneração após destruição.
- Áudio sintetizado localmente pela Web Audio API, sem arquivos externos.
- Dados de gameplay separados em JSON e documentação para migração futura.

## Limites desta versão

É uma **vertical slice de jogo**, não um RPG completo: não há quests, inventário, salvamento de progresso, construção, voo, inimigos controlados por IA ou destruição do terreno. As colisões usam simplificações 3D e os modelos dos personagens são geométricos estilizados, não assets de qualidade comercial. Não há integração com Steam nesta versão.

O código e os dados são preparados para migração, mas **a lógica Three.js precisará ser reimplementada** em Blueprints/C++ na Unreal. Veja [`docs/MIGRACAO_UNREAL.md`](docs/MIGRACAO_UNREAL.md).

## Estrutura

```text
JOGAR.bat
index.html
src/
  main.ts
  style.css
  audio/Sound.ts
  characters/Character.ts
  combat/Combat.ts
  core/Game.ts
  data/races.json
  data/abilities.json
  data/gameConfig.ts
  ui/Ui.ts
  world/World.ts
tests/project.test.mjs
docs/
  GAME_DESIGN.md
  MIGRACAO_UNREAL.md
  TESTE_MANUAL.md
```

## Nota de direitos

Este é um projeto independente e experimental de fã. Referências e nomes ao universo de Dragon Ball são usados para um protótipo pessoal. O projeto não inclui modelos, áudios, imagens ou marcas oficiais distribuídos de terceiros. Publicação comercial exigiria avaliar direitos de propriedade intelectual e, conforme o caso, obter licenças ou desenvolver uma identidade original.
