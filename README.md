# EdeneBeauty Backend v2.0 — Documentation Complète

## Structure du projet

```
edenebeauty-v2/
├── server.js                  ← API Express.js (point d'entrée)
├── package.json               ← Dépendances npm
├── src/
│   ├── database.js            ← Schema SQLite, requêtes, transactions
│   ├── email.js               ← Service email + templates HTML
│   └── validation.js          ← Middleware validation des données
├── scripts/
│   ├── seed.js                ← Injection de données de démo (dev)
│   └── backup.js              ← Sauvegarde automatique DB + JSON
├── public/
│   └── index.html             ← Dashboard admin complet
└── data/
    ├── edenebeauty.db          ← Base de données SQLite (auto-créée)
    └── backups/               ← Sauvegardes automatiques
```

---

## Installation

```bash
cd edenebeauty-v2
npm install
npm start
# → http://localhost:3000        (dashboard admin)
# → http://localhost:3000/api/   (API REST)
```

### Mode développement (hot-reload)
```bash
npm run dev
```

### Injecter des données de démo
```bash
node scripts/seed.js   # insère 85 inscrits fictifs
```

### Sauvegarde manuelle
```bash
node scripts/backup.js
```

---

## Base de données (SQLite)

### Tables

| Table | Description |
|-------|-------------|
| `inscrits` | Table principale — tous les inscrits |
| `centres_interet` | Centres d'intérêt des clientes (relation 1-N) |
| `specialites_pro` | Spécialités des professionnelles (relation 1-N) |
| `pays_ref` | Référentiel de 29 pays avec zones géographiques |
| `tags` | Tags admin personnalisables |
| `inscrits_tags` | Liaison inscrits ↔ tags (M-N) |
| `historique` | Journal de toutes les actions (audit trail) |
| `emails_log` | Log de tous les emails envoyés |
| `stats_daily` | Statistiques quotidiennes |
| `config` | Configuration serveur (SMTP, etc.) |

### Schéma table `inscrits`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INTEGER PK | Identifiant auto-incrémenté |
| `uuid` | TEXT UNIQUE | UUID v4 public |
| `nom` | TEXT | Nom de famille |
| `prenom` | TEXT | Prénom |
| `email` | TEXT UNIQUE | Email (case-insensitive) |
| `telephone` | TEXT | Téléphone (optionnel) |
| `pays` | TEXT | Pays |
| `ville` | TEXT | Ville |
| `type_profil` | TEXT | `pro` ou `cliente` |
| `specialite` | TEXT | Spécialité principale (pros) |
| `status` | TEXT | `nouveau` / `contacté` / `en_cours` / `validé` / `refusé` |
| `source` | TEXT | Origine de l'inscription |
| `ip_address` | TEXT | IP (anonymisée en production) |
| `user_agent` | TEXT | Navigateur |
| `notes_admin` | TEXT | Notes internes |
| `created_at` | DATETIME | Date d'inscription |
| `updated_at` | DATETIME | Dernière modification (trigger auto) |

---

## API REST — Endpoints

### Inscription (public)

```
POST /api/register
```

**Body :**
```json
{
  "nom": "Diallo",
  "prenom": "Fatou",
  "email": "fatou.diallo@example.com",
  "telephone": "+33 6 12 34 56 78",
  "pays": "France",
  "ville": "Paris",
  "type_profil": "cliente",
  "centres_interet": ["Coiffure afro", "Skincare", "Maquillage"],
  "source": "instagram"
}
```

**Ou pour une pro :**
```json
{
  "nom": "Koné",
  "prenom": "Sofia",
  "email": "sofia.kone@example.com",
  "type_profil": "pro",
  "specialite": "Coiffure afro & texturée",
  "pays": "Côte d'Ivoire",
  "ville": "Abidjan"
}
```

**Réponses :**
- `201` — Inscription réussie
- `400` — Données invalides (détail dans `errors[]`)
- `409` — Email déjà inscrit
- `429` — Trop de tentatives (rate limit)
- `500` — Erreur serveur

---

### Liste des inscrits (admin)

```
GET /api/registrations
```

**Query params :**

| Param | Valeurs | Description |
|-------|---------|-------------|
| `type` | `tous` `pro` `cliente` | Filtrer par type |
| `status` | `nouveau` `contacté` `en_cours` `validé` `refusé` | Filtrer par statut |
| `pays` | ex: `France` | Filtrer par pays |
| `search` | texte libre | Recherche nom/email/ville/tel |
| `page` | entier (défaut: 1) | Pagination |
| `limit` | entier (défaut: 50, max: 5000) | Résultats par page |

**Réponse :**
```json
{
  "data": [...],
  "total": 47,
  "page": 1,
  "pages": 2
}
```

---

### Détail inscrit (admin)

```
GET /api/registrations/:id
```

Retourne l'inscrit avec ses centres d'intérêt, spécialités, tags, historique et emails.

---

### Modifier inscrit (admin)

```
PATCH /api/registrations/:id
```

```json
{
  "status": "validé",
  "notes_admin": "Rendez-vous pris pour le 15/01"
}
```

---

### Supprimer inscrit (admin)

```
DELETE /api/registrations/:id
```

---

### Envoyer un email (admin)

```
POST /api/registrations/:id/email
```

**Avec template :**
```json
{ "template": "confirmation" }
```

**Ou personnalisé :**
```json
{
  "sujet_custom": "Votre accès EdeneBeauty est prêt",
  "corps_custom": "<p>Bonjour, voici votre lien d'accès...</p>"
}
```

**Templates disponibles :**
- `confirmation` — Email de confirmation d'inscription
- `welcome_pro` — Bienvenue professionnelle

---

### Statistiques (admin)

```
GET /api/stats
```

Retourne : total, pros, clientes, nouveaux, validés, cette semaine, ce mois, par statut, par pays, par zone géographique, par jour (60j), spécialités, centres d'intérêt, sources.

---

### Export CSV (admin)

```
GET /api/export
GET /api/export?type=pro
GET /api/export?type=cliente
GET /api/export?status=validé
```

CSV UTF-8 avec BOM (compatible Excel), incluant tous les champs.

---

### Export JSON (admin)

```
GET /api/export/json
```

---

### Tags (admin)

```
GET  /api/tags                        ← Liste des tags
POST /api/tags                        ← Créer un tag  { "label": "VIP", "color": "#C9A96E" }
POST /api/registrations/:id/tags      ← Ajouter tag   { "tag_id": 1 }
DELETE /api/registrations/:id/tags/:tagId  ← Retirer tag
```

---

### Historique (admin)

```
GET /api/historique/:id    ← Journal des actions d'un inscrit
```

---

### Emails log (admin)

```
GET /api/emails            ← Log des 200 derniers emails
```

---

### Configuration (admin)

```
GET /api/config            ← Lire la configuration
PUT /api/config            ← Modifier la configuration
```

**Clés configurables :**
- `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`
- `email_from`
- `email_confirmation_active` (`0` ou `1`)
- `site_nom`, `site_url`
- `admin_password`

---

### Health check

```
GET /api/health
```

---

## Configuration SMTP

Pour activer les emails de confirmation automatiques :

1. Ouvrir le dashboard → **Configuration**
2. Renseigner SMTP (Gmail, Sendgrid, Mailgun, etc.)
3. Activer "Confirmation automatique"
4. Enregistrer

### Exemple avec Gmail
```
smtp_host: smtp.gmail.com
smtp_port: 587
smtp_user: votre@gmail.com
smtp_pass: [App Password Google]  ← pas votre mot de passe normal
email_from: EdeneBeauty <votre@gmail.com>
```

> Pour Gmail : activer la validation en 2 étapes, puis générer un "App Password" dans les paramètres du compte.

---

## Dashboard Admin

Accessible à `http://localhost:3000/`

### Fonctionnalités

**Vue Dashboard :**
- Compteurs : total, pros, clientes, à contacter, semaine, mois, taux de validation
- Graphique timeline (30 jours d'inscriptions)
- Donut pro/cliente
- Graphiques : top pays, spécialités, centres d'intérêt, statuts

**Gestion Inscrits :**
- Liste paginée (25 par page)
- Filtres : recherche texte, statut, pays
- Segments séparés : Pros / Clientes

**Fiche détail (popup) :**
- Onglet Informations : toutes les données, centres d'intérêt / spécialité
- Onglet Statut & Notes : modifier le statut (5 valeurs), notes internes
- Onglet Envoyer email : templates ou email personnalisé
- Onglet Historique : journal complet des actions

**Export :**
- CSV avec tous les champs (UTF-8 BOM pour Excel)
- Filtrable par type / statut

**Configuration :**
- SMTP, emails automatiques, informations site, mot de passe admin

---

## Intégration landing page

```javascript
// Formulaire de pré-inscription
async function inscrire(formData) {
  const response = await fetch('https://votre-backend.com/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom:              formData.nom,
      prenom:           formData.prenom,
      email:            formData.email,
      telephone:        formData.telephone,
      pays:             formData.pays,
      ville:            formData.ville,
      type_profil:      formData.type,        // 'pro' ou 'cliente'
      specialite:       formData.specialite,  // si pro
      centres_interet:  formData.centres,     // si cliente, tableau
      source:           'landing_page'        // ou 'instagram', etc.
    })
  });

  const result = await response.json();

  if (response.ok) {
    // Succès → afficher message
    console.log(result.message);
  } else if (response.status === 409) {
    // Email déjà inscrit
    alert(result.error);
  } else {
    // Erreur de validation
    console.error(result.errors);
  }
}
```

---

## Déploiement

### Railway (recommandé — gratuit)
```bash
# 1. Push sur GitHub
# 2. Connecter sur railway.app
# 3. New Project → Deploy from GitHub repo
# 4. Railway détecte Node.js automatiquement
# 5. URL HTTPS générée automatiquement
```

### Render (gratuit)
```
Build Command: npm install
Start Command: npm start
```

### VPS Ubuntu
```bash
sudo apt update && sudo apt install nodejs npm nginx -y
npm install -g pm2

cd /var/www/edenebeauty
npm install
pm2 start server.js --name edenebeauty
pm2 startup && pm2 save

# Nginx reverse proxy
server {
    listen 80;
    server_name api.edenebeauty.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Variables d'environnement
```bash
PORT=3000                    # Port (défaut: 3000)
NODE_ENV=production          # Désactive le endpoint /api/dev/seed
```

---

## Backup automatique (cron)

```bash
# Backup quotidien à 2h du matin
0 2 * * * node /var/www/edenebeauty/scripts/backup.js >> /var/log/edenebeauty-backup.log 2>&1
```

Les backups sont stockés dans `data/backups/` et nettoyés automatiquement après 30 jours.

---

## Sécurité

- Rate limiting sur `/api/register` (10 tentatives / 15 min par IP)
- Helmet.js (headers HTTP sécurisés)
- Validation stricte des données (email, téléphone, type_profil)
- Unicité email (COLLATE NOCASE)
- Paramètres SQLite préparés (protection injection SQL)
- Logs d'audit (historique de toutes les actions)

---

## Support

Pour toute question : contact@edenebeauty.com
