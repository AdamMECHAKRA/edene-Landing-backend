/**
 * EdeneBeauty — Database Layer
 * Utilise "better-sqlite3" en local, avec fallback automatique
 * sur Render : force NODE_VERSION=18 dans les variables d'env
 *
 * SOLUTION RENDER : on utilise "sqlite3" async + wrapper sync-like
 * via une base de données en mémoire + fichier persistant
 *
 * Pour Render, la vraie solution est de forcer NODE_VERSION=18.19.0
 * dans Environment Variables. better-sqlite3 v9 supporte Node ≤ 22.
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const DB_DIR  = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'edenebeauty.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// ── Chargement du driver SQLite ──────────────────────────────────────
let Database;
try {
  Database = require('better-sqlite3');
  console.log('[DB] Driver: better-sqlite3 (synchrone)');
} catch (e) {
  console.error('[DB] better-sqlite3 non disponible:', e.message);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─────────────────────────────────────────────────
// SCHÉMA COMPLET
// ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS inscrits (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid          TEXT    NOT NULL UNIQUE,
    nom           TEXT    NOT NULL,
    prenom        TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    telephone     TEXT,
    pays          TEXT,
    ville         TEXT,
    type_profil   TEXT    NOT NULL DEFAULT 'cliente' CHECK(type_profil IN ('pro','cliente')),
    specialite    TEXT,
    status        TEXT    NOT NULL DEFAULT 'nouveau'
                          CHECK(status IN ('nouveau','contacté','en_cours','validé','refusé')),
    source        TEXT    DEFAULT 'landing_page',
    ip_address    TEXT,
    user_agent    TEXT,
    notes_admin   TEXT,
    created_at    DATETIME DEFAULT (datetime('now')),
    updated_at    DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS centres_interet (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    inscrit_id  INTEGER NOT NULL REFERENCES inscrits(id) ON DELETE CASCADE,
    label       TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS specialites_pro (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    inscrit_id  INTEGER NOT NULL REFERENCES inscrits(id) ON DELETE CASCADE,
    specialite  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pays_ref (
    code  TEXT PRIMARY KEY,
    nom   TEXT NOT NULL,
    zone  TEXT
  );

  CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#C9A96E'
  );

  CREATE TABLE IF NOT EXISTS inscrits_tags (
    inscrit_id INTEGER NOT NULL REFERENCES inscrits(id) ON DELETE CASCADE,
    tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (inscrit_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS historique (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    inscrit_id  INTEGER REFERENCES inscrits(id) ON DELETE CASCADE,
    action      TEXT    NOT NULL,
    detail      TEXT,
    admin_ip    TEXT,
    created_at  DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emails_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    inscrit_id  INTEGER REFERENCES inscrits(id) ON DELETE SET NULL,
    destinataire TEXT   NOT NULL,
    sujet       TEXT    NOT NULL,
    corps       TEXT,
    statut      TEXT    DEFAULT 'envoyé' CHECK(statut IN ('envoyé','erreur','en_attente')),
    erreur      TEXT,
    sent_at     DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stats_daily (
    date          TEXT PRIMARY KEY,
    total         INTEGER DEFAULT 0,
    nouveaux_pros INTEGER DEFAULT 0,
    nouvelles_clientes INTEGER DEFAULT 0,
    total_cumul   INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS config (
    cle   TEXT PRIMARY KEY,
    valeur TEXT NOT NULL,
    updated_at DATETIME DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_inscrits_email   ON inscrits(email);
  CREATE INDEX IF NOT EXISTS idx_inscrits_type    ON inscrits(type_profil);
  CREATE INDEX IF NOT EXISTS idx_inscrits_status  ON inscrits(status);
  CREATE INDEX IF NOT EXISTS idx_inscrits_pays    ON inscrits(pays);
  CREATE INDEX IF NOT EXISTS idx_inscrits_created ON inscrits(created_at);
  CREATE INDEX IF NOT EXISTS idx_centres_inscrit  ON centres_interet(inscrit_id);
  CREATE INDEX IF NOT EXISTS idx_hist_inscrit     ON historique(inscrit_id);

  CREATE TRIGGER IF NOT EXISTS trg_inscrits_updated
    AFTER UPDATE ON inscrits FOR EACH ROW
    BEGIN UPDATE inscrits SET updated_at = datetime('now') WHERE id = NEW.id; END;
`);

// ─────────────────────────────────────────────────
// DONNÉES DE RÉFÉRENCE
// ─────────────────────────────────────────────────
const insertPays = db.prepare(`INSERT OR IGNORE INTO pays_ref (code, nom, zone) VALUES (?, ?, ?)`);
const paysRef = [
  ['FR','France','Europe'],['BE','Belgique','Europe'],['CH','Suisse','Europe'],
  ['CA','Canada','Amérique'],['US','États-Unis','Amérique'],
  ['CI','Côte d\'Ivoire','Afrique de l\'Ouest'],['SN','Sénégal','Afrique de l\'Ouest'],
  ['CM','Cameroun','Afrique Centrale'],['GN','Guinée','Afrique de l\'Ouest'],
  ['ML','Mali','Afrique de l\'Ouest'],['BF','Burkina Faso','Afrique de l\'Ouest'],
  ['TG','Togo','Afrique de l\'Ouest'],['BJ','Bénin','Afrique de l\'Ouest'],
  ['MR','Mauritanie','Afrique de l\'Ouest'],['GH','Ghana','Afrique de l\'Ouest'],
  ['NG','Nigéria','Afrique de l\'Ouest'],['CG','Congo','Afrique Centrale'],
  ['CD','RD Congo','Afrique Centrale'],['GA','Gabon','Afrique Centrale'],
  ['MA','Maroc','Afrique du Nord'],['TN','Tunisie','Afrique du Nord'],
  ['DZ','Algérie','Afrique du Nord'],['LY','Libye','Afrique du Nord'],
  ['MG','Madagascar','Océan Indien'],['MU','Maurice','Océan Indien'],
  ['RE','La Réunion','Océan Indien'],['MQ','Martinique','Caraïbes'],
  ['GP','Guadeloupe','Caraïbes'],['GF','Guyane','Amérique'],
];
db.transaction(() => paysRef.forEach(p => insertPays.run(...p)))();

const insertConfig = db.prepare(`INSERT OR IGNORE INTO config (cle, valeur) VALUES (?, ?)`);
[
  ['smtp_host','smtp.gmail.com'],['smtp_port','587'],
  ['smtp_user',''],['smtp_pass',''],
  ['email_from','EdeneBeauty <noreply@edenebeauty.com>'],
  ['email_confirmation_active','0'],
  ['admin_password','edene2024'],
  ['site_nom','EdeneBeauty'],
  ['site_url','https://edenebeauty.com'],
].forEach(([k,v]) => insertConfig.run(k,v));

// ─────────────────────────────────────────────────
// REQUÊTES PRÉPARÉES
// ─────────────────────────────────────────────────
const queries = {
  getById: db.prepare(`
    SELECT i.*,
      GROUP_CONCAT(DISTINCT ci.label)      AS centres,
      GROUP_CONCAT(DISTINCT sp.specialite) AS specialites_multi,
      GROUP_CONCAT(DISTINCT t.label)       AS tags
    FROM inscrits i
    LEFT JOIN centres_interet ci ON ci.inscrit_id = i.id
    LEFT JOIN specialites_pro  sp ON sp.inscrit_id = i.id
    LEFT JOIN inscrits_tags    it ON it.inscrit_id = i.id
    LEFT JOIN tags             t  ON t.id = it.tag_id
    WHERE i.id = ? GROUP BY i.id
  `),
  getByEmail:    db.prepare(`SELECT id, email FROM inscrits WHERE email = ? COLLATE NOCASE`),
  getByUuid:     db.prepare(`SELECT * FROM inscrits WHERE uuid = ?`),
  insert:        db.prepare(`
    INSERT INTO inscrits (uuid,nom,prenom,email,telephone,pays,ville,type_profil,specialite,source,ip_address,user_agent)
    VALUES (@uuid,@nom,@prenom,@email,@telephone,@pays,@ville,@type_profil,@specialite,@source,@ip_address,@user_agent)
  `),
  updateStatus:  db.prepare(`UPDATE inscrits SET status=?, notes_admin=COALESCE(?,notes_admin) WHERE id=?`),
  updateNotes:   db.prepare(`UPDATE inscrits SET notes_admin=? WHERE id=?`),
  delete:        db.prepare(`DELETE FROM inscrits WHERE id=?`),
  insertCentre:  db.prepare(`INSERT INTO centres_interet (inscrit_id, label) VALUES (?, ?)`),
  insertSpec:    db.prepare(`INSERT INTO specialites_pro (inscrit_id, specialite) VALUES (?, ?)`),
  getAllTags:    db.prepare(`SELECT * FROM tags ORDER BY label`),
  insertTag:    db.prepare(`INSERT OR IGNORE INTO tags (label, color) VALUES (?, ?)`),
  getTagByLabel:db.prepare(`SELECT id FROM tags WHERE label=?`),
  addTag:       db.prepare(`INSERT OR IGNORE INTO inscrits_tags (inscrit_id,tag_id) VALUES (?,?)`),
  removeTag:    db.prepare(`DELETE FROM inscrits_tags WHERE inscrit_id=? AND tag_id=?`),
  insertHist:   db.prepare(`INSERT INTO historique (inscrit_id,action,detail,admin_ip) VALUES (?,?,?,?)`),
  getHist:      db.prepare(`SELECT * FROM historique WHERE inscrit_id=? ORDER BY created_at DESC LIMIT 50`),
  insertEmail:  db.prepare(`INSERT INTO emails_log (inscrit_id,destinataire,sujet,corps,statut,erreur) VALUES (?,?,?,?,?,?)`),
  getConfig:    db.prepare(`SELECT cle, valeur FROM config`),
  setConfig:    db.prepare(`UPDATE config SET valeur=?, updated_at=datetime('now') WHERE cle=?`),
  getAllPays:   db.prepare(`SELECT * FROM pays_ref ORDER BY nom`),
  statTotal:    db.prepare(`SELECT COUNT(*) as n FROM inscrits`),
  statPros:     db.prepare(`SELECT COUNT(*) as n FROM inscrits WHERE type_profil='pro'`),
  statClientes: db.prepare(`SELECT COUNT(*) as n FROM inscrits WHERE type_profil='cliente'`),
  statNouveau:  db.prepare(`SELECT COUNT(*) as n FROM inscrits WHERE status='nouveau'`),
  statValides:  db.prepare(`SELECT COUNT(*) as n FROM inscrits WHERE status='validé'`),
  statParStatus:db.prepare(`SELECT status, COUNT(*) as n FROM inscrits GROUP BY status ORDER BY n DESC`),
  statParPays:  db.prepare(`SELECT pays, COUNT(*) as n FROM inscrits WHERE pays IS NOT NULL GROUP BY pays ORDER BY n DESC LIMIT 15`),
  statParZone:  db.prepare(`SELECT pr.zone, COUNT(*) as n FROM inscrits i LEFT JOIN pays_ref pr ON pr.nom=i.pays WHERE pr.zone IS NOT NULL GROUP BY pr.zone ORDER BY n DESC`),
  statParJour:  db.prepare(`SELECT DATE(created_at) as date, COUNT(*) as n, SUM(CASE WHEN type_profil='pro' THEN 1 ELSE 0 END) as pros, SUM(CASE WHEN type_profil='cliente' THEN 1 ELSE 0 END) as clientes FROM inscrits GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 60`),
  statSpec:     db.prepare(`SELECT sp.specialite, COUNT(*) as n FROM specialites_pro sp GROUP BY sp.specialite ORDER BY n DESC`),
  statCentres:  db.prepare(`SELECT ci.label, COUNT(*) as n FROM centres_interet ci GROUP BY ci.label ORDER BY n DESC`),
  statSource:   db.prepare(`SELECT source, COUNT(*) as n FROM inscrits GROUP BY source ORDER BY n DESC`),
  statSemaine:  db.prepare(`SELECT COUNT(*) as n FROM inscrits WHERE created_at >= datetime('now','-7 days')`),
  statMois:     db.prepare(`SELECT COUNT(*) as n FROM inscrits WHERE created_at >= datetime('now','start of month')`),
};

// ─────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────
const createInscrit = db.transaction((data, centres, specialites) => {
  const result = queries.insert.run(data);
  const id = result.lastInsertRowid;
  if (centres && centres.length)    centres.forEach(c    => { if(c&&c.trim()) queries.insertCentre.run(id, c.trim()); });
  if (specialites && specialites.length) specialites.forEach(s => { if(s&&s.trim()) queries.insertSpec.run(id, s.trim()); });
  queries.insertHist.run(id, 'inscription', `Inscription via ${data.source||'landing_page'}`, data.ip_address);
  return id;
});

function getInscrits({ type, status, pays, search, page=1, limit=50 } = {}) {
  let where = ['1=1'];
  const params = [];
  if (type && type !== 'tous')   { where.push(`i.type_profil=?`); params.push(type); }
  if (status && status !== 'tous') { where.push(`i.status=?`);     params.push(status); }
  if (pays)                      { where.push(`i.pays=?`);         params.push(pays); }
  if (search) {
    where.push(`(i.nom LIKE ? OR i.prenom LIKE ? OR i.email LIKE ? OR i.ville LIKE ? OR i.telephone LIKE ?)`);
    const s = `%${search}%`;
    params.push(s,s,s,s,s);
  }
  const w = where.join(' AND ');
  const offset = (parseInt(page)-1)*parseInt(limit);
  const total = db.prepare(`SELECT COUNT(DISTINCT i.id) as n FROM inscrits i WHERE ${w}`).get(...params).n;
  const data  = db.prepare(`
    SELECT i.*,
      GROUP_CONCAT(DISTINCT ci.label)      AS centres,
      GROUP_CONCAT(DISTINCT sp.specialite) AS specialites_multi,
      GROUP_CONCAT(DISTINCT t.label)       AS tags
    FROM inscrits i
    LEFT JOIN centres_interet ci ON ci.inscrit_id=i.id
    LEFT JOIN specialites_pro  sp ON sp.inscrit_id=i.id
    LEFT JOIN inscrits_tags    it ON it.inscrit_id=i.id
    LEFT JOIN tags             t  ON t.id=it.tag_id
    WHERE ${w} GROUP BY i.id ORDER BY i.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);
  return { data, total, page: parseInt(page), pages: Math.ceil(total/parseInt(limit)) };
}

function getStats() {
  return {
    total:         queries.statTotal.get().n,
    pros:          queries.statPros.get().n,
    clientes:      queries.statClientes.get().n,
    nouveaux:      queries.statNouveau.get().n,
    valides:       queries.statValides.get().n,
    cette_semaine: queries.statSemaine.get().n,
    ce_mois:       queries.statMois.get().n,
    par_status:    queries.statParStatus.all(),
    par_pays:      queries.statParPays.all(),
    par_zone:      queries.statParZone.all(),
    par_jour:      queries.statParJour.all(),
    specialites:   queries.statSpec.all(),
    centres:       queries.statCentres.all(),
    par_source:    queries.statSource.all(),
  };
}

module.exports = { db, queries, createInscrit, getInscrits, getStats, DB_PATH };
