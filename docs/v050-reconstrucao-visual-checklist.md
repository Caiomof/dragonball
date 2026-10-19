# Dragon Ball RPG — backlog visual e de mundo (lista completa)

**Regras deste documento**

- Não apagar itens. Só marcar `[x]` quando **você** disser que está ok **ou** quando estiver implementado e realmente ok.
- `(código)` = já tem algo no repositório; **ainda precisa do seu ok no jogo**.
- Versionar correções depois (v0.5.1, v0.5.2…); aqui fica o inventário inteiro.

---

## Personagem e criação

- [x] Cabelo: ver o **corte real** na galeria (malha), não símbolo `(código)`
- [ ] Cabelo: ver o corte escolhido no personagem 3D na criação (tempo real) — **skinning no osso Head (igual roupa); validar no jogo**
- [ ] Cabelo: persistir no jogo após salvar personagem
- [ ] Barba: estilos (nenhuma, curta, cavanhaque, cheia) visíveis no rosto `(código)` skinning
- [x] Olhos e cor de cabelo aplicados no modelo GLTF `(código)` íris + pupila separadas
- [x] Altura e porte visíveis e estáveis `(código)` faixa ampliada
- [x] Roupa escolhível: gi da raça (padrão)
- [x] Roupa escolhível: patrulheiro (modular, sem sumir o corpo)
- [x] Roupa escolhível: camponês (modular, sem sumir o corpo)
- [x] Roupa escolhível: patrulheira e camponesa `(código)` galeria 5 opções
- [ ] Feminino: corpo feminino + cabelos femininos quando fizer sentido (removido BuzzedFemale corrompido até reimport)
- [x] Namekuseijin: visual de criação (antenas / sem cabelo humano) coerente `(código)`
- [x] Majin: visual de criação coerente `(código)`
- [ ] Namekuseijin e Majin: **corpo 3D próprio** (pacote atual não traz; hoje bloqueados ou procedural)
- [x] Gi por raça (textura PNG) legível e sem personagem invisível
- [x] Primeira pessoa: braços do modelo GLTF (não só braços primitivos)
- [x] Mercador com visual de NPC (corpo + roupa camponês) alinhado ao jogador `(código)`
- [x] Saqueadores com roupa ranger + animação UAL1
- [x] Modal próprio (sem alert do navegador) ao salvar/excluir guerreiro `(código)`
- [x] Nome do guerreiro só no final (modal “Jogar”) `(código)`
- [x] Cor da barba separada da cor do cabelo na UI `(código)`
- [x] Criador sem girar/aproximar câmera `(código)`

## Animação do herói

- [x] Locomoção a pé: idle / walk / run / sprint fluidos (UAL1) `(código)`
- [x] Natação `(código)`
- [x] Decolagem de voo faz sentido `(código)`
- [x] Voo parado / hover sem pose de corrida `(código)`
- [x] Voo em movimento sem “correr no ar” `(código)`
- [ ] Voo acelerado (boost) legível e bonito — **inclinação reforçada `(código)`; validar**
- [ ] Pouso / brake de voo
- [x] Ataques corpo a corpo e gestos de poder `(código)`
- [x] Kamehameha / feixes / disco / orbe com pose coerente `(código)`
- [x] Correr (Shift) inclina o tronco no chão `(código)` novo

## Fauna e inimigos

- [x] Lobo: malha, ataque, dano, loot
- [x] Veado, lebre, vaca, boi, cavalo: tamanho **adulto** (não filhote) `(código)`
- [x] Animais: animação **andar** devagar e **correr** rápido `(código)`
- [x] Animais: não travar em desnível / obstáculo `(código)` desatole + hop
- [x] Poeira ao correr `(código)`
- [x] Espectro (fantasma): voo idle / voo rápido `(código)` ghost glTF
- [x] Orcs no vale vermelho: spawn, escala, dificuldade `(código)` **maior + mais spawns**
- [x] Bolha verde no vale vermelho `(código)` **maior + mais spawns**
- [ ] Mais variedade de monstros no mapa (blob, orc, ghost, futuros do zip) — **falta importar mais do zip**
- [x] Monstros **maiores** no Vale Crimson `(código)` escala corpo ↑
- [ ] Monstros **maiores** e desafios maiores (bosses, elites) — boss guardião existe; elite dedicado pendente
- [x] Barra de vida no bicho ao tomar dano `(código)`
- [x] Telegráfico antes de mordida / ataque (anel no chão) `(código)`
- [ ] Movimento de orc/monstro satisfatório (feedback antigo: orc removido por movimento ruim; reintroduzido no vale)

## Mundo, natureza e cenário

- [x] Árvores Quaternius com **textura** (bin + jpg no disco)
- [x] Árvores substituem ou dominam sobre cilindro+icosaedro antigo `(código)`
- [x] Árvores em tamanho **grande** o suficiente `(código)` escala ~1.45×
- [x] Arbustos, grama, flores, troncos secos espalhados `(código)`
- [x] Quebrar árvore no gameplay (breakables) com visual GLTF `(código)` stands + decor
- [x] Rochas 3D substitutas (tijolos vila) onde não há glTF de pedra `(código)`
- [x] Cactos / neve / decor procedural ainda aceitável ou substituir por assets `(código)` **crimson: vulcões + poças de lava + brasas**
- [x] Hub medieval: cercas e caixas com **textura** (import pasta glTF vila)
- [x] Grades de metal com sentido (ex.: perto do boneco de treino) `(código)`
- [x] Carroça, trepadeiras, props extras `(código)` parcial vila
- [x] Casa modular: piso, paredes, porta, janela, telhado atrás do mercador `(código)`
- [ ] Mais casas / ruas medievais usando o MegaKit (paredes, telhados, portas)
- [x] Mais densidade de natureza sem poluir spawn / água `(código)` parcial
- [ ] Mapa **maior** (hoje limitado por `WORLD_HALF` / grade de terreno — mudança grande)
- [x] Bioma novo **vermelho** visível e com inimigos `(código)` **região leste espelhando deserto (CALDEIRA CRIMSON)**
- [x] Bioma vermelho **grande o suficiente** na sensação de exploração `(código)` **mesma escala deserto/neve; validar no mapa**
- [x] Santuários / marcos legíveis no mapa `(código)`

## Água, rio e terreno

- [x] Rio: superfície contínua sem buracos
- [x] Margem do rio sem degrau feio / desnível agressivo `(código)` blend na margem
- [x] Cor e leitura da água (mais limpa, menos “lama”) `(código)` shader
- [x] Espuma nas bordas mais visível `(código)`
- [x] Lago coerente com nível e natação
- [ ] Terreno geral: menos desníveis feios perto da água
- [x] Física de terreno = malha renderizada (manter ao mudar água)

## VFX e poderes

- [ ] Texturas Kenney importadas e no disco — **rodar `asset_import.py` se pasta `public/assets/vfx` vazia**
- [x] Impacto de poder com partículas Kenney `(código)` faísca + texturas variadas no impacto
- [x] Feixe / carga com variedade (chama, círculo, estrela, magia) `(código)`
- [ ] Brackeys VFX usados onde couber (aura, impacto, ambiente) — **paths no código; falta import**
- [x] Kamehameha / galick / masenko / kienzan visualmente distintos `(código)` estilos
- [x] Aura de voo / carga de ki legível `(código)`
- [ ] UAL2 ou clips extras do zip usados onde fizer sentido (sem quebrar UAL1)

## Áudio, UI e qualidade

- [x] Passos / natação / voo no som `(código)`
- [x] HUD de alvo (dummy e bichos) coerente `(código)`
- [x] Indicadores de voo, ki, stamina
- [ ] Performance em máquina real (sem travadas ao carregar muitos GLTF)
- [x] `npm run check` verde após mudanças grandes

## Import e assets (pipeline)

- [x] `asset_import.py`: natureza pasta glTF completa
- [x] `asset_import.py`: vila pasta glTF completa
- [x] Animais: glTF válido (wolf embedded; outros com bin quando existir)
- [x] Outfits + cabelos + corpos com bin/texturas
- [x] Monstros ghost, orc, blob com bin/texturas
- [x] Não depender só de `.gltf` solto sem textura (caixas brancas) — import corrigido

## Gameplay preservado (não quebrar)

- [x] Missões / jornada
- [x] Inventário, loja, Zeni, modos criativo/sobrevivência
- [x] Criador de poderes
- [x] Checkpoints, dummy, guardião
- [x] Quatro raças (duas jogáveis; duas bloqueadas até ter corpo)

## Histórico de feedback (referência — não apagar)

- Personagem invisível com outfit modular escondendo corpo → gi + outfit opcional
- Árvores brancas sem bin → import corrigido
- “Só lobo e fantasma mudaram” → árvores GLTF, vila, fauna
- Checklist marcado sem teste do usuário → não repetir
- Playwright visual removido → teste manual seu
- Cabelo não aparece → tentativa: skinning rígido no osso Head (mesma ideia da roupa)

## Versões futuras (ideias — ainda não item fechado)

- [ ] v0.5.x — correções só do que você marcar acima
- [ ] Boss único com arena no vale vermelho
- [x] Mais spawns por bioma (deserto, neve) `(código)` **crimson: spawns espalhados pelo leste**
- [ ] Edifícios jogáveis / interiores MegaKit
- [ ] Reimportar `Hair_BuzzedFemale` e mais monstros do zip com animação

---

**Última edição do inventário:** marcados itens com implementação no repo; cabelo/barba e VFX no disco seguem pendentes de **seu teste** ou **import de assets**.
