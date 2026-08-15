-- ============================================================================
-- FECOMÉRCIO PATRIMÔNIO — estrutura do banco (Supabase / PostgreSQL)
-- Rode este arquivo inteiro no SQL Editor do Supabase, de uma vez só.
-- Todas as tabelas usam o prefixo fp_ para não colidir com outros projetos.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- PESSOAS --
create table if not exists fp_perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  usuario     text unique not null,
  nome        text not null,
  matricula   text,
  cargo       text,
  telefone    text,
  papel       text not null default 'solicitante'
              check (papel in ('admin','gestor','solicitante')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Pré-cadastro: o administrador libera o usuário antes de a pessoa entrar.
create table if not exists fp_convites (
  id          uuid primary key default gen_random_uuid(),
  usuario     text unique not null,
  nome        text,
  papel       text not null default 'solicitante',
  matricula   text,
  cargo       text,
  acessos     jsonb not null default '[]'::jsonb,  -- [{"setor_id":"...","nivel":"solicitar"}]
  usado       boolean not null default false,
  criado_em   timestamptz not null default now()
);

-- --------------------------------------------------------------- SETORES --
-- Cada setor é uma base própria de demandas. Novos setores entram por aqui.
create table if not exists fp_setores (
  id          uuid primary key default gen_random_uuid(),
  chave       text unique not null,          -- FIN, RH, ALM, PAT...
  nome        text not null,
  descricao   text,
  cor         text not null default '#004A8D',
  usa_itens   boolean not null default false, -- demanda com lista de itens
  usa_valor   boolean not null default false, -- demanda com valor em R$
  usa_qr      boolean not null default false, -- movimentação física com etiqueta
  ordem       int not null default 0,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Estações do fluxo: é a "localização atual" de cada demanda.
create table if not exists fp_etapas (
  id          uuid primary key default gen_random_uuid(),
  setor_id    uuid not null references fp_setores(id) on delete cascade,
  ordem       int not null default 0,
  nome        text not null,
  tipo        text not null default 'andamento'
              check (tipo in ('inicio','aprovacao','andamento','final')),
  prazo_dias  int not null default 0
);

-- Tipos de demanda, com os campos de preenchimento de cada um.
create table if not exists fp_tipos (
  id              uuid primary key default gen_random_uuid(),
  setor_id        uuid not null references fp_setores(id) on delete cascade,
  nome            text not null,
  campos          jsonb not null default '[]'::jsonb,
  -- campos: [{"chave":"centro_custo","rotulo":"Centro de custo","tipo":"texto|numero|data|lista|longo","obrigatorio":true,"opcoes":["A","B"]}]
  exige_aprovacao boolean not null default true,
  sla_dias        int not null default 5,
  ativo           boolean not null default true
);

-- Quem pode o quê em cada setor. É o coração do controle de acesso.
create table if not exists fp_acessos (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references fp_perfis(id) on delete cascade,
  setor_id   uuid not null references fp_setores(id) on delete cascade,
  nivel      text not null default 'solicitar'
             check (nivel in ('acompanhar','solicitar','aprovar','gerir')),
  unique (perfil_id, setor_id)
);

-- -------------------------------------------------------------- DEMANDAS --
create table if not exists fp_demandas (
  id             uuid primary key default gen_random_uuid(),
  protocolo      text unique not null,
  setor_id       uuid not null references fp_setores(id),
  tipo_id        uuid references fp_tipos(id),
  solicitante_id uuid references fp_perfis(id),
  responsavel_id uuid references fp_perfis(id),
  etapa_id       uuid references fp_etapas(id),
  titulo         text not null,
  descricao      text,
  prioridade     text not null default 'normal'
                 check (prioridade in ('baixa','normal','alta','urgente')),
  status         text not null default 'aberta'
                 check (status in ('aberta','em_analise','aprovada','reprovada',
                                   'em_andamento','concluida','cancelada')),
  local_atual    text,
  valor          numeric(14,2) not null default 0,
  prazo          date,
  dados          jsonb not null default '{}'::jsonb,
  criada_em      timestamptz not null default now(),
  atualizada_em  timestamptz not null default now(),
  concluida_em   timestamptz
);
create index if not exists ix_dem_setor  on fp_demandas(setor_id, criada_em desc);
create index if not exists ix_dem_solic  on fp_demandas(solicitante_id);
create index if not exists ix_dem_status on fp_demandas(status);

create table if not exists fp_itens (
  id            uuid primary key default gen_random_uuid(),
  demanda_id    uuid not null references fp_demandas(id) on delete cascade,
  descricao     text not null,
  quantidade    numeric(14,3) not null default 1,
  unidade       text default 'un',
  valor_unit    numeric(14,2) not null default 0,
  referencia    text,          -- código do produto ou nº de tombo, quando houver
  atendido      boolean not null default false
);
create index if not exists ix_itens_dem on fp_itens(demanda_id);

-- Histórico completo: cada passo da demanda vira uma linha aqui.
create table if not exists fp_tramites (
  id          uuid primary key default gen_random_uuid(),
  demanda_id  uuid not null references fp_demandas(id) on delete cascade,
  autor_id    uuid references fp_perfis(id),
  autor_nome  text,
  acao        text not null,   -- abertura, comentario, aprovacao, reprovacao, etapa, status, movimentacao, conclusao
  de          text,
  para        text,
  local       text,
  comentario  text,
  criado_em   timestamptz not null default now()
);
create index if not exists ix_tram_dem on fp_tramites(demanda_id, criado_em);

create table if not exists fp_seguidores (
  demanda_id uuid not null references fp_demandas(id) on delete cascade,
  perfil_id  uuid not null references fp_perfis(id) on delete cascade,
  primary key (demanda_id, perfil_id)
);

-- ------------------------------------------------------------ PATRIMÔNIO --
create table if not exists fp_bens (
  id             uuid primary key default gen_random_uuid(),
  tombo          text unique not null,       -- número de patrimônio (vai no QR)
  descricao      text not null,
  categoria      text,
  marca          text,
  modelo         text,
  serie          text,
  setor_id       uuid references fp_setores(id),
  local          text,
  responsavel_id uuid references fp_perfis(id),
  situacao       text not null default 'em_uso'
                 check (situacao in ('em_uso','estoque','manutencao','emprestado','baixado')),
  valor          numeric(14,2) not null default 0,
  aquisicao      date,
  nota_fiscal    text,
  observacao     text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

create table if not exists fp_bem_mov (
  id          uuid primary key default gen_random_uuid(),
  bem_id      uuid not null references fp_bens(id) on delete cascade,
  demanda_id  uuid references fp_demandas(id),
  de_local    text,
  para_local  text,
  de_situacao text,
  para_situacao text,
  responsavel text,
  motivo      text,
  autor_id    uuid references fp_perfis(id),
  autor_nome  text,
  data        timestamptz not null default now()
);
create index if not exists ix_bemmov on fp_bem_mov(bem_id, data desc);

-- ------------------------------------------- ESTOQUE / ALMOXARIFADO -------
create table if not exists fp_fornecedores (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  contato   text,
  fone      text,
  criado_em timestamptz not null default now()
);

create table if not exists fp_produtos (
  id            uuid primary key default gen_random_uuid(),
  codigo        text unique not null,        -- vai no QR da etiqueta
  nome          text not null,
  categoria     text default 'Geral',
  unidade       text default 'un',
  estoque       numeric(14,3) not null default 0,
  minimo        numeric(14,3) not null default 0,
  maximo        numeric(14,3) not null default 0,
  preco         numeric(14,2) not null default 0,
  local         text,
  fornecedor_id uuid references fp_fornecedores(id),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create table if not exists fp_movimentos (
  id           uuid primary key default gen_random_uuid(),
  produto_id   uuid not null references fp_produtos(id) on delete cascade,
  demanda_id   uuid references fp_demandas(id),
  tipo         text not null check (tipo in ('entrada','saida','ajuste')),
  qtd          numeric(14,3) not null,
  saldo_depois numeric(14,3) not null default 0,
  preco        numeric(14,2) not null default 0,
  destino      text,
  solicitante  text,
  documento    text,
  autor_id     uuid references fp_perfis(id),
  autor_nome   text,
  data         timestamptz not null default now()
);
create index if not exists ix_mov_prod on fp_movimentos(produto_id, data desc);

-- ============================================================================
-- FUNÇÕES DE APOIO
-- SECURITY DEFINER de propósito: elas consultam fp_perfis por dentro e, sem
-- isso, as políticas de RLS que as chamam entrariam em recursão.
-- ============================================================================

create or replace function fp_e_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from fp_perfis
                 where id = auth.uid() and ativo and papel = 'admin');
$$;

create or replace function fp_e_gestor() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from fp_perfis
                 where id = auth.uid() and ativo and papel in ('admin','gestor'));
$$;

-- Setores que o usuário enxerga (qualquer nível de acesso).
create or replace function fp_meus_setores() returns setof uuid
language sql security definer stable set search_path = public as $$
  select s.id from fp_setores s where fp_e_admin()
  union
  select a.setor_id from fp_acessos a where a.perfil_id = auth.uid();
$$;

-- Setores em que o usuário pode aprovar / gerir.
create or replace function fp_setores_aprovacao() returns setof uuid
language sql security definer stable set search_path = public as $$
  select s.id from fp_setores s where fp_e_admin()
  union
  select a.setor_id from fp_acessos a
   where a.perfil_id = auth.uid() and a.nivel in ('aprovar','gerir');
$$;

create or replace function fp_precisa_configurar() returns boolean
language sql security definer stable set search_path = public as $$
  select not exists (select 1 from fp_perfis where papel = 'admin');
$$;

-- Cria (ou devolve) o perfil de quem acabou de autenticar.
-- Primeiro acesso do sistema  -> vira administrador.
-- Demais                      -> precisa de convite feito pelo administrador.
create or replace function fp_garantir_perfil(p_nome text default null)
returns fp_perfis
language plpgsql security definer set search_path = public as $$
declare
  v_id      uuid := auth.uid();
  v_usuario text;
  v_perfil  fp_perfis;
  v_convite fp_convites;
  v_primeiro boolean;
  v_acesso  jsonb;
begin
  if v_id is null then raise exception 'Sessão não identificada.'; end if;

  select * into v_perfil from fp_perfis where id = v_id;
  if found then
    if p_nome is not null and length(trim(p_nome)) > 0 and v_perfil.nome is distinct from p_nome then
      update fp_perfis set nome = p_nome where id = v_id returning * into v_perfil;
    end if;
    return v_perfil;
  end if;

  select lower(split_part(email, '@', 1)) into v_usuario from auth.users where id = v_id;
  v_primeiro := not exists (select 1 from fp_perfis where papel = 'admin');

  if v_primeiro then
    insert into fp_perfis (id, usuario, nome, papel, ativo)
    values (v_id, v_usuario, coalesce(nullif(trim(p_nome),''), v_usuario), 'admin', true)
    returning * into v_perfil;
    return v_perfil;
  end if;

  select * into v_convite from fp_convites where usuario = v_usuario and not usado;
  if not found then
    raise exception 'Usuário não autorizado. Peça ao administrador para liberar seu acesso.';
  end if;

  insert into fp_perfis (id, usuario, nome, papel, matricula, cargo, ativo)
  values (v_id, v_usuario,
          coalesce(nullif(trim(p_nome),''), v_convite.nome, v_usuario),
          v_convite.papel, v_convite.matricula, v_convite.cargo, true)
  returning * into v_perfil;

  for v_acesso in select * from jsonb_array_elements(v_convite.acessos) loop
    insert into fp_acessos (perfil_id, setor_id, nivel)
    values (v_id, (v_acesso->>'setor_id')::uuid, coalesce(v_acesso->>'nivel','solicitar'))
    on conflict (perfil_id, setor_id) do nothing;
  end loop;

  update fp_convites set usado = true where id = v_convite.id;
  return v_perfil;
end $$;

-- Protocolo sequencial por setor e por ano: FIN-2026-0001
create or replace function fp_novo_protocolo(p_setor uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_chave text;
  v_ano   text := to_char(now(),'YYYY');
  v_seq   int;
begin
  select chave into v_chave from fp_setores where id = p_setor;
  if v_chave is null then raise exception 'Setor inexistente.'; end if;
  select count(*) + 1 into v_seq from fp_demandas
   where setor_id = p_setor and to_char(criada_em,'YYYY') = v_ano;
  return v_chave || '-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
end $$;

-- Baixa/entrada de estoque em uma transação só (evita saldo torto).
create or replace function fp_mover_estoque(
  p_produto uuid, p_tipo text, p_qtd numeric,
  p_destino text default null, p_solicitante text default null,
  p_documento text default null, p_demanda uuid default null)
returns fp_movimentos
language plpgsql security definer set search_path = public as $$
declare
  v_saldo numeric; v_novo numeric; v_mov fp_movimentos;
  v_nome text; v_preco numeric;
begin
  select estoque, preco into v_saldo, v_preco from fp_produtos where id = p_produto for update;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if p_qtd <= 0 then raise exception 'Quantidade precisa ser maior que zero.'; end if;

  v_novo := case p_tipo when 'entrada' then v_saldo + p_qtd
                        when 'saida'   then v_saldo - p_qtd
                        else p_qtd end;
  if v_novo < 0 then raise exception 'Saldo insuficiente: há % em estoque.', v_saldo; end if;

  update fp_produtos set estoque = v_novo where id = p_produto;
  select nome into v_nome from fp_perfis where id = auth.uid();

  insert into fp_movimentos (produto_id, demanda_id, tipo, qtd, saldo_depois, preco,
                             destino, solicitante, documento, autor_id, autor_nome)
  values (p_produto, p_demanda, p_tipo, p_qtd, v_novo, coalesce(v_preco,0),
          p_destino, p_solicitante, p_documento, auth.uid(), v_nome)
  returning * into v_mov;
  return v_mov;
end $$;

create or replace function fp_toque_demanda() returns trigger
language plpgsql as $$
begin
  new.atualizada_em := now();
  if new.status = 'concluida' and old.status is distinct from 'concluida' then
    new.concluida_em := now();
  end if;
  return new;
end $$;

drop trigger if exists tg_toque_demanda on fp_demandas;
create trigger tg_toque_demanda before update on fp_demandas
for each row execute function fp_toque_demanda();

-- ============================================================================
-- RLS — ninguém lê nada sem passar por aqui
-- ============================================================================
alter table fp_perfis       enable row level security;
alter table fp_convites     enable row level security;
alter table fp_setores      enable row level security;
alter table fp_etapas       enable row level security;
alter table fp_tipos        enable row level security;
alter table fp_acessos      enable row level security;
alter table fp_demandas     enable row level security;
alter table fp_itens        enable row level security;
alter table fp_tramites     enable row level security;
alter table fp_seguidores   enable row level security;
alter table fp_bens         enable row level security;
alter table fp_bem_mov      enable row level security;
alter table fp_fornecedores enable row level security;
alter table fp_produtos     enable row level security;
alter table fp_movimentos   enable row level security;

-- perfis: cada um vê a si mesmo; gestor e admin veem todos; só admin altera papel/ativo
drop policy if exists p_perfis_ver on fp_perfis;
create policy p_perfis_ver on fp_perfis for select to authenticated
  using (id = auth.uid() or fp_e_gestor());
drop policy if exists p_perfis_eu on fp_perfis;
create policy p_perfis_eu on fp_perfis for update to authenticated
  using (id = auth.uid() or fp_e_admin()) with check (id = auth.uid() or fp_e_admin());
drop policy if exists p_perfis_del on fp_perfis;
create policy p_perfis_del on fp_perfis for delete to authenticated using (fp_e_admin());

-- convites: exclusivo do administrador
drop policy if exists p_convites on fp_convites;
create policy p_convites on fp_convites for all to authenticated
  using (fp_e_admin()) with check (fp_e_admin());

-- setores, etapas e tipos: todo mundo lê (a lista alimenta os formulários), admin escreve
drop policy if exists p_setores_ver on fp_setores;
create policy p_setores_ver on fp_setores for select to authenticated using (true);
drop policy if exists p_setores_adm on fp_setores;
create policy p_setores_adm on fp_setores for all to authenticated
  using (fp_e_admin()) with check (fp_e_admin());

drop policy if exists p_etapas_ver on fp_etapas;
create policy p_etapas_ver on fp_etapas for select to authenticated using (true);
drop policy if exists p_etapas_adm on fp_etapas;
create policy p_etapas_adm on fp_etapas for all to authenticated
  using (fp_e_admin()) with check (fp_e_admin());

drop policy if exists p_tipos_ver on fp_tipos;
create policy p_tipos_ver on fp_tipos for select to authenticated using (true);
drop policy if exists p_tipos_adm on fp_tipos;
create policy p_tipos_adm on fp_tipos for all to authenticated
  using (fp_e_admin()) with check (fp_e_admin());

-- acessos: a pessoa vê os próprios; admin administra
drop policy if exists p_acessos_ver on fp_acessos;
create policy p_acessos_ver on fp_acessos for select to authenticated
  using (perfil_id = auth.uid() or fp_e_gestor());
drop policy if exists p_acessos_adm on fp_acessos;
create policy p_acessos_adm on fp_acessos for all to authenticated
  using (fp_e_admin()) with check (fp_e_admin());

-- demandas: só o que for do seu setor liberado (ou suas próprias)
drop policy if exists p_dem_ver on fp_demandas;
create policy p_dem_ver on fp_demandas for select to authenticated
  using (solicitante_id = auth.uid() or setor_id in (select fp_meus_setores()));
drop policy if exists p_dem_criar on fp_demandas;
create policy p_dem_criar on fp_demandas for insert to authenticated
  with check (solicitante_id = auth.uid() and setor_id in (select fp_meus_setores()));
drop policy if exists p_dem_editar on fp_demandas;
create policy p_dem_editar on fp_demandas for update to authenticated
  using (setor_id in (select fp_setores_aprovacao())
         or (solicitante_id = auth.uid() and status in ('aberta','reprovada')))
  with check (true);
drop policy if exists p_dem_apagar on fp_demandas;
create policy p_dem_apagar on fp_demandas for delete to authenticated using (fp_e_admin());

drop policy if exists p_itens on fp_itens;
create policy p_itens on fp_itens for all to authenticated
  using (demanda_id in (select id from fp_demandas))
  with check (demanda_id in (select id from fp_demandas));

drop policy if exists p_tram_ver on fp_tramites;
create policy p_tram_ver on fp_tramites for select to authenticated
  using (demanda_id in (select id from fp_demandas));
drop policy if exists p_tram_criar on fp_tramites;
create policy p_tram_criar on fp_tramites for insert to authenticated
  with check (demanda_id in (select id from fp_demandas));

drop policy if exists p_seguidores on fp_seguidores;
create policy p_seguidores on fp_seguidores for all to authenticated
  using (perfil_id = auth.uid() or fp_e_gestor())
  with check (perfil_id = auth.uid() or fp_e_gestor());

-- patrimônio e estoque: leitura para quem tem o setor; escrita para aprovar/gerir
drop policy if exists p_bens_ver on fp_bens;
create policy p_bens_ver on fp_bens for select to authenticated using (true);
drop policy if exists p_bens_esc on fp_bens;
create policy p_bens_esc on fp_bens for all to authenticated
  using (fp_e_gestor() or setor_id in (select fp_setores_aprovacao()))
  with check (fp_e_gestor() or setor_id in (select fp_setores_aprovacao()));

drop policy if exists p_bemmov_ver on fp_bem_mov;
create policy p_bemmov_ver on fp_bem_mov for select to authenticated using (true);
drop policy if exists p_bemmov_criar on fp_bem_mov;
create policy p_bemmov_criar on fp_bem_mov for insert to authenticated with check (true);

drop policy if exists p_forn_ver on fp_fornecedores;
create policy p_forn_ver on fp_fornecedores for select to authenticated using (true);
drop policy if exists p_forn_esc on fp_fornecedores;
create policy p_forn_esc on fp_fornecedores for all to authenticated
  using (fp_e_gestor()) with check (fp_e_gestor());

drop policy if exists p_prod_ver on fp_produtos;
create policy p_prod_ver on fp_produtos for select to authenticated using (true);
drop policy if exists p_prod_esc on fp_produtos;
create policy p_prod_esc on fp_produtos for all to authenticated
  using (fp_e_gestor()) with check (fp_e_gestor());

drop policy if exists p_mov_ver on fp_movimentos;
create policy p_mov_ver on fp_movimentos for select to authenticated using (true);
drop policy if exists p_mov_criar on fp_movimentos;
create policy p_mov_criar on fp_movimentos for insert to authenticated with check (true);
