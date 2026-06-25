# aiDeck Development Workflow

## Contexto

O atomic-skills depende do aiDeck para o dashboard. Durante development, precisamos testar mudanças no aiDeck antes de publicá-las no npm.

## Problema: Client-Server Mismatch

A branch `feat/dashboard-shell-polish` do aiDeck introduziu um novo formato de rotas:

| Componente | Rotas |
|-------------|-------|
| **Client novo** | `/api/consumers/:c/projects/:p/data/:s` |
| **Server legado** | `/api/projects/:id/state/:consumer` |

O server tem **dois routers**:
- `api-v2.js` — rotas novas `/api/consumers/...`
- `api.js` — rotas legadas `/api/projects/:id/state/:consumer`

Quando há mismatch, o dashboard carrega mas os dados dão 404.

## Workflow

### 1. Link aiDeck local

```bash
npm run dev:aideck:link
```

Isso:
1. Builda o aiDeck local (`../aideck`)
2. Cria symlink `node_modules/@henryavila/aideck` → `../aideck`
3. Restage runtime artifacts (bin + dashboard)

### 2. Verifique o status

```bash
npm run dev:aideck:status
```

Reporta:
- Versão instalada
- Se é symlink → para onde aponta
- Status do runtime

### 3. Restart o dashboard

```bash
npm run serve
```

### 4. Verifique que funciona

```bash
npm run verify:aideck:smoke
```

Isso testa as rotas de dados:
- `/api/consumers/atomic-skills/projects`
- `/api/consumers/atomic-skills/projects/:id/data/*`
- `/api/consumers/atomic-skills/initiatives`

**Se FAIL:** há client-server mismatch. Verifique:
- O aiDeck local está completo?
- Os dataSources estão registrados?
- O consumer está registrado?

### 5. Quando terminar, unlink

```bash
npm run dev:aideck:unlink
```

Volta ao pacote npm publicado.

## Troubleshooting

### "404 em /api/consumers/.../data/..."

**Causa:** Server não tem as rotas v2, ou o consumer não está registrado.

**Check:**
```bash
# Verificar se consumer está registrado
curl http://localhost:7777/api/consumers

# Verificar se o projeto está registrado
curl http://localhost:7777/api/consumers/atomic-skills/projects
```

### "symlink already exists"

**Causa:** `dev:aideck:link` já foi executado.

**Fix:** Execute `dev:aideck:unlink` primeiro, ou ignore.

### "npm run build falhou"

**Causa:** O aiDeck local tem erros de build.

**Fix:** Resolva no repo do aiDeck primeiro.

## Referências

- `scripts/dev-aideck.mjs` — orquestrador
- `scripts/verify-aideck-consumer.mjs` — verificador
- `../aideck` — repo do aiDeck (se sibling)
