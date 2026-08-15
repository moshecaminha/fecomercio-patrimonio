/* ============================================================================
   NÚCLEO — conexão, sessão, estado, permissões e navegação.
   Tudo o que as outras telas usam nasce aqui.
   ========================================================================== */
'use strict';

const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

/* estado da sessão em memória */
let S = {
  setores: [], etapas: [], tipos: [], acessos: [], perfis: [],
  demandas: [], bens: [], produtos: [], fornecedores: [], movimentos: [], bemMov: []
};
let perfil = null;
let vista = 'painel';
let aberta = null;            // demanda aberta na ficha
let leitorCam = null;
let etqSel = new Set();
let modoLogin = 'entrar';

const F = {
  dSetor:'', dStatus:'', dPrior:'', dBusca:'', dMinhas:false, dAtrasadas:false,
  bBusca:'', bSetor:'', bSituacao:'', pBusca:'', pCat:'', pBaixo:false,
  rSetor:'', rDe:'', rAte:'', rSolic:'', eTipo:'bens', eBusca:''
};

/* --------------------------------------------------------------- ATALHOS -- */
const el = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = v => Number(v || 0);
const num = v => n(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dinheiro = v => n(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const hoje = () => new Date().toLocaleDateString('sv-SE');
const diaDe = iso => new Date(iso).toLocaleDateString('sv-SE');
const dataBR = d => d ? String(d).slice(0,10).split('-').reverse().join('/') : '—';
const dataHoraBR = iso => !iso ? '—' :
  new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const semAcento = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const contem = (texto, termo) => semAcento(texto).includes(semAcento(termo));

const setor = id => S.setores.find(s => s.id === id);
const setorPor = chave => S.setores.find(s => s.chave === chave);
const tipo = id => S.tipos.find(t => t.id === id);
const etapa = id => S.etapas.find(e => e.id === id);
const etapasDe = sid => S.etapas.filter(e => e.setor_id === sid).sort((a,b) => a.ordem - b.ordem);
const tiposDe = sid => S.tipos.filter(t => t.setor_id === sid && t.ativo);
const pessoa = id => S.perfis.find(p => p.id === id);
const nomeDe = id => (pessoa(id)?.nome) || '—';
const produtoPorCodigo = c => S.produtos.find(p => p.codigo.toUpperCase() === String(c||'').trim().toUpperCase());
const bemPorTombo = t => S.bens.find(b => b.tombo.toUpperCase() === String(t||'').trim().toUpperCase());

const ROTULO_STATUS = { aberta:'Aberta', em_analise:'Em análise', aprovada:'Aprovada', reprovada:'Reprovada',
  em_andamento:'Em andamento', concluida:'Concluída', cancelada:'Cancelada' };
const ROTULO_PRIOR = { baixa:'Baixa', normal:'Normal', alta:'Alta', urgente:'Urgente' };
const ROTULO_SITUACAO = { em_uso:'Em uso', estoque:'Em estoque', manutencao:'Em manutenção',
  emprestado:'Emprestado', baixado:'Baixado' };
const ABERTAS = ['aberta','em_analise','aprovada','em_andamento'];

/* ----------------------------------------------------------- PERMISSÕES -- */
const ehAdmin = () => perfil?.papel === 'admin';
const ehGestor = () => perfil && (perfil.papel === 'admin' || perfil.papel === 'gestor');
const PESO = { acompanhar:1, solicitar:2, aprovar:3, gerir:4 };

function nivelNo(setorId){
  if (ehAdmin()) return 'gerir';
  const a = S.acessos.find(x => x.setor_id === setorId && x.perfil_id === perfil?.id);
  return a ? a.nivel : null;
}
const podeVer      = sid => !!nivelNo(sid);
const podeSolicitar= sid => PESO[nivelNo(sid)] >= 2;
const podeAprovar  = sid => PESO[nivelNo(sid)] >= 3;
const podeGerir    = sid => PESO[nivelNo(sid)] >= 4;
const setoresVisiveis   = () => S.setores.filter(s => s.ativo && podeVer(s.id));
const setoresQueSolicito= () => S.setores.filter(s => s.ativo && podeSolicitar(s.id));
const setoresQueAprovo  = () => S.setores.filter(s => s.ativo && podeAprovar(s.id));

/* --------------------------------------------------------- AVISOS/MODAL -- */
function aviso(msg, tom = ''){
  const d = document.createElement('div');
  d.className = 'aviso ' + tom;
  d.textContent = msg;
  el('avisos').appendChild(d);
  setTimeout(() => d.remove(), 5200);
}
function modal(titulo, corpo, pe = ''){
  el('modais').innerHTML = `<div class="cortina"><div class="modal" role="dialog" aria-modal="true">
    <div class="modal-cab"><h3>${esc(titulo)}</h3><button class="x" data-acao="fechar-modal" aria-label="Fechar">×</button></div>
    <div class="modal-corpo">${corpo}</div>
    ${pe ? `<div class="modal-pe">${pe}</div>` : ''}</div></div>`;
}
const fecharModal = () => { el('modais').innerHTML = ''; };

function erroBanco(e){
  const m = String(e?.message || e || '');
  if (/row-level security|violates row-level/i.test(m)) return 'Seu acesso não permite essa ação neste setor.';
  if (/duplicate key|already exists/i.test(m)) return 'Esse registro já existe.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Tente de novo em instantes.';
  if (/does not exist|schema cache/i.test(m)) return 'O banco ainda não tem as tabelas do sistema. Rode os arquivos de supabase/ no SQL Editor.';
  return m || 'Não foi possível concluir.';
}

/* ----------------------------------------------------- ARQUIVO/IMPRESSÃO -- */
const csvLinha = v => v.map(x => { const s = String(x ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; }).join(';');
function baixarArquivo(nome, texto, tipoMime = 'text/csv;charset=utf-8'){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + texto], { type: tipoMime }));
  a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function cabDoc(titulo, sub = ''){
  return `<div class="doc-cab"><img src="assets/logo.png" alt="Fecomércio PE">
    <div><h1>${esc(titulo)}</h1><div style="font-size:11px;color:#555">${esc(sub)}</div></div>
    <div class="quando">${esc(CONFIG.ENTIDADE)} · ${dataHoraBR(new Date().toISOString())}</div></div>`;
}
function imprimir(html, comQR = false){
  el('areaImpressao').innerHTML = html;
  if (comQR) el('areaImpressao').querySelectorAll('[data-qr]').forEach(d => gerarQR(d, d.dataset.qr, Number(d.dataset.tam || 76)));
  setTimeout(() => window.print(), comQR ? 420 : 90);
}

/* -------------------------------------------------------------- QR CODE -- */
// t=b → bem patrimonial | t=p → produto de estoque | t=d → demanda
const urlEtiqueta = (t, cod) =>
  (CONFIG.URL_BASE || location.origin).replace(/\/$/,'') + '/?t=' + t + '&c=' + encodeURIComponent(cod);

function lidoDaEtiqueta(txt){
  const s = String(txt || '').trim();
  const m = s.match(/[?&]c=([^&#\s]+)/i);
  const t = s.match(/[?&]t=([bpd])/i);
  if (m) return { tipo: t ? t[1] : '', codigo: decodeURIComponent(m[1]) };
  return { tipo: '', codigo: s };
}
function gerarQR(destino, texto, tamanho){
  destino.innerHTML = '';
  if (typeof QRCode === 'undefined'){ destino.innerHTML = `<span class="mono" style="font-size:9px">${esc(texto)}</span>`; return; }
  new QRCode(destino, { text: texto, width: tamanho, height: tamanho, correctLevel: QRCode.CorrectLevel.M });
}

/* ======================================================================== */
/* ACESSO                                                                    */
/* ======================================================================== */
const limparUsuario = u => String(u || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
const emailInterno = u => limparUsuario(u) + '@' + CONFIG.DOMINIO_INTERNO;
const msgLogin = (txt, ok) => { el('msgLogin').innerHTML = txt ? `<div class="${ok?'ok-login':'erro-login'}">${esc(txt)}</div>` : ''; };

async function montarLogin(){
  let precisa = false;
  try {
    const { data, error } = await sb.rpc('fp_precisa_configurar');
    if (error) throw error;
    precisa = !!data;
  } catch(e){
    msgLogin('Não consegui falar com o banco: ' + erroBanco(e));
  }
  modoLogin = precisa ? 'configurar' : 'entrar';
  pintarLogin();
}

function pintarLogin(){
  el('subLogin').textContent =
    modoLogin === 'configurar' ? 'Primeiro acesso · criação do administrador' :
    modoLogin === 'ativar'     ? 'Ativação do acesso liberado pelo administrador' :
                                 'Gestão de demandas por setor';

  el('areaLogin').innerHTML = `
    ${modoLogin === 'configurar' ? `<p class="legenda">Ninguém tem acesso ainda. Crie aqui a conta de administrador — depois dela, o cadastro fecha e novos usuários só entram por liberação sua.</p>` : ''}
    ${modoLogin === 'ativar' ? `<p class="legenda">Use o nome de usuário que o administrador informou e escolha a sua senha.</p>` : ''}
    ${modoLogin !== 'entrar' ? `<label class="campo"><span>Nome completo</span>
      <input id="lgNome" type="text" autocomplete="name" placeholder="Como aparece nos relatórios"></label>` : ''}
    <label class="campo"><span>Usuário</span>
      <input id="lgUsuario" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ex.: maria.silva"></label>
    <label class="campo"><span>Senha</span>
      <input id="lgSenha" type="password" autocomplete="${modoLogin === 'entrar' ? 'current-password' : 'new-password'}" placeholder="Mínimo de 6 caracteres"></label>
    <button class="btn gr" id="btnLogin" data-acao="login">${
      modoLogin === 'configurar' ? 'Criar administrador' : modoLogin === 'ativar' ? 'Ativar meu acesso' : 'Entrar'}</button>
    ${modoLogin === 'entrar'
      ? `<p class="legenda" style="text-align:center;margin:16px 0 0">Recebeu um usuário do administrador?
           <a href="#" data-acao="modo-ativar"><b>Defina sua senha</b></a></p>`
      : modoLogin === 'ativar'
      ? `<p class="legenda" style="text-align:center;margin:16px 0 0"><a href="#" data-acao="modo-entrar"><b>Voltar para entrar</b></a></p>` : ''}`;
  el('lgUsuario').focus();
}

const trocarModoLogin = m => { modoLogin = m; msgLogin(''); pintarLogin(); };

async function enviarLogin(){
  const usuario = limparUsuario(el('lgUsuario').value);
  const senha = el('lgSenha').value;
  const nome = el('lgNome') ? el('lgNome').value.trim() : '';
  const btn = el('btnLogin');

  if (!usuario) return msgLogin('Informe o usuário.');
  if (senha.length < 6) return msgLogin('A senha precisa de pelo menos 6 caracteres.');
  if (modoLogin !== 'entrar' && !nome) return msgLogin('Informe seu nome — ele assina cada demanda que você abrir.');

  btn.disabled = true; btn.textContent = 'Aguarde…'; msgLogin('');
  try {
    const email = emailInterno(usuario);
    if (modoLogin === 'entrar'){
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
    } else {
      const { error } = await sb.auth.signUp({ email, password: senha, options:{ data:{ nome, usuario } } });
      if (error && !/already registered|User already/i.test(error.message)) throw error;
      const { error: e2 } = await sb.auth.signInWithPassword({ email, password: senha });
      if (e2) throw e2;
    }
    const { error: e3 } = await sb.rpc('fp_garantir_perfil', { p_nome: nome || null });
    if (e3){ await sb.auth.signOut(); throw e3; }
    await entrarNoSistema();
  } catch(e){
    const m = String(e.message || e);
    if (/não autorizado/i.test(m)) msgLogin(m);
    else if (/Invalid login credentials/i.test(m)) msgLogin(modoLogin === 'entrar'
      ? 'Usuário ou senha não conferem.'
      : 'Esse usuário já tem senha definida. Entre normalmente ou peça uma nova liberação ao administrador.');
    else if (/signups not allowed/i.test(m)) msgLogin('Cadastro bloqueado no Supabase: ative "Allow new users to sign up" em Authentication → Sign In / Providers.');
    else if (/Email logins are disabled/i.test(m)) msgLogin('Ative o provedor Email em Authentication → Sign In / Providers no Supabase.');
    else if (/confirm/i.test(m)) msgLogin('Desligue "Confirm email" em Authentication → Sign In / Providers no Supabase.');
    else if (/invalid.*email/i.test(m)) msgLogin('O Supabase recusou o domínio interno. Troque DOMINIO_INTERNO em assets/config.js.');
    else msgLogin(erroBanco(e));
    pintarLogin();
  }
}

async function sair(){
  await pararCamera();
  await sb.auth.signOut();
  perfil = null; S.demandas = []; aberta = null;
  el('app').style.display = 'none';
  el('login').style.display = 'flex';
  await montarLogin();
}

async function entrarNoSistema(){
  const { data:{ user } } = await sb.auth.getUser();
  if (!user) return;

  const { data: p, error } = await sb.rpc('fp_garantir_perfil', { p_nome: null });
  if (error){ await sb.auth.signOut(); msgLogin(erroBanco(error)); await montarLogin(); return; }
  perfil = Array.isArray(p) ? p[0] : p;

  if (!perfil.ativo){
    await sb.auth.signOut();
    msgLogin('Seu acesso está desativado. Procure o administrador da plataforma.');
    return;
  }

  el('login').style.display = 'none';
  el('app').style.display = 'block';
  el('rotuloUnidade').textContent = CONFIG.UNIDADE || 'Gestão de demandas';
  el('quemSou').textContent = perfil.nome;
  el('meuPapel').textContent = perfil.papel === 'admin' ? 'Administrador'
    : perfil.papel === 'gestor' ? 'Gestor' : 'Solicitante';

  await recarregar();
  await tratarEtiquetaNaURL();
  pintarAbas();
  render();
}

/* Se a pessoa chegou pela leitura de um QR, abre direto o que foi lido. */
async function tratarEtiquetaNaURL(){
  const q = new URLSearchParams(location.search);
  const cod = q.get('c');
  if (!cod) return;
  const t = q.get('t') || '';
  history.replaceState(null, '', location.pathname);

  if (t === 'd' || /^[A-Z]{2,4}-\d{4}-\d+$/i.test(cod)){
    const d = S.demandas.find(x => x.protocolo.toUpperCase() === cod.toUpperCase());
    if (d){ vista = 'demandas'; aberta = d.id; return; }
  }
  const bem = bemPorTombo(cod);
  if (bem){ vista = 'patrimonio'; setTimeout(() => fichaBem(bem.id), 250); return; }
  const prod = produtoPorCodigo(cod);
  if (prod){ vista = 'almoxarifado'; setTimeout(() => fichaMovimento(prod.id, 'saida'), 250); return; }
  aviso(`Etiqueta lida: "${cod}" não corresponde a nenhum registro.`, 'ruim');
}

/* ======================================================================== */
/* CARGA DE DADOS                                                            */
/* ======================================================================== */
async function recarregar(){
  const [set, eta, tip, ace, pes, dem, ben, pro, forn, mov, bmv] = await Promise.all([
    sb.from('fp_setores').select('*').order('ordem'),
    sb.from('fp_etapas').select('*').order('ordem'),
    sb.from('fp_tipos').select('*').order('nome'),
    sb.from('fp_acessos').select('*'),
    sb.from('fp_perfis').select('*').order('nome'),
    sb.from('fp_demandas').select('*').order('criada_em', { ascending:false }).limit(800),
    sb.from('fp_bens').select('*').eq('ativo', true).order('tombo'),
    sb.from('fp_produtos').select('*').eq('ativo', true).order('codigo'),
    sb.from('fp_fornecedores').select('*').order('nome'),
    sb.from('fp_movimentos').select('*').order('data', { ascending:false }).limit(800),
    sb.from('fp_bem_mov').select('*').order('data', { ascending:false }).limit(500)
  ]);
  for (const r of [set, eta, tip, ace, dem]) if (r.error) throw r.error;

  S.setores = set.data || [];
  S.etapas = eta.data || [];
  S.tipos = tip.data || [];
  S.acessos = ace.data || [];
  S.perfis = pes.data || [];
  S.demandas = (dem.data || []).map(d => ({ ...d, valor: n(d.valor) }));
  S.bens = ben.data || [];
  S.produtos = (pro.data || []).map(p => ({ ...p, estoque:n(p.estoque), minimo:n(p.minimo), maximo:n(p.maximo), preco:n(p.preco) }));
  S.fornecedores = forn.data || [];
  S.movimentos = (mov.data || []).map(m => ({ ...m, qtd:n(m.qtd), saldo_depois:n(m.saldo_depois) }));
  S.bemMov = bmv.data || [];
}

async function atualizarDemandas(){
  const { data, error } = await sb.from('fp_demandas').select('*').order('criada_em', { ascending:false }).limit(800);
  if (error) throw error;
  S.demandas = (data || []).map(d => ({ ...d, valor: n(d.valor) }));
}

/* ======================================================================== */
/* NAVEGAÇÃO                                                                 */
/* ======================================================================== */
function abasDisponiveis(){
  const abas = [['painel','Painel']];
  if (setoresQueSolicito().length) abas.push(['nova','Nova demanda']);
  abas.push(['demandas','Demandas']);
  const pat = setorPor('PAT'), alm = setorPor('ALM');
  if (pat && podeVer(pat.id)) abas.push(['patrimonio','Patrimônio']);
  if (alm && podeVer(alm.id)) abas.push(['almoxarifado','Almoxarifado']);
  if ((pat && podeAprovar(pat.id)) || (alm && podeAprovar(alm.id))) abas.push(['etiquetas','Etiquetas QR']);
  if (ehGestor() || setoresQueAprovo().length) abas.push(['relatorios','Relatórios']);
  if (ehAdmin()) abas.push(['admin','Administração']);
  return abas;
}

function pintarAbas(){
  const minhas = S.demandas.filter(d => d.solicitante_id === perfil.id && ABERTAS.includes(d.status)).length;
  const aprovar = S.demandas.filter(d => podeAprovar(d.setor_id) && ['aberta','em_analise'].includes(d.status)).length;
  el('abas').innerHTML = abasDisponiveis().map(([id, rot]) => {
    let pino = '';
    if (id === 'demandas' && aprovar) pino = `<span class="pino">${aprovar}</span>`;
    else if (id === 'painel' && minhas) pino = `<span class="pino calmo">${minhas}</span>`;
    return `<button class="aba" data-acao="ir" data-vista="${id}" aria-current="${vista === id}">${rot}${pino}</button>`;
  }).join('');
}

async function ir(v){
  await pararCamera();
  vista = v; aberta = null;
  pintarAbas(); render();
  window.scrollTo(0, 0);
}

function render(){
  const mapa = {
    painel: vPainel, nova: vNovaDemanda, demandas: vDemandas,
    patrimonio: vPatrimonio, almoxarifado: vAlmoxarifado,
    etiquetas: vEtiquetas, relatorios: vRelatorios, admin: vAdmin
  };
  el('tela').innerHTML = (mapa[vista] || vPainel)();
  document.querySelectorAll('[data-qr]').forEach(d => gerarQR(d, d.dataset.qr, Number(d.dataset.tam || 76)));
  if (vista === 'admin') carregarConvites();
}

/* ---------------------------------------------------------------- ARRANQUE */
(async () => {
  try {
    const { data:{ session } } = await sb.auth.getSession();
    if (session) await entrarNoSistema();
    else { el('login').style.display = 'flex'; await montarLogin(); }
  } catch(e){
    el('login').style.display = 'flex';
    el('areaLogin').innerHTML = `<div class="erro-login">Falha ao iniciar: ${esc(e.message || e)}</div>
      <p class="legenda">Recarregue a página. Se continuar, confira a URL e a chave em assets/config.js.</p>`;
  }
})();
