# Déploiement de Rémanence

Le jeu est **100% statique** (canvas + `localStorage`, aucun backend). Il se build en
fichiers HTML/JS/CSS purs et s'héberge n'importe où — ici sur **GitHub Pages**.

## Déploiement automatique (recommandé)

Un workflow GitHub Actions (`.github/workflows/deploy.yml`) build et publie le site
à chaque `push` sur `main`.

1. Crée un dépôt GitHub **nommé `remanence`** et pousse le code :
   ```bash
   git init
   git add .
   git commit -m "Rémanence"
   gh repo create remanence --public --source=. --push   # ou via l'interface GitHub
   ```
2. Sur GitHub : **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Chaque push déclenche le déploiement. Le site sera sur :
   ```
   https://<ton-pseudo>.github.io/remanence/
   ```

> Le dépôt **doit** s'appeler `remanence`, sinon les assets (`_next/...`) ne se
> chargent pas. Si tu choisis un autre nom, remplace `remanence` par ce nom dans
> `next.config.mjs`, `package.json` (`build:pages`) et `.github/workflows/deploy.yml`.
> Pour un domaine personnalisé (ou un dépôt `<pseudo>.github.io`), laisse
> `NEXT_PUBLIC_BASE_PATH` vide.

## Build local (test ou déploiement manuel)

```bash
pnpm install
pnpm build:pages   # génère le dossier out/ avec basePath=/remanence et .nojekyll
```

Le dossier `out/` contient le site complet. Tu peux le tester localement :

```bash
npx serve out
```

Pour un build sans basePath (domaine perso / racine) :

```bash
pnpm build          # out/ servi à la racine "/"
```

## Pourquoi pas de Cloudflare Worker ?

Le jeu n'a aucune route serveur ni base de données : toute la progression vit dans
le navigateur du joueur (`localStorage`). Un Worker n'apporterait rien ici, donc on
reste sur de l'hébergement statique simple.
