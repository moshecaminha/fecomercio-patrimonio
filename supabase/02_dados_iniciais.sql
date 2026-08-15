-- ============================================================================
-- FECOMÉRCIO PATRIMÔNIO — carga inicial
-- Rode depois do 01_schema.sql. Pode rodar de novo sem duplicar nada.
-- Setores, estações de fluxo e tipos de demanda saem prontos daqui; o
-- administrador ajusta tudo pela tela de Administração depois.
-- ============================================================================

insert into fp_setores (chave, nome, descricao, cor, usa_itens, usa_valor, usa_qr, ordem) values
  ('FIN','Financeiro',  'Pagamentos, reembolsos, adiantamentos e notas fiscais.',            '#004A8D', true,  true,  false, 1),
  ('RH', 'Recursos Humanos','Férias, benefícios, admissão, desligamento e treinamentos.',    '#0B6E4F', false, false, false, 2),
  ('ALM','Almoxarifado', 'Requisição e baixa de material de consumo, com etiqueta QR.',      '#C89633', true,  true,  true,  3),
  ('PAT','Patrimônio',   'Bens permanentes: transferência, manutenção, baixa e inventário.', '#8A4B2A', true,  true,  true,  4),
  ('COM','Compras',      'Cotações, requisições de compra e contratos com fornecedores.',    '#5B4B8A', true,  true,  false, 5),
  ('TI', 'Tecnologia',   'Equipamentos, acessos, sistemas e suporte técnico.',               '#1F6F8B', false, false, false, 6),
  ('MAN','Manutenção',   'Serviços prediais, reparos e conservação das unidades.',           '#B3261E', false, true,  false, 7)
on conflict (chave) do nothing;

-- ------------------------------------------------------------- ESTAÇÕES ----
-- A estação é a resposta para "onde a demanda está agora".
insert into fp_etapas (setor_id, ordem, nome, tipo, prazo_dias)
select s.id, e.ordem, e.nome, e.tipo, e.prazo
from fp_setores s
join (values
  ('FIN',1,'Solicitação recebida','inicio',1),
  ('FIN',2,'Conferência de documentos','andamento',2),
  ('FIN',3,'Aprovação da diretoria','aprovacao',3),
  ('FIN',4,'Programado para pagamento','andamento',5),
  ('FIN',5,'Pago','final',0),
  ('RH',1,'Solicitação recebida','inicio',1),
  ('RH',2,'Análise do RH','andamento',3),
  ('RH',3,'Aprovação da gerência','aprovacao',2),
  ('RH',4,'Em execução','andamento',5),
  ('RH',5,'Concluída','final',0),
  ('ALM',1,'Pedido registrado','inicio',1),
  ('ALM',2,'Separação do material','andamento',1),
  ('ALM',3,'Aprovação do gestor','aprovacao',1),
  ('ALM',4,'Disponível para retirada','andamento',2),
  ('ALM',5,'Entregue e baixado','final',0),
  ('PAT',1,'Solicitação registrada','inicio',1),
  ('PAT',2,'Vistoria do bem','andamento',3),
  ('PAT',3,'Aprovação do patrimônio','aprovacao',2),
  ('PAT',4,'Movimentação física','andamento',3),
  ('PAT',5,'Registro atualizado','final',0),
  ('COM',1,'Requisição recebida','inicio',1),
  ('COM',2,'Cotação com fornecedores','andamento',5),
  ('COM',3,'Aprovação da compra','aprovacao',3),
  ('COM',4,'Pedido emitido','andamento',5),
  ('COM',5,'Material recebido','final',0),
  ('TI',1,'Chamado aberto','inicio',1),
  ('TI',2,'Triagem','andamento',1),
  ('TI',3,'Autorização da chefia','aprovacao',2),
  ('TI',4,'Em atendimento','andamento',3),
  ('TI',5,'Encerrado','final',0),
  ('MAN',1,'Solicitação recebida','inicio',1),
  ('MAN',2,'Vistoria no local','andamento',3),
  ('MAN',3,'Aprovação do orçamento','aprovacao',5),
  ('MAN',4,'Serviço em execução','andamento',7),
  ('MAN',5,'Vistoria final','final',0)
) as e(chave, ordem, nome, tipo, prazo) on e.chave = s.chave
where not exists (select 1 from fp_etapas x where x.setor_id = s.id);

-- --------------------------------------------------------- TIPOS/CAMPOS ----
insert into fp_tipos (setor_id, nome, campos, exige_aprovacao, sla_dias)
select s.id, t.nome, t.campos::jsonb, t.aprova, t.sla
from fp_setores s
join (values
  ('FIN','Pagamento a fornecedor',
   '[{"chave":"favorecido","rotulo":"Favorecido","tipo":"texto","obrigatorio":true},
     {"chave":"documento","rotulo":"CNPJ/CPF","tipo":"texto","obrigatorio":true},
     {"chave":"nota","rotulo":"Nota fiscal","tipo":"texto","obrigatorio":false},
     {"chave":"vencimento","rotulo":"Vencimento","tipo":"data","obrigatorio":true},
     {"chave":"forma","rotulo":"Forma de pagamento","tipo":"lista","obrigatorio":true,"opcoes":["Boleto","PIX","Transferência","Cartão corporativo"]},
     {"chave":"centro","rotulo":"Centro de custo","tipo":"texto","obrigatorio":true}]', true, 5),
  ('FIN','Reembolso de despesa',
   '[{"chave":"periodo","rotulo":"Período da despesa","tipo":"texto","obrigatorio":true},
     {"chave":"comprovante","rotulo":"Nº do comprovante","tipo":"texto","obrigatorio":true},
     {"chave":"centro","rotulo":"Centro de custo","tipo":"texto","obrigatorio":true}]', true, 7),
  ('FIN','Adiantamento de viagem',
   '[{"chave":"destino","rotulo":"Destino","tipo":"texto","obrigatorio":true},
     {"chave":"saida","rotulo":"Saída","tipo":"data","obrigatorio":true},
     {"chave":"retorno","rotulo":"Retorno","tipo":"data","obrigatorio":true}]', true, 5),
  ('RH','Solicitação de férias',
   '[{"chave":"inicio","rotulo":"Início das férias","tipo":"data","obrigatorio":true},
     {"chave":"dias","rotulo":"Dias","tipo":"numero","obrigatorio":true},
     {"chave":"abono","rotulo":"Abono pecuniário","tipo":"lista","obrigatorio":true,"opcoes":["Não","Sim — 10 dias"]},
     {"chave":"substituto","rotulo":"Quem responde no período","tipo":"texto","obrigatorio":false}]', true, 10),
  ('RH','Abertura de vaga',
   '[{"chave":"cargo","rotulo":"Cargo","tipo":"texto","obrigatorio":true},
     {"chave":"lotacao","rotulo":"Lotação","tipo":"texto","obrigatorio":true},
     {"chave":"regime","rotulo":"Regime","tipo":"lista","obrigatorio":true,"opcoes":["CLT","Estágio","Jovem aprendiz","Temporário"]},
     {"chave":"justificativa","rotulo":"Justificativa","tipo":"longo","obrigatorio":true}]', true, 15),
  ('RH','Inscrição em treinamento',
   '[{"chave":"curso","rotulo":"Curso","tipo":"texto","obrigatorio":true},
     {"chave":"instituicao","rotulo":"Instituição","tipo":"texto","obrigatorio":false},
     {"chave":"carga","rotulo":"Carga horária","tipo":"numero","obrigatorio":false}]', true, 10),
  ('ALM','Requisição de material',
   '[{"chave":"finalidade","rotulo":"Finalidade","tipo":"texto","obrigatorio":true},
     {"chave":"retirada","rotulo":"Forma de retirada","tipo":"lista","obrigatorio":true,"opcoes":["Retirar no almoxarifado","Entregar no setor"]}]', true, 2),
  ('ALM','Reposição de estoque',
   '[{"chave":"motivo","rotulo":"Motivo","tipo":"lista","obrigatorio":true,"opcoes":["Estoque mínimo atingido","Demanda extraordinária","Reposição programada"]}]', true, 7),
  ('PAT','Transferência de bem',
   '[{"chave":"tombo","rotulo":"Nº de tombo","tipo":"texto","obrigatorio":true},
     {"chave":"origem","rotulo":"Local de origem","tipo":"texto","obrigatorio":true},
     {"chave":"destino","rotulo":"Local de destino","tipo":"texto","obrigatorio":true},
     {"chave":"recebedor","rotulo":"Quem recebe","tipo":"texto","obrigatorio":true}]', true, 5),
  ('PAT','Manutenção de bem',
   '[{"chave":"tombo","rotulo":"Nº de tombo","tipo":"texto","obrigatorio":true},
     {"chave":"defeito","rotulo":"Defeito relatado","tipo":"longo","obrigatorio":true},
     {"chave":"garantia","rotulo":"Está na garantia?","tipo":"lista","obrigatorio":true,"opcoes":["Sim","Não","Não sei"]}]', true, 10),
  ('PAT','Baixa de bem',
   '[{"chave":"tombo","rotulo":"Nº de tombo","tipo":"texto","obrigatorio":true},
     {"chave":"motivo","rotulo":"Motivo da baixa","tipo":"lista","obrigatorio":true,"opcoes":["Obsolescência","Perda total","Extravio","Doação","Venda"]},
     {"chave":"laudo","rotulo":"Nº do laudo","tipo":"texto","obrigatorio":false}]', true, 15),
  ('COM','Requisição de compra',
   '[{"chave":"justificativa","rotulo":"Justificativa","tipo":"longo","obrigatorio":true},
     {"chave":"centro","rotulo":"Centro de custo","tipo":"texto","obrigatorio":true},
     {"chave":"urgencia","rotulo":"Prazo desejado","tipo":"data","obrigatorio":false}]', true, 10),
  ('TI','Suporte técnico',
   '[{"chave":"equipamento","rotulo":"Equipamento","tipo":"texto","obrigatorio":true},
     {"chave":"problema","rotulo":"O que está acontecendo","tipo":"longo","obrigatorio":true}]', false, 2),
  ('TI','Liberação de acesso',
   '[{"chave":"sistema","rotulo":"Sistema","tipo":"texto","obrigatorio":true},
     {"chave":"perfil","rotulo":"Perfil de acesso","tipo":"texto","obrigatorio":true},
     {"chave":"prazo","rotulo":"Até quando","tipo":"data","obrigatorio":false}]', true, 3),
  ('MAN','Serviço predial',
   '[{"chave":"local","rotulo":"Local","tipo":"texto","obrigatorio":true},
     {"chave":"servico","rotulo":"Serviço necessário","tipo":"longo","obrigatorio":true},
     {"chave":"risco","rotulo":"Há risco de acidente?","tipo":"lista","obrigatorio":true,"opcoes":["Não","Sim"]}]', true, 7)
) as t(chave, nome, campos, aprova, sla) on t.chave = s.chave
where not exists (select 1 from fp_tipos x where x.setor_id = s.id and x.nome = t.nome);
