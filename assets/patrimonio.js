/* ============================================================================
   PATRIMÔNIO E ALMOXARIFADO — o que se move fisicamente.
   Toda movimentação começa por uma etiqueta: bipa o QR, confirma, pronto.
   ========================================================================== */
'use strict';

const setorPAT = () => setorPor('PAT');
const setorALM = () => setorPor('ALM');
const abaixoMinimo = p => p.estoque <= p.minimo;

/* ------------------------------------------------------------- LEITOR ---- */
function leitorHTML(dica){
  return `<div class="leitor">
    <h4>Leitura de etiqueta</h4>
    <div class="linha-bip">
      <input id="campoBip" type="text" inputmode="text" autocomplete="off" placeholder="Bipe o código ou digite">
      <button class="btn" data-acao="ler-campo">Buscar</button>
      <button class="btn" data-acao="camera">Câmera</button>
    </div>
    <div class="dica">${esc(dica)}</div>
    <div id="cam"></div>
  </div>`;
}

async function pararCamera(){
  if (!leitorCam) return;
  try { await leitorCam.stop(); leitorCam.clear(); } catch(e){}
  leitorCam = null;
  const c = el('cam'); if (c) c.innerHTML = '';
}

async function abrirCamera(){
  if (leitorCam) return pararCamera();
  if (typeof Html5Qrcode === 'undefined') return aviso('Leitor de câmera indisponível nesta conexão.', 'ruim');
  el('cam').innerHTML = '<div id="camAlvo"></div>';
  try {
    leitorCam = new Html5Qrcode('camAlvo');
    await leitorCam.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 },
      txt => { pararCamera(); tratarLeitura(txt); },
      () => {});
  } catch(e){
    el('cam').innerHTML = '';
    aviso('Não consegui abrir a câmera. Autorize o acesso no navegador.', 'ruim');
  }
}

function lerCampo(){
  const c = el('campoBip');
  if (!c || !c.value.trim()) return;
  const v = c.value; c.value = '';
  tratarLeitura(v);
}

function tratarLeitura(texto){
  const { codigo } = lidoDaEtiqueta(texto);
  const bem = bemPorTombo(codigo);
  if (bem) return fichaBem(bem.id);
  const prod = produtoPorCodigo(codigo);
  if (prod) return fichaMovimento(prod.id, 'saida');
  const dem = S.demandas.find(d => d.protocolo.toUpperCase() === codigo.toUpperCase());
  if (dem) return abrirDemanda(dem.id);
  aviso(`Nada encontrado para "${codigo}".`, 'ruim');
}

/* ======================================================================== */
/* PATRIMÔNIO                                                                */
/* ======================================================================== */
function filtrarBens(){
  return S.bens.filter(b => {
    if (F.bSetor && b.setor_id !== F.bSetor) return false;
    if (F.bSituacao && b.situacao !== F.bSituacao) return false;
    if (F.bBusca && !contem([b.tombo, b.descricao, b.categoria, b.marca, b.modelo, b.local, b.serie].join(' '), F.bBusca)) return false;
    return true;
  });
}

function vPatrimonio(){
  const s = setorPAT();
  const pode = s && podeAprovar(s.id);
  const lista = filtrarBens();
  const total = lista.reduce((a, b) => a + n(b.valor), 0);

  return `
  <div class="titulo-tela"><div><h2>Patrimônio</h2>
    <p>${S.bens.length} bem(ns) cadastrado(s) · ${dinheiro(total)} no filtro atual</p></div>
    <div class="acoes">
      ${pode ? `<button class="btn" data-acao="novo-bem">Cadastrar bem</button>` : ''}
      <button class="btn sec" data-acao="exportar-bens">Exportar CSV</button>
    </div></div>

  ${pode ? `<div style="margin-bottom:18px">${leitorHTML('Aponte a câmera para a etiqueta do bem ou digite o número de tombo.')}</div>` : ''}

  <div class="bloco">
    <h3>Bens<span class="conta">${lista.length} de ${S.bens.length}</span></h3>
    <div class="filtros">
      <label class="campo"><span>Buscar</span>
        <input type="search" data-vivo="bBusca" value="${esc(F.bBusca)}" placeholder="Tombo, descrição, marca, local…"></label>
      <label class="campo"><span>Setor responsável</span><select data-filtro="bSetor">
        <option value="">Todos</option>
        ${S.setores.map(x => `<option value="${x.id}" ${F.bSetor === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}
      </select></label>
      <label class="campo"><span>Situação</span><select data-filtro="bSituacao">
        <option value="">Todas</option>
        ${Object.entries(ROTULO_SITUACAO).map(([k, v]) => `<option value="${k}" ${F.bSituacao === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select></label>
    </div>
    ${lista.length ? `<div class="rolagem"><table class="tabela">
      <thead><tr><th>Tombo</th><th>Bem</th><th>Local atual</th><th>Responsável</th><th>Situação</th><th class="dir">Valor</th><th></th></tr></thead>
      <tbody>${lista.slice(0, 200).map(b => `<tr>
        <td class="mono"><b>${esc(b.tombo)}</b></td>
        <td>${esc(b.descricao)}<div style="font-size:11.5px;color:var(--mute)">${esc([b.marca, b.modelo].filter(Boolean).join(' · '))}</div></td>
        <td>${esc(b.local || '—')}</td>
        <td>${b.responsavel_id ? esc(nomeDe(b.responsavel_id)) : '—'}</td>
        <td><span class="tag ${b.situacao === 'baixado' ? 'cancelada' : b.situacao === 'manutencao' ? 'em_andamento' : 'aprovada'}">${ROTULO_SITUACAO[b.situacao]}</span></td>
        <td class="dir num">${dinheiro(b.valor)}</td>
        <td class="dir"><button class="btn mini sec" data-acao="ficha-bem" data-id="${b.id}">Abrir</button></td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="vazio"><b>Nenhum bem no filtro</b>Cadastre um bem ou limpe os filtros.</div>`}
  </div>`;
}

function fichaBem(id){
  const b = S.bens.find(x => x.id === id);
  if (!b) return aviso('Bem não encontrado.', 'ruim');
  const s = setorPAT();
  const pode = s && podeAprovar(s.id);
  const hist = S.bemMov.filter(m => m.bem_id === id).slice(0, 12);

  modal(`Bem ${b.tombo}`, `
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
      <div style="flex:1;min-width:200px">
        <h3 style="font-size:17px;margin-bottom:6px">${esc(b.descricao)}</h3>
        <div class="campos-dados" style="margin-top:12px">
          <div><div class="r">Categoria</div><div class="v">${esc(b.categoria || '—')}</div></div>
          <div><div class="r">Marca / modelo</div><div class="v">${esc([b.marca, b.modelo].filter(Boolean).join(' · ') || '—')}</div></div>
          <div><div class="r">Nº de série</div><div class="v mono">${esc(b.serie || '—')}</div></div>
          <div><div class="r">Local atual</div><div class="v">${esc(b.local || '—')}</div></div>
          <div><div class="r">Responsável</div><div class="v">${b.responsavel_id ? esc(nomeDe(b.responsavel_id)) : '—'}</div></div>
          <div><div class="r">Situação</div><div class="v">${ROTULO_SITUACAO[b.situacao]}</div></div>
          <div><div class="r">Aquisição</div><div class="v">${dataBR(b.aquisicao)} · ${dinheiro(b.valor)}</div></div>
          <div><div class="r">Nota fiscal</div><div class="v">${esc(b.nota_fiscal || '—')}</div></div>
        </div>
      </div>
      <div style="text-align:center">
        <div data-qr="${esc(urlEtiqueta('b', b.tombo))}" data-tam="104"></div>
        <div class="mono" style="font-size:11px;margin-top:6px">${esc(b.tombo)}</div>
      </div>
    </div>

    ${pode ? `<div style="border-top:1px solid var(--linha);margin-top:16px;padding-top:16px">
      <h4 style="font-family:'Archivo';font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--azul);margin-bottom:12px">Movimentar bem</h4>
      <div class="linha-campos c2">
        <label class="campo"><span>Novo local</span><input id="bmLocal" type="text" value="${esc(b.local || '')}" placeholder="Sala, andar, unidade"></label>
        <label class="campo"><span>Situação</span><select id="bmSituacao">
          ${Object.entries(ROTULO_SITUACAO).map(([k, v]) => `<option value="${k}" ${b.situacao === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select></label>
      </div>
      <div class="linha-campos c2">
        <label class="campo"><span>Responsável</span><select id="bmResp"><option value="">—</option>
          ${S.perfis.filter(p => p.ativo).map(p => `<option value="${p.id}" ${p.id === b.responsavel_id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
        </select></label>
        <label class="campo"><span>Motivo</span><input id="bmMotivo" type="text" placeholder="Transferência, manutenção, devolução…"></label>
      </div>
    </div>` : ''}

    ${hist.length ? `<div style="border-top:1px solid var(--linha);margin-top:16px;padding-top:12px">
      <h4 style="font-family:'Archivo';font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--azul);margin-bottom:8px">Últimas movimentações</h4>
      <table class="tabela"><tbody>${hist.map(m => `<tr>
        <td class="mono" style="white-space:nowrap">${dataHoraBR(m.data)}</td>
        <td>${esc(m.de_local || '—')} → <b>${esc(m.para_local || '—')}</b><div style="font-size:11.5px;color:var(--mute)">${esc(m.motivo || '')} · ${esc(m.autor_nome || '')}</div></td>
      </tr>`).join('')}</tbody></table></div>` : ''}`,
    `${pode ? `<button class="btn sec" data-acao="editar-bem" data-id="${b.id}">Editar cadastro</button>
      <button class="btn" data-acao="mover-bem" data-id="${b.id}">Registrar movimentação</button>` : ''}
     <button class="btn neutro" data-acao="fechar-modal">Fechar</button>`);

  document.querySelectorAll('[data-qr]').forEach(d => gerarQR(d, d.dataset.qr, Number(d.dataset.tam || 76)));
}

async function moverBem(id){
  const b = S.bens.find(x => x.id === id);
  const local = el('bmLocal').value.trim();
  const situacao = el('bmSituacao').value;
  const resp = el('bmResp').value || null;
  const motivo = el('bmMotivo').value.trim();
  if (local === (b.local || '') && situacao === b.situacao && resp === (b.responsavel_id || null))
    return aviso('Nada mudou. Ajuste local, situação ou responsável.', 'ruim');

  try {
    const { error } = await sb.from('fp_bens').update({ local, situacao, responsavel_id: resp }).eq('id', id);
    if (error) throw error;
    await sb.from('fp_bem_mov').insert({
      bem_id: id, de_local: b.local, para_local: local,
      de_situacao: b.situacao, para_situacao: situacao,
      responsavel: resp ? nomeDe(resp) : null, motivo: motivo || null,
      autor_id: perfil.id, autor_nome: perfil.nome
    });
    await recarregar();
    fecharModal(); render();
    aviso(`Bem ${b.tombo} movimentado.`, 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

function formBem(id){
  const b = id ? S.bens.find(x => x.id === id) : null;
  modal(b ? 'Editar bem' : 'Cadastrar bem', `
    <div class="linha-campos c2">
      <label class="campo"><span>Nº de tombo <em>*</em></span><input id="bTombo" type="text" value="${esc(b?.tombo || sugerirTombo())}"></label>
      <label class="campo"><span>Categoria</span><input id="bCat" type="text" value="${esc(b?.categoria || '')}" placeholder="Mobiliário, informática…"></label>
    </div>
    <label class="campo"><span>Descrição <em>*</em></span><input id="bDesc" type="text" value="${esc(b?.descricao || '')}" placeholder="Ex.: Notebook Dell Latitude 5440"></label>
    <div class="linha-campos c3">
      <label class="campo"><span>Marca</span><input id="bMarca" type="text" value="${esc(b?.marca || '')}"></label>
      <label class="campo"><span>Modelo</span><input id="bModelo" type="text" value="${esc(b?.modelo || '')}"></label>
      <label class="campo"><span>Nº de série</span><input id="bSerie" type="text" value="${esc(b?.serie || '')}"></label>
    </div>
    <div class="linha-campos c2">
      <label class="campo"><span>Setor responsável</span><select id="bSetor"><option value="">—</option>
        ${S.setores.map(x => `<option value="${x.id}" ${b?.setor_id === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
      <label class="campo"><span>Local</span><input id="bLocal" type="text" value="${esc(b?.local || '')}" placeholder="Sala 204 · 2º andar"></label>
    </div>
    <div class="linha-campos c3">
      <label class="campo"><span>Situação</span><select id="bSit">
        ${Object.entries(ROTULO_SITUACAO).map(([k, v]) => `<option value="${k}" ${b?.situacao === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="campo"><span>Valor (R$)</span><input id="bValor" type="number" step="0.01" value="${b?.valor || ''}"></label>
      <label class="campo"><span>Aquisição</span><input id="bAq" type="date" value="${b?.aquisicao || ''}"></label>
    </div>
    <div class="linha-campos c2">
      <label class="campo"><span>Nota fiscal</span><input id="bNF" type="text" value="${esc(b?.nota_fiscal || '')}"></label>
      <label class="campo"><span>Responsável</span><select id="bResp"><option value="">—</option>
        ${S.perfis.filter(p => p.ativo).map(p => `<option value="${p.id}" ${b?.responsavel_id === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
    </div>
    <label class="campo"><span>Observação</span><textarea id="bObs">${esc(b?.observacao || '')}</textarea></label>`,
    `<button class="btn neutro" data-acao="fechar-modal">Cancelar</button>
     <button class="btn" data-acao="salvar-bem" data-id="${b?.id || ''}">Salvar bem</button>`);
}

function sugerirTombo(){
  const nums = S.bens.map(b => parseInt(String(b.tombo).replace(/\D/g,''), 10)).filter(x => !isNaN(x));
  const prox = (nums.length ? Math.max(...nums) : 0) + 1;
  return 'PAT' + String(prox).padStart(5, '0');
}

async function salvarBem(id){
  const dados = {
    tombo: el('bTombo').value.trim().toUpperCase(),
    descricao: el('bDesc').value.trim(),
    categoria: el('bCat').value.trim() || null,
    marca: el('bMarca').value.trim() || null,
    modelo: el('bModelo').value.trim() || null,
    serie: el('bSerie').value.trim() || null,
    setor_id: el('bSetor').value || null,
    local: el('bLocal').value.trim() || null,
    situacao: el('bSit').value,
    valor: n(el('bValor').value),
    aquisicao: el('bAq').value || null,
    nota_fiscal: el('bNF').value.trim() || null,
    responsavel_id: el('bResp').value || null,
    observacao: el('bObs').value.trim() || null
  };
  if (!dados.tombo || !dados.descricao) return aviso('Tombo e descrição são obrigatórios.', 'ruim');
  try {
    const { error } = id
      ? await sb.from('fp_bens').update(dados).eq('id', id)
      : await sb.from('fp_bens').insert(dados);
    if (error) throw error;
    await recarregar(); fecharModal(); render();
    aviso(id ? 'Bem atualizado.' : `Bem ${dados.tombo} cadastrado. Imprima a etiqueta na aba Etiquetas QR.`, 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

/* ======================================================================== */
/* ALMOXARIFADO                                                              */
/* ======================================================================== */
function filtrarProdutos(){
  return S.produtos.filter(p => {
    if (F.pCat && p.categoria !== F.pCat) return false;
    if (F.pBaixo && !abaixoMinimo(p)) return false;
    if (F.pBusca && !contem([p.codigo, p.nome, p.categoria, p.local].join(' '), F.pBusca)) return false;
    return true;
  });
}

function vAlmoxarifado(){
  const s = setorALM();
  const pode = s && podeAprovar(s.id);
  const lista = filtrarProdutos();
  const faltando = S.produtos.filter(abaixoMinimo);
  const cats = [...new Set(S.produtos.map(p => p.categoria).filter(Boolean))].sort();
  const hojeStr = hoje();
  const saidasHoje = S.movimentos.filter(m => m.tipo === 'saida' && diaDe(m.data) === hojeStr);

  return `
  <div class="titulo-tela"><div><h2>Almoxarifado</h2>
    <p>${S.produtos.length} item(ns) em estoque · ${faltando.length} abaixo do mínimo</p></div>
    <div class="acoes">
      ${pode ? `<button class="btn" data-acao="novo-produto">Novo item</button>` : ''}
      <button class="btn sec" data-acao="exportar-estoque">Exportar CSV</button>
    </div></div>

  <div class="kpis">
    <div class="kpi"><div class="rot">Itens cadastrados</div><div class="val">${S.produtos.length}</div><div class="sub">${cats.length} categoria(s)</div></div>
    <div class="kpi ${faltando.length ? 'grave' : 'bom'}"><div class="rot">Abaixo do mínimo</div><div class="val">${faltando.length}</div><div class="sub">precisam de reposição</div></div>
    <div class="kpi"><div class="rot">Saídas hoje</div><div class="val">${saidasHoje.length}</div><div class="sub">${dataBR(hojeStr)}</div></div>
    <div class="kpi"><div class="rot">Valor em estoque</div><div class="val" style="font-size:24px">${dinheiro(S.produtos.reduce((a,p) => a + p.estoque * p.preco, 0))}</div><div class="sub">a preço de cadastro</div></div>
  </div>

  ${pode ? `<div style="margin-bottom:18px">${leitorHTML('Bipe a etiqueta do material para dar baixa. Também funciona digitando o código.')}</div>` : ''}

  ${faltando.length ? `<div class="bloco">
    <h3>Reposição necessária<span class="conta">${faltando.length}</span></h3>
    <div class="rolagem"><table class="tabela">
      <thead><tr><th>Código</th><th>Item</th><th class="dir">Saldo</th><th class="dir">Mínimo</th><th class="dir">Sugestão de compra</th></tr></thead>
      <tbody>${faltando.map(p => `<tr>
        <td class="mono">${esc(p.codigo)}</td><td>${esc(p.nome)}</td>
        <td class="dir num baixo">${num(p.estoque)} ${esc(p.unidade)}</td>
        <td class="dir num">${num(p.minimo)}</td>
        <td class="dir num">${num(Math.max(p.maximo - p.estoque, p.minimo))} ${esc(p.unidade)}</td>
      </tr>`).join('')}</tbody></table></div>
  </div>` : ''}

  <div class="bloco">
    <h3>Estoque<span class="conta">${lista.length} de ${S.produtos.length}</span></h3>
    <div class="filtros">
      <label class="campo"><span>Buscar</span><input type="search" data-vivo="pBusca" value="${esc(F.pBusca)}" placeholder="Código, nome, local…"></label>
      <label class="campo"><span>Categoria</span><select data-filtro="pCat"><option value="">Todas</option>
        ${cats.map(c => `<option ${F.pCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <div><label class="marcador"><input type="checkbox" data-filtro="pBaixo" ${F.pBaixo ? 'checked' : ''}> Só abaixo do mínimo</label></div>
    </div>
    ${lista.length ? `<div class="rolagem"><table class="tabela">
      <thead><tr><th>Código</th><th>Item</th><th>Local</th><th class="dir">Saldo</th><th class="dir">Mín.</th><th class="dir">Preço</th><th></th></tr></thead>
      <tbody>${lista.slice(0, 200).map(p => `<tr>
        <td class="mono">${esc(p.codigo)}</td>
        <td>${esc(p.nome)}<div style="font-size:11.5px;color:var(--mute)">${esc(p.categoria || '')}</div></td>
        <td>${esc(p.local || '—')}</td>
        <td class="dir num ${abaixoMinimo(p) ? 'baixo' : ''}">${num(p.estoque)} ${esc(p.unidade)}</td>
        <td class="dir num">${num(p.minimo)}</td>
        <td class="dir num">${dinheiro(p.preco)}</td>
        <td class="dir">${pode ? `<button class="btn mini sec" data-acao="mov-saida" data-id="${p.id}">Baixa</button>
          <button class="btn mini neutro" data-acao="mov-entrada" data-id="${p.id}">Entrada</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="vazio"><b>Estoque vazio</b>Cadastre o primeiro item do almoxarifado.</div>`}
  </div>

  <div class="bloco">
    <h3>Últimas movimentações</h3>
    <div class="rolagem"><table class="tabela">
      <thead><tr><th>Quando</th><th>Item</th><th>Tipo</th><th class="dir">Qtd</th><th>Destino</th><th>Quem registrou</th></tr></thead>
      <tbody>${S.movimentos.slice(0, 25).map(m => {
        const p = S.produtos.find(x => x.id === m.produto_id);
        return `<tr><td class="mono" style="white-space:nowrap">${dataHoraBR(m.data)}</td>
          <td>${esc(p?.nome || '—')}</td>
          <td><span class="tag ${m.tipo === 'saida' ? 'em_andamento' : 'aprovada'}">${m.tipo === 'saida' ? 'Saída' : m.tipo === 'entrada' ? 'Entrada' : 'Ajuste'}</span></td>
          <td class="dir num">${num(m.qtd)}</td>
          <td>${esc(m.destino || '—')}${m.solicitante ? `<div style="font-size:11.5px;color:var(--mute)">${esc(m.solicitante)}</div>` : ''}</td>
          <td>${esc(m.autor_nome || '—')}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="vazio">Sem movimentações registradas.</td></tr>'}</tbody></table></div>
  </div>`;
}

function fichaMovimento(produtoId, tipoMov){
  const p = S.produtos.find(x => x.id === produtoId);
  if (!p) return aviso('Item não encontrado.', 'ruim');
  const saida = tipoMov === 'saida';
  modal(`${saida ? 'Baixa' : 'Entrada'} · ${p.nome}`, `
    <div style="display:flex;justify-content:space-between;gap:14px;align-items:baseline;padding-bottom:12px;border-bottom:1px dashed var(--linha)">
      <div><span class="protocolo leve">${esc(p.codigo)}</span>
        <div style="font-size:12px;color:var(--mute);margin-top:6px">${esc(p.local || 'sem local definido')}</div></div>
      <div style="text-align:right"><div class="rot" style="font-size:10px;color:var(--mute);text-transform:uppercase">Saldo atual</div>
        <div style="font-family:'Archivo';font-weight:800;font-size:28px" class="${abaixoMinimo(p) ? 'baixo' : ''}">${num(p.estoque)}</div>
        <div class="mono" style="font-size:11px;color:var(--mute)">${esc(p.unidade)}</div></div>
    </div>
    <div class="linha-campos c2" style="margin-top:14px">
      <label class="campo"><span>Quantidade <em>*</em></span><input id="mvQtd" type="number" step="0.001" min="0.001" value="1"></label>
      <label class="campo"><span>${saida ? 'Setor de destino' : 'Nota fiscal / documento'}</span>
        ${saida ? `<select id="mvDestino">${S.setores.map(x => `<option>${esc(x.nome)}</option>`).join('')}<option value="__outro">Outro destino…</option></select>`
                : `<input id="mvDoc" type="text" placeholder="NF 12345">`}</label>
    </div>
    <label class="campo"><span>${saida ? 'Quem está retirando' : 'Fornecedor'}</span>
      <input id="mvQuem" type="text" placeholder="${saida ? 'Nome de quem leva o material' : 'Nome do fornecedor'}"></label>
    <label class="campo"><span>Vincular a uma demanda (opcional)</span>
      <select id="mvDemanda"><option value="">Sem vínculo</option>
        ${S.demandas.filter(d => ABERTAS.includes(d.status)).slice(0, 60).map(d =>
          `<option value="${d.id}">${esc(d.protocolo)} · ${esc(d.titulo.slice(0, 48))}</option>`).join('')}
      </select></label>`,
    `<button class="btn neutro" data-acao="fechar-modal">Cancelar</button>
     <button class="btn ${saida ? '' : 'ok'}" data-acao="confirmar-mov" data-id="${p.id}" data-tipo="${tipoMov}">Confirmar ${saida ? 'baixa' : 'entrada'}</button>`);
  setTimeout(() => { const q = el('mvQtd'); if (q){ q.focus(); q.select(); } }, 100);
}

async function confirmarMovimento(produtoId, tipoMov, botao){
  const qtd = n(el('mvQtd').value);
  if (qtd <= 0) return aviso('Informe uma quantidade maior que zero.', 'ruim');
  const p = S.produtos.find(x => x.id === produtoId);
  if (tipoMov === 'saida' && qtd > p.estoque) return aviso(`Saldo insuficiente: há ${num(p.estoque)} ${p.unidade}.`, 'ruim');

  botao.disabled = true; botao.textContent = 'Registrando…';
  try {
    const destinoEl = el('mvDestino');
    const { error } = await sb.rpc('fp_mover_estoque', {
      p_produto: produtoId, p_tipo: tipoMov, p_qtd: qtd,
      p_destino: destinoEl ? destinoEl.value : null,
      p_solicitante: el('mvQuem').value.trim() || null,
      p_documento: el('mvDoc') ? el('mvDoc').value.trim() : null,
      p_demanda: el('mvDemanda').value || null
    });
    if (error) throw error;

    const dem = el('mvDemanda').value;
    if (dem) await registrar(dem, {
      acao: 'movimentacao', para: tipoMov === 'saida' ? 'material entregue' : 'material recebido',
      local: destinoEl ? destinoEl.value : null,
      comentario: `${tipoMov === 'saida' ? 'Baixa' : 'Entrada'} de ${num(qtd)} ${p.unidade} · ${p.nome} (${p.codigo}).`
    });

    await recarregar();
    fecharModal(); render();
    aviso(`${tipoMov === 'saida' ? 'Baixa' : 'Entrada'} registrada: ${num(qtd)} ${p.unidade} de ${p.nome}.`, 'bom');
  } catch(e){
    botao.disabled = false; botao.textContent = 'Confirmar';
    aviso(erroBanco(e), 'ruim');
  }
}

function formProduto(id){
  const p = id ? S.produtos.find(x => x.id === id) : null;
  modal(p ? 'Editar item' : 'Novo item do almoxarifado', `
    <div class="linha-campos c2">
      <label class="campo"><span>Código <em>*</em></span><input id="pCod" type="text" value="${esc(p?.codigo || sugerirCodigo())}"></label>
      <label class="campo"><span>Categoria</span><input id="pCat" type="text" value="${esc(p?.categoria || 'Geral')}"></label>
    </div>
    <label class="campo"><span>Nome do item <em>*</em></span><input id="pNome" type="text" value="${esc(p?.nome || '')}"></label>
    <div class="linha-campos c3">
      <label class="campo"><span>Unidade</span><input id="pUn" type="text" value="${esc(p?.unidade || 'un')}"></label>
      <label class="campo"><span>Estoque mínimo</span><input id="pMin" type="number" step="0.001" value="${p?.minimo ?? 0}"></label>
      <label class="campo"><span>Estoque máximo</span><input id="pMax" type="number" step="0.001" value="${p?.maximo ?? 0}"></label>
    </div>
    <div class="linha-campos c3">
      <label class="campo"><span>Preço unitário (R$)</span><input id="pPreco" type="number" step="0.01" value="${p?.preco ?? 0}"></label>
      <label class="campo"><span>Local na prateleira</span><input id="pLocal" type="text" value="${esc(p?.local || '')}" placeholder="Corredor B · prateleira 3"></label>
      ${p ? '' : `<label class="campo"><span>Saldo inicial</span><input id="pEst" type="number" step="0.001" value="0"></label>`}
    </div>
    <label class="campo"><span>Fornecedor</span><select id="pForn"><option value="">—</option>
      ${S.fornecedores.map(f => `<option value="${f.id}" ${p?.fornecedor_id === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>`,
    `<button class="btn neutro" data-acao="fechar-modal">Cancelar</button>
     <button class="btn" data-acao="salvar-produto" data-id="${p?.id || ''}">Salvar item</button>`);
}

function sugerirCodigo(){
  const nums = S.produtos.map(p => parseInt(String(p.codigo).replace(/\D/g,''), 10)).filter(x => !isNaN(x));
  return 'ALM' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
}

async function salvarProduto(id){
  const dados = {
    codigo: el('pCod').value.trim().toUpperCase(),
    nome: el('pNome').value.trim(),
    categoria: el('pCat').value.trim() || 'Geral',
    unidade: el('pUn').value.trim() || 'un',
    minimo: n(el('pMin').value), maximo: n(el('pMax').value),
    preco: n(el('pPreco').value),
    local: el('pLocal').value.trim() || null,
    fornecedor_id: el('pForn').value || null
  };
  if (!dados.codigo || !dados.nome) return aviso('Código e nome são obrigatórios.', 'ruim');
  try {
    let error;
    if (id) ({ error } = await sb.from('fp_produtos').update(dados).eq('id', id));
    else {
      dados.estoque = n(el('pEst').value);
      ({ error } = await sb.from('fp_produtos').insert(dados));
    }
    if (error) throw error;
    await recarregar(); fecharModal(); render();
    aviso(id ? 'Item atualizado.' : `Item ${dados.codigo} cadastrado.`, 'bom');
  } catch(e){ aviso(erroBanco(e), 'ruim'); }
}

/* ======================================================================== */
/* ETIQUETAS QR                                                              */
/* ======================================================================== */
function vEtiquetas(){
  const bens = F.eTipo === 'bens';
  const fonte = bens ? S.bens : S.produtos;
  const lista = fonte.filter(x => !F.eBusca || contem(bens ? `${x.tombo} ${x.descricao}` : `${x.codigo} ${x.nome}`, F.eBusca));

  return `
  <div class="titulo-tela"><div><h2>Etiquetas QR</h2>
    <p>Cada etiqueta abre direto a ficha do item no celular de quem bipar.</p></div>
    <div class="acoes">
      <button class="btn sec" data-acao="etq-todas">Marcar todas</button>
      <button class="btn neutro" data-acao="etq-nenhuma">Limpar</button>
      <button class="btn" data-acao="imprimir-etq" ${etqSel.size ? '' : 'disabled'}>Imprimir selecionadas</button>
    </div></div>

  <div class="bloco">
    <h3>Selecionar<span class="conta" id="contaEtq">${etqSel.size} selecionada(s)</span></h3>
    <div class="filtros">
      <label class="campo"><span>O que etiquetar</span><select data-filtro="eTipo">
        <option value="bens" ${bens ? 'selected' : ''}>Bens do patrimônio</option>
        <option value="produtos" ${!bens ? 'selected' : ''}>Materiais do almoxarifado</option>
      </select></label>
      <label class="campo"><span>Buscar</span><input type="search" data-vivo="eBusca" value="${esc(F.eBusca)}" placeholder="Código ou descrição"></label>
    </div>
    ${lista.length ? `<div class="etiquetas">${lista.slice(0, 150).map(x => {
      const cod = bens ? x.tombo : x.codigo;
      const nome = bens ? x.descricao : x.nome;
      return `<div class="etq ${etqSel.has(x.id) ? 'marcada' : ''}">
        <div class="qr" data-qr="${esc(urlEtiqueta(bens ? 'b' : 'p', cod))}" data-tam="86"></div>
        <div class="cod">${esc(cod)}</div><div class="nm">${esc(nome)}</div>
        <label><input type="checkbox" data-etq="${x.id}" ${etqSel.has(x.id) ? 'checked' : ''}> imprimir</label>
      </div>`;
    }).join('')}</div>`
      : `<div class="vazio"><b>Nada para etiquetar</b>Cadastre bens ou materiais primeiro.</div>`}
  </div>`;
}

function imprimirEtiquetas(){
  const bens = F.eTipo === 'bens';
  const fonte = (bens ? S.bens : S.produtos).filter(x => etqSel.has(x.id));
  if (!fonte.length) return aviso('Selecione ao menos uma etiqueta.', 'ruim');
  imprimir(`${cabDoc('Etiquetas patrimoniais', `${fonte.length} etiqueta(s) · ${bens ? 'bens' : 'materiais'}`)}
    <div class="etiquetas">${fonte.map(x => {
      const cod = bens ? x.tombo : x.codigo;
      return `<div class="etq"><div class="qr" data-qr="${esc(urlEtiqueta(bens ? 'b' : 'p', cod))}" data-tam="80"></div>
        <div class="cod">${esc(cod)}</div><div class="nm">${esc(bens ? x.descricao : x.nome)}</div>
        <div style="font-size:8px;color:#666;margin-top:4px">${esc(CONFIG.ENTIDADE)}</div></div>`;
    }).join('')}</div>`, true);
}
