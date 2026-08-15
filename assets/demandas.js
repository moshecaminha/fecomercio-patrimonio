/* ============================================================================
   DEMANDAS — painel, abertura, acompanhamento e decisão.
   O trilho de estações é o que responde, em um olhar, à pergunta que todo
   solicitante faz: "onde está a minha demanda?"
   ========================================================================== */
'use strict';

let novo = { setor_id:'', tipo_id:'', itens:[] };

/* ------------------------------------------------------------- APOIO ----- */
const atrasada = d => d.prazo && ABERTAS.includes(d.status) && d.prazo < hoje();
const posicaoDe = d => {
  const e = etapa(d.etapa_id);
  return e ? e.nome : (d.local_atual || ROTULO_STATUS[d.status]);
};
function tagStatus(d){
  return `<span class="tag ${d.status}">${ROTULO_STATUS[d.status]}</span>` +
    (atrasada(d) ? `<span class="tag atrasada">Atrasada</span>` : '') +
    (['alta','urgente'].includes(d.prioridade) ? `<span class="tag ${d.prioridade}">${ROTULO_PRIOR[d.prioridade]}</span>` : '');
}
function selo(sid){
  const s = setor(sid); if (!s) return '';
  return `<span class="marca-setor"><i style="background:${esc(s.cor)}"></i>${esc(s.nome)}</span>`;
}

/* ------------------------------------------- TRILHO (elemento assinatura) - */
function trilhoHTML(d){
  const et = etapasDe(d.setor_id);
  if (!et.length) return '';
  const atual = etapa(d.etapa_id);
  const iAtual = atual ? et.findIndex(e => e.id === atual.id) : 0;
  const encerrada = ['concluida','cancelada','reprovada'].includes(d.status);
  const passos = S.tramitesAbertos || [];
  return `<div class="trilho">${et.map((e, i) => {
    const classe = encerrada && d.status !== 'reprovada' ? 'feita'
      : i < iAtual ? 'feita' : i === iAtual ? (encerrada ? 'feita' : 'aqui') : '';
    const marca = passos.find(t => t.acao === 'etapa' && t.para === e.nome);
    return `<div class="estacao ${classe}"><span class="ponto"></span>
      <div class="rot">${esc(e.nome)}</div>
      <div class="data">${i === iAtual && !encerrada ? 'aqui agora' : marca ? dataBR(marca.criado_em) : e.prazo_dias ? e.prazo_dias + ' d' : ''}</div>
    </div>`;
  }).join('')}</div>`;
}

/* ======================================================================== */
/* PAINEL                                                                    */
/* ======================================================================== */
function vPainel(){
  const minhas = S.demandas.filter(d => d.solicitante_id === perfil.id);
  const abertasMinhas = minhas.filter(d => ABERTAS.includes(d.status));
  const paraDecidir = S.demandas.filter(d => podeAprovar(d.setor_id) && ['aberta','em_analise'].includes(d.status));
  const atrasadas = S.demandas.filter(d => podeVer(d.setor_id) && atrasada(d));
  const mes = hoje().slice(0, 7);
  const concluidas = S.demandas.filter(d => d.concluida_em && diaDe(d.concluida_em).startsWith(mes));

  return `
  <div class="titulo-tela">
    <div><h2>Olá, ${esc(perfil.nome.split(' ')[0])}</h2>
      <p>${abertasMinhas.length ? `Você tem ${abertasMinhas.length} demanda(s) em andamento.` : 'Você não tem demandas em aberto.'}</p></div>
    ${setoresQueSolicito().length ? `<div class="acoes"><button class="btn" data-acao="ir" data-vista="nova">Abrir demanda</button></div>` : ''}
  </div>

  <div class="kpis">
    <div class="kpi"><div class="rot">Minhas em aberto</div><div class="val">${abertasMinhas.length}</div>
      <div class="sub">de ${minhas.length} já abertas</div></div>
    <div class="kpi ${paraDecidir.length ? 'aviso' : ''}"><div class="rot">Aguardando você</div><div class="val">${paraDecidir.length}</div>
      <div class="sub">${paraDecidir.length ? 'para analisar ou aprovar' : 'nada pendente'}</div></div>
    <div class="kpi ${atrasadas.length ? 'grave' : ''}"><div class="rot">Fora do prazo</div><div class="val">${atrasadas.length}</div>
      <div class="sub">nos seus setores</div></div>
    <div class="kpi bom"><div class="rot">Concluídas no mês</div><div class="val">${concluidas.length}</div>
      <div class="sub">${dataBR(mes + '-01').slice(3)}</div></div>
  </div>

  ${paraDecidir.length ? `<div class="bloco">
    <h3>Esperando sua decisão<span class="conta">${paraDecidir.length}</span></h3>
    <ul class="lista-dem">${paraDecidir.slice(0, 8).map(linhaDemanda).join('')}</ul>
  </div>` : ''}

  <div class="grade g23">
    <div class="bloco">
      <h3>Minhas demandas<span class="conta">${minhas.length}</span></h3>
      ${minhas.length
        ? `<ul class="lista-dem">${minhas.slice(0, 10).map(linhaDemanda).join('')}</ul>`
        : `<div class="vazio"><b>Nada por aqui ainda</b>Abra sua primeira demanda pelo botão acima.</div>`}
    </div>
    <div class="bloco">
      <h3>Seus setores</h3>
      <div class="corpo">
        ${setoresVisiveis().map(s => {
          const q = S.demandas.filter(d => d.setor_id === s.id && ABERTAS.includes(d.status)).length;
          const nv = nivelNo(s.id);
          return `<button class="cartao-dem" style="padding:12px 0;border-bottom:1px solid var(--linha)"
            data-acao="filtrar-setor" data-id="${s.id}">
            <div class="l1">${selo(s.id)}<span class="tag aberta" style="margin-left:auto">${q} em aberto</span></div>
            <div class="l3" style="margin-top:5px">Seu acesso: <b>${nv === 'gerir' ? 'gerir tudo' : nv === 'aprovar' ? 'aprovar demandas' : nv === 'solicitar' ? 'abrir e acompanhar' : 'somente acompanhar'}</b></div>
          </button>`;
        }).join('') || `<p class="legenda">Nenhum setor liberado para você ainda.</p>`}
      </div>
    </div>
  </div>`;
}

function linhaDemanda(d){
  return `<li><button class="cartao-dem" data-acao="abrir-demanda" data-id="${d.id}">
    <div class="l1"><span class="protocolo leve">${esc(d.protocolo)}</span>${tagStatus(d)}</div>
    <div class="l2">${esc(d.titulo)}</div>
    <div class="l3">
      ${selo(d.setor_id)}
      <span><span class="onde">${esc(posicaoDe(d))}</span></span>
      <span>Solicitante: <b>${esc(nomeDe(d.solicitante_id))}</b></span>
      <span>Aberta em <b>${dataBR(d.criada_em)}</b></span>
      ${d.prazo ? `<span>Prazo: <b>${dataBR(d.prazo)}</b></span>` : ''}
    </div></button></li>`;
}

/* ======================================================================== */
/* NOVA DEMANDA                                                              */
/* ======================================================================== */
function vNovaDemanda(){
  const sets = setoresQueSolicito();
  if (!sets.length) return `<div class="bloco"><div class="vazio"><b>Sem setor liberado</b>
    Peça ao administrador acesso de solicitante em algum setor.</div></div>`;

  const s = novo.setor_id ? setor(novo.setor_id) : null;
  const tps = s ? tiposDe(s.id) : [];
  const t = novo.tipo_id ? tipo(novo.tipo_id) : null;

  return `
  <div class="titulo-tela"><div><h2>Abrir demanda</h2>
    <p>Escolha o setor, o tipo e preencha o que ele pede. O protocolo é gerado na hora.</p></div></div>

  <div class="bloco">
    <h3>1 · Para onde vai a demanda</h3>
    <div class="corpo">
      <div class="linha-campos c2">
        <label class="campo"><span>Setor <em>*</em></span>
          <select id="ndSetor" data-acao="troca-setor">
            <option value="">Selecione…</option>
            ${sets.map(x => `<option value="${x.id}" ${novo.setor_id === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}
          </select></label>
        <label class="campo"><span>Tipo de demanda <em>*</em></span>
          <select id="ndTipo" data-acao="troca-tipo" ${!s ? 'disabled' : ''}>
            <option value="">${s ? 'Selecione…' : 'Escolha o setor primeiro'}</option>
            ${tps.map(x => `<option value="${x.id}" ${novo.tipo_id === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}
          </select></label>
      </div>
      ${s ? `<p class="legenda" style="margin:0">${esc(s.descricao || '')}
        ${t ? ` · Prazo de atendimento previsto: <b>${t.sla_dias} dia(s)</b>${t.exige_aprovacao ? ' · passa por aprovação' : ''}` : ''}</p>` : ''}
    </div>
  </div>

  ${!t ? '' : `
  <div class="bloco">
    <h3>2 · Dados da demanda</h3>
    <div class="corpo">
      <label class="campo"><span>Assunto <em>*</em></span>
        <input id="ndTitulo" type="text" maxlength="120" placeholder="Resuma em uma linha o que você precisa"></label>
      <label class="campo"><span>Detalhamento</span>
        <textarea id="ndDesc" placeholder="Explique o contexto, quem usa, onde fica, o que já foi tentado…"></textarea></label>
      <div class="linha-campos c3">
        <label class="campo"><span>Prioridade</span>
          <select id="ndPrior">
            ${Object.entries(ROTULO_PRIOR).map(([k, v]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${v}</option>`).join('')}
          </select></label>
        <label class="campo"><span>Precisa até</span><input id="ndPrazo" type="date" value="${prazoSugerido(t)}"></label>
        ${s.usa_valor ? `<label class="campo"><span>Valor estimado (R$)</span>
          <input id="ndValor" type="number" step="0.01" min="0" placeholder="0,00"></label>` : ''}
      </div>
      ${(t.campos || []).length ? `<div class="linha-campos c2">${(t.campos || []).map(campoHTML).join('')}</div>` : ''}
    </div>
  </div>

  ${s.usa_itens ? `<div class="bloco">
    <h3>3 · Itens<span class="conta">${novo.itens.length} item(ns)</span></h3>
    <div class="corpo">
      <p class="legenda">Liste o que precisa ser atendido. Os relatórios por item usam exatamente esta lista.</p>
      <div class="linha-campos c3">
        <label class="campo"><span>Descrição</span><input id="itDesc" type="text" placeholder="Ex.: Papel A4 75g"></label>
        <label class="campo"><span>Quantidade</span><input id="itQtd" type="number" step="0.001" min="0" value="1"></label>
        <label class="campo"><span>Unidade</span><input id="itUn" type="text" value="un" maxlength="10"></label>
      </div>
      <div class="linha-campos c3">
        <label class="campo"><span>Valor unitário (R$)</span><input id="itValor" type="number" step="0.01" min="0" placeholder="0,00"></label>
        <label class="campo"><span>Código / tombo (opcional)</span><input id="itRef" type="text" placeholder="Vincula ao estoque ou ao bem"></label>
        <label class="campo"><span>&nbsp;</span><button class="btn sec" data-acao="add-item" style="width:100%">Incluir item</button></label>
      </div>
      ${novo.itens.length ? `<div class="rolagem"><table class="tabela">
        <thead><tr><th>Item</th><th class="dir">Qtd</th><th class="dir">Valor un.</th><th class="dir">Total</th><th></th></tr></thead>
        <tbody>${novo.itens.map((it, i) => `<tr>
          <td>${esc(it.descricao)}${it.referencia ? ` <span class="mono" style="color:var(--mute)">${esc(it.referencia)}</span>` : ''}</td>
          <td class="dir num">${num(it.quantidade)} ${esc(it.unidade)}</td>
          <td class="dir num">${dinheiro(it.valor_unit)}</td>
          <td class="dir num">${dinheiro(it.quantidade * it.valor_unit)}</td>
          <td class="dir"><button class="btn mini neutro" data-acao="del-item" data-id="${i}">Remover</button></td></tr>`).join('')}
        </tbody></table></div>` : ''}
    </div>
  </div>` : ''}

  <div class="btn-linha" style="margin-top:6px">
    <button class="btn" data-acao="salvar-demanda">Enviar demanda</button>
    <button class="btn neutro" data-acao="ir" data-vista="painel">Cancelar</button>
  </div>`}`;
}

function prazoSugerido(t){
  const d = new Date();
  d.setDate(d.getDate() + (t.sla_dias || 5));
  return d.toLocaleDateString('sv-SE');
}

function campoHTML(c){
  const id = 'cx_' + c.chave;
  const obr = c.obrigatorio ? ' <em>*</em>' : '';
  if (c.tipo === 'longo') return `<label class="campo" style="grid-column:1/-1"><span>${esc(c.rotulo)}${obr}</span>
    <textarea id="${id}" data-campo="${esc(c.chave)}" data-obrig="${!!c.obrigatorio}"></textarea></label>`;
  if (c.tipo === 'lista') return `<label class="campo"><span>${esc(c.rotulo)}${obr}</span>
    <select id="${id}" data-campo="${esc(c.chave)}" data-obrig="${!!c.obrigatorio}">
      <option value="">Selecione…</option>
      ${(c.opcoes || []).map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`;
  const tp = c.tipo === 'numero' ? 'number' : c.tipo === 'data' ? 'date' : 'text';
  return `<label class="campo"><span>${esc(c.rotulo)}${obr}</span>
    <input id="${id}" type="${tp}" data-campo="${esc(c.chave)}" data-obrig="${!!c.obrigatorio}"></label>`;
}

function incluirItem(){
  const desc = el('itDesc').value.trim();
  if (!desc) return aviso('Descreva o item antes de incluir.', 'ruim');
  novo.itens.push({
    descricao: desc,
    quantidade: n(el('itQtd').value) || 1,
    unidade: el('itUn').value.trim() || 'un',
    valor_unit: n(el('itValor').value),
    referencia: el('itRef').value.trim()
  });
  render();
}

async function salvarNovaDemanda(){
  const t = tipo(novo.tipo_id);
  if (!t) return aviso('Escolha o setor e o tipo de demanda.', 'ruim');
  const titulo = el('ndTitulo').value.trim();
  if (!titulo) return aviso('Informe o assunto da demanda.', 'ruim');

  const dados = {};
  for (const c of (t.campos || [])){
    const campo = el('cx_' + c.chave);
    const v = campo ? campo.value.trim() : '';
    if (c.obrigatorio && !v) return aviso(`Preencha "${c.rotulo}".`, 'ruim');
    if (v) dados[c.chave] = v;
  }

  const s = setor(novo.setor_id);
  const primeira = etapasDe(s.id)[0];
  const valorItens = novo.itens.reduce((a, i) => a + i.quantidade * i.valor_unit, 0);
  const valor = n(el('ndValor')?.value) || valorItens;

  try {
    const { data: proto, error: eP } = await sb.rpc('fp_novo_protocolo', { p_setor: s.id });
    if (eP) throw eP;

    const registro = {
      protocolo: proto, setor_id: s.id, tipo_id: t.id, solicitante_id: perfil.id,
      etapa_id: primeira ? primeira.id : null, titulo,
      descricao: el('ndDesc').value.trim() || null,
      prioridade: el('ndPrior').value, status: 'aberta',
      local_atual: primeira ? primeira.nome : null,
      valor, prazo: el('ndPrazo').value || null, dados
    };
    const { data: dem, error } = await sb.from('fp_demandas').insert(registro).select().single();
    if (error) throw error;

    if (novo.itens.length){
      const { error: eI } = await sb.from('fp_itens').insert(novo.itens.map(i => ({ ...i, demanda_id: dem.id })));
      if (eI) throw eI;
    }
    await sb.from('fp_tramites').insert({
      demanda_id: dem.id, autor_id: perfil.id, autor_nome: perfil.nome,
      acao: 'abertura', para: primeira ? primeira.nome : 'Aberta',
      local: primeira ? primeira.nome : null,
      comentario: `Demanda aberta por ${perfil.nome}.`
    });

    novo = { setor_id:'', tipo_id:'', itens:[] };
    S.itensTodos = null;                 // relatórios recarregam com os itens novos
    await atualizarDemandas();
    vista = 'demandas'; aberta = dem.id;
    pintarAbas(); render();
    aviso(`Demanda ${proto} registrada. Acompanhe por aqui.`, 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

/* ======================================================================== */
/* LISTA E FICHA                                                             */
/* ======================================================================== */
function filtrarDemandas(){
  return S.demandas.filter(d => {
    if (!podeVer(d.setor_id) && d.solicitante_id !== perfil.id) return false;
    if (F.dSetor && d.setor_id !== F.dSetor) return false;
    if (F.dStatus && d.status !== F.dStatus) return false;
    if (F.dPrior && d.prioridade !== F.dPrior) return false;
    if (F.dMinhas && d.solicitante_id !== perfil.id) return false;
    if (F.dAtrasadas && !atrasada(d)) return false;
    if (F.dBusca){
      const alvo = [d.protocolo, d.titulo, d.descricao, nomeDe(d.solicitante_id), JSON.stringify(d.dados)].join(' ');
      if (!contem(alvo, F.dBusca)) return false;
    }
    return true;
  });
}

function vDemandas(){
  if (aberta) return fichaDemanda(aberta);
  const lista = filtrarDemandas();

  return `
  <div class="titulo-tela"><div><h2>Demandas</h2>
    <p>${lista.length} demanda(s) no filtro atual · ${lista.filter(d => ABERTAS.includes(d.status)).length} em aberto</p></div>
    <div class="acoes"><button class="btn sec" data-acao="exportar-demandas">Exportar CSV</button></div></div>

  <div class="bloco">
    <div class="filtros">
      <label class="campo"><span>Buscar</span>
        <input type="search" id="fBusca" data-vivo="dBusca" value="${esc(F.dBusca)}" placeholder="Protocolo, assunto, solicitante…"></label>
      <label class="campo"><span>Setor</span><select data-filtro="dSetor">
        <option value="">Todos</option>
        ${setoresVisiveis().map(s => `<option value="${s.id}" ${F.dSetor === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}
      </select></label>
      <label class="campo"><span>Situação</span><select data-filtro="dStatus">
        <option value="">Todas</option>
        ${Object.entries(ROTULO_STATUS).map(([k, v]) => `<option value="${k}" ${F.dStatus === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select></label>
      <label class="campo"><span>Prioridade</span><select data-filtro="dPrior">
        <option value="">Todas</option>
        ${Object.entries(ROTULO_PRIOR).map(([k, v]) => `<option value="${k}" ${F.dPrior === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select></label>
      <div>
        <label class="marcador"><input type="checkbox" data-filtro="dMinhas" ${F.dMinhas ? 'checked' : ''}> Só as minhas</label>
        <label class="marcador"><input type="checkbox" data-filtro="dAtrasadas" ${F.dAtrasadas ? 'checked' : ''}> Só atrasadas</label>
      </div>
    </div>
    ${lista.length
      ? `<ul class="lista-dem">${lista.slice(0, 120).map(linhaDemanda).join('')}</ul>`
      : `<div class="vazio"><b>Nenhuma demanda encontrada</b>Ajuste os filtros ou abra uma nova demanda.</div>`}
  </div>`;
}

async function abrirDemanda(id){
  aberta = id;
  vista = 'demandas';
  pintarAbas();
  el('tela').innerHTML = `<div class="carregando">Abrindo a ficha…</div>`;
  const [it, tr] = await Promise.all([
    sb.from('fp_itens').select('*').eq('demanda_id', id),
    sb.from('fp_tramites').select('*').eq('demanda_id', id).order('criado_em')
  ]);
  S.itensAbertos = it.data || [];
  S.tramitesAbertos = tr.data || [];
  render();
  window.scrollTo(0, 0);
}

function fichaDemanda(id){
  const d = S.demandas.find(x => x.id === id);
  if (!d) return `<div class="bloco"><div class="vazio"><b>Demanda não encontrada</b></div></div>`;
  const s = setor(d.setor_id), t = tipo(d.tipo_id);
  const itens = S.itensAbertos || [], hist = S.tramitesAbertos || [];
  const decidir = podeAprovar(d.setor_id) && ['aberta','em_analise'].includes(d.status);
  const conduz = podeAprovar(d.setor_id) && ABERTAS.includes(d.status);
  const et = etapasDe(d.setor_id);

  return `
  <div class="titulo-tela">
    <div><button class="btn mini neutro" data-acao="voltar-lista">← Todas as demandas</button></div>
    <div class="acoes">
      <button class="btn sec" data-acao="imprimir-demanda">Imprimir ficha</button>
      ${d.solicitante_id === perfil.id && ABERTAS.includes(d.status)
        ? `<button class="btn neutro" data-acao="cancelar-demanda" data-id="${d.id}">Cancelar demanda</button>` : ''}
    </div>
  </div>

  <div class="bloco">
    <div class="ficha-cab">
      <div class="l1" style="display:flex;gap:9px;flex-wrap:wrap;align-items:center">
        <span class="protocolo">${esc(d.protocolo)}</span>${tagStatus(d)}
        <span style="margin-left:auto">${selo(d.setor_id)}</span>
      </div>
      <h2>${esc(d.titulo)}</h2>
      ${d.descricao ? `<p class="legenda" style="margin:0">${esc(d.descricao)}</p>` : ''}
    </div>

    ${trilhoHTML(d)}

    <div class="ficha-meta">
      <div class="it"><div class="r">Onde está agora</div><div class="v"><span class="onde">${esc(posicaoDe(d))}</span></div></div>
      <div class="it"><div class="r">Solicitante</div><div class="v">${esc(nomeDe(d.solicitante_id))}</div></div>
      <div class="it"><div class="r">Responsável</div><div class="v">${d.responsavel_id ? esc(nomeDe(d.responsavel_id)) : 'a designar'}</div></div>
      <div class="it"><div class="r">Tipo</div><div class="v">${t ? esc(t.nome) : '—'}</div></div>
      <div class="it"><div class="r">Aberta em</div><div class="v">${dataHoraBR(d.criada_em)}</div></div>
      <div class="it"><div class="r">Prazo</div><div class="v">${d.prazo ? dataBR(d.prazo) + (atrasada(d) ? ' · vencido' : '') : 'sem prazo'}</div></div>
      ${s?.usa_valor ? `<div class="it"><div class="r">Valor</div><div class="v num">${dinheiro(d.valor)}</div></div>` : ''}
      <div class="it"><div class="r">Última atualização</div><div class="v">${dataHoraBR(d.atualizada_em)}</div></div>
    </div>

    ${Object.keys(d.dados || {}).length ? `<div class="corpo" style="border-bottom:1px solid var(--linha)">
      <div class="campos-dados">${(t?.campos || []).filter(c => d.dados[c.chave]).map(c =>
        `<div><div class="r">${esc(c.rotulo)}</div><div class="v">${esc(d.dados[c.chave])}</div></div>`).join('')}</div>
    </div>` : ''}

    ${itens.length ? `<div class="rolagem"><table class="tabela">
      <thead><tr><th>Item solicitado</th><th class="dir">Qtd</th><th class="dir">Valor un.</th><th class="dir">Total</th><th>Situação</th></tr></thead>
      <tbody>${itens.map(i => `<tr>
        <td>${esc(i.descricao)}${i.referencia ? ` <span class="mono" style="color:var(--mute)">${esc(i.referencia)}</span>` : ''}</td>
        <td class="dir num">${num(i.quantidade)} ${esc(i.unidade || '')}</td>
        <td class="dir num">${dinheiro(i.valor_unit)}</td>
        <td class="dir num">${dinheiro(n(i.quantidade) * n(i.valor_unit))}</td>
        <td>${i.atendido ? '<span class="tag aprovada">Atendido</span>' : '<span class="tag em_analise">Pendente</span>'}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
  </div>

  ${decidir ? `<div class="bloco">
    <h3>Decisão</h3>
    <div class="corpo">
      <p class="legenda">Sua análise fica registrada no histórico com data, hora e o seu nome.</p>
      <label class="campo"><span>Parecer</span><textarea id="txParecer" placeholder="Justifique a aprovação ou a recusa"></textarea></label>
      <div class="btn-linha">
        <button class="btn ok" data-acao="decidir" data-id="${d.id}" data-voto="aprovar">Aprovar</button>
        <button class="btn perigo" data-acao="decidir" data-id="${d.id}" data-voto="reprovar">Reprovar</button>
        <button class="btn neutro" data-acao="decidir" data-id="${d.id}" data-voto="analise">Marcar em análise</button>
      </div>
    </div>
  </div>` : ''}

  ${conduz ? `<div class="bloco">
    <h3>Movimentar</h3>
    <div class="corpo">
      <div class="linha-campos c2">
        <label class="campo"><span>Mover para a estação</span>
          <select id="mvEtapa">${et.map(e => `<option value="${e.id}" ${e.id === d.etapa_id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select></label>
        <label class="campo"><span>Responsável</span>
          <select id="mvResp"><option value="">Sem responsável</option>
            ${S.perfis.filter(p => p.ativo).map(p => `<option value="${p.id}" ${p.id === d.responsavel_id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
      </div>
      <label class="campo"><span>Localização física / observação da etapa</span>
        <input id="mvLocal" type="text" value="${esc(d.local_atual || '')}" placeholder="Ex.: mesa 3 do financeiro, sala 204, em trânsito"></label>
      <label class="campo"><span>Comentário</span><textarea id="mvNota" placeholder="O que foi feito nesta etapa"></textarea></label>
      <div class="btn-linha">
        <button class="btn" data-acao="mover-demanda" data-id="${d.id}">Registrar movimentação</button>
        <button class="btn ok" data-acao="concluir-demanda" data-id="${d.id}">Concluir demanda</button>
      </div>
    </div>
  </div>` : ''}

  <div class="bloco">
    <h3>Histórico da demanda<span class="conta">${hist.length} registro(s)</span></h3>
    <ul class="historico">
      ${hist.slice().reverse().map(h => `<li class="${esc(h.acao)}"><span class="bola"></span>
        <div class="quando">${dataHoraBR(h.criado_em)} · ${esc(h.autor_nome || 'sistema')}</div>
        <div class="oque">${esc(descreverTramite(h))}</div>
        ${h.comentario && h.acao !== 'abertura' ? `<div class="nota">${esc(h.comentario)}</div>` : ''}
      </li>`).join('') || '<li class="vazio">Sem registros.</li>'}
    </ul>
    <div class="corpo" style="border-top:1px solid var(--linha)">
      <label class="campo"><span>Adicionar comentário</span>
        <textarea id="txComent" placeholder="Escreva uma atualização para quem acompanha"></textarea></label>
      <button class="btn sec" data-acao="comentar" data-id="${d.id}">Publicar comentário</button>
    </div>
  </div>`;
}

function descreverTramite(h){
  switch (h.acao){
    case 'abertura':     return 'Demanda aberta e encaminhada para ' + (h.para || 'análise') + '.';
    case 'aprovacao':    return 'Aprovada.';
    case 'reprovacao':   return 'Reprovada.';
    case 'status':       return 'Situação alterada para ' + (ROTULO_STATUS[h.para] || h.para) + '.';
    case 'etapa':        return 'Movida de "' + (h.de || 'início') + '" para "' + (h.para || '') + '".';
    case 'movimentacao': return 'Movimentação física registrada' + (h.local ? ' · ' + h.local : '') + '.';
    case 'conclusao':    return 'Demanda concluída.';
    case 'cancelamento': return 'Demanda cancelada pelo solicitante.';
    default:             return h.comentario ? 'Comentário' : 'Atualização';
  }
}

/* --------------------------------------------------------- OPERAÇÕES ----- */
async function registrar(demanda_id, campos){
  await sb.from('fp_tramites').insert({ demanda_id, autor_id: perfil.id, autor_nome: perfil.nome, ...campos });
}

async function decidirDemanda(id, voto){
  const d = S.demandas.find(x => x.id === id);
  const parecer = el('txParecer')?.value.trim() || '';
  if (voto === 'reprovar' && !parecer) return aviso('Explique o motivo da reprovação antes de confirmar.', 'ruim');

  const et = etapasDe(d.setor_id);
  const proxima = voto === 'aprovar'
    ? (et.find(e => e.ordem > (etapa(d.etapa_id)?.ordem || 0) && e.tipo !== 'aprovacao') || et[et.length - 1])
    : etapa(d.etapa_id);
  const status = voto === 'aprovar' ? 'aprovada' : voto === 'reprovar' ? 'reprovada' : 'em_analise';

  try {
    const patch = { status };
    if (voto === 'aprovar' && proxima){ patch.etapa_id = proxima.id; patch.local_atual = proxima.nome; }
    const { error } = await sb.from('fp_demandas').update(patch).eq('id', id);
    if (error) throw error;
    await registrar(id, {
      acao: voto === 'aprovar' ? 'aprovacao' : voto === 'reprovar' ? 'reprovacao' : 'status',
      de: ROTULO_STATUS[d.status], para: voto === 'analise' ? 'em_analise' : status,
      local: patch.local_atual || d.local_atual, comentario: parecer || null
    });
    await atualizarDemandas();
    await abrirDemanda(id);
    pintarAbas();
    aviso(voto === 'aprovar' ? 'Demanda aprovada.' : voto === 'reprovar' ? 'Demanda reprovada.' : 'Marcada em análise.', voto === 'reprovar' ? 'ruim' : 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

async function moverDemanda(id){
  const d = S.demandas.find(x => x.id === id);
  const novaEtapa = etapa(el('mvEtapa').value);
  const resp = el('mvResp').value || null;
  const local = el('mvLocal').value.trim();
  const nota = el('mvNota').value.trim();

  try {
    const patch = {
      etapa_id: novaEtapa ? novaEtapa.id : d.etapa_id,
      responsavel_id: resp,
      local_atual: local || (novaEtapa ? novaEtapa.nome : d.local_atual)
    };
    if (d.status === 'aberta') patch.status = 'em_andamento';
    if (novaEtapa && novaEtapa.tipo === 'final') patch.status = 'concluida';
    const { error } = await sb.from('fp_demandas').update(patch).eq('id', id);
    if (error) throw error;
    await registrar(id, {
      acao: 'etapa', de: etapa(d.etapa_id)?.nome || null,
      para: novaEtapa?.nome || null, local: patch.local_atual, comentario: nota || null
    });
    await atualizarDemandas();
    await abrirDemanda(id);
    aviso('Movimentação registrada.', 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

async function concluirDemanda(id){
  if (!confirm('Concluir esta demanda? Ela sai das listas de pendências.')) return;
  const et = etapasDe(S.demandas.find(x => x.id === id).setor_id);
  const fim = et.find(e => e.tipo === 'final') || et[et.length - 1];
  try {
    const { error } = await sb.from('fp_demandas').update({
      status: 'concluida', etapa_id: fim?.id, local_atual: fim?.nome
    }).eq('id', id);
    if (error) throw error;
    await registrar(id, { acao:'conclusao', para:'concluida', local: fim?.nome, comentario: el('mvNota')?.value.trim() || null });
    await atualizarDemandas();
    await abrirDemanda(id);
    pintarAbas();
    aviso('Demanda concluída.', 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

async function cancelarDemanda(id){
  const motivo = prompt('Motivo do cancelamento:');
  if (motivo === null) return;
  try {
    const { error } = await sb.from('fp_demandas').update({ status:'cancelada' }).eq('id', id);
    if (error) throw error;
    await registrar(id, { acao:'cancelamento', para:'cancelada', comentario: motivo || null });
    await atualizarDemandas();
    await abrirDemanda(id);
    pintarAbas();
    aviso('Demanda cancelada.');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

async function comentarDemanda(id){
  const txt = el('txComent').value.trim();
  if (!txt) return aviso('Escreva o comentário antes de publicar.', 'ruim');
  try {
    await registrar(id, { acao:'comentario', comentario: txt });
    await abrirDemanda(id);
    aviso('Comentário publicado.', 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

function imprimirFichaDemanda(){
  const d = S.demandas.find(x => x.id === aberta);
  if (!d) return;
  const t = tipo(d.tipo_id), itens = S.itensAbertos || [], hist = S.tramitesAbertos || [];
  imprimir(`${cabDoc('Ficha da demanda ' + d.protocolo, setor(d.setor_id)?.nome + ' · ' + (t?.nome || ''))}
    <h2 style="font-size:15px;margin:0 0 8px">${esc(d.titulo)}</h2>
    <p style="font-size:11px">${esc(d.descricao || '')}</p>
    <table><tbody>
      <tr><th>Situação</th><td>${ROTULO_STATUS[d.status]}</td><th>Onde está</th><td>${esc(posicaoDe(d))}</td></tr>
      <tr><th>Solicitante</th><td>${esc(nomeDe(d.solicitante_id))}</td><th>Responsável</th><td>${esc(d.responsavel_id ? nomeDe(d.responsavel_id) : '—')}</td></tr>
      <tr><th>Aberta em</th><td>${dataHoraBR(d.criada_em)}</td><th>Prazo</th><td>${dataBR(d.prazo)}</td></tr>
      <tr><th>Prioridade</th><td>${ROTULO_PRIOR[d.prioridade]}</td><th>Valor</th><td>${dinheiro(d.valor)}</td></tr>
      ${(t?.campos || []).filter(c => d.dados?.[c.chave]).map(c => `<tr><th>${esc(c.rotulo)}</th><td colspan="3">${esc(d.dados[c.chave])}</td></tr>`).join('')}
    </tbody></table>
    ${itens.length ? `<h3 style="font-size:12px;margin:14px 0 6px">Itens</h3><table>
      <thead><tr><th>Item</th><th>Qtd</th><th>Valor un.</th><th>Total</th></tr></thead>
      <tbody>${itens.map(i => `<tr><td>${esc(i.descricao)}</td><td>${num(i.quantidade)} ${esc(i.unidade||'')}</td>
        <td>${dinheiro(i.valor_unit)}</td><td>${dinheiro(n(i.quantidade)*n(i.valor_unit))}</td></tr>`).join('')}</tbody></table>` : ''}
    <h3 style="font-size:12px;margin:14px 0 6px">Histórico</h3><table>
      <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Observação</th></tr></thead>
      <tbody>${hist.map(h => `<tr><td>${dataHoraBR(h.criado_em)}</td><td>${esc(h.autor_nome||'')}</td>
        <td>${esc(descreverTramite(h))}</td><td>${esc(h.comentario||'')}</td></tr>`).join('')}</tbody></table>
    <p style="font-size:10px;margin-top:20px">_______________________________<br>Assinatura do responsável</p>`);
}
