-- Execute no SQL Editor do Supabase para zerar tudo que foi adicionado no uso.
-- Depois execute supabase-seed.sql para carregar a nova base.

delete from storage.objects where bucket_id = 'fotos-sg1205';

truncate table
  public.historico_sg1205,
  public.fotos_sg1205,
  public.alteracoes_sg1205,
  public.itens_sg1205
restart identity cascade;
