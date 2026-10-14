import './style.css';
import { Game } from './core/Game';

try {
  new Game();
} catch (error) {
  console.error('Falha na inicialização do DragonBallRPG:', error);
  const root = document.getElementById('game-root');
  if (root) root.innerHTML = `<div class="fatal-error"><h1>NÃO FOI POSSÍVEL INICIAR O JOGO</h1><p>Verifique se a aceleração gráfica está habilitada no navegador e recarregue a página.</p><code>${error instanceof Error ? error.message.replace(/[<>&]/g, '') : 'Erro desconhecido'}</code></div>`;
  document.getElementById('ui-root')?.remove();
}
