# Configuração do Supabase - SG-1205

1. Crie um projeto em <https://supabase.com>.
2. No SQL Editor, execute `supabase-schema.sql`.
3. Depois execute `supabase-seed.sql` para importar os 152 itens de `data.js`.
   A carga de 12/06/2026 também adiciona a coluna `observacao` ao histórico,
   preserva os IDs das tarefas existentes e remove somente os registros que
   foram desdobrados na nova planilha.
4. Em **Project Settings > API**, copie:
   - Project URL
   - Publishable/anon key
5. Cole os dois valores no início de `supabaseClient.js`.
6. Em **Authentication > Providers > Email**, desative **Confirm email** para manter o cadastro imediato pela interface atual.
7. Publique novamente os arquivos no GitHub Pages.

## Criar os usuários padrão

A criação de usuários confirmados usa a `service_role` e deve ser executada somente no ambiente
administrativo. O script é idempotente: usuários existentes não são duplicados.

```powershell
$env:SUPABASE_URL="https://SEU-PROJETO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="SUA-SERVICE-ROLE"
node scripts/ensure_supabase_users.js
```

O resultado aparece no terminal e também em `supabase-users-report.json`, contendo:

- usuários criados;
- usuários já existentes;
- possíveis erros.

Todos são criados com e-mail `nome@sg1205.local`, senha inicial `senha1234`, e-mail confirmado
e `must_change_password: true`, mantendo o login atual e a troca obrigatória no primeiro acesso.
Se uma conta padrão já existir e ainda não tiver a marca de primeiro acesso, o script adiciona
`must_change_password: true`. Contas com a marca `false` já trocaram a senha e são preservadas.

### GitHub Actions

O workflow `.github/workflows/ensure-supabase-users.yml` executa a mesma verificação
automaticamente. Cadastre estes secrets no repositório:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Nunca coloque a `service_role` em `supabaseClient.js`, no código publicado ou em commits.

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
