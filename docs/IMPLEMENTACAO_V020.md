# Implementação 0.2.0 — demonstração jogável

Esta entrega evolui a base 0.1.14. O objetivo é uma demonstração com aparência editável, movimentos coerentes, exploração guiada e um ciclo completo de jogo. O código e os assets permanecem locais ao projeto.

## Escopo implementado

| Área | Comportamento implementado | Evidência principal |
|---|---|---|
| Aparência | Cabelos e barbas em geometria própria ajustada aos vértices da cabeça; acessórios acompanham o esqueleto. Antenas/orelhas Namekuseijin e apêndice Majin. | Captura do editor e teste de edição/persistência |
| Editor | Giro e aproximação, cores, altura/porte, edição de personagem existente preservando sua jornada. | Fluxo completo no navegador |
| Locomoção | Biblioteca existente preservada para caminhada/corrida/salto/nado; transições e reprodução controlada por velocidade real. | Biblioteca GLB validada; captura de natação |
| Voo | Clipes para decolagem, flutuação, cruzeiro e frenagem; inclinação nas curvas, descida, consumo de Ki, limites e colisão em altura. | Objetivo de voo executado no navegador |
| Energia e combate | Posturas específicas para X e quatro técnicas, liberação própria, origem nos ossos das mãos, soco com impacto atrasado, bloqueio por cenário. | Treinamento e desafio final vencidos por entradas de jogo |
| Fauna | Frente +Z alinhada à velocidade, curvas suaves, repouso/patrulha, fuga/perseguição, antecipação de mordida, distância vertical e linha de visão. | Testes de orientação, curvas e alcance; combate com lobo no navegador |
| Cervo | Modelo articulado original incluído em GLB, com seis clipes; gerador versionado. | Integridade do arquivo e canais de animação |
| Água | Perfil de rio contínuo, lago nivelado, leito escavado, margens, profundidade e nado derivados da mesma definição. Altura do nadador acompanha a cabeça. | Mais de 1.500 amostras do leito; captura e asserção de cabeça acima da água |
| Mundo | Área jogável ampliada de 210 para 340 unidades por lado; planície, dunas e serra nevada; flora, marcos e santuários; transições graduais. | Testes dos biomas e capturas de deserto/neve |
| Jornada | Seis etapas ordenadas, direção/distância, checkpoints e guardião com ataque de área anunciado. A onda pode ser evitada por voo, distância ou cobertura. | Progressão completa e regras do ataque testadas |
| Câmera e interface | Boom com colisão, primeira pessoa, HUD de objetivos, alvo próximo, telas de derrota e edição, atalhos de painéis. | Testes de câmera e fluxo no navegador |
| Persistência | Migração e validação de valores, perfis independentes, progresso/checkpoint, gravação periódica e aviso de falha. | Testes com armazenamento simulado e recarga real da página |
| Estabilidade e qualidade | Simulação fixa de 60 passos/s, pausa global, cancelamento de cargas ao pausar, espera de recursos, presets de qualidade, volume e redução de movimento. | Testes do relógio e pausa com estatísticas/fauna congeladas |
| Manutenção | Módulos de aparência, clipes, terreno, jornada, câmera, configurações e regras extraídos da coordenação da partida. Terreno dividido para descarte por câmera, vegetação instanciada e textura de aura compartilhada. | TypeScript e build de produção |

## Validação executada

- `npm run check`: 39 testes, sem falhas ou testes ignorados; verificação TypeScript e build Vite.
- Build de produção servido por `npm run preview`: criação e carregamento até PLAYING, sem erros ou requisições falhas; API de realocação de desenvolvimento ausente.
- `python tests/smoke_browser.py`: criação, carregamento, três socos com dano, voo, carregamento de técnica, pausa, natação, descoberta dos santuários, derrota do guardião, primeira pessoa, configurações, edição, persistência, derrota do jogador e retorno ao checkpoint.
- Conferência adicional no navegador: acessórios das quatro raças e clipes das quatro técnicas, além de recuperação de Ki; sem erros de JavaScript. Roteiro reproduzível: `python tests/visual_browser.py`.
- Revisão de capturas: editor, voo, carga, lago, deserto, neve, primeira pessoa e derrota. Artefatos ficam em `/tmp/origens-smoke`, fora do repositório.
- O teste de navegador utiliza Chromium com SwiftShader, no ambiente Linux em nuvem. Ele usa realocação exclusiva de desenvolvimento para abreviar viagens entre pontos distantes; não comprova o percurso integral a pé. O treinamento e os ataques usam os comandos reais do jogo.

O Vite ainda informa um aviso de tamanho do pacote JavaScript, cerca de 730 kB minificado com Three.js (aproximadamente 196 kB comprimido). A compilação é bem-sucedida; separar o carregamento da biblioteca pode ser uma otimização posterior.

## Limites desta versão

As animações novas são articulação autoral em código, sem captura de movimento ou IK de pés. O lobo possui somente `idle` e `move` no asset original; ataque, impacto e queda usam complementos do controlador. O cervo é estilizado e articulado, não um animal escaneado ou um modelo de alta fidelidade. O guardião é um alvo estacionário com ataque de área, não um inimigo humanoide com navegação.

A água tem uma superfície opaca estilizada; não há mergulho, refração física ou simulação de fluidos. Os biomas compartilham iluminação de ambiente, sem ciclo de clima. A jornada é curta e demonstrativa, sem campanha ou multiplayer.

A inspeção visual na nuvem e os testes funcionais não certificam taxa de quadros em Windows/GPU, ergonomia de longas sessões ou qualidade percebida do áudio. Esses pontos têm um roteiro explícito em `TESTE_MANUAL.md`. O código está preparado para avaliação; a preferência estética do jogador continua sendo o critério final para animação e aparência.
