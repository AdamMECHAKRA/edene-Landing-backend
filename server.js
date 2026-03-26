/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║           EDENEBEAUTY — BACKEND API v2.0                  ║
 * ║     Express.js + SQLite · Toutes fonctionnalités          ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * Routes :
 *  POST   /api/register                  Inscription landing page
 *  GET    /api/registrations             Liste filtrée + pagination
 *  GET    /api/registrations/:id         Détail complet
 *  PATCH  /api/registrations/:id         Modifier status / notes
 *  DELETE /api/registrations/:id         Supprimer
 *  POST   /api/registrations/:id/email   Envoyer email manuel
 *  POST   /api/registrations/:id/tags    Ajouter tag
 *  DELETE /api/registrations/:id/tags/:tagId  Retirer tag
 *  GET    /api/stats                     Statistiques
 *  GET    /api/export                    Export CSV
 *  GET    /api/export/json               Export JSON
 *  GET    /api/pays                      Référentiel pays
 *  GET    /api/tags                      Liste tags
 *  POST   /api/tags                      Créer tag
 *  GET    /api/historique/:id            Historique d'un inscrit
 *  GET    /api/emails                    Log emails
 *  GET    /api/config                    Lire config
 *  PUT    /api/config                    Modifier config
 *  GET    /api/health                    Health check
 *  GET    /                              Dashboard admin
 */

'use strict';

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const path        = require('path');
const { v4: uuidv4 } = require('uuid');

const { db, queries, createInscrit, getInscrits, getStats, DB_PATH, turso, syncFromTurso } = require('./src/database');
// ── Notification email admin
const nodemailer = require('nodemailer');

function createAdminTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function notifierAdmin(inscrit, centres, specialite) {
  const transporter = createAdminTransporter();
  if (!transporter) {
    console.log('[Email Admin] SMTP non configuré');
    return;
  }

  const estPro = inscrit.type_profil === 'pro';
  const sujet  = `[EdeneBeauty] Nouvelle ${estPro ? 'Professionnelle' : 'Cliente'} — ${inscrit.prenom} ${inscrit.nom}`;

  const corps = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <div style="background:#14227A;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:1px;">EdeneBeauty</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Nouvelle inscription reçue</p>
    </div>

    <div style="padding:28px 32px;">

      <div style="background:${estPro ? '#EEF2FF' : '#FFF0F6'};border-left:4px solid ${estPro ? '#14227A' : '#ff8fa3'};padding:12px 16px;border-radius:6px;margin-bottom:24px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#14227A;">
          ${estPro ? '💼 Professionnelle' : '✨ Future Cliente'}
        </p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;color:#888;width:140px;">Prénom Nom</td>
          <td style="padding:10px 0;font-weight:600;color:#1a1a1a;">${inscrit.prenom} ${inscrit.nom}</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;color:#888;">Email</td>
          <td style="padding:10px 0;"><a href="mailto:${inscrit.email}" style="color:#14227A;">${inscrit.email}</a></td>
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;color:#888;">Téléphone</td>
          <td style="padding:10px 0;color:#1a1a1a;">${inscrit.telephone || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;color:#888;">Localisation</td>
          <td style="padding:10px 0;color:#1a1a1a;">${[inscrit.ville, inscrit.pays].filter(Boolean).join(', ') || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;color:#888;">Source</td>
          <td style="padding:10px 0;color:#1a1a1a;">${inscrit.source || 'landing_page'}</td>
        </tr>
        ${estPro ? `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;color:#888;">Spécialité</td>
          <td style="padding:10px 0;font-weight:600;color:#14227A;">${specialite || '—'}</td>
        </tr>
        ` : `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;color:#888;">Centres d'intérêt</td>
          <td style="padding:10px 0;color:#1a1a1a;">${centres && centres.length ? centres.join(', ') : '—'}</td>
        </tr>
        `}
        <tr>
          <td style="padding:10px 0;color:#888;">Date</td>
          <td style="padding:10px 0;color:#1a1a1a;">${new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
        </tr>
      </table>

      <div style="margin-top:24px;text-align:center;">
        <a href="https://api.edeneapp.com/admin.html"
           style="display:inline-block;background:#14227A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Voir dans le dashboard →
        </a>
      </div>

    </div>

    <div style="background:#f9f9f9;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;font-size:11px;color:#aaa;">EdeneBeauty · edeneapp.com</p>
    </div>

  </div>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: `"EdeneBeauty" <${process.env.SMTP_USER}>`,
      to:   process.env.ADMIN_EMAIL,
      subject: sujet,
      html: corps,
    });
    console.log('[Email Admin] Notification envoyée pour:', inscrit.email);
  } catch(err) {
    console.error('[Email Admin] Erreur:', err.message);
  }
}

// Init schema Turso au démarrage
if (turso) {
  (async () => {
    try {
      await turso.execute(`CREATE TABLE IF NOT EXISTS inscrits (
        id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL UNIQUE,
        nom TEXT NOT NULL, prenom TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        telephone TEXT, pays TEXT, ville TEXT,
        type_profil TEXT NOT NULL DEFAULT 'cliente',
        specialite TEXT, centres_interet TEXT,
        status TEXT DEFAULT 'nouveau',
        source TEXT, ip_address TEXT, notes_admin TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
      )`);
      await turso.execute(`ALTER TABLE inscrits ADD COLUMN notes_admin TEXT`).catch(() => {});
      await turso.execute(`ALTER TABLE inscrits ADD COLUMN centres_interet TEXT`).catch(() => {});
      console.log('[Turso] Schema OK');
    } catch(e) {
      console.error('[Turso] Schema error:', e.message);
    }
  })();
}
const { sendConfirmation, sendEmail, templateConfirmation, templateWelcomePro } = require('./src/email');
const { validateInscription, validateStatusUpdate, SPECIALITES_PRO, CENTRES_INTERET } = require('./src/validation');

// ─────────────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE'] }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// Rate limiting sur l'inscription
try {
  const rateLimit = require('express-rate-limit');
  app.use('/api/register', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 10,
    message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' }
  }));
} catch {}

// IP helper
function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
}

// ─────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────

// ── HEALTH CHECK ──────────────────────────────────
app.get('/api/health', (req, res) => {
  const { statTotal } = require('./src/database');
  res.json({
    status: 'ok',
    version: '2.0.0',
    db: DB_PATH,
    inscrits: queries.statTotal.get().n,
    timestamp: new Date().toISOString(),
  });
});

// ── RÉFÉRENTIEL PAYS ──────────────────────────────
app.get('/api/pays', (req, res) => {
  const pays = queries.getAllPays.all();
  const zones = [...new Set(pays.map(p => p.zone).filter(Boolean))];
  res.json({ pays, zones });
});

// ── RÉFÉRENTIEL SPÉCIALITÉS & CENTRES ─────────────
app.get('/api/referentiel', (req, res) => {
  res.json({ specialites: SPECIALITES_PRO, centres_interet: CENTRES_INTERET });
});

// ─────────────────────────────────────────────────
// INSCRIPTION (PUBLIC)
// ─────────────────────────────────────────────────
app.post('/api/register', validateInscription, async (req, res) => {
  const {
    nom, prenom, email, telephone, pays, ville,
    type_profil, specialite, centres_interet, source
  } = req.body;

  // Vérifier doublon email
  const existing = queries.getByEmail.get(email);
  if (existing) {
    return res.status(409).json({
      error: 'Cette adresse email est déjà inscrite. Vous faites déjà partie de la communauté EdeneBeauty !'
    });
  }

  try {
    const uuid = uuidv4();

    const id = createInscrit({
      uuid, nom, prenom, email,
      telephone: telephone || null,
      pays: pays || null,
      ville: ville || null,
      type_profil,
      specialite: type_profil === 'pro' ? (specialite || null) : null,
      centres_interet: type_profil === 'cliente'
        ? JSON.stringify(Array.isArray(centres_interet) ? centres_interet : [])
        : null,
      source: source || 'landing_page',
      ip_address: getIP(req),
      user_agent: req.headers['user-agent'] || null,
    });

    const inscrit = queries.getById.get(id);

    // Email de confirmation (async, non bloquant)
    sendConfirmation(inscrit).catch(console.error);
    // Notification admin
    notifierAdmin(
      inscrit,
      type_profil === 'cliente' ? (Array.isArray(centres_interet) ? centres_interet : []) : [],
      type_profil === 'pro' ? specialite : null
    ).catch(console.error);

    return res.status(201).json({
      success: true,
      message: 'Inscription réussie ! Bienvenue dans la communauté EdeneBeauty.',
      uuid,
      type_profil,
    });

  } catch (err) {
    console.error('[Register]', err);
    return res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer.' });
  }
});

// ─────────────────────────────────────────────────
// LISTE DES INSCRITS (ADMIN)
// ─────────────────────────────────────────────────
app.get('/api/registrations', (req, res) => {
  try {
    const result = getInscrits({
      type:   req.query.type,
      status: req.query.status,
      pays:   req.query.pays,
      search: req.query.search,
      page:   req.query.page   || 1,
      limit:  req.query.limit  || 50,
    });
    res.json(result);
  } catch (err) {
    console.error('[GetInscrits]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────
// DÉTAIL INSCRIT
// ─────────────────────────────────────────────────
app.get('/api/registrations/:id', (req, res) => {
  const inscrit = queries.getById.get(req.params.id);
  if (!inscrit) return res.status(404).json({ error: 'Inscrit introuvable.' });

  const historique = queries.getHist.all(req.params.id);
  const emails     = db.prepare(`
    SELECT * FROM emails_log WHERE inscrit_id = ? ORDER BY sent_at DESC LIMIT 20
  `).all(req.params.id);

  res.json({ ...inscrit, historique, emails });
});

// ─────────────────────────────────────────────────
// MODIFIER INSCRIT (status, notes)
// ─────────────────────────────────────────────────
app.patch('/api/registrations/:id', validateStatusUpdate, (req, res) => {
  const id = req.params.id;
  const { status, notes_admin } = req.body;

  const inscrit = queries.getById.get(id);
  if (!inscrit) return res.status(404).json({ error: 'Inscrit introuvable.' });

  if (status) {
    queries.updateStatus.run(status, notes_admin || null, id);
    queries.insertHistorique.run(
      id, 'status_change',
      `Statut: ${inscrit.status} → ${status}`,
      getIP(req)
    );
    if (turso) turso.execute({
      sql: `UPDATE inscrits SET status=?, notes_admin=COALESCE(?,notes_admin) WHERE uuid=?`,
      args: [status, notes_admin || null, inscrit.uuid]
    }).catch(e => console.error('[Turso] Erreur update status:', e.message));
  }

  if (notes_admin !== undefined && !status) {
    queries.updateNotes.run(notes_admin, id);
    queries.insertHist.run(id, 'note_update', 'Notes mises à jour', getIP(req));
    if (turso) turso.execute({
      sql: `UPDATE inscrits SET notes_admin=? WHERE uuid=?`,
      args: [notes_admin, inscrit.uuid]
    }).catch(e => console.error('[Turso] Erreur update notes:', e.message));
  }

  res.json({ success: true, inscrit: queries.getById.get(id) });
});

// ─────────────────────────────────────────────────
// SUPPRIMER INSCRIT
// ─────────────────────────────────────────────────
app.delete('/api/registrations/:id', (req, res) => {
  const inscrit = queries.getById.get(req.params.id);
  if (!inscrit) return res.status(404).json({ error: 'Inscrit introuvable.' });

  queries.delete.run(req.params.id);
  queries.insertHist.run(null, 'delete', `Suppression inscrit #${req.params.id} — ${inscrit.email}`, getIP(req));

  if (turso) turso.execute({
    sql: `DELETE FROM inscrits WHERE uuid=?`,
    args: [inscrit.uuid]
  }).catch(e => console.error('[Turso] Erreur delete:', e.message));

  res.json({ success: true });
});

// ─────────────────────────────────────────────────
// ENVOYER EMAIL MANUEL
// ─────────────────────────────────────────────────
app.post('/api/registrations/:id/email', async (req, res) => {
  const inscrit = queries.getById.get(req.params.id);
  if (!inscrit) return res.status(404).json({ error: 'Inscrit introuvable.' });

  const { template, sujet_custom, corps_custom } = req.body;

  let sujet, corps;

  if (template === 'confirmation') {
    const tpl = templateConfirmation(inscrit);
    sujet = tpl.sujet; corps = tpl.corps;
  } else if (template === 'welcome_pro') {
    const tpl = templateWelcomePro(inscrit);
    sujet = tpl.sujet; corps = tpl.corps;
  } else if (sujet_custom && corps_custom) {
    sujet = sujet_custom; corps = corps_custom;
  } else {
    return res.status(400).json({ error: 'Template ou sujet/corps requis.' });
  }

  const result = await sendEmail(inscrit.id, inscrit.email, sujet, corps);
  queries.insertHistorique.run(inscrit.id, 'email_sent', `Email: "${sujet}"`, getIP(req));

  res.json({ success: result.success, ...result });
});

// ─────────────────────────────────────────────────
// TAGS
// ─────────────────────────────────────────────────
app.get('/api/tags', (req, res) => {
  res.json(queries.getAllTags.all());
});

app.post('/api/tags', (req, res) => {
  const { label, color } = req.body;
  if (!label) return res.status(400).json({ error: 'Label requis.' });
  queries.insertTag.run(label.trim(), color || '#C9A96E');
  const tag = queries.getTagByLabel.get(label.trim());
  res.status(201).json(tag);
});

app.post('/api/registrations/:id/tags', (req, res) => {
  const { tag_id } = req.body;
  if (!tag_id) return res.status(400).json({ error: 'tag_id requis.' });
 queries.addTag.run(req.params.id, tag_id);
  queries.insertHist.run(req.params.id, 'tag_add', `Tag ajouté: ${tag_id}`, getIP(req));
  res.json({ success: true });
});

app.delete('/api/registrations/:id/tags/:tagId', (req, res) => {
  queries.removeTag.run(req.params.id, req.params.tagId);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────
// HISTORIQUE
// ─────────────────────────────────────────────────
app.get('/api/historique/:id', (req, res) => {
  res.json(queries.getHistorique.all(req.params.id));
});

// ─────────────────────────────────────────────────
// LOG EMAILS
// ─────────────────────────────────────────────────
app.get('/api/emails', (req, res) => {
  const emails = db.prepare(`
    SELECT el.*, i.nom, i.prenom FROM emails_log el
    LEFT JOIN inscrits i ON i.id = el.inscrit_id
    ORDER BY el.sent_at DESC LIMIT 200
  `).all();
  res.json(emails);
});

// ─────────────────────────────────────────────────
// STATISTIQUES
// ─────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  try {
    res.json(getStats());
  } catch (err) {
    console.error('[Stats]', err);
    res.status(500).json({ error: 'Erreur stats.' });
  }
});

// ─────────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────────
app.get('/api/export', (req, res) => {
  const { type, status, pays } = req.query;
  const result = getInscrits({ type, status, pays, limit: 99999 });
  const rows = result.data;

  const headers = [
    'ID','UUID','Nom','Prénom','Email','Téléphone','Pays','Ville',
    'Type','Spécialité','Centres d\'intérêt','Tags','Statut',
    'Source','Date inscription','Dernière MAJ'
  ];

  const csv = [
    headers.join(';'),
    ...rows.map(r => [
      r.id, r.uuid, r.nom, r.prenom, r.email,
      r.telephone || '', r.pays || '', r.ville || '',
      r.type_profil,
      r.specialite || r.specialites_multi || '',
      (r.centres || '').replace(/,/g, ' | '),
      (r.tags || '').replace(/,/g, ' | '),
      r.status || 'nouveau',
      r.source || 'landing_page',
      r.created_at, r.updated_at
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(';'))
  ].join('\n');

  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="edenebeauty_inscrits_${date}.csv"`);
  res.send('\uFEFF' + csv); // BOM UTF-8
});

// ─────────────────────────────────────────────────
// EXPORT JSON
// ─────────────────────────────────────────────────
app.get('/api/export/json', (req, res) => {
  const { type, status, pays } = req.query;
  const result = getInscrits({ type, status, pays, limit: 99999 });

  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="edenebeauty_inscrits_${date}.json"`);
  res.json({ exported_at: new Date().toISOString(), total: result.total, data: result.data });
});

// ─────────────────────────────────────────────────
// CONFIGURATION (ADMIN)
// ─────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const config = {};
  queries.getConfig.all().forEach(r => {
    // Ne pas exposer le mot de passe SMTP
    config[r.cle] = r.cle.includes('pass') ? '••••••••' : r.valeur;
  });
  res.json(config);
});

app.put('/api/config', (req, res) => {
  const updates = req.body;
  const allowed = [
    'smtp_host','smtp_port','smtp_user','smtp_pass',
    'email_from','email_confirmation_active',
    'admin_password','site_nom','site_url'
  ];

  let updated = 0;
  Object.entries(updates).forEach(([k, v]) => {
    if (allowed.includes(k)) {
      queries.setConfig.run(String(v), k);
      updated++;
    }
  });

  res.json({ success: true, updated });
});

// ─────────────────────────────────────────────────
// SCRIPT SEED (DEV)
// ─────────────────────────────────────────────────
app.post('/api/dev/seed', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Non disponible en production.' });
  }
  try {
    require('./scripts/seed').seed();
    res.json({ success: true, message: 'Données de démo insérées.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────
// SPA FALLBACK — Dashboard admin
// ─────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─────────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────────
syncFromTurso().finally(() => {
  app.listen(PORT, () => {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║       EdeneBeauty Backend v2.0            ║');
    console.log(`║   http://localhost:${PORT}                   ║`);
    console.log(`║   DB: ${DB_PATH.split('/').slice(-2).join('/')}           ║`);
    console.log('╚═══════════════════════════════════════════╝\n');
  });
});

module.exports = app;
