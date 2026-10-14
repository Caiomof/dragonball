# Versão 0.1.6 — Atualização incremental

## Prioridades implementadas

1. Removida a dependência da tentativa de download de modelo GLB externo. Asset interno no ZIP.
2. Asset animado organizado em hierarquia de juntas (`Idle`, `Walk`, `Run`, `Jump`, `Flight`, `Punch`, `Charge`). Transições via `AnimationMixer`. Frequência da animação independe do multiplicador de velocidade.
3. Lista de personagens no menu, criar/editar/excluir múltiplos perfis salvos no localStorage. Raça, nome e controles de aparência.
4. LMB soco e combo de até 3 golpes; RMB pequenas rajadas de Ki; segurar 1–4 carrega o poder até 2,4 segundos; soltar lança, com custo/dano/tamanho progressivos.
5. Barra de stamina dinâmica com gasto de corrida, voo e socos, recuperação ao descansar.
6. Tela de atributos gratuita (limites positivos) para vida, ki, stamina, poder, recuperação de ki, velocidade e voo, com persistência por perfil.
7. Animação simplificada dos braços na visão em primeira pessoa para socos.

## Notas de implementação

- O modelo GLB acompanha o ZIP; o `JOGAR.bat` o verifica antes de inicializar.
- O renderer 3D permanece Three.js. Para Unreal, reutilizar dados, especificações e o GLB quando compatível; reimplementar código de runtime.
- Ajustes de atributo são intencionalmente ilimitados em quantidade de alterações, mas seus **valores são limitados por faixas de teste**.
- `localStorage` é local ao navegador e origem `http://127.0.0.1:5173`; não equivale a sincronização em nuvem.
- Não realizamos teste visual real com navegador WebGL neste ambiente. Configurar a verificação de integração completa no futuro.
