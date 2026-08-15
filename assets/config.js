/* ============================================================================
   Conexão com o Supabase.
   Troque os três primeiros valores pelos do SEU projeto:
   Supabase → Project Settings → API → Project URL e a chave "publishable"
   (ou a legada "anon"). Essa chave é pública por natureza; quem protege os
   dados é a RLS que está em supabase/01_schema.sql.
   ========================================================================== */
window.CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_KEY: 'SUA-CHAVE-PUBLICAVEL',

  /* O login é por usuário + senha. O Supabase ancora cada conta num e-mail
     interno montado a partir do usuário (ex.: maria.silva@fecomercio.local).
     Esse endereço nunca recebe mensagem: serve só como identificador. */
  DOMINIO_INTERNO: 'fecomercio.local',

  /* Endereço público do sistema — é o que vai dentro do QR das etiquetas.
     Apontar a câmera do celular abre direto a ficha do bem ou do material. */
  URL_BASE: 'https://fecomercio-patrimonio.vercel.app',

  ENTIDADE: 'Fecomércio PE',
  UNIDADE: 'Sede administrativa'
};
