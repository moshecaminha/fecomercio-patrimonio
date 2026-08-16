/* ============================================================================
   FECOMÉRCIO PATRIMÔNIO — apoio ao uso em celular
   Não altera nenhuma tela: observa o que foi desenhado e prepara para o toque.

   1. Rotula cada célula com o título da coluna, para o CSS transformar a
      tabela em cartão legível sem rolagem lateral.
   2. Marca a célula de botões, que não precisa de rótulo.
   3. Devolve o foco ao campo de leitura depois de cada bipada.
   ========================================================================== */
'use strict';

(function(){

  function rotularTabelas(raiz){
    raiz.querySelectorAll('table.tabela').forEach(tab => {
      if (tab.closest('.matriz')) return;              // matriz continua tabela
      const titulos = [...tab.querySelectorAll('thead th')].map(th => th.textContent.trim());
      if (!titulos.length) return;

      tab.querySelectorAll('tbody tr').forEach(tr => {
        [...tr.children].forEach((td, i) => {
          if (td.hasAttribute('data-rotulo') || td.hasAttribute('colspan')) return;
          const rotulo = titulos[i] || '';
          if (td.querySelector('.btn')) td.classList.add('acoes-cel');
          else if (rotulo) td.setAttribute('data-rotulo', rotulo);
        });
      });
    });
  }

  /* Depois de uma leitura, o campo perde o foco e o operador precisa tocar de
     novo para bipar o próximo item. Em uma conferência de 40 volumes isso são
     40 toques a mais. */
  function focoNoLeitor(raiz){
    const campo = raiz.querySelector('#campoBip');
    if (campo && !campo.dataset.pronto){
      campo.dataset.pronto = '1';
      campo.setAttribute('enterkeyhint', 'search');
      campo.setAttribute('autocorrect', 'off');
      const grande = !window.matchMedia || window.matchMedia('(min-width: 900px)').matches;
      if (grande) campo.focus();   // no celular, focar abriria o teclado por cima da lista
    }
  }

  function preparar(){
    rotularTabelas(document);
    focoNoLeitor(document);
  }

  let espera = null;
  const observador = new MutationObserver(() => {
    clearTimeout(espera);
    espera = setTimeout(preparar, 40);
  });

  function ligar(){
    ['tela', 'modais'].forEach(id => {
      const alvo = document.getElementById(id);
      if (alvo) observador.observe(alvo, { childList: true, subtree: true });
    });
    preparar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();

})();
