-- Execute no SQL Editor do Supabase.
-- A tabela itens_sg1205 aceita os dados originais em JSONB para preservar o formato do data.js.

create table if not exists public.itens_sg1205 (
  id bigint primary key,
  dados jsonb not null
);

create table if not exists public.alteracoes_sg1205 (
  item_id bigint primary key references public.itens_sg1205(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  observacao text not null default '',
  auditoria_conclusao jsonb not null default '{}'::jsonb,
  usuario text not null,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.historico_sg1205 (
  id bigint generated always as identity primary key,
  item_id bigint references public.itens_sg1205(id) on delete cascade,
  item text,
  equipamento text,
  campo text not null,
  status text not null,
  usuario text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.fotos_sg1205 (
  id text primary key,
  item_id bigint references public.itens_sg1205(id) on delete cascade,
  caminho text not null unique,
  nome text,
  usuario text not null,
  criado_em timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('fotos-sg1205', 'fotos-sg1205', true)
on conflict (id) do update set public = true;

alter table public.itens_sg1205 enable row level security;
alter table public.alteracoes_sg1205 enable row level security;
alter table public.historico_sg1205 enable row level security;
alter table public.fotos_sg1205 enable row level security;

create policy "Leitura publica dos itens SG-1205"
on public.itens_sg1205 for select to anon, authenticated using (true);

create policy "Leitura publica das alteracoes SG-1205"
on public.alteracoes_sg1205 for select to anon, authenticated using (true);
create policy "Usuarios autenticados alteram SG-1205"
on public.alteracoes_sg1205 for all to authenticated using (true) with check (true);

create policy "Leitura publica do historico SG-1205"
on public.historico_sg1205 for select to anon, authenticated using (true);
create policy "Usuarios autenticados criam historico SG-1205"
on public.historico_sg1205 for insert to authenticated with check (true);

create policy "Leitura publica das fotos SG-1205"
on public.fotos_sg1205 for select to anon, authenticated using (true);
create policy "Usuarios autenticados alteram fotos SG-1205"
on public.fotos_sg1205 for all to authenticated using (true) with check (true);

create policy "Leitura publica dos arquivos SG-1205"
on storage.objects for select to anon, authenticated
using (bucket_id = 'fotos-sg1205');
create policy "Usuarios autenticados enviam arquivos SG-1205"
on storage.objects for insert to authenticated
with check (bucket_id = 'fotos-sg1205');
create policy "Usuarios autenticados removem arquivos SG-1205"
on storage.objects for delete to authenticated
using (bucket_id = 'fotos-sg1205');

grant select on public.itens_sg1205 to anon, authenticated;
grant select on public.alteracoes_sg1205, public.historico_sg1205, public.fotos_sg1205 to anon, authenticated;
grant insert, update, delete on public.alteracoes_sg1205, public.fotos_sg1205 to authenticated;
grant insert on public.historico_sg1205 to authenticated;
grant usage, select on sequence public.historico_sg1205_id_seq to authenticated;

alter publication supabase_realtime add table public.itens_sg1205;
alter publication supabase_realtime add table public.alteracoes_sg1205;
alter publication supabase_realtime add table public.historico_sg1205;
alter publication supabase_realtime add table public.fotos_sg1205;

-- Importe a base no formato:
-- insert into public.itens_sg1205 (id, dados) values (1, '{"id":1,...}'::jsonb);
-- Em Authentication > Providers > Email, desative Confirm email se quiser manter
-- o cadastro imediato pela tela atual usando os e-mails internos @sg1205.local.
