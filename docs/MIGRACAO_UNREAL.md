# Preparação de migração Three.js → Unreal Engine

A migração será uma **reimplementação**, não uma conversão direta do código TypeScript em Blueprint. Preserve regras, dados e assets para não perder decisões de design.

## Dados portáveis

- `src/data/races.json`: identificadores, atributos e apresentação de quatro raças.
- `src/data/abilities.json`: Ki, dano, cooldown, alcance e duração dos efeitos.
- `docs/GAME_DESIGN.md`: decisões de gameplay e escopo.

## Mapeamento dos sistemas

| Web | Unreal |
|---|---|
| Game.ts (estados e fluxo) | GameInstance + GameModes + PlayerController |
| Character.ts | Character Blueprint + Skeletal Mesh + Animation Blueprint |
| World.ts | Landscape + Foliage/PCG + iluminação |
| Combat.ts | Ability Blueprint/GAS + Niagara + Damage |
| Ui.ts / HTML + CSS | UMG Widgets |
| Sound.ts | MetaSounds / Sound Cues |
| races.json / abilities.json | Data Tables, Primary Data Assets ou arquivos JSON |

## Convenção de unidades e orientação

- Three.js: unidades de mundo tratadas como metros no design deste protótipo; eixo Y vertical, câmera e movimentação 3D.
- Unreal: unidade padrão é centímetro; eixo Z vertical. Multiplicar posições e velocidades lineares por 100 ao portar magnitudes.
- Não copiar diretamente ângulos/orientações entre engines sem converter eixos e handedness.

## Assets

Os personagens e o cenário v0.1 são feitos com geometria procedural Three.js. Não há modelos GLB incluídos nesta versão. Para a migração, recriar visual com meshes apropriadas, ou produzir assets glTF/GLB independentes. Preservar paletas e descrições visuais das raças.

## Plano futuro

1. Aprovar a direção visual e as mecânicas no protótipo web.
2. Congelar v1 do esquema JSON e formalizar regras.
3. Produzir modelos e animações exportáveis (GLB/FBX quando adequado).
4. Reimplementar um único mapa e personagem na Unreal.
5. Migrar dados e validar resultados equivalentes.
6. Expandir física, destruição e mundo aberto nativos na Unreal.

Não planejar migração binária automática. Não duplicar esforços entre engines antes de estabilizar as regras do jogo.
