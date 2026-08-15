/* ============================================================================
   ADMINISTRAÇÃO — só o administrador chega aqui.
   É onde se decide quem entra, em quais setores cada pessoa atua, como o
   fluxo de cada setor se organiza e o que cada tipo de demanda pergunta.
   ========================================================================== */
'use strict';

let adminAba = 'pessoas';
let setorEmFoco = '';
let convites = [];

function vAdmin(){
  const abas = [['pessoas','Pessoas e acessos'],['setores','Setores'],['fluxos','Fluxos e tipos']];
  return `
  <div class="titulo-tela"><div><h2>Administração</h2>
    <p>Cadastro de pessoas, setores e regras de tramitação.</p></div></div>
  <div class="bloco" style="padding:0">
    <div style="display:flex;gap:4px;padding:0 14px;border-bottom:1px solid var(--linha);overflow-x:auto">
      ${abas.map(([k, r]) => `<button class="aba" data-acao="admin-aba" data-k="${k}" aria-current="${adminAba === k}">${r}</button>`).join('')}
    </div>
  </div>
  ${adminAba === 'pessoas' ? blocoPessoas() : adminAba === 'setores' ? blocoSetores() : blocoFluxos()}`;
}

/* ======================================================================== */
/* PESSOAS E ACESSOS                                                         */
/* ======================================================================== */
function blocoPessoas(){
  return `
  <div class="bloco">
    <h3>Liberar novo acesso</h3>
    <div class="corpo">
      <p class="legenda">O usuário é criado aqui e a pessoa define a própria senha na tela de acesso, em "Defina sua senha". Sem liberação, ninguém entra.</p>
      <div class="linha-campos c3">
        <label class="campo"><span>Usuário <em>*</em></span><input id="cvUsuario" type="text" placeholder="maria.silva" autocapitalize="none"></label>
        <label class="campo"><span>Nome completo</span><input id="cvNome" type="text" placeholder="Maria Silva"></label>
        <label class="campo"><span>Papel</span><select id="cvPapel">
          <option value="solicitante">Solicitante</option>
          <option value="gestor">Gestor</option>
          <option value="admin">Administrador</option></select></label>
      </div>
      <div class="linha-campos c2">
        <label class="campo"><span>Matrícula</span><input id="cvMat" type="text"></label>
        <label class="campo"><span>Cargo</span><input id="cvCargo" type="text"></label>
      </div>
      <p class="legenda" style="margin-bottom:8px"><b>Setores que essa pessoa poderá acessar</b></p>
      <div class="grade g3" style="gap:8px;margin-bottom:14px">
        ${S.setores.map(s => `<div style="border:1px solid var(--linha);border-radius:8px;padding:10px">
          <div class="marca-setor" style="margin-bottom:6px"><i style="background:${esc(s.cor)}"></i>${esc(s.nome)}</div>
          <select data-cv-setor="${s.id}" style="padding:7px 9px;font-size:13px">
            <option value="">Sem acesso</option>
            <option value="acompanhar">Só acompanhar</option>
            <option value="solicitar">Abrir demandas</option>
            <option value="aprovar">Aprovar demandas</option>
            <option value="gerir">Gerir o setor</option>
          </select></div>`).join('')}
      </div>
      <button class="btn" data-acao="criar-convite">Liberar acesso</button>
    </div>
  </div>

  <div class="bloco">
    <h3>Liberações aguardando ativação<span class="conta" id="contaConvites">—</span></h3>
    <div id="listaConvites"><div class="carregando">Carregando…</div></div>
  </div>

  <div class="bloco">
    <h3>Equipe<span class="conta">${S.perfis.length} pessoa(s)</span></h3>
    <div class="rolagem"><table class="tabela">
      <thead><tr><th>Pessoa</th><th>Usuário</th><th>Papel</th><th>Setores liberados</th><th>Situação</th><th></th></tr></thead>
      <tbody>${S.perfis.map(p => {
        const meus = S.acessos.filter(a => a.perfil_id === p.id);
        return `<tr>
          <td><b>${esc(p.nome)}</b><div style="font-size:11.5px;color:var(--mute)">${esc(p.cargo || '')}</div></td>
          <td class="mono">${esc(p.usuario)}</td>
          <td><select data-papel="${p.id}" ${p.id === perfil.id ? 'disabled' : ''} style="padding:6px 8px;font-size:13px">
            ${['solicitante','gestor','admin'].map(x => `<option value="${x}" ${p.papel === x ? 'selected' : ''}>${x === 'admin' ? 'Administrador' : x === 'gestor' ? 'Gestor' : 'Solicitante'}</option>`).join('')}
          </select></td>
          <td>${p.papel === 'admin' ? '<span class="tag aprovada">todos os setores</span>'
            : meus.length ? meus.map(a => `<span class="tag em_analise" style="margin:1px">${esc(setor(a.setor_id)?.chave || '?')} · ${a.nivel}</span>`).join(' ')
            : '<span style="color:var(--mute);font-size:12px">nenhum</span>'}</td>
          <td>${p.ativo ? '<span class="tag aprovada">Ativo</span>' : '<span class="tag cancelada">Inativo</span>'}</td>
          <td class="dir" style="white-space:nowrap">
            <button class="btn mini sec" data-acao="editar-acessos" data-id="${p.id}">Acessos</button>
            ${p.id === perfil.id ? '' : `<button class="btn mini neutro" data-acao="alternar-ativo" data-id="${p.id}" data-ativo="${p.ativo}">${p.ativo ? 'Desativar' : 'Reativar'}</button>`}
          </td></tr>`;
      }).join('')}</tbody></table></div>
  </div>`;
}

async function carregarConvites(){
  if (adminAba !== 'pessoas' || !el('listaConvites')) return;
  const { data, error } = await sb.from('fp_convites').select('*').eq('usado', false).order('criado_em', { ascending:false });
  if (error){ el('listaConvites').innerHTML = `<div class="vazio">${esc(erroBanco(error))}</div>`; return; }
  convites = data || [];
  el('contaConvites').textContent = convites.length;
  el('listaConvites').innerHTML = convites.length
    ? `<div class="rolagem"><table class="tabela">
        <thead><tr><th>Usuário</th><th>Nome</th><th>Papel</th><th>Setores</th><th>Liberado em</th><th></th></tr></thead>
        <tbody>${convites.map(c => `<tr>
          <td class="mono"><b>${esc(c.usuario)}</b></td><td>${esc(c.nome || '—')}</td><td>${esc(c.papel)}</td>
          <td>${(c.acessos || []).map(a => `<span class="tag em_analise" style="margin:1px">${esc(setor(a.setor_id)?.chave || '?')}</span>`).join(' ') || '—'}</td>
          <td class="mono">${dataBR(c.criado_em)}</td>
          <td class="dir"><button class="btn mini neutro" data-acao="del-convite" data-id="${c.id}">Cancelar</button></td>
        </tr>`).join('')}</tbody></table></div>`
    : `<div class="vazio"><b>Nenhuma liberação pendente</b>Todo mundo que foi liberado já ativou o acesso.</div>`;
}

async function criarConvite(){
  const usuario = limparUsuario(el('cvUsuario').value);
  if (!usuario) return aviso('Informe o nome de usuário da pessoa.', 'ruim');
  const acessos = [];
  document.querySelectorAll('[data-cv-setor]').forEach(s => {
    if (s.value) acessos.push({ setor_id: s.dataset.cvSetor, nivel: s.value });
  });
  if (!acessos.length && el('cvPapel').value !== 'admin')
    return aviso('Escolha ao menos um setor para essa pessoa.', 'ruim');

  const { error } = await sb.from('fp_convites').insert({
    usuario, nome: el('cvNome').value.trim() || null, papel: el('cvPapel').value,
    matricula: el('cvMat').value.trim() || null, cargo: el('cvCargo').value.trim() || null,
    acessos
  });
  if (error) return aviso(erroBanco(error), 'ruim');
  el('cvUsuario').value = ''; el('cvNome').value = ''; el('cvMat').value = ''; el('cvCargo').value = '';
  document.querySelectorAll('[data-cv-setor]').forEach(s => s.value = '');
  carregarConvites();
  aviso(`Acesso liberado para "${usuario}". Passe esse usuário para a pessoa — ela define a senha na tela de acesso.`, 'bom');
}

function editarAcessos(id){
  const p = S.perfis.find(x => x.id === id);
  const meus = S.acessos.filter(a => a.perfil_id === id);
  modal(`Acessos de ${p.nome}`, `
    <p class="legenda">Defina o que essa pessoa faz em cada setor. "Aprovar" libera decisão sobre as demandas; "gerir" inclui cadastros do setor.</p>
    <div class="grade g2" style="gap:10px">
      ${S.setores.map(s => {
        const a = meus.find(x => x.setor_id === s.id);
        return `<div style="border:1px solid var(--linha);border-radius:8px;padding:11px">
          <div class="marca-setor" style="margin-bottom:7px"><i style="background:${esc(s.cor)}"></i>${esc(s.nome)}</div>
          <select data-ac-setor="${s.id}" style="padding:8px 10px;font-size:13.5px">
            <option value="">Sem acesso</option>
            ${['acompanhar','solicitar','aprovar','gerir'].map(nv =>
              `<option value="${nv}" ${a?.nivel === nv ? 'selected' : ''}>${
                nv === 'acompanhar' ? 'Só acompanhar' : nv === 'solicitar' ? 'Abrir demandas' : nv === 'aprovar' ? 'Aprovar demandas' : 'Gerir o setor'}</option>`).join('')}
          </select></div>`;
      }).join('')}
    </div>`,
    `<button class="btn neutro" data-acao="fechar-modal">Cancelar</button>
     <button class="btn" data-acao="salvar-acessos" data-id="${id}">Salvar acessos</button>`);
}

async function salvarAcessos(id){
  const novos = [];
  document.querySelectorAll('[data-ac-setor]').forEach(s => {
    if (s.value) novos.push({ perfil_id: id, setor_id: s.dataset.acSetor, nivel: s.value });
  });
  try {
    const { error: eD } = await sb.from('fp_acessos').delete().eq('perfil_id', id);
    if (eD) throw eD;
    if (novos.length){
      const { error } = await sb.from('fp_acessos').insert(novos);
      if (error) throw error;
    }
    await recarregar();
    fecharModal(); pintarAbas(); render();
    aviso('Acessos atualizados.', 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

/* ======================================================================== */
/* SETORES                                                                   */
/* ======================================================================== */
function blocoSetores(){
  return `
  <div class="bloco">
    <h3>Setores da plataforma<span class="conta">${S.setores.length}</span></h3>
    <div class="corpo">
      <p class="legenda">Cada setor tem base própria de demandas, fluxo próprio e acesso próprio. Cadastre quantos precisar — o sistema se adapta.</p>
      <button class="btn" data-acao="novo-setor">Novo setor</button>
    </div>
    <div class="rolagem"><table class="tabela">
      <thead><tr><th>Sigla</th><th>Setor</th><th>Recursos</th><th class="dir">Demandas</th><th class="dir">Etapas</th><th></th></tr></thead>
      <tbody>${S.setores.map(s => `<tr>
        <td><span class="protocolo leve">${esc(s.chave)}</span></td>
        <td><b>${esc(s.nome)}</b><div style="font-size:11.5px;color:var(--mute)">${esc(s.descricao || '')}</div></td>
        <td>${[s.usa_itens && 'itens', s.usa_valor && 'valores', s.usa_qr && 'etiqueta QR'].filter(Boolean)
          .map(x => `<span class="tag em_analise" style="margin:1px">${x}</span>`).join(' ') || '—'}</td>
        <td class="dir num">${S.demandas.filter(d => d.setor_id === s.id).length}</td>
        <td class="dir num">${etapasDe(s.id).length}</td>
        <td class="dir"><button class="btn mini sec" data-acao="editar-setor" data-id="${s.id}">Editar</button></td>
      </tr>`).join('')}</tbody></table></div>
  </div>`;
}

function formSetor(id){
  const s = id ? setor(id) : null;
  modal(s ? 'Editar setor' : 'Novo setor', `
    <div class="linha-campos c2">
      <label class="campo"><span>Sigla <em>*</em></span><input id="stChave" type="text" maxlength="4" value="${esc(s?.chave || '')}" placeholder="JUR" ${s ? 'disabled' : ''}></label>
      <label class="campo"><span>Nome <em>*</em></span><input id="stNome" type="text" value="${esc(s?.nome || '')}" placeholder="Jurídico"></label>
    </div>
    <label class="campo"><span>Descrição</span><input id="stDesc" type="text" value="${esc(s?.descricao || '')}" placeholder="O que esse setor atende"></label>
    <div class="linha-campos c2">
      <label class="campo"><span>Cor de identificação</span><input id="stCor" type="text" value="${esc(s?.cor || '#004A8D')}" placeholder="#004A8D"></label>
      <label class="campo"><span>Ordem de exibição</span><input id="stOrdem" type="number" value="${s?.ordem ?? S.setores.length + 1}"></label>
    </div>
    <p class="legenda" style="margin-bottom:6px"><b>Recursos do setor</b></p>
    <label class="marcador"><input type="checkbox" id="stItens" ${s?.usa_itens ? 'checked' : ''}> Demandas com lista de itens</label>
    <label class="marcador"><input type="checkbox" id="stValor" ${s?.usa_valor ? 'checked' : ''}> Demandas com valor em reais</label>
    <label class="marcador"><input type="checkbox" id="stQR" ${s?.usa_qr ? 'checked' : ''}> Movimentação física com etiqueta QR</label>
    ${s ? '' : `<p class="legenda" style="margin-top:12px">As estações do fluxo entram depois, na aba "Fluxos e tipos".</p>`}`,
    `<button class="btn neutro" data-acao="fechar-modal">Cancelar</button>
     <button class="btn" data-acao="salvar-setor" data-id="${s?.id || ''}">Salvar setor</button>`);
}

async function salvarSetor(id){
  const dados = {
    nome: el('stNome').value.trim(),
    descricao: el('stDesc').value.trim() || null,
    cor: el('stCor').value.trim() || '#004A8D',
    ordem: n(el('stOrdem').value),
    usa_itens: el('stItens').checked,
    usa_valor: el('stValor').checked,
    usa_qr: el('stQR').checked
  };
  if (!id) dados.chave = el('stChave').value.trim().toUpperCase();
  if (!dados.nome || (!id && !dados.chave)) return aviso('Sigla e nome são obrigatórios.', 'ruim');
  try {
    const { error } = id
      ? await sb.from('fp_setores').update(dados).eq('id', id)
      : await sb.from('fp_setores').insert(dados);
    if (error) throw error;
    await recarregar(); fecharModal(); pintarAbas(); render();
    aviso(id ? 'Setor atualizado.' : 'Setor criado. Agora monte o fluxo dele.', 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

/* ======================================================================== */
/* FLUXOS E TIPOS                                                            */
/* ======================================================================== */
function blocoFluxos(){
  const sid = setorEmFoco || S.setores[0]?.id || '';
  if (!sid) return `<div class="bloco"><div class="vazio"><b>Cadastre um setor primeiro</b></div></div>`;
  const et = etapasDe(sid), tps = S.tipos.filter(t => t.setor_id === sid);

  return `
  <div class="bloco">
    <div class="filtros">
      <label class="campo"><span>Setor</span><select data-filtro-setor-foco>
        ${S.setores.map(s => `<option value="${s.id}" ${sid === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}
      </select></label>
    </div>
  </div>

  <div class="bloco">
    <h3>Estações do fluxo<span class="conta">${et.length}</span></h3>
    <div class="corpo">
      <p class="legenda">A demanda caminha por estas estações — é o que o solicitante vê no trilho de acompanhamento.</p>
      <div class="linha-campos c3">
        <label class="campo"><span>Nome da estação</span><input id="etNome" type="text" placeholder="Ex.: Conferência de documentos"></label>
        <label class="campo"><span>Tipo</span><select id="etTipo">
          <option value="inicio">Entrada da demanda</option>
          <option value="andamento" selected>Andamento</option>
          <option value="aprovacao">Ponto de aprovação</option>
          <option value="final">Encerramento</option></select></label>
        <label class="campo"><span>Prazo (dias)</span><input id="etPrazo" type="number" value="2" min="0"></label>
      </div>
      <button class="btn sec" data-acao="add-etapa" data-id="${sid}">Incluir estação</button>
    </div>
    <div class="rolagem"><table class="tabela">
      <thead><tr><th>#</th><th>Estação</th><th>Tipo</th><th class="dir">Prazo</th><th></th></tr></thead>
      <tbody>${et.map(e => `<tr>
        <td class="mono">${e.ordem}</td><td><b>${esc(e.nome)}</b></td>
        <td><span class="tag ${e.tipo === 'aprovacao' ? 'em_andamento' : e.tipo === 'final' ? 'aprovada' : 'em_analise'}">${
          e.tipo === 'inicio' ? 'Entrada' : e.tipo === 'aprovacao' ? 'Aprovação' : e.tipo === 'final' ? 'Encerramento' : 'Andamento'}</span></td>
        <td class="dir num">${e.prazo_dias || 0} d</td>
        <td class="dir"><button class="btn mini neutro" data-acao="del-etapa" data-id="${e.id}">Remover</button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="vazio">Sem estações. Inclua ao menos uma de entrada e uma de encerramento.</td></tr>'}</tbody></table></div>
  </div>

  <div class="bloco">
    <h3>Tipos de demanda<span class="conta">${tps.length}</span></h3>
    <div class="corpo"><button class="btn" data-acao="novo-tipo" data-id="${sid}">Novo tipo</button></div>
    <div class="rolagem"><table class="tabela">
      <thead><tr><th>Tipo</th><th>Campos que pergunta</th><th class="dir">Prazo</th><th>Aprovação</th><th></th></tr></thead>
      <tbody>${tps.map(t => `<tr>
        <td><b>${esc(t.nome)}</b></td>
        <td>${(t.campos || []).map(c => `<span class="tag em_analise" style="margin:1px">${esc(c.rotulo)}</span>`).join(' ') || '—'}</td>
        <td class="dir num">${t.sla_dias} d</td>
        <td>${t.exige_aprovacao ? '<span class="tag aprovada">Sim</span>' : '<span class="tag cancelada">Não</span>'}</td>
        <td class="dir"><button class="btn mini sec" data-acao="editar-tipo" data-id="${t.id}">Editar</button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="vazio">Nenhum tipo cadastrado neste setor.</td></tr>'}</tbody></table></div>
  </div>`;
}

async function addEtapa(sid){
  const nome = el('etNome').value.trim();
  if (!nome) return aviso('Dê um nome à estação.', 'ruim');
  const ordem = (etapasDe(sid).length ? Math.max(...etapasDe(sid).map(e => e.ordem)) : 0) + 1;
  const { error } = await sb.from('fp_etapas').insert({
    setor_id: sid, nome, tipo: el('etTipo').value, prazo_dias: n(el('etPrazo').value), ordem
  });
  if (error) return aviso(erroBanco(error), 'ruim');
  await recarregar(); render();
  aviso('Estação incluída.', 'bom');
}

async function delEtapa(id){
  if (!confirm('Remover esta estação? Demandas paradas nela continuam existindo, mas ficam sem posição no trilho.')) return;
  const { error } = await sb.from('fp_etapas').delete().eq('id', id);
  if (error) return aviso(erroBanco(error), 'ruim');
  await recarregar(); render();
}

let camposEmEdicao = [];

function formTipo(id, sid){
  const t = id ? tipo(id) : null;
  camposEmEdicao = t ? JSON.parse(JSON.stringify(t.campos || [])) : [];
  modal(t ? 'Editar tipo de demanda' : 'Novo tipo de demanda', corpoFormTipo(t, sid),
    `<button class="btn neutro" data-acao="fechar-modal">Cancelar</button>
     <button class="btn" data-acao="salvar-tipo" data-id="${t?.id || ''}" data-setor="${t?.setor_id || sid}">Salvar tipo</button>`);
}

function corpoFormTipo(t, sid){
  return `
    <label class="campo"><span>Nome do tipo <em>*</em></span>
      <input id="tpNome" type="text" value="${esc(t?.nome || '')}" placeholder="Ex.: Pagamento a fornecedor"></label>
    <div class="linha-campos c2">
      <label class="campo"><span>Prazo de atendimento (dias)</span><input id="tpSla" type="number" min="0" value="${t?.sla_dias ?? 5}"></label>
      <label class="campo"><span>&nbsp;</span>
        <label class="marcador" style="margin:0"><input type="checkbox" id="tpAprova" ${t?.exige_aprovacao !== false ? 'checked' : ''}> Passa por aprovação</label></label>
    </div>
    <p class="legenda" style="margin-bottom:6px"><b>Campos que o solicitante preenche</b></p>
    <div id="listaCampos">${listaCamposHTML()}</div>
    <div class="linha-campos c3" style="margin-top:10px">
      <label class="campo"><span>Rótulo do campo</span><input id="cpRotulo" type="text" placeholder="Centro de custo"></label>
      <label class="campo"><span>Tipo</span><select id="cpTipo">
        <option value="texto">Texto</option><option value="longo">Texto longo</option>
        <option value="numero">Número</option><option value="data">Data</option><option value="lista">Lista de opções</option></select></label>
      <label class="campo"><span>Opções (separe por ;)</span><input id="cpOpcoes" type="text" placeholder="Boleto;PIX;Transferência"></label>
    </div>
    <div class="btn-linha">
      <label class="marcador" style="margin:0 8px 0 0"><input type="checkbox" id="cpObrig" checked> Obrigatório</label>
      <button class="btn sec mini" data-acao="add-campo">Incluir campo</button>
    </div>`;
}

function listaCamposHTML(){
  if (!camposEmEdicao.length) return `<p class="legenda" style="margin:0">Nenhum campo extra — o tipo pedirá só assunto, detalhamento e prazo.</p>`;
  return `<table class="tabela"><tbody>${camposEmEdicao.map((c, i) => `<tr>
    <td><b>${esc(c.rotulo)}</b>${c.obrigatorio ? ' <span class="tag urgente">obrigatório</span>' : ''}
      <div style="font-size:11.5px;color:var(--mute)">${esc(c.tipo)}${c.opcoes?.length ? ' · ' + esc(c.opcoes.join(', ')) : ''}</div></td>
    <td class="dir"><button class="btn mini neutro" data-acao="del-campo" data-id="${i}">Remover</button></td>
  </tr>`).join('')}</tbody></table>`;
}

function addCampo(){
  const rotulo = el('cpRotulo').value.trim();
  if (!rotulo) return aviso('Informe o rótulo do campo.', 'ruim');
  const opcoes = el('cpOpcoes').value.split(';').map(x => x.trim()).filter(Boolean);
  camposEmEdicao.push({
    chave: semAcento(rotulo).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'campo' + camposEmEdicao.length,
    rotulo, tipo: el('cpTipo').value, obrigatorio: el('cpObrig').checked,
    ...(opcoes.length ? { opcoes } : {})
  });
  el('listaCampos').innerHTML = listaCamposHTML();
  el('cpRotulo').value = ''; el('cpOpcoes').value = '';
}

async function salvarTipo(id, sid){
  const dados = {
    setor_id: sid,
    nome: el('tpNome').value.trim(),
    sla_dias: n(el('tpSla').value),
    exige_aprovacao: el('tpAprova').checked,
    campos: camposEmEdicao
  };
  if (!dados.nome) return aviso('Informe o nome do tipo.', 'ruim');
  try {
    const { error } = id
      ? await sb.from('fp_tipos').update(dados).eq('id', id)
      : await sb.from('fp_tipos').insert(dados);
    if (error) throw error;
    await recarregar(); fecharModal(); render();
    aviso(id ? 'Tipo atualizado.' : 'Tipo criado.', 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}
