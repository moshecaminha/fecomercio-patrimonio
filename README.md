# Fecomércio Patrimônio

Plataforma de gestão de demandas por setor: financeiro, RH, almoxarifado, patrimônio, compras, TI, manutenção — e qualquer outro setor que o administrador cadastrar depois.

Cada setor tem base própria de demandas, fluxo próprio de tramitação e acesso próprio. O usuário só vê o que o administrador liberou para ele. Tudo o que se move fisicamente (bem patrimonial ou material de almoxarifado) carrega uma etiqueta QR: apontar a câmera abre direto a ficha de movimentação.

- **Front-end:** HTML, CSS e JavaScript puro, sem build. Basta publicar a pasta.
- **Banco e autenticação:** Supabase (PostgreSQL + Auth + RLS).
- **Hospedagem:** Vercel, ligada ao repositório do GitHub.

---

## 1. Estrutura de arquivos

```
index.html                     tela de acesso + casca da aplicação
vercel.json                    configuração de publicação
assets/
  logo.png                     logomarca Fecomércio PE
  config.js                    URL e chave do Supabase (o que você edita)
  styles.css                   identidade visual (branco, azul #004A8D, dourado #C89633)
  nucleo.js                    sessão, permissões, carga de dados, navegação
  demandas.js                  painel, abertura, trilho de acompanhamento, decisão
  patrimonio.js                bens, almoxarifado, leitor QR, etiquetas
  relatorios.js                relatórios por setor, solicitante, tipo e item
  admin.js                     pessoas, acessos, setores, fluxos e tipos
  acoes.js                     ligação dos botões com as funções
supabase/
  01_schema.sql                tabelas, funções e políticas de segurança
  02_dados_iniciais.sql        setores, estações de fluxo e tipos prontos
```

## 2. Modelo de dados

| Tabela | Para que serve |
|---|---|
| `fp_perfis` | Quem é cada pessoa e qual o papel (administrador, gestor, solicitante). |
| `fp_convites` | Liberação prévia feita pelo administrador. Sem convite, ninguém entra. |
| `fp_setores` | Os setores. Cada um com sigla, cor e recursos (itens, valores, etiqueta QR). |
| `fp_acessos` | Usuário × setor × nível: acompanhar, solicitar, aprovar ou gerir. |
| `fp_etapas` | As estações do fluxo de cada setor — a localização atual da demanda. |
| `fp_tipos` | Tipos de demanda e os campos que cada um pergunta (JSON configurável). |
| `fp_demandas` | A demanda: protocolo, situação, etapa atual, prazo, valor, dados preenchidos. |
| `fp_itens` | Itens pedidos em cada demanda — base do relatório por item. |
| `fp_tramites` | Histórico completo: abertura, comentários, aprovações, movimentações. |
| `fp_bens` / `fp_bem_mov` | Patrimônio: bens com nº de tombo e todo o histórico de local e responsável. |
| `fp_produtos` / `fp_movimentos` | Almoxarifado: saldo, mínimo, máximo e cada entrada e baixa. |
| `fp_fornecedores` | Fornecedores usados por compras e almoxarifado. |

Níveis de acesso, do menor para o maior:

| Nível | O que a pessoa faz no setor |
|---|---|
| `acompanhar` | Vê as demandas e o andamento. Não abre nem decide. |
| `solicitar` | Abre demandas e acompanha as próprias e as do setor. |
| `aprovar` | Aprova, reprova, movimenta entre estações e conclui. |
| `gerir` | Tudo acima, mais os cadastros do setor. |

O papel `admin` enxerga e administra todos os setores, independentemente de `fp_acessos`.

## 3. Publicação

### 3.1 Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. **SQL Editor** → cole e rode `supabase/01_schema.sql` inteiro.
3. Rode `supabase/02_dados_iniciais.sql` (setores, fluxos e tipos já prontos).
4. **Authentication → Sign In / Providers**: mantenha o provedor **Email** ativado, **desligue "Confirm email"** e mantenha **"Allow new users to sign up"** ligado. O cadastro fica protegido pelos convites, não pelo Supabase.
5. **Project Settings → API**: copie a *Project URL* e a chave *publishable* (ou a legada *anon*).

### 3.2 config.js

Edite `assets/config.js`:

```js
SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
SUPABASE_KEY: 'sb_publishable_...',
DOMINIO_INTERNO: 'fecomercio.local',
URL_BASE: 'https://fecomercio-patrimonio.vercel.app',
```

`URL_BASE` é o endereço que vai dentro do QR das etiquetas. Publique primeiro, pegue o domínio da Vercel e volte aqui para ajustar — depois disso, reimprima as etiquetas.

### 3.3 GitHub

```bash
git init
git add .
git commit -m "Fecomércio Patrimônio — primeira versão"
git branch -M main
git remote add origin https://github.com/SUA-ORG/fecomercio-patrimonio.git
git push -u origin main
```

### 3.4 Vercel

1. **Add New → Project** e escolha o repositório.
2. Framework Preset: **Other**. Sem build command, sem output directory.
3. Deploy. Cada `git push` na `main` publica de novo.

O QR exige HTTPS para a câmera funcionar — a Vercel já entrega assim.

## 4. Primeiro acesso

1. Abra o site. Como ainda não existe administrador, a tela pede **criação do administrador**.
2. Crie o usuário (ex.: `admin`), com nome completo e senha.
3. Depois desse cadastro, a criação livre de contas fecha automaticamente.
4. Vá em **Administração → Pessoas e acessos**, informe usuário, nome, papel e o nível em cada setor.
5. Passe o nome de usuário para a pessoa. Ela entra em **"Defina sua senha"** na tela de acesso, escolhe a senha e já cai no seu painel com os setores liberados.

## 5. Como o fluxo funciona

1. O solicitante escolhe **setor → tipo de demanda**, e o formulário se monta com os campos daquele tipo.
2. O sistema gera o protocolo (`FIN-2026-0001`) e coloca a demanda na primeira estação do fluxo.
3. Quem tem nível `aprovar` no setor vê a demanda em "Esperando sua decisão", aprova ou reprova com parecer.
4. A cada movimentação, a demanda muda de estação e o **trilho** mostra onde ela está — inclusive a localização física, quando existe.
5. Ao chegar na estação de encerramento, a demanda é concluída e entra nos relatórios de tempo médio.

Tudo isso é configurável por setor em **Administração → Fluxos e tipos**: as estações, os prazos, os campos de cada tipo e se o tipo passa ou não por aprovação.

## 6. Etiquetas QR

- **Etiquetas QR** gera as etiquetas de bens (nº de tombo) e de materiais (código).
- O QR aponta para `URL_BASE/?t=b&c=TOMBO` (bem) ou `?t=p&c=CODIGO` (material).
- Quem bipa cai direto na ficha: no bem, o formulário de transferência; no material, a baixa de estoque.
- A baixa pode ser vinculada a uma demanda aberta — o movimento aparece no histórico dela.

## 7. Manutenção

- **Novo setor:** Administração → Setores → Novo setor. Depois monte as estações e os tipos dele.
- **Alguém saiu:** Administração → Pessoas → Desativar. O histórico permanece intacto.
- **Backup:** Supabase → Database → Backups, e os CSV exportados por Relatórios.
