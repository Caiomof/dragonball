# DRAGON BALL RPG: ORIGENS — v0.1.6

**Protótipo 3D experimental para Windows 10/11**, feito em TypeScript + Three.js + Vite. O jogo funciona em um servidor local e utiliza WebGL no navegador.

## Um clique para jogar

1. Extraia o ZIP inteiro para uma pasta (não execute dentro do arquivo compactado).
2. Dê dois cliques no **`JOGAR.bat`**.
3. Aguarde a instalação das dependências npm (somente na primeira vez) e a abertura do navegador.

Requer internet somente para instalar Node.js/dependências na primeira execução. O arquivo `public/models/origens-warrior.glb` **já vem no ZIP**, sem download de modelo 3D. Se o Windows solicitar autorização para instalar Node.js via winget, autorize; caso precise, feche e abra novamente o inicializador.

Alternativa manual: `npm install` e `npm run dev` na raiz da pasta. Endereço padrão: `http://127.0.0.1:5173`.

## Controles

| Comando | Efeito |
|---|---|
| `W A S D` | Caminhar |
| `Shift` | Correr, gastando stamina |
| Mouse | Controlar mira/câmera |
| Clique esquerdo | Soco / combo de três golpes |
| Clique direito | Pequena rajada de Ki |
| **Segurar `1`, `2`, `3`, `4`** | Carregar respectivamente Kamehameha, Galick Gun, Masenko, Kienzan |
| **Soltar a tecla** | Disparar o poder; carregar por mais tempo aumenta tamanho, dano e gasto de Ki |
| Scroll do mouse | Alternar poder destacado na barra |
| Espaço | Pular |
| Espaço duas vezes rapidamente | Ativar/desativar voo |
| Espaço no voo / Ctrl | Subir / descer |
| `V` | Alternar primeira / terceira pessoa |
| `K` | Abrir laboratório de atributos |
| `O` | Abrir configurações |
| `Esc` | Pausar |
| `F3` | Diagnóstico opcional |

**Observação:** o scroll apenas destaca o poder. As teclas 1–4 lançam os poderes. O botão esquerdo é exclusivamente para combate corpo a corpo.

## Personagens

Na tela inicial, clique **Começar jornada** para abrir a lista de personagens. Crie quantos personagens quiser, escolha a raça e customize:

- nome, altura e porte físico;
- penteado, cor do cabelo, barba;
- cor dos olhos;
- raça (Saiyajin, Terráqueo, Namekuseijin, Majin).

Os perfis ficam salvos no `localStorage` do navegador, individualmente, junto com os atributos. **Não apague os dados do site `localhost:5173`** se quiser preservá-los; uma janela anônima não compartilhará o mesmo armazenamento.

## Evolução gratuita

Pressione `K` e use **+ e −** para ajustar vida, Ki máximo, stamina, poder de luta, recuperação de Ki, velocidade terrestre e domínio do voo. Não há custo de pontos nesta versão. As mudanças afetam a partida e ficam salvas por personagem. Os controles usam limites de segurança para evitar números inviáveis.

## Personagem 3D: mudança principal

O `public/models/origens-warrior.glb` é um **novo modelo estilizado criado para esta versão**, com hierarquia de articulações, 64 partes de malha e sete clipes de animação (`Idle`, `Walk`, `Run`, `Jump`, `Flight`, `Punch`, `Charge`). É um modelo simples, original e inteiramente empacotado no projeto — não é um modelo comercial de alta fidelidade. Usa `AnimationMixer` com transições e reprodução independente da velocidade ajustável de corrida.

O gerador de assets está em `scripts/build_hero.py` (opcional, só para desenvolvimento; requer Python + NumPy + trimesh). **Não é necessário executar o script no Windows.**

## Projeto e arquitetura

- `src/core/Game.ts` — fluxo de jogo, input, câmera e regras.
- `src/characters/Character.ts` — renderização do personagem e animação.
- `src/data/profiles.ts` — atributos e armazenamento de perfis.
- `src/world/World.ts` — terreno, colisões e objetos destrutíveis.
- `src/combat/Combat.ts` — efeitos e dano.
- `src/ui/Ui.ts` / `src/style.css` — telas, HUD e editor.
- `src/data/*.json` — configurações das raças e técnicas.
- `public/models/origens-warrior.glb` — modelo local.
- `docs/` — design e migração futura para Unreal.
- `tests/` — testes automatizados.

Comandos opcionais para desenvolvedores: `npm test`, `npm run build`.

## Estado da validação

- ✅ Formato do GLB verificado e importado pela biblioteca `trimesh`; 7 animações identificadas.
- ✅ Testes estáticos e de integridade dos arquivos passam.
- ✅ Análise sintática TypeScript realizada.
- ⚠️ Compilação real Vite/Three.js e testes de gameplay WebGL **não puderam ser executados no ambiente de criação por falta de acesso ao registro npm**. Faça o teste no Windows. Se ocorrer um erro, envie a mensagem do terminal, mais a aba Console (F12) se necessário.

Projeto experimental de fã, sem afiliação ou autorização dos proprietários de Dragon Ball. Para publicação comercial, serão necessárias verificações de direitos sobre a franquia, nomes e personagens.
