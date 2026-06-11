# Configuração do Supabase - SG-1205

1. Crie um projeto em <https://supabase.com>.
2. No SQL Editor, execute `supabase-schema.sql`.
3. Depois execute `supabase-seed.sql` para importar os 149 itens de `data.js`.
4. Em **Project Settings > API**, copie:
   - Project URL
   - Publishable/anon key
5. Cole os dois valores no início de `supabaseClient.js`.
6. Em **Authentication > Providers > Email**, desative **Confirm email** para manter o cadastro imediato pela interface atual.
7. Publique novamente os arquivos no GitHub Pages.

## Arquivos e tabelas

- `itens_sg1205`: base principal, carregada antes de `data.js`.
- `alteracoes_sg1205`: status, observação, usuário, data e auditoria.
- `historico_sg1205`: histórico exibido na aba Relatório.
- `fotos_sg1205`: metadados das fotos.
- Bucket `fotos-sg1205`: arquivos das fotos.

## Realtime

O arquivo `supabase-schema.sql` adiciona as quatro tabelas à publicação `supabase_realtime`.
Celular e notebook recebem as alterações automaticamente.

## Segurança

A ANON KEY pode ficar no frontend quando o Row Level Security está ativo. Não coloque a
`service_role` key em `supabaseClient.js` nem no GitHub.

## Atualizar a carga inicial

Após alterar `data.js`, gere novamente o SQL:

```powershell
node scripts/generate_supabase_seed.js
```

Execute o novo `supabase-seed.sql` no SQL Editor. Alterações realizadas pelos usuários ficam
separadas em `alteracoes_sg1205` e não são apagadas pela atualização da base.
