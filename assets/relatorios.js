/* ============================================================================
   RELATÓRIOS — por setor, por demanda, por solicitante e por item.
   Tudo o que aparece aqui respeita o filtro do topo e sai em CSV ou impressão.
   ========================================================================== */
'use strict';

async function carregarItens(){
  if (S.itensTodos) return;
  const { data } = await sb.from('fp_itens').select('*').limit(3000);
  S.itensTodos = data || [];
}

function periodoRelatorio(){
  if (!F.rDe && !F.rAte){
    const d = new Date(); d.setDate(d.getDate() - 90);
    return { de: d.toLocaleDateString('sv-SE'), ate: hoje(), padrao: true };
  }
  return { de: F.rDe || '2000-01-01', ate: F.rAte || hoje(), padrao: false };
}

function baseRelatorio(){
  const { de, ate } = periodoRelatorio();
  return S.demandas.filter(d => {
    if (!podeVer(d.setor_id)) return false;
    const dia = diaDe(d.criada_em);
    if (dia < de || dia > ate) return false;
    if (F.rSetor && d.setor_id !== F.rSetor) return false;
    if (F.rSolic && d.solicitante_id !== F.rSolic) return false;
    return true;
  });
}

function vRelatorios(){
  if (!S.itensTodos){
    carregarItens().then(render);
    return `<div class="carregando">Reunindo os números…</div>`;
  }
  const lista = baseRelatorio();
  const { de, ate, padrao } = periodoRelatorio();
  const ids = new Set(lista.map(d => d.id));
  const itens = (S.itensTodos || []).filter(i => ids.has(i.demanda_id));

  const concluidas = lista.filter(d => d.status === 'concluida');
  const tempoMedio = concluidas.length
    ? Math.round(concluidas.reduce((a, d) => a + diasEntre(d.criada_em, d.concluida_em), 0) / concluidas.length)
    : 0;

  /* agrupamentos */
  const porSetor = agrupar(lista, d => d.setor_id);
  const porSolic = agrupar(lista, d => d.solicitante_id);
  const porTipo = agrupar(lista, d => d.tipo_id);
  const porItem = {};
  for (const i of itens){
    const chave = semAcento(i.descricao);
    porItem[chave] = porItem[chave] || { nome: i.descricao, qtd: 0, valor: 0, vezes: 0 };
    porItem[chave].qtd += n(i.quantidade);
    porItem[chave].valor += n(i.quantidade) * n(i.valor_unit);
    porItem[chave].vezes++;
  }
  const itensOrdenados = Object.values(porItem).sort((a, b) => b.valor - a.valor || b.qtd - a.qtd);

  return `
  <div class="titulo-tela"><div><h2>Relatórios</h2>
    <p>${lista.length} demanda(s) entre ${dataBR(de)} e ${dataBR(ate)}${padrao ? ' (últimos 90 dias)' : ''}</p></div>
    <div class="acoes">
      <button class="btn sec" data-acao="exportar-relatorio">Exportar CSV</button>
      <button class="btn" data-acao="imprimir-relatorio">Imprimir</button>
    </div></div>

  <div class="bloco">
    <div class="filtros">
      <label class="campo"><span>Setor</span><select data-filtro="rSetor"><option value="">Todos</option>
        ${setoresVisiveis().map(s => `<option value="${s.id}" ${F.rSetor === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></label>
      <label class="campo"><span>De</span><input type="date" data-filtro="rDe" value="${F.rDe}"></label>
      <label class="campo"><span>Até</span><input type="date" data-filtro="rAte" value="${F.rAte}"></label>
      <label class="campo"><span>Solicitante</span><select data-filtro="rSolic"><option value="">Todos</option>
        ${S.perfis.map(p => `<option value="${p.id}" ${F.rSolic === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="rot">Demandas no período</div><div class="val">${lista.length}</div>
      <div class="sub">${lista.filter(d => ABERTAS.includes(d.status)).length} ainda em aberto</div></div>
    <div class="kpi bom"><div class="rot">Concluídas</div><div class="val">${concluidas.length}</div>
      <div class="sub">${lista.length ? Math.round(concluidas.length / lista.length * 100) : 0}% do total</div></div>
    <div class="kpi ${tempoMedio > 15 ? 'aviso' : ''}"><div class="rot">Tempo médio</div><div class="val">${tempoMedio}<span style="font-size:15px"> dias</span></div>
      <div class="sub">da abertura à conclusão</div></div>
    <div class="kpi"><div class="rot">Valor movimentado</div><div class="val" style="font-size:23px">${dinheiro(lista.reduce((a, d) => a + n(d.valor), 0))}</div>
      <div class="sub">soma das demandas</div></div>
  </div>

  <div class="grade g2">
    <div class="bloco">
      <h3>Por setor</h3>
      <div class="rolagem"><table class="tabela">
        <thead><tr><th>Setor</th><th class="dir">Demandas</th><th class="dir">Em aberto</th><th class="dir">Reprovadas</th><th class="dir">Valor</th></tr></thead>
        <tbody>${Object.entries(porSetor).map(([sid, ds]) => `<tr>
          <td>${selo(sid)}</td>
          <td class="dir num">${ds.length}</td>
          <td class="dir num">${ds.filter(d => ABERTAS.includes(d.status)).length}</td>
          <td class="dir num">${ds.filter(d => d.status === 'reprovada').length}</td>
          <td class="dir num">${dinheiro(ds.reduce((a, d) => a + n(d.valor), 0))}</td></tr>`).join('')
          || '<tr><td colspan="5" class="vazio">Sem dados no período.</td></tr>'}</tbody></table></div>
    </div>

    <div class="bloco">
      <h3>Por solicitante</h3>
      <div class="rolagem"><table class="tabela">
        <thead><tr><th>Pessoa</th><th class="dir">Demandas</th><th class="dir">Concluídas</th><th class="dir">Valor</th></tr></thead>
        <tbody>${Object.entries(porSolic).sort((a, b) => b[1].length - a[1].length).slice(0, 15).map(([pid, ds]) => `<tr>
          <td>${esc(nomeDe(pid))}</td>
          <td class="dir num">${ds.length}</td>
          <td class="dir num">${ds.filter(d => d.status === 'concluida').length}</td>
          <td class="dir num">${dinheiro(ds.reduce((a, d) => a + n(d.valor), 0))}</td></tr>`).join('')
          || '<tr><td colspan="4" class="vazio">Sem dados no período.</td></tr>'}</tbody></table></div>
    </div>
  </div>

  <div class="bloco">
    <h3>Por tipo de demanda</h3>
    <div class="rolagem"><table class="tabela">
      <thead><tr><th>Tipo</th><th>Setor</th><th class="dir">Qtd</th><th class="dir">Tempo médio</th><th class="dir">Valor</th></tr></thead>
      <tbody>${Object.entries(porTipo).sort((a, b) => b[1].length - a[1].length).map(([tid, ds]) => {
        const fim = ds.filter(d => d.concluida_em);
        const media = fim.length ? Math.round(fim.reduce((a, d) => a + diasEntre(d.criada_em, d.concluida_em), 0) / fim.length) : '—';
        return `<tr><td>${esc(tipo(tid)?.nome || 'Sem tipo')}</td>
          <td>${selo(ds[0].setor_id)}</td>
          <td class="dir num">${ds.length}</td>
          <td class="dir num">${media === '—' ? '—' : media + ' d'}</td>
          <td class="dir num">${dinheiro(ds.reduce((a, d) => a + n(d.valor), 0))}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="vazio">Sem dados no período.</td></tr>'}</tbody></table></div>
  </div>

  <div class="bloco">
    <h3>Por item solicitado<span class="conta">${itensOrdenados.length} item(ns) distintos</span></h3>
    <div class="rolagem"><table class="tabela">
      <thead><tr><th>Item</th><th class="dir">Vezes pedido</th><th class="dir">Quantidade total</th><th class="dir">Valor total</th></tr></thead>
      <tbody>${itensOrdenados.slice(0, 40).map(i => `<tr>
        <td>${esc(i.nome)}</td><td class="dir num">${i.vezes}</td>
        <td class="dir num">${num(i.qtd)}</td><td class="dir num">${dinheiro(i.valor)}</td></tr>`).join('')
        || '<tr><td colspan="4" class="vazio">Nenhuma demanda com itens no período.</td></tr>'}</tbody></table></div>
  </div>

  <div class="bloco">
    <h3>Demandas do período<span class="conta">${lista.length}</span></h3>
    <div class="rolagem"><table class="tabela">
      <thead><tr><th>Protocolo</th><th>Assunto</th><th>Setor</th><th>Solicitante</th><th>Situação</th><th>Onde está</th><th class="dir">Valor</th></tr></thead>
      <tbody>${lista.slice(0, 200).map(d => `<tr>
        <td class="mono">${esc(d.protocolo)}</td>
        <td>${esc(d.titulo)}</td>
        <td>${esc(setor(d.setor_id)?.nome || '')}</td>
        <td>${esc(nomeDe(d.solicitante_id))}</td>
        <td>${tagStatus(d)}</td>
        <td>${esc(posicaoDe(d))}</td>
        <td class="dir num">${dinheiro(d.valor)}</td></tr>`).join('')
        || '<tr><td colspan="7" class="vazio">Sem demandas no período.</td></tr>'}</tbody></table></div>
  </div>`;
}

function agrupar(lista, chave){
  const r = {};
  for (const x of lista){ const k = chave(x) || 'sem'; (r[k] = r[k] || []).push(x); }
  return r;
}

/* ------------------------------------------------------------ EXPORTAR --- */
function exportarDemandas(){
  const lista = filtrarDemandas();
  const linhas = [csvLinha(['Protocolo','Setor','Tipo','Assunto','Solicitante','Responsavel','Situacao','Onde esta','Prioridade','Aberta em','Prazo','Concluida em','Valor'])];
  for (const d of lista) linhas.push(csvLinha([
    d.protocolo, setor(d.setor_id)?.nome, tipo(d.tipo_id)?.nome, d.titulo,
    nomeDe(d.solicitante_id), d.responsavel_id ? nomeDe(d.responsavel_id) : '',
    ROTULO_STATUS[d.status], posicaoDe(d), ROTULO_PRIOR[d.prioridade],
    dataBR(d.criada_em), dataBR(d.prazo), d.concluida_em ? dataBR(d.concluida_em) : '',
    n(d.valor).toFixed(2).replace('.', ',')
  ]));
  baixarArquivo(`demandas_${hoje()}.csv`, linhas.join('\n'));
  aviso('Arquivo gerado.', 'bom');
}

function exportarRelatorio(){
  const lista = baseRelatorio();
  const ids = new Set(lista.map(d => d.id));
  const itens = (S.itensTodos || []).filter(i => ids.has(i.demanda_id));
  const partes = [];

  partes.push('RESUMO POR SETOR');
  partes.push(csvLinha(['Setor','Demandas','Em aberto','Concluidas','Reprovadas','Valor']));
  for (const [sid, ds] of Object.entries(agrupar(lista, d => d.setor_id)))
    partes.push(csvLinha([setor(sid)?.nome, ds.length, ds.filter(d => ABERTAS.includes(d.status)).length,
      ds.filter(d => d.status === 'concluida').length, ds.filter(d => d.status === 'reprovada').length,
      ds.reduce((a, d) => a + n(d.valor), 0).toFixed(2).replace('.', ',')]));

  partes.push('', 'RESUMO POR SOLICITANTE');
  partes.push(csvLinha(['Solicitante','Demandas','Concluidas','Valor']));
  for (const [pid, ds] of Object.entries(agrupar(lista, d => d.solicitante_id)))
    partes.push(csvLinha([nomeDe(pid), ds.length, ds.filter(d => d.status === 'concluida').length,
      ds.reduce((a, d) => a + n(d.valor), 0).toFixed(2).replace('.', ',')]));

  partes.push('', 'ITENS SOLICITADOS');
  partes.push(csvLinha(['Item','Demanda','Setor','Quantidade','Unidade','Valor unitario','Total']));
  for (const i of itens){
    const d = lista.find(x => x.id === i.demanda_id);
    partes.push(csvLinha([i.descricao, d?.protocolo, setor(d?.setor_id)?.nome, num(i.quantidade), i.unidade,
      n(i.valor_unit).toFixed(2).replace('.', ','), (n(i.quantidade) * n(i.valor_unit)).toFixed(2).replace('.', ',')]));
  }

  partes.push('', 'DEMANDAS');
  partes.push(csvLinha(['Protocolo','Assunto','Setor','Solicitante','Situacao','Onde esta','Aberta em','Concluida em','Dias','Valor']));
  for (const d of lista)
    partes.push(csvLinha([d.protocolo, d.titulo, setor(d.setor_id)?.nome, nomeDe(d.solicitante_id),
      ROTULO_STATUS[d.status], posicaoDe(d), dataBR(d.criada_em),
      d.concluida_em ? dataBR(d.concluida_em) : '',
      d.concluida_em ? diasEntre(d.criada_em, d.concluida_em) : '',
      n(d.valor).toFixed(2).replace('.', ',')]));

  baixarArquivo(`relatorio_fecomercio_${hoje()}.csv`, partes.join('\n'));
  aviso('Relatório exportado.', 'bom');
}

function exportarBens(){
  const linhas = [csvLinha(['Tombo','Descricao','Categoria','Marca','Modelo','Serie','Setor','Local','Responsavel','Situacao','Valor','Aquisicao','Nota fiscal'])];
  for (const b of filtrarBens()) linhas.push(csvLinha([b.tombo, b.descricao, b.categoria, b.marca, b.modelo, b.serie,
    setor(b.setor_id)?.nome, b.local, b.responsavel_id ? nomeDe(b.responsavel_id) : '',
    ROTULO_SITUACAO[b.situacao], n(b.valor).toFixed(2).replace('.', ','), b.aquisicao, b.nota_fiscal]));
  baixarArquivo(`patrimonio_${hoje()}.csv`, linhas.join('\n'));
  aviso('Inventário exportado.', 'bom');
}

function exportarEstoque(){
  const linhas = [csvLinha(['Codigo','Item','Categoria','Unidade','Saldo','Minimo','Maximo','Preco','Local','Valor em estoque'])];
  for (const p of filtrarProdutos()) linhas.push(csvLinha([p.codigo, p.nome, p.categoria, p.unidade,
    num(p.estoque), num(p.minimo), num(p.maximo), p.preco.toFixed(2).replace('.', ','), p.local,
    (p.estoque * p.preco).toFixed(2).replace('.', ',')]));
  baixarArquivo(`estoque_${hoje()}.csv`, linhas.join('\n'));
  aviso('Estoque exportado.', 'bom');
}

function imprimirRelatorio(){
  const lista = baseRelatorio();
  const { de, ate } = periodoRelatorio();
  const porSetor = agrupar(lista, d => d.setor_id);
  const concluidas = lista.filter(d => d.status === 'concluida');

  imprimir(`${cabDoc('Relatório de demandas', `Período de ${dataBR(de)} a ${dataBR(ate)}${F.rSetor ? ' · ' + setor(F.rSetor)?.nome : ''}`)}
    <p style="font-size:11px"><b>${lista.length}</b> demandas · <b>${concluidas.length}</b> concluídas ·
      <b>${lista.filter(d => ABERTAS.includes(d.status)).length}</b> em aberto ·
      valor total <b>${dinheiro(lista.reduce((a, d) => a + n(d.valor), 0))}</b></p>

    <h3 style="font-size:12px;margin:14px 0 6px">Por setor</h3>
    <table><thead><tr><th>Setor</th><th>Demandas</th><th>Em aberto</th><th>Concluídas</th><th>Valor</th></tr></thead>
    <tbody>${Object.entries(porSetor).map(([sid, ds]) => `<tr><td>${esc(setor(sid)?.nome || '')}</td>
      <td>${ds.length}</td><td>${ds.filter(d => ABERTAS.includes(d.status)).length}</td>
      <td>${ds.filter(d => d.status === 'concluida').length}</td>
      <td>${dinheiro(ds.reduce((a, d) => a + n(d.valor), 0))}</td></tr>`).join('')}</tbody></table>

    <h3 style="font-size:12px;margin:14px 0 6px">Demandas</h3>
    <table><thead><tr><th>Protocolo</th><th>Assunto</th><th>Setor</th><th>Solicitante</th><th>Situação</th><th>Onde está</th><th>Valor</th></tr></thead>
    <tbody>${lista.map(d => `<tr><td>${esc(d.protocolo)}</td><td>${esc(d.titulo)}</td>
      <td>${esc(setor(d.setor_id)?.nome || '')}</td><td>${esc(nomeDe(d.solicitante_id))}</td>
      <td>${ROTULO_STATUS[d.status]}</td><td>${esc(posicaoDe(d))}</td>
      <td>${dinheiro(d.valor)}</td></tr>`).join('')}</tbody></table>

    <p style="font-size:10px;margin-top:24px">Emitido por ${esc(perfil.nome)} em ${dataHoraBR(new Date().toISOString())}.</p>`);
}
