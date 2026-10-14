# Registro da versão 0.1.2

A atualização mantém os arquivos originais `src/core/Game.ts`, `src/world/World.ts`, `src/characters/Character.ts`, `src/combat/Combat.ts` e `src/ui/Ui.ts`, incrementados diretamente. Introduz apenas `src/data/skills.json` e `src/data/skills.ts` como módulo de dados das habilidades.

## Regras de gameplay portáveis

- `abilities`: KI, dano, alcance, tempo de carregamento, duração do efeito e cooldown por habilidade.
- `races`: raça, vida máxima inicial, Ki máximo inicial e poder de luta base.
- `flight`: duplo Espaço alterna, Ctrl descida, Shift aceleração, altura mínima de 1,2m sobre o terreno.
- `upgrades`: cada ponto aumenta Ki (+20), vida (+25) ou poder (+5 e +10% no dano de habilidades).
- `destructibles`: trees HP 65, rocks HP 85, ruins HP 75, regen 120s. O totem segue valores próprios.
- `settings`: modo de câmera, campo de visão e sensibilidade persistidos em armazenamento local.

Para migrar à Unreal: implementar habilidades como dados de GameplayAbilities/DataAssets, objetos destrutíveis com componentes e timers, câmera com Spring Arm + Aim Ray, voo via CharacterMovement Flying e UI UMG. **O código Three.js não migra diretamente.**
