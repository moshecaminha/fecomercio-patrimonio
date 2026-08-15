/* ============================================================================
   AÇÕES — um único ouvinte para toda a interface.
   Cada botão declara data-acao; aqui em baixo se decide o que fazer.
   ========================================================================== */
'use strict';

document.addEventListener('click', async ev => {
  if (ev.target.classList?.contains('cortina')) return fecharModal();
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) return;
  const a = alvo.dataset.acao, id = alvo.dataset.id;

  /* tela de acesso */
  if (a === 'login' || a === 'modo-ativar' || a === 'modo-entrar'){
    ev.preventDefault();
    if (a === 'login') await enviarLogin();
    else trocarModoLogin(a === 'modo-ativar' ? 'ativar' : 'entrar');
    return;
  }

  try {
    switch (a){
      /* navegação -------------------------------------------------------- */
      case 'sair': await sair(); break;
      case 'ir': await ir(alvo.dataset.vista); break;
      case 'fechar-modal': fecharModal(); break;
      case 'filtrar-setor': F.dSetor = id; await ir('demandas'); break;
      case 'voltar-lista': aberta = null; render(); break;

      /* demandas --------------------------------------------------------- */
      case 'abrir-demanda': await abrirDemanda(id); break;
      case 'add-item': incluirItem(); break;
      case 'del-item': novo.itens.splice(Number(id), 1); render(); break;
      case 'salvar-demanda': await salvarNovaDemanda(); break;
      case 'decidir': await decidirDemanda(id, alvo.dataset.voto); break;
      case 'mover-demanda': await moverDemanda(id); break;
      case 'concluir-demanda': await concluirDemanda(id); break;
      case 'cancelar-demanda': await cancelarDemanda(id); break;
      case 'comentar': await comentarDemanda(id); break;
      case 'imprimir-demanda': imprimirFichaDemanda(); break;

      /* patrimônio ------------------------------------------------------- */
      case 'novo-bem': formBem(null); break;
      case 'ficha-bem': fichaBem(id); break;
      case 'editar-bem': fecharModal(); formBem(id); break;
      case 'salvar-bem': await salvarBem(id || null); break;
      case 'mover-bem': await moverBem(id); break;

      /* almoxarifado ----------------------------------------------------- */
      case 'ler-campo': lerCampo(); break;
      case 'camera': await abrirCamera(); break;
      case 'novo-produto': formProduto(null); break;
      case 'mov-saida': fichaMovimento(id, 'saida'); break;
      case 'mov-entrada': fichaMovimento(id, 'entrada'); break;
      case 'confirmar-mov': await confirmarMovimento(id, alvo.dataset.tipo, alvo); break;
      case 'salvar-produto': await salvarProduto(id || null); break;

      /* etiquetas -------------------------------------------------------- */
      case 'etq-todas': {
        const fonte = F.eTipo === 'bens' ? S.bens : S.produtos;
        fonte.filter(x => !F.eBusca || contem(F.eTipo === 'bens' ? `${x.tombo} ${x.descricao}` : `${x.codigo} ${x.nome}`, F.eBusca))
             .forEach(x => etqSel.add(x.id));
        render(); break; }
      case 'etq-nenhuma': etqSel.clear(); render(); break;
      case 'imprimir-etq': imprimirEtiquetas(); break;

      /* relatórios ------------------------------------------------------- */
      case 'exportar-demandas': exportarDemandas(); break;
      case 'exportar-bens': exportarBens(); break;
      case 'exportar-estoque': exportarEstoque(); break;
      case 'exportar-relatorio': exportarRelatorio(); break;
      case 'imprimir-relatorio': imprimirRelatorio(); break;

      /* administração ---------------------------------------------------- */
      case 'admin-aba': adminAba = alvo.dataset.k; render(); break;
      case 'criar-convite': await criarConvite(); break;
      case 'del-convite': {
        const { error } = await sb.from('fp_convites').delete().eq('id', id);
        if (error) return aviso(erroBanco(error), 'ruim');
        carregarConvites(); break; }
      case 'editar-acessos': editarAcessos(id); break;
      case 'salvar-acessos': await salvarAcessos(id); break;
      case 'alternar-ativo': {
        const { error } = await sb.from('fp_perfis').update({ ativo: alvo.dataset.ativo !== 'true' }).eq('id', id);
        if (error) return aviso(erroBanco(error), 'ruim');
        await recarregar(); render(); break; }
      case 'novo-setor': formSetor(null); break;
      case 'editar-setor': formSetor(id); break;
      case 'salvar-setor': await salvarSetor(id || null); break;
      case 'add-etapa': await addEtapa(id); break;
      case 'del-etapa': await delEtapa(id); break;
      case 'novo-tipo': formTipo(null, id); break;
      case 'editar-tipo': formTipo(id, null); break;
      case 'salvar-tipo': await salvarTipo(id || null, alvo.dataset.setor); break;
      case 'add-campo': addCampo(); break;
      case 'del-campo': camposEmEdicao.splice(Number(id), 1); el('listaCampos').innerHTML = listaCamposHTML(); break;
    }
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
});

/* --------------------------------------------------------------- CHANGE -- */
document.addEventListener('change', async ev => {
  const t = ev.target;

  if (t.dataset.acao === 'troca-setor'){
    novo.setor_id = t.value; novo.tipo_id = ''; novo.itens = []; render(); return;
  }
  if (t.dataset.acao === 'troca-tipo'){ novo.tipo_id = t.value; render(); return; }

  if (t.dataset.filtro){
    F[t.dataset.filtro] = t.type === 'checkbox' ? t.checked : t.value;
    if (t.dataset.filtro === 'eTipo') etqSel.clear();
    render(); return;
  }
  if (t.hasAttribute('data-filtro-setor-foco')){ setorEmFoco = t.value; render(); return; }

  if (t.dataset.etq){
    t.checked ? etqSel.add(t.dataset.etq) : etqSel.delete(t.dataset.etq);
    el('contaEtq').textContent = etqSel.size + ' selecionada(s)';
    const b = document.querySelector('[data-acao="imprimir-etq"]');
    if (b) b.disabled = !etqSel.size;
    t.closest('.etq')?.classList.toggle('marcada', t.checked);
    return;
  }

  if (t.dataset.papel){
    const { error } = await sb.from('fp_perfis').update({ papel: t.value }).eq('id', t.dataset.papel);
    if (error) return aviso(erroBanco(error), 'ruim');
    await recarregar();
    aviso('Papel atualizado.', 'bom');
    return;
  }

  if (t.id === 'mvDestino' && t.value === '__outro'){
    const l = t.closest('label');
    l.innerHTML = '<span>Setor de destino</span><input id="mvDestino" type="text" placeholder="Digite o destino">';
    el('mvDestino').focus();
  }
});

/* ---------------------------------------------------------------- INPUT -- */
let esperaBusca = null;
document.addEventListener('input', ev => {
  const t = ev.target;
  if (!t.dataset.vivo) return;
  const chave = t.dataset.vivo, valor = t.value, pos = t.selectionStart;
  F[chave] = valor;
  clearTimeout(esperaBusca);
  esperaBusca = setTimeout(() => {
    render();
    const novoCampo = document.querySelector(`[data-vivo="${chave}"]`);
    if (novoCampo){ novoCampo.focus(); try { novoCampo.setSelectionRange(pos, pos); } catch(e){} }
  }, 220);
});

/* -------------------------------------------------------------- TECLADO -- */
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') return fecharModal();
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'campoBip'){ ev.preventDefault(); lerCampo(); }
  else if (ev.target.closest('#login')){ ev.preventDefault(); enviarLogin(); }
});

/* Falha de carregamento antes de a tela existir: avisa em vez de ficar mudo. */
window.addEventListener('error', e => {
  const area = el('areaLogin');
  if (area && el('login').style.display !== 'none' && !el('btnLogin')){
    area.innerHTML = `<div class="erro-login">Erro ao carregar: ${esc(e.message)}</div>`;
  }
});
