/* ============================================================================
   RELATÓRIOS — três bases, filtros que se alimentam dos próprios dados.

   Demandas   : quem pede, o que pede, quanto demora, quanto custa.
   Estoque    : o que sai, para onde vai, quem retira, quanto consome.
   Patrimônio : onde está cada bem, em que situação, e o que se moveu.

   As listas de filtro são montadas a partir do que existe de fato no período,
   e não de uma lista fixa: se ninguém do RH retirou material no mês, o RH não
   aparece como opção de destino.
   ========================================================================== */
'use strict';

let relAba = 'demandas';

/* Chaves de filtro novas, sem precisar mexer no núcleo. */
Object.assign(F, Object.fromEntries(Object.entries({
  mTipo:'', mCat:'', mDestino:'', mAutor:'', mBusca:'', mSoBaixo:false,
  gSetor:'', gSituacao:'', gLocal:'', gCat:'', gBusca:''
}).filter(([k]) => F[k] === undefined)));

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

function agrupar(lista, chave){
  const r = {};
  for (const x of lista){ const k = chave(x) ?? 'sem'; (r[k] = r[k] || []).push(x); }
  return r;
}
const soma = (lista, f) => lista.reduce((a, x) => a + n(f(x)), 0);
const ordenaPor = (obj, f) => Object.entries(obj).sort((a, b) => f(b[1]) - f(a[1]));
const pct = (parte, todo) => todo ? Math.round(parte / todo * 100) : 0;
const linhaVazia = cols => `<tr><td colspan="${cols}" class="vazio">Nada no período e nos filtros escolhidos.</td></tr>`;

/* Barra proporcional: dá a leitura relativa antes de o olho chegar no número. */
function barra(valor, maximo, cor){
  const l = maximo ? Math.max(2, Math.round(valor / maximo * 100)) : 0;
  return `<div style="height:5px;background:var(--nevoa);border-radius:3px;margin-top:5px;overflow:hidden">
    <div style="height:100%;width:${l}%;background:${cor || 'var(--azul)'}"></div></div>`;
}

function opcoes(lista, atual){
  return [...new Set(lista.filter(Boolean))].sort().map(v =>
    `<option value="${esc(v)}" ${atual === v ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

/* ======================================================================== */
/* CASCA                                                                     */
/* ======================================================================== */
function vRelatorios(){
  if (!S.itensTodos){ carregarItens().then(render); return `<div class="carregando">Reunindo os números…</div>`; }
  const { de, ate, padrao } = periodoRelatorio();
  const abas = [['demandas','Demandas'],['estoque','Estoque'],['patrimonio','Patrimônio']];

  return `
  <div class="titulo-tela">
    <div><h2>Relatórios</h2>
      <p>${dataBR(de)} a ${dataBR(ate)}${padrao ? ' · últimos 90 dias' : ''}</p></div>
    <div class="acoes">
      <button class="btn sec" data-rel="csv">Exportar CSV</button>
      <button class="btn" data-rel="imprimir">Imprimir</button>
    </div>
  </div>

  <div class="bloco" style="padding:0">
    <div style="display:flex;gap:4px;padding:0 12px;border-bottom:1px solid var(--linha);overflow-x:auto">
      ${abas.map(([k, r]) => `<button class="aba" data-rel="aba" data-k="${k}" aria-current="${relAba === k}">${r}</button>`).join('')}
    </div>
    <div class="filtros">
      <label class="campo"><span>De</span><input type="date" data-filtro="rDe" value="${F.rDe}"></label>
      <label class="campo"><span>Até</span><input type="date" data-filtro="rAte" value="${F.rAte}"></label>
      ${relAba === 'demandas' ? filtrosDemandas() : relAba === 'estoque' ? filtrosEstoque() : filtrosPatrimonio()}
    </div>
  </div>

  ${relAba === 'demandas' ? relDemandas() : relAba === 'estoque' ? relEstoque() : relPatrimonio()}`;
}

/* ======================================================================== */
/* 1 · DEMANDAS                                                              */
/* ======================================================================== */
function filtrosDemandas(){
  return `
    <label class="campo"><span>Setor</span><select data-filtro="rSetor"><option value="">Todos</option>
      ${setoresVisiveis().map(s => `<option value="${s.id}" ${F.rSetor === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}
    </select></label>
    <label class="campo"><span>Solicitante</span><select data-filtro="rSolic"><option value="">Todos</option>
      ${S.perfis.map(p => `<option value="${p.id}" ${F.rSolic === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
    </select></label>`;
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

function relDemandas(){
  const lista = baseRelatorio();
  const ids = new Set(lista.map(d => d.id));
  const itens = (S.itensTodos || []).filter(i => ids.has(i.demanda_id));
  const concluidas = lista.filter(d => d.status === 'concluida');
  const media = concluidas.length
    ? Math.round(soma(concluidas, d => diasEntre(d.criada_em, d.concluida_em)) / concluidas.length) : 0;

  const porSetor = agrupar(lista, d => d.setor_id);
  const porSolic = agrupar(lista, d => d.solicitante_id);
  const porTipo = agrupar(lista, d => d.tipo_id);

  const porItem = {};
  for (const i of itens){
    const k = semAcento(i.descricao);
    porItem[k] = porItem[k] || { nome: i.descricao, qtd: 0, valor: 0, vezes: 0 };
    porItem[k].qtd += n(i.quantidade);
    porItem[k].valor += n(i.quantidade) * n(i.valor_unit);
    porItem[k].vezes++;
  }
  const itensOrd = Object.values(porItem).sort((a, b) => b.valor - a.valor || b.qtd - a.qtd);
  const maxSetor = Math.max(1, ...Object.values(porSetor).map(x => x.length));

  return `
  <div class="kpis">
    <div class="kpi"><div class="rot">Demandas</div><div class="val">${lista.length}</div>
      <div class="sub">${lista.filter(d => ABERTAS.includes(d.status)).length} em aberto</div></div>
    <div class="kpi bom"><div class="rot">Concluídas</div><div class="val">${concluidas.length}</div>
      <div class="sub">${pct(concluidas.length, lista.length)}% do total</div></div>
    <div class="kpi ${media > 15 ? 'aviso' : ''}"><div class="rot">Tempo médio</div><div class="val">${media}<span style="font-size:15px"> d</span></div>
      <div class="sub">abertura → conclusão</div></div>
    <div class="kpi"><div class="rot">Valor</div><div class="val" style="font-size:22px">${dinheiro(soma(lista, d => d.valor))}</div>
      <div class="sub">soma das demandas</div></div>
  </div>

  <div class="grade g2">
    <div class="bloco"><h3>Por setor</h3>
      <table class="tabela">
        <thead><tr><th>Setor</th><th class="dir">Demandas</th><th class="dir">Em aberto</th><th class="dir">Reprovadas</th><th class="dir">Valor</th></tr></thead>
        <tbody>${ordenaPor(porSetor, v => v.length).map(([sid, ds]) => `<tr>
          <td>${selo(sid)}${barra(ds.length, maxSetor, setor(sid)?.cor)}</td>
          <td class="dir num">${ds.length}</td>
          <td class="dir num">${ds.filter(d => ABERTAS.includes(d.status)).length}</td>
          <td class="dir num">${ds.filter(d => d.status === 'reprovada').length}</td>
          <td class="dir num">${dinheiro(soma(ds, d => d.valor))}</td></tr>`).join('') || linhaVazia(5)}</tbody></table>
    </div>

    <div class="bloco"><h3>Por solicitante</h3>
      <table class="tabela">
        <thead><tr><th>Pessoa</th><th class="dir">Demandas</th><th class="dir">Concluídas</th><th class="dir">Valor</th></tr></thead>
        <tbody>${ordenaPor(porSolic, v => v.length).slice(0, 15).map(([pid, ds]) => `<tr>
          <td>${esc(nomeDe(pid))}</td><td class="dir num">${ds.length}</td>
          <td class="dir num">${ds.filter(d => d.status === 'concluida').length}</td>
          <td class="dir num">${dinheiro(soma(ds, d => d.valor))}</td></tr>`).join('') || linhaVazia(4)}</tbody></table>
    </div>
  </div>

  <div class="bloco"><h3>Por tipo de demanda</h3>
    <table class="tabela">
      <thead><tr><th>Tipo</th><th>Setor</th><th class="dir">Qtd</th><th class="dir">Tempo médio</th><th class="dir">Valor</th></tr></thead>
      <tbody>${ordenaPor(porTipo, v => v.length).map(([tid, ds]) => {
        const fim = ds.filter(d => d.concluida_em);
        const m = fim.length ? Math.round(soma(fim, d => diasEntre(d.criada_em, d.concluida_em)) / fim.length) + ' d' : '—';
        return `<tr><td>${esc(tipo(tid)?.nome || 'Sem tipo')}</td><td>${selo(ds[0].setor_id)}</td>
          <td class="dir num">${ds.length}</td><td class="dir num">${m}</td>
          <td class="dir num">${dinheiro(soma(ds, d => d.valor))}</td></tr>`;
      }).join('') || linhaVazia(5)}</tbody></table>
  </div>

  <div class="bloco"><h3>Por item solicitado<span class="conta">${itensOrd.length} distintos</span></h3>
    <table class="tabela">
      <thead><tr><th>Item</th><th class="dir">Vezes pedido</th><th class="dir">Quantidade</th><th class="dir">Valor</th></tr></thead>
      <tbody>${itensOrd.slice(0, 40).map(i => `<tr>
        <td>${esc(i.nome)}</td><td class="dir num">${i.vezes}</td>
        <td class="dir num">${num(i.qtd)}</td><td class="dir num">${dinheiro(i.valor)}</td></tr>`).join('') || linhaVazia(4)}</tbody></table>
  </div>

  <div class="bloco"><h3>Demandas do período<span class="conta">${lista.length}</span></h3>
    <table class="tabela">
      <thead><tr><th>Protocolo</th><th>Assunto</th><th>Setor</th><th>Solicitante</th><th>Situação</th><th>Onde está</th><th class="dir">Valor</th></tr></thead>
      <tbody>${lista.slice(0, 150).map(d => `<tr>
        <td class="mono">${esc(d.protocolo)}</td><td>${esc(d.titulo)}</td>
        <td>${esc(setor(d.setor_id)?.nome || '')}</td><td>${esc(nomeDe(d.solicitante_id))}</td>
        <td>${tagStatus(d)}</td><td>${esc(posicaoDe(d))}</td>
        <td class="dir num">${dinheiro(d.valor)}</td></tr>`).join('') || linhaVazia(7)}</tbody></table>
  </div>`;
}

/* ======================================================================== */
/* 2 · ESTOQUE                                                               */
/* ======================================================================== */
const produtoDe = m => S.produtos.find(p => p.id === m.produto_id);
const valorMov = m => n(m.qtd) * n(m.preco || produtoDe(m)?.preco || 0);

function filtrosEstoque(){
  const { de, ate } = periodoRelatorio();
  const noPeriodo = S.movimentos.filter(m => diaDe(m.data) >= de && diaDe(m.data) <= ate);
  return `
    <label class="campo"><span>Movimento</span><select data-filtro="mTipo">
      <option value="">Todos</option>
      <option value="saida" ${F.mTipo === 'saida' ? 'selected' : ''}>Só saídas</option>
      <option value="entrada" ${F.mTipo === 'entrada' ? 'selected' : ''}>Só entradas</option>
      <option value="ajuste" ${F.mTipo === 'ajuste' ? 'selected' : ''}>Só ajustes</option>
    </select></label>
    <label class="campo"><span>Categoria</span><select data-filtro="mCat">
      <option value="">Todas</option>${opcoes(noPeriodo.map(m => produtoDe(m)?.categoria), F.mCat)}</select></label>
    <label class="campo"><span>Destino</span><select data-filtro="mDestino">
      <option value="">Todos</option>${opcoes(noPeriodo.map(m => m.destino), F.mDestino)}</select></label>
    <label class="campo"><span>Registrado por</span><select data-filtro="mAutor">
      <option value="">Todos</option>${opcoes(noPeriodo.map(m => m.autor_nome), F.mAutor)}</select></label>
    <label class="campo linha-toda"><span>Buscar item ou pessoa</span>
      <input type="search" data-vivo="mBusca" value="${esc(F.mBusca)}" placeholder="Código, material, quem retirou…"></label>
    <div class="linha-toda"><label class="marcador">
      <input type="checkbox" data-filtro="mSoBaixo" ${F.mSoBaixo ? 'checked' : ''}> Só itens hoje abaixo do mínimo</label></div>`;
}

function movimentosFiltrados(){
  const { de, ate } = periodoRelatorio();
  return S.movimentos.filter(m => {
    const dia = diaDe(m.data);
    if (dia < de || dia > ate) return false;
    if (F.mTipo && m.tipo !== F.mTipo) return false;
    const p = produtoDe(m);
    if (F.mCat && p?.categoria !== F.mCat) return false;
    if (F.mDestino && m.destino !== F.mDestino) return false;
    if (F.mAutor && m.autor_nome !== F.mAutor) return false;
    if (F.mSoBaixo && !(p && p.estoque <= p.minimo)) return false;
    if (F.mBusca && !contem([p?.codigo, p?.nome, p?.categoria, m.destino, m.solicitante, m.documento, m.autor_nome].join(' '), F.mBusca)) return false;
    return true;
  });
}

function relEstoque(){
  const movs = movimentosFiltrados();
  const saidas = movs.filter(m => m.tipo === 'saida');
  const entradas = movs.filter(m => m.tipo === 'entrada');
  const valorSaida = soma(saidas, valorMov);

  const porItem = agrupar(movs, m => m.produto_id);
  const porDestino = agrupar(saidas, m => m.destino || 'Sem destino informado');
  const porCategoria = agrupar(saidas, m => produtoDe(m)?.categoria || 'Sem categoria');
  const porQuem = agrupar(saidas, m => m.solicitante || 'Não informado');
  const porMes = agrupar(movs, m => diaDe(m.data).slice(0, 7));
  const porAutor = agrupar(movs, m => m.autor_nome || 'Sistema');

  const maxDestino = Math.max(1, ...Object.values(porDestino).map(v => soma(v, valorMov)));
  const maxMes = Math.max(1, ...Object.values(porMes).map(v => soma(v.filter(m => m.tipo === 'saida'), valorMov)));

  /* Curva ABC: quais poucos itens concentram o gasto. */
  const abc = ordenaPor(porItem, v => soma(v.filter(m => m.tipo === 'saida'), valorMov))
    .map(([pid, ms]) => ({ p: S.produtos.find(x => x.id === pid), valor: soma(ms.filter(m => m.tipo === 'saida'), valorMov) }))
    .filter(x => x.valor > 0);
  let acum = 0;
  for (const x of abc){ acum += x.valor; x.acum = pct(acum, valorSaida); x.classe = x.acum <= 80 ? 'A' : x.acum <= 95 ? 'B' : 'C'; }

  const cats = [...new Set(saidas.map(m => produtoDe(m)?.categoria || 'Sem categoria'))].sort();
  const dests = Object.keys(porDestino).sort();

  return `
  <div class="kpis">
    <div class="kpi"><div class="rot">Movimentações</div><div class="val">${movs.length}</div>
      <div class="sub">${saidas.length} saídas · ${entradas.length} entradas</div></div>
    <div class="kpi aviso"><div class="rot">Consumo no período</div><div class="val" style="font-size:22px">${dinheiro(valorSaida)}</div>
      <div class="sub">${num(soma(saidas, m => m.qtd))} unidades</div></div>
    <div class="kpi bom"><div class="rot">Reposição</div><div class="val" style="font-size:22px">${dinheiro(soma(entradas, valorMov))}</div>
      <div class="sub">${num(soma(entradas, m => m.qtd))} unidades recebidas</div></div>
    <div class="kpi ${S.produtos.filter(p => p.estoque <= p.minimo).length ? 'grave' : ''}">
      <div class="rot">Itens movimentados</div><div class="val">${Object.keys(porItem).length}</div>
      <div class="sub">${S.produtos.filter(p => p.estoque <= p.minimo).length} abaixo do mínimo hoje</div></div>
  </div>

  <div class="grade g2">
    <div class="bloco"><h3>Quem mais consome<span class="conta">por destino</span></h3>
      <table class="tabela">
        <thead><tr><th>Destino</th><th class="dir">Retiradas</th><th class="dir">Itens</th><th class="dir">Valor</th><th class="dir">% do total</th></tr></thead>
        <tbody>${ordenaPor(porDestino, v => soma(v, valorMov)).map(([dest, ms]) => `<tr>
          <td>${esc(dest)}${barra(soma(ms, valorMov), maxDestino, 'var(--ouro)')}</td>
          <td class="dir num">${ms.length}</td>
          <td class="dir num">${new Set(ms.map(m => m.produto_id)).size}</td>
          <td class="dir num">${dinheiro(soma(ms, valorMov))}</td>
          <td class="dir num">${pct(soma(ms, valorMov), valorSaida)}%</td></tr>`).join('') || linhaVazia(5)}</tbody></table>
    </div>

    <div class="bloco"><h3>Por categoria de material</h3>
      <table class="tabela">
        <thead><tr><th>Categoria</th><th class="dir">Saídas</th><th class="dir">Quantidade</th><th class="dir">Valor</th></tr></thead>
        <tbody>${ordenaPor(porCategoria, v => soma(v, valorMov)).map(([cat, ms]) => `<tr>
          <td>${esc(cat)}</td><td class="dir num">${ms.length}</td>
          <td class="dir num">${num(soma(ms, m => m.qtd))}</td>
          <td class="dir num">${dinheiro(soma(ms, valorMov))}</td></tr>`).join('') || linhaVazia(4)}</tbody></table>
    </div>
  </div>

  <div class="bloco">
    <h3>Consumo por destino e categoria<span class="conta">cruzamento</span></h3>
    <div class="matriz"><table class="tabela">
      <thead><tr><th>Destino</th>${cats.map(c => `<th class="dir">${esc(c)}</th>`).join('')}<th class="dir">Total</th></tr></thead>
      <tbody>${dests.map(d => {
        const linha = saidas.filter(m => (m.destino || 'Sem destino informado') === d);
        return `<tr><td>${esc(d)}</td>
          ${cats.map(c => {
            const v = soma(linha.filter(m => (produtoDe(m)?.categoria || 'Sem categoria') === c), valorMov);
            return `<td class="dir num" style="${v ? '' : 'color:var(--linha-forte)'}">${v ? dinheiro(v) : '—'}</td>`;
          }).join('')}
          <td class="dir num"><b>${dinheiro(soma(linha, valorMov))}</b></td></tr>`;
      }).join('') || linhaVazia(cats.length + 2)}
      ${dests.length ? `<tr><td><b>Total</b></td>
        ${cats.map(c => `<td class="dir num"><b>${dinheiro(soma(saidas.filter(m => (produtoDe(m)?.categoria || 'Sem categoria') === c), valorMov))}</b></td>`).join('')}
        <td class="dir num"><b>${dinheiro(valorSaida)}</b></td></tr>` : ''}
      </tbody></table></div>
  </div>

  <div class="grade g2">
    <div class="bloco"><h3>Curva ABC<span class="conta">onde o dinheiro está</span></h3>
      <p class="legenda" style="padding:14px 18px 0;margin:0">Classe A concentra os primeiros 80% do valor consumido — são os itens que merecem contrato, cotação e conferência apertada.</p>
      <table class="tabela">
        <thead><tr><th>Item</th><th>Classe</th><th class="dir">Valor</th><th class="dir">Acumulado</th></tr></thead>
        <tbody>${abc.slice(0, 25).map(x => `<tr>
          <td>${esc(x.p?.nome || '—')}<div style="font-size:11px;color:var(--mute)" class="mono">${esc(x.p?.codigo || '')}</div></td>
          <td><span class="tag ${x.classe === 'A' ? 'reprovada' : x.classe === 'B' ? 'em_andamento' : 'em_analise'}">Classe ${x.classe}</span></td>
          <td class="dir num">${dinheiro(x.valor)}</td>
          <td class="dir num">${x.acum}%</td></tr>`).join('') || linhaVazia(4)}</tbody></table>
    </div>

    <div class="bloco"><h3>Quem retirou</h3>
      <table class="tabela">
        <thead><tr><th>Pessoa</th><th class="dir">Retiradas</th><th class="dir">Itens distintos</th><th class="dir">Valor</th></tr></thead>
        <tbody>${ordenaPor(porQuem, v => soma(v, valorMov)).slice(0, 20).map(([quem, ms]) => `<tr>
          <td>${esc(quem)}</td><td class="dir num">${ms.length}</td>
          <td class="dir num">${new Set(ms.map(m => m.produto_id)).size}</td>
          <td class="dir num">${dinheiro(soma(ms, valorMov))}</td></tr>`).join('') || linhaVazia(4)}</tbody></table>
    </div>
  </div>

  <div class="grade g2">
    <div class="bloco"><h3>Evolução mês a mês</h3>
      <table class="tabela">
        <thead><tr><th>Mês</th><th class="dir">Saídas</th><th class="dir">Entradas</th><th class="dir">Valor consumido</th></tr></thead>
        <tbody>${Object.entries(porMes).sort().reverse().map(([mes, ms]) => {
          const s = ms.filter(m => m.tipo === 'saida');
          return `<tr><td>${dataBR(mes + '-01').slice(3)}${barra(soma(s, valorMov), maxMes)}</td>
            <td class="dir num">${s.length}</td>
            <td class="dir num">${ms.filter(m => m.tipo === 'entrada').length}</td>
            <td class="dir num">${dinheiro(soma(s, valorMov))}</td></tr>`;
        }).join('') || linhaVazia(4)}</tbody></table>
    </div>

    <div class="bloco"><h3>Por item<span class="conta">saldo x consumo</span></h3>
      <table class="tabela">
        <thead><tr><th>Item</th><th class="dir">Saiu</th><th class="dir">Entrou</th><th class="dir">Saldo hoje</th><th class="dir">Consumido</th></tr></thead>
        <tbody>${ordenaPor(porItem, v => soma(v.filter(m => m.tipo === 'saida'), valorMov)).slice(0, 30).map(([pid, ms]) => {
          const p = S.produtos.find(x => x.id === pid);
          const baixo = p && p.estoque <= p.minimo;
          return `<tr>
            <td>${esc(p?.nome || '—')}<div style="font-size:11px;color:var(--mute)" class="mono">${esc(p?.codigo || '')}</div></td>
            <td class="dir num">${num(soma(ms.filter(m => m.tipo === 'saida'), m => m.qtd))}</td>
            <td class="dir num">${num(soma(ms.filter(m => m.tipo === 'entrada'), m => m.qtd))}</td>
            <td class="dir num ${baixo ? 'baixo' : ''}">${p ? num(p.estoque) + ' ' + esc(p.unidade) : '—'}</td>
            <td class="dir num">${dinheiro(soma(ms.filter(m => m.tipo === 'saida'), valorMov))}</td></tr>`;
        }).join('') || linhaVazia(5)}</tbody></table>
    </div>
  </div>

  <div class="bloco"><h3>Movimentações detalhadas<span class="conta">${movs.length} registro(s)</span></h3>
    <table class="tabela">
      <thead><tr><th>Data</th><th>Item</th><th>Movimento</th><th class="dir">Qtd</th><th class="dir">Saldo depois</th><th>Destino</th><th>Quem retirou</th><th>Registrado por</th></tr></thead>
      <tbody>${movs.slice(0, 200).map(m => {
        const p = produtoDe(m);
        return `<tr>
          <td class="mono">${dataHoraBR(m.data)}</td>
          <td>${esc(p?.nome || '—')}<div style="font-size:11px;color:var(--mute)" class="mono">${esc(p?.codigo || '')}</div></td>
          <td><span class="tag ${m.tipo === 'saida' ? 'em_andamento' : m.tipo === 'entrada' ? 'aprovada' : 'em_analise'}">${
            m.tipo === 'saida' ? 'Saída' : m.tipo === 'entrada' ? 'Entrada' : 'Ajuste'}</span></td>
          <td class="dir num">${num(m.qtd)}</td>
          <td class="dir num">${num(m.saldo_depois)}</td>
          <td>${esc(m.destino || '—')}</td>
          <td>${esc(m.solicitante || '—')}</td>
          <td>${esc(m.autor_nome || '—')}</td></tr>`;
      }).join('') || linhaVazia(8)}</tbody></table>
  </div>

  <div class="bloco"><h3>Quem registra as movimentações</h3>
    <table class="tabela">
      <thead><tr><th>Operador</th><th class="dir">Lançamentos</th><th class="dir">Saídas</th><th class="dir">Entradas</th><th class="dir">Ajustes</th></tr></thead>
      <tbody>${ordenaPor(porAutor, v => v.length).map(([quem, ms]) => `<tr>
        <td>${esc(quem)}</td><td class="dir num">${ms.length}</td>
        <td class="dir num">${ms.filter(m => m.tipo === 'saida').length}</td>
        <td class="dir num">${ms.filter(m => m.tipo === 'entrada').length}</td>
        <td class="dir num">${ms.filter(m => m.tipo === 'ajuste').length}</td></tr>`).join('') || linhaVazia(5)}</tbody></table>
  </div>`;
}

/* ======================================================================== */
/* 3 · PATRIMÔNIO                                                            */
/* ======================================================================== */
function filtrosPatrimonio(){
  return `
    <label class="campo"><span>Setor responsável</span><select data-filtro="gSetor"><option value="">Todos</option>
      ${S.setores.map(s => `<option value="${s.id}" ${F.gSetor === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}
    </select></label>
    <label class="campo"><span>Situação</span><select data-filtro="gSituacao"><option value="">Todas</option>
      ${Object.entries(ROTULO_SITUACAO).map(([k, v]) => `<option value="${k}" ${F.gSituacao === k ? 'selected' : ''}>${v}</option>`).join('')}
    </select></label>
    <label class="campo"><span>Local</span><select data-filtro="gLocal"><option value="">Todos</option>
      ${opcoes(S.bens.map(b => b.local), F.gLocal)}</select></label>
    <label class="campo"><span>Categoria</span><select data-filtro="gCat"><option value="">Todas</option>
      ${opcoes(S.bens.map(b => b.categoria), F.gCat)}</select></label>
    <label class="campo linha-toda"><span>Buscar bem</span>
      <input type="search" data-vivo="gBusca" value="${esc(F.gBusca)}" placeholder="Tombo, descrição, marca, série…"></label>`;
}

function bensFiltrados(){
  return S.bens.filter(b => {
    if (F.gSetor && b.setor_id !== F.gSetor) return false;
    if (F.gSituacao && b.situacao !== F.gSituacao) return false;
    if (F.gLocal && b.local !== F.gLocal) return false;
    if (F.gCat && b.categoria !== F.gCat) return false;
    if (F.gBusca && !contem([b.tombo, b.descricao, b.marca, b.modelo, b.serie, b.local].join(' '), F.gBusca)) return false;
    return true;
  });
}

function relPatrimonio(){
  const bens = bensFiltrados();
  const idsBens = new Set(bens.map(b => b.id));
  const { de, ate } = periodoRelatorio();
  const movs = S.bemMov.filter(m => idsBens.has(m.bem_id) && diaDe(m.data) >= de && diaDe(m.data) <= ate);

  const valorTotal = soma(bens, b => b.valor);
  const emManutencao = bens.filter(b => b.situacao === 'manutencao');
  const semResp = bens.filter(b => !b.responsavel_id);
  const semLocal = bens.filter(b => !b.local);

  const porSetor = agrupar(bens, b => b.setor_id);
  const porSituacao = agrupar(bens, b => b.situacao);
  const porCategoria = agrupar(bens, b => b.categoria || 'Sem categoria');
  const porLocal = agrupar(bens, b => b.local || 'Sem local definido');
  const porAutorMov = agrupar(movs, m => m.autor_nome || 'Sistema');

  const maxSetor = Math.max(1, ...Object.values(porSetor).map(v => soma(v, b => b.valor)));
  const situacoes = Object.keys(ROTULO_SITUACAO);

  const parados = emManutencao.map(b => {
    const ult = S.bemMov.filter(m => m.bem_id === b.id).sort((x, y) => new Date(y.data) - new Date(x.data))[0];
    const base = ult ? ult.data : b.criado_em;
    return { b, desde: diaDe(base), dias: diasEntre(base, new Date().toISOString()) };
  }).sort((x, y) => y.dias - x.dias);

  return `
  <div class="kpis">
    <div class="kpi"><div class="rot">Bens no filtro</div><div class="val">${bens.length}</div>
      <div class="sub">de ${S.bens.length} cadastrados</div></div>
    <div class="kpi"><div class="rot">Valor patrimonial</div><div class="val" style="font-size:22px">${dinheiro(valorTotal)}</div>
      <div class="sub">média de ${dinheiro(bens.length ? valorTotal / bens.length : 0)}</div></div>
    <div class="kpi ${emManutencao.length ? 'aviso' : ''}"><div class="rot">Em manutenção</div><div class="val">${emManutencao.length}</div>
      <div class="sub">${dinheiro(soma(emManutencao, b => b.valor))} parados</div></div>
    <div class="kpi ${semResp.length ? 'grave' : 'bom'}"><div class="rot">Sem responsável</div><div class="val">${semResp.length}</div>
      <div class="sub">${semLocal.length} também sem local</div></div>
  </div>

  <div class="grade g2">
    <div class="bloco"><h3>Por setor responsável</h3>
      <table class="tabela">
        <thead><tr><th>Setor</th><th class="dir">Bens</th><th class="dir">Em uso</th><th class="dir">Manutenção</th><th class="dir">Valor</th></tr></thead>
        <tbody>${ordenaPor(porSetor, v => soma(v, b => b.valor)).map(([sid, bs]) => `<tr>
          <td>${sid === 'sem' ? 'Sem setor' : selo(sid)}${barra(soma(bs, b => b.valor), maxSetor, setor(sid)?.cor)}</td>
          <td class="dir num">${bs.length}</td>
          <td class="dir num">${bs.filter(b => b.situacao === 'em_uso').length}</td>
          <td class="dir num">${bs.filter(b => b.situacao === 'manutencao').length}</td>
          <td class="dir num">${dinheiro(soma(bs, b => b.valor))}</td></tr>`).join('') || linhaVazia(5)}</tbody></table>
    </div>

    <div class="bloco"><h3>Por situação</h3>
      <table class="tabela">
        <thead><tr><th>Situação</th><th class="dir">Bens</th><th class="dir">% do parque</th><th class="dir">Valor</th></tr></thead>
        <tbody>${ordenaPor(porSituacao, v => v.length).map(([sit, bs]) => `<tr>
          <td><span class="tag ${sit === 'baixado' ? 'cancelada' : sit === 'manutencao' ? 'em_andamento' : 'aprovada'}">${ROTULO_SITUACAO[sit] || sit}</span></td>
          <td class="dir num">${bs.length}</td><td class="dir num">${pct(bs.length, bens.length)}%</td>
          <td class="dir num">${dinheiro(soma(bs, b => b.valor))}</td></tr>`).join('') || linhaVazia(4)}</tbody></table>
    </div>
  </div>

  <div class="bloco">
    <h3>Setor por situação<span class="conta">cruzamento</span></h3>
    <div class="matriz"><table class="tabela">
      <thead><tr><th>Setor</th>${situacoes.map(s => `<th class="dir">${ROTULO_SITUACAO[s]}</th>`).join('')}<th class="dir">Total</th></tr></thead>
      <tbody>${Object.entries(porSetor).map(([sid, bs]) => `<tr>
        <td>${sid === 'sem' ? 'Sem setor' : esc(setor(sid)?.nome || '—')}</td>
        ${situacoes.map(s => {
          const q = bs.filter(b => b.situacao === s).length;
          return `<td class="dir num" style="${q ? '' : 'color:var(--linha-forte)'}">${q || '—'}</td>`;
        }).join('')}
        <td class="dir num"><b>${bs.length}</b></td></tr>`).join('') || linhaVazia(situacoes.length + 2)}</tbody></table></div>
  </div>

  <div class="grade g2">
    <div class="bloco"><h3>Por localização</h3>
      <table class="tabela">
        <thead><tr><th>Local</th><th class="dir">Bens</th><th class="dir">Valor</th></tr></thead>
        <tbody>${ordenaPor(porLocal, v => v.length).slice(0, 25).map(([loc, bs]) => `<tr>
          <td>${esc(loc)}</td><td class="dir num">${bs.length}</td>
          <td class="dir num">${dinheiro(soma(bs, b => b.valor))}</td></tr>`).join('') || linhaVazia(3)}</tbody></table>
    </div>

    <div class="bloco"><h3>Por categoria</h3>
      <table class="tabela">
        <thead><tr><th>Categoria</th><th class="dir">Bens</th><th class="dir">Valor total</th><th class="dir">Valor médio</th></tr></thead>
        <tbody>${ordenaPor(porCategoria, v => soma(v, b => b.valor)).map(([cat, bs]) => `<tr>
          <td>${esc(cat)}</td><td class="dir num">${bs.length}</td>
          <td class="dir num">${dinheiro(soma(bs, b => b.valor))}</td>
          <td class="dir num">${dinheiro(soma(bs, b => b.valor) / bs.length)}</td></tr>`).join('') || linhaVazia(4)}</tbody></table>
    </div>
  </div>

  ${parados.length ? `<div class="bloco"><h3>Parados em manutenção<span class="conta">${parados.length}</span></h3>
    <table class="tabela">
      <thead><tr><th>Tombo</th><th>Bem</th><th>Desde</th><th class="dir">Dias parado</th><th class="dir">Valor</th></tr></thead>
      <tbody>${parados.slice(0, 20).map(x => `<tr>
        <td class="mono">${esc(x.b.tombo)}</td><td>${esc(x.b.descricao)}</td>
        <td class="mono">${dataBR(x.desde)}</td>
        <td class="dir num ${x.dias > 30 ? 'baixo' : ''}">${x.dias}</td>
        <td class="dir num">${dinheiro(x.b.valor)}</td></tr>`).join('')}</tbody></table>
  </div>` : ''}

  <div class="bloco"><h3>Movimentações do período<span class="conta">${movs.length}</span></h3>
    <table class="tabela">
      <thead><tr><th>Data</th><th>Bem</th><th>De</th><th>Para</th><th>Situação</th><th>Motivo</th><th>Registrado por</th></tr></thead>
      <tbody>${movs.slice(0, 150).map(m => {
        const b = S.bens.find(x => x.id === m.bem_id);
        return `<tr>
          <td class="mono">${dataHoraBR(m.data)}</td>
          <td>${esc(b?.descricao || '—')}<div style="font-size:11px;color:var(--mute)" class="mono">${esc(b?.tombo || '')}</div></td>
          <td>${esc(m.de_local || '—')}</td>
          <td><b>${esc(m.para_local || '—')}</b></td>
          <td>${m.para_situacao ? `<span class="tag ${m.para_situacao === 'baixado' ? 'cancelada' : 'aprovada'}">${ROTULO_SITUACAO[m.para_situacao]}</span>` : '—'}</td>
          <td>${esc(m.motivo || '—')}</td>
          <td>${esc(m.autor_nome || '—')}</td></tr>`;
      }).join('') || linhaVazia(7)}</tbody></table>
  </div>

  ${Object.keys(porAutorMov).length ? `<div class="bloco"><h3>Quem movimentou</h3>
    <table class="tabela">
      <thead><tr><th>Operador</th><th class="dir">Movimentações</th><th class="dir">Bens distintos</th></tr></thead>
      <tbody>${ordenaPor(porAutorMov, v => v.length).map(([quem, ms]) => `<tr>
        <td>${esc(quem)}</td><td class="dir num">${ms.length}</td>
        <td class="dir num">${new Set(ms.map(m => m.bem_id)).size}</td></tr>`).join('')}</tbody></table>
  </div>` : ''}

  <div class="bloco"><h3>Inventário<span class="conta">${bens.length} bem(ns)</span></h3>
    <table class="tabela">
      <thead><tr><th>Tombo</th><th>Bem</th><th>Setor</th><th>Local</th><th>Responsável</th><th>Situação</th><th class="dir">Valor</th></tr></thead>
      <tbody>${bens.slice(0, 200).map(b => `<tr>
        <td class="mono">${esc(b.tombo)}</td>
        <td>${esc(b.descricao)}<div style="font-size:11px;color:var(--mute)">${esc([b.marca, b.modelo].filter(Boolean).join(' · '))}</div></td>
        <td>${esc(setor(b.setor_id)?.nome || '—')}</td>
        <td>${esc(b.local || '—')}</td>
        <td>${b.responsavel_id ? esc(nomeDe(b.responsavel_id)) : '<span style="color:var(--erro)">sem responsável</span>'}</td>
        <td><span class="tag ${b.situacao === 'baixado' ? 'cancelada' : b.situacao === 'manutencao' ? 'em_andamento' : 'aprovada'}">${ROTULO_SITUACAO[b.situacao]}</span></td>
        <td class="dir num">${dinheiro(b.valor)}</td></tr>`).join('') || linhaVazia(7)}</tbody></table>
  </div>`;
}

/* ======================================================================== */
/* AÇÕES DESTA TELA (ouvinte próprio, para não mexer em acoes.js)            */
/* ======================================================================== */
document.addEventListener('click', ev => {
  const alvo = ev.target.closest('[data-rel]');
  if (!alvo) return;
  const a = alvo.dataset.rel;
  if (a === 'aba'){ relAba = alvo.dataset.k; render(); window.scrollTo(0, 0); }
  else if (a === 'csv') exportarRelatorio();
  else if (a === 'imprimir') imprimirRelatorio();
});

/* ------------------------------------------------------------ EXPORTAR --- */
const brl = v => n(v).toFixed(2).replace('.', ',');

function exportarRelatorio(){
  const { de, ate } = periodoRelatorio();
  const partes = [];

  if (relAba === 'demandas'){
    const lista = baseRelatorio();
    const ids = new Set(lista.map(d => d.id));
    partes.push('RESUMO POR SETOR', csvLinha(['Setor','Demandas','Em aberto','Concluidas','Reprovadas','Valor']));
    for (const [sid, ds] of Object.entries(agrupar(lista, d => d.setor_id)))
      partes.push(csvLinha([setor(sid)?.nome, ds.length, ds.filter(d => ABERTAS.includes(d.status)).length,
        ds.filter(d => d.status === 'concluida').length, ds.filter(d => d.status === 'reprovada').length, brl(soma(ds, d => d.valor))]));

    partes.push('', 'POR SOLICITANTE', csvLinha(['Solicitante','Demandas','Concluidas','Valor']));
    for (const [pid, ds] of Object.entries(agrupar(lista, d => d.solicitante_id)))
      partes.push(csvLinha([nomeDe(pid), ds.length, ds.filter(d => d.status === 'concluida').length, brl(soma(ds, d => d.valor))]));

    partes.push('', 'ITENS', csvLinha(['Item','Protocolo','Setor','Quantidade','Unidade','Valor unitario','Total']));
    for (const i of (S.itensTodos || []).filter(i => ids.has(i.demanda_id))){
      const d = lista.find(x => x.id === i.demanda_id);
      partes.push(csvLinha([i.descricao, d?.protocolo, setor(d?.setor_id)?.nome, num(i.quantidade), i.unidade,
        brl(i.valor_unit), brl(n(i.quantidade) * n(i.valor_unit))]));
    }

    partes.push('', 'DEMANDAS', csvLinha(['Protocolo','Assunto','Setor','Tipo','Solicitante','Situacao','Onde esta','Aberta em','Concluida em','Dias','Valor']));
    for (const d of lista)
      partes.push(csvLinha([d.protocolo, d.titulo, setor(d.setor_id)?.nome, tipo(d.tipo_id)?.nome, nomeDe(d.solicitante_id),
        ROTULO_STATUS[d.status], posicaoDe(d), dataBR(d.criada_em), d.concluida_em ? dataBR(d.concluida_em) : '',
        d.concluida_em ? diasEntre(d.criada_em, d.concluida_em) : '', brl(d.valor)]));

  } else if (relAba === 'estoque'){
    const movs = movimentosFiltrados();
    const saidas = movs.filter(m => m.tipo === 'saida');
    partes.push('CONSUMO POR DESTINO', csvLinha(['Destino','Retiradas','Itens distintos','Quantidade','Valor']));
    for (const [dest, ms] of Object.entries(agrupar(saidas, m => m.destino || 'Sem destino')))
      partes.push(csvLinha([dest, ms.length, new Set(ms.map(m => m.produto_id)).size, num(soma(ms, m => m.qtd)), brl(soma(ms, valorMov))]));

    partes.push('', 'CONSUMO POR CATEGORIA', csvLinha(['Categoria','Saidas','Quantidade','Valor']));
    for (const [cat, ms] of Object.entries(agrupar(saidas, m => produtoDe(m)?.categoria || 'Sem categoria')))
      partes.push(csvLinha([cat, ms.length, num(soma(ms, m => m.qtd)), brl(soma(ms, valorMov))]));

    partes.push('', 'POR ITEM', csvLinha(['Codigo','Item','Categoria','Saiu','Entrou','Saldo atual','Minimo','Valor consumido']));
    for (const [pid, ms] of Object.entries(agrupar(movs, m => m.produto_id))){
      const p = S.produtos.find(x => x.id === pid);
      partes.push(csvLinha([p?.codigo, p?.nome, p?.categoria,
        num(soma(ms.filter(m => m.tipo === 'saida'), m => m.qtd)),
        num(soma(ms.filter(m => m.tipo === 'entrada'), m => m.qtd)),
        num(p?.estoque), num(p?.minimo), brl(soma(ms.filter(m => m.tipo === 'saida'), valorMov))]));
    }

    partes.push('', 'MOVIMENTACOES', csvLinha(['Data','Codigo','Item','Movimento','Quantidade','Unidade','Saldo depois','Destino','Quem retirou','Documento','Registrado por','Valor']));
    for (const m of movs){
      const p = produtoDe(m);
      partes.push(csvLinha([dataHoraBR(m.data), p?.codigo, p?.nome, m.tipo, num(m.qtd), p?.unidade,
        num(m.saldo_depois), m.destino, m.solicitante, m.documento, m.autor_nome, brl(valorMov(m))]));
    }

  } else {
    const bens = bensFiltrados();
    const idsBens = new Set(bens.map(b => b.id));
    partes.push('PATRIMONIO POR SETOR', csvLinha(['Setor','Bens','Em uso','Manutencao','Baixados','Valor']));
    for (const [sid, bs] of Object.entries(agrupar(bens, b => b.setor_id)))
      partes.push(csvLinha([sid === 'sem' ? 'Sem setor' : setor(sid)?.nome, bs.length,
        bs.filter(b => b.situacao === 'em_uso').length, bs.filter(b => b.situacao === 'manutencao').length,
        bs.filter(b => b.situacao === 'baixado').length, brl(soma(bs, b => b.valor))]));

    partes.push('', 'INVENTARIO', csvLinha(['Tombo','Bem','Categoria','Marca','Modelo','Serie','Setor','Local','Responsavel','Situacao','Aquisicao','Nota fiscal','Valor']));
    for (const b of bens)
      partes.push(csvLinha([b.tombo, b.descricao, b.categoria, b.marca, b.modelo, b.serie,
        setor(b.setor_id)?.nome, b.local, b.responsavel_id ? nomeDe(b.responsavel_id) : '',
        ROTULO_SITUACAO[b.situacao], b.aquisicao, b.nota_fiscal, brl(b.valor)]));

    partes.push('', 'MOVIMENTACOES DE BENS', csvLinha(['Data','Tombo','Bem','De','Para','Situacao anterior','Situacao nova','Motivo','Registrado por']));
    for (const m of S.bemMov.filter(m => idsBens.has(m.bem_id) && diaDe(m.data) >= de && diaDe(m.data) <= ate)){
      const b = S.bens.find(x => x.id === m.bem_id);
      partes.push(csvLinha([dataHoraBR(m.data), b?.tombo, b?.descricao, m.de_local, m.para_local,
        ROTULO_SITUACAO[m.de_situacao] || '', ROTULO_SITUACAO[m.para_situacao] || '', m.motivo, m.autor_nome]));
    }
  }

  baixarArquivo(`relatorio_${relAba}_${hoje()}.csv`, partes.join('\n'));
  aviso('Relatório exportado.', 'bom');
}

/* Exportações rápidas usadas pelas outras telas. */
function exportarDemandas(){
  const lista = filtrarDemandas();
  const linhas = [csvLinha(['Protocolo','Setor','Tipo','Assunto','Solicitante','Responsavel','Situacao','Onde esta','Prioridade','Aberta em','Prazo','Concluida em','Valor'])];
  for (const d of lista) linhas.push(csvLinha([d.protocolo, setor(d.setor_id)?.nome, tipo(d.tipo_id)?.nome, d.titulo,
    nomeDe(d.solicitante_id), d.responsavel_id ? nomeDe(d.responsavel_id) : '', ROTULO_STATUS[d.status], posicaoDe(d),
    ROTULO_PRIOR[d.prioridade], dataBR(d.criada_em), dataBR(d.prazo), d.concluida_em ? dataBR(d.concluida_em) : '', brl(d.valor)]));
  baixarArquivo(`demandas_${hoje()}.csv`, linhas.join('\n'));
  aviso('Arquivo gerado.', 'bom');
}

function exportarBens(){
  const linhas = [csvLinha(['Tombo','Descricao','Categoria','Marca','Modelo','Serie','Setor','Local','Responsavel','Situacao','Valor','Aquisicao','Nota fiscal'])];
  for (const b of filtrarBens()) linhas.push(csvLinha([b.tombo, b.descricao, b.categoria, b.marca, b.modelo, b.serie,
    setor(b.setor_id)?.nome, b.local, b.responsavel_id ? nomeDe(b.responsavel_id) : '',
    ROTULO_SITUACAO[b.situacao], brl(b.valor), b.aquisicao, b.nota_fiscal]));
  baixarArquivo(`patrimonio_${hoje()}.csv`, linhas.join('\n'));
  aviso('Inventário exportado.', 'bom');
}

function exportarEstoque(){
  const linhas = [csvLinha(['Codigo','Item','Categoria','Unidade','Saldo','Minimo','Maximo','Preco','Local','Valor em estoque'])];
  for (const p of filtrarProdutos()) linhas.push(csvLinha([p.codigo, p.nome, p.categoria, p.unidade,
    num(p.estoque), num(p.minimo), num(p.maximo), brl(p.preco), p.local, brl(p.estoque * p.preco)]));
  baixarArquivo(`estoque_${hoje()}.csv`, linhas.join('\n'));
  aviso('Estoque exportado.', 'bom');
}

/* ----------------------------------------------------------- IMPRESSÃO --- */
const assinatura = () =>
  `<p style="font-size:10px;margin-top:24px">Emitido por ${esc(perfil.nome)} em ${dataHoraBR(new Date().toISOString())}.</p>
   <p style="font-size:10px;margin-top:26px">_______________________________<br>Assinatura do responsável</p>`;

function imprimirRelatorio(){
  const { de, ate } = periodoRelatorio();
  const sub = `Período de ${dataBR(de)} a ${dataBR(ate)}`;

  if (relAba === 'estoque'){
    const movs = movimentosFiltrados();
    const saidas = movs.filter(m => m.tipo === 'saida');
    imprimir(`${cabDoc('Relatório de movimentação de estoque', sub)}
      <p style="font-size:11px"><b>${movs.length}</b> movimentações · <b>${saidas.length}</b> saídas ·
        consumo de <b>${dinheiro(soma(saidas, valorMov))}</b></p>
      <h3 style="font-size:12px;margin:14px 0 6px">Consumo por destino</h3>
      <table><thead><tr><th>Destino</th><th>Retiradas</th><th>Quantidade</th><th>Valor</th></tr></thead>
      <tbody>${Object.entries(agrupar(saidas, m => m.destino || 'Sem destino')).map(([d, ms]) =>
        `<tr><td>${esc(d)}</td><td>${ms.length}</td><td>${num(soma(ms, m => m.qtd))}</td>
         <td>${dinheiro(soma(ms, valorMov))}</td></tr>`).join('')}</tbody></table>
      <h3 style="font-size:12px;margin:14px 0 6px">Movimentações</h3>
      <table><thead><tr><th>Data</th><th>Item</th><th>Mov.</th><th>Qtd</th><th>Destino</th><th>Quem retirou</th><th>Registrado por</th></tr></thead>
      <tbody>${movs.map(m => { const p = produtoDe(m); return `<tr><td>${dataHoraBR(m.data)}</td>
        <td>${esc(p?.codigo || '')} ${esc(p?.nome || '')}</td><td>${esc(m.tipo)}</td><td>${num(m.qtd)}</td>
        <td>${esc(m.destino || '')}</td><td>${esc(m.solicitante || '')}</td><td>${esc(m.autor_nome || '')}</td></tr>`; }).join('')}</tbody></table>
      ${assinatura()}`);
    return;
  }

  if (relAba === 'patrimonio'){
    const bens = bensFiltrados();
    imprimir(`${cabDoc('Inventário patrimonial', sub)}
      <p style="font-size:11px"><b>${bens.length}</b> bens · valor total <b>${dinheiro(soma(bens, b => b.valor))}</b> ·
        <b>${bens.filter(b => b.situacao === 'manutencao').length}</b> em manutenção</p>
      <table><thead><tr><th>Tombo</th><th>Bem</th><th>Setor</th><th>Local</th><th>Responsável</th><th>Situação</th><th>Valor</th></tr></thead>
      <tbody>${bens.map(b => `<tr><td>${esc(b.tombo)}</td><td>${esc(b.descricao)}</td>
        <td>${esc(setor(b.setor_id)?.nome || '')}</td><td>${esc(b.local || '')}</td>
        <td>${esc(b.responsavel_id ? nomeDe(b.responsavel_id) : '')}</td>
        <td>${ROTULO_SITUACAO[b.situacao]}</td><td>${dinheiro(b.valor)}</td></tr>`).join('')}</tbody></table>
      ${assinatura()}`);
    return;
  }

  const lista = baseRelatorio();
  imprimir(`${cabDoc('Relatório de demandas', sub + (F.rSetor ? ' · ' + setor(F.rSetor)?.nome : ''))}
    <p style="font-size:11px"><b>${lista.length}</b> demandas · <b>${lista.filter(d => d.status === 'concluida').length}</b> concluídas ·
      <b>${lista.filter(d => ABERTAS.includes(d.status)).length}</b> em aberto ·
      valor total <b>${dinheiro(soma(lista, d => d.valor))}</b></p>
    <h3 style="font-size:12px;margin:14px 0 6px">Por setor</h3>
    <table><thead><tr><th>Setor</th><th>Demandas</th><th>Em aberto</th><th>Concluídas</th><th>Valor</th></tr></thead>
    <tbody>${Object.entries(agrupar(lista, d => d.setor_id)).map(([sid, ds]) => `<tr><td>${esc(setor(sid)?.nome || '')}</td>
      <td>${ds.length}</td><td>${ds.filter(d => ABERTAS.includes(d.status)).length}</td>
      <td>${ds.filter(d => d.status === 'concluida').length}</td><td>${dinheiro(soma(ds, d => d.valor))}</td></tr>`).join('')}</tbody></table>
    <h3 style="font-size:12px;margin:14px 0 6px">Demandas</h3>
    <table><thead><tr><th>Protocolo</th><th>Assunto</th><th>Setor</th><th>Solicitante</th><th>Situação</th><th>Onde está</th><th>Valor</th></tr></thead>
    <tbody>${lista.map(d => `<tr><td>${esc(d.protocolo)}</td><td>${esc(d.titulo)}</td>
      <td>${esc(setor(d.setor_id)?.nome || '')}</td><td>${esc(nomeDe(d.solicitante_id))}</td>
      <td>${ROTULO_STATUS[d.status]}</td><td>${esc(posicaoDe(d))}</td><td>${dinheiro(d.valor)}</td></tr>`).join('')}</tbody></table>
    ${assinatura()}`);
}
