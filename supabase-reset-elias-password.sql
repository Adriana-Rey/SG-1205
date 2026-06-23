-- Redefine a senha do usuario Elias para senha1234.
-- Execute este arquivo no Supabase SQL Editor.
-- A conta continuara exigindo troca de senha no proximo acesso.

begin;

with usuario_atualizado as (
  update auth.users
  set
    encrypted_password = crypt('senha1234', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_sent_at = null,
    recovery_sent_at = null,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'username', 'Elias',
        'must_change_password', true
      ),
    updated_at = now()
  where lower(email) = 'elias@sg1205.local'
  returning id, email
)
select
  case
    when exists (select 1 from usuario_atualizado)
      then 'Senha do Elias redefinida para senha1234. Troca obrigatoria no proximo acesso.'
    else 'Usuario elias@sg1205.local nao encontrado.'
  end as resultado;

commit;
