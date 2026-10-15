# DRAGON BALL RPG: ORIGENS — v0.1.14

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


## V0.1.13 — Passe de correção de animações e arte

Esta versão foi alterada **a partir do RAR modificado no Cursor** (base 0.1.12), não da antiga versão distribuída pelo ChatGPT.

- As animações aprovadas de parada, andar, correr e pular continuam mapeadas aos mesmos clips `Idle_Loop`, `Walk_Loop`, `Sprint_Loop`, `Jump_Loop`.
- Os poderes agora usam de verdade `Spell_Simple_Idle_Loop` / `Spell_Simple_Shoot` e não sobrescrevem o corpo com poses manuais pós-mixer. Durante carregamento, o clip permanece ativo. Voo usa transições e movimentos próprios derivados de clips existentes — **ainda não é uma animação de voo originalmente capturada**, exigindo avaliação visual.
- Nado usa `Swim_Fwd_Loop` e `Swim_Idle_Loop` da biblioteca existente; a entrada na água é amortecida.
- Rio é uma **malha contínua** com shader de correnteza, espuma sutil e superfície compartilhada com a física da natação, ao invés de retângulos.
- Uniforme do personagem humanoide agora é aplicado na textura UV real, com quatro combinações de cores; **não há alteração no esqueleto nem na geometria**. Regenerar com `python scripts/paint_uniform.py` (requer numpy e pillow).
- Animais: suporte a modelos `.glb` reais em `public/models/wildlife/{wolf,deer}.glb`, com animações se estiverem embutidas. O lobo modelo `anyCreature` MIT pode ser baixado com `INSTALAR_LOBO.bat`. **O GLB do lobo não está embutido no ZIP, e o cervo continua como fallback procedural** até receber um asset autorizado; não declarar os dois animais prontos.

### Teste no Windows

Execute `JOGAR.bat` e confira: caminhada/corrida inalteradas, X carregamento de Ki sustentado, 1–4 animações de conjuração ao segurar e soltar, câmera ao voar, rio e natação, diferença de uniformes por raça. Em caso de falha, envie console F12 e vídeo curto do movimento; a compilação WebGL e a qualidade visual dependem de teste real.

### Licenças e origem

- Quaternius Universal Animation Library — CC0: https://quaternius.com/packs/universalanimationlibrary.html
- Quaternius Ultimate Animated Animals — CC0: https://quaternius.com/packs/ultimateanimatedanimals.html (sugestão para cervo, não incluído)
- Wolf anyCreature example — MIT, fonte: https://github.com/Ariescar/anyCreature/blob/main/example/wolf.glb (download opcional)

