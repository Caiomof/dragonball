# Roteiro de teste manual — v0.1.6

1. Executar `JOGAR.bat`. Confirmar abertura do endereço local e ausência de erro na tela; se houver, inspecionar console do navegador (`F12`).
2. **Começar jornada** → **Criar novo guerreiro**. Escolher raça, nome, altura, porte físico, olhos/cabelo/barba. Inspecionar a prévia 3D em diferentes estilos.
3. **Salvar e jogar**. Verificar se o avatar correto surge, se os pés ficam no chão e se é possível andar **para cima e para baixo** em colinas.
4. Andar normalmente por 10 segundos. Correr segurando Shift por 10 segundos. As animações devem manter um ritmo proporcional a *andar x correr*, sem acelerar freneticamente se o atributo de velocidade aumentar.
5. Com a mira em um alvo próximo, clicar com o esquerdo três vezes em intervalos menores que 0,85s. Conferir combos, gasto de stamina e dano.
6. Usar clique direito: bola de Ki e gasto de 6 Ki.
7. Pressionar e soltar `1` rapidamente: Kamehameha básico. Depois manter `1` pressionado por 2 segundos: feixe maior, mais dano, mais gasto de Ki.
8. Conferir as técnicas `2`, `3`, `4` da mesma forma. Scroll continua destacando o poder na hotbar.
9. Pressionar `K` para evoluir Ki, regeneração de Ki, stamina, vida, poder, velocidade terrestre e voo via botões **+ e −**. Voltar ao mapa e testar efeito imediatamente.
10. Dar dois toques em Espaço para voar. Testar subida com Espaço, descida com Ctrl e modificação do atributo de voo.
11. Pressionar `V` para câmera em primeira pessoa; inspecionar movimentos dos braços durante socos e ataques.
12. Voltar ao menu, criar um segundo personagem, editar um antigo e conferir sua evolução. Recarregar a página e confirmar que os perfis continuam salvos.
13. Destruir um objeto ambiental. Conferir que renasce após dois minutos.

**Limite conhecido:** a v0.1.6 foi validada estruturalmente e pela importação do GLB, mas a execução WebGL no Chrome/Edge não pôde ser automatizada no ambiente gerador por falta de acesso às dependências npm. Este roteiro confirma as interações visuais.
