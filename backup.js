/**
 * EdeneBeauty — Script de sauvegarde automatique
 * node scripts/backup.js
 * Peut être planifié avec cron: 0 2 * * * node /path/to/scripts/backup.js
 */

const path = require('path');
const fs   = require('fs');

process.chdir(path.join(__dirname, '..'));

const { db, DB_PATH, getInscrits } = require('../src/database');

const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const date  = new Date().toISOString().replace(/[:.]/g, '-').split('T');
const stamp = `${date[0]}_${date[1].slice(0,8)}`;

// 1. Backup SQLite (copie binaire)
const dbBackup = path.join(BACKUP_DIR, `edenebeauty_${stamp}.db`);
db.backup(dbBackup)
  .then(() => console.log(`✅ DB backup: ${dbBackup}`))
  .catch(e => console.error('❌ DB backup error:', e.message));

// 2. Export JSON
const jsonBackup = path.join(BACKUP_DIR, `inscrits_${stamp}.json`);
const all = getInscrits({ limit: 99999 });
fs.writeFileSync(jsonBackup, JSON.stringify({
  backup_at: new Date().toISOString(),
  total: all.total,
  data: all.data
}, null, 2));
console.log(`✅ JSON backup: ${jsonBackup} (${all.total} inscrits)`);

// 3. Nettoyer backups > 30 jours
const files = fs.readdirSync(BACKUP_DIR);
const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
files.forEach(f => {
  const fp = path.join(BACKUP_DIR, f);
  const stat = fs.statSync(fp);
  if (stat.mtimeMs < thirtyDaysAgo) {
    fs.unlinkSync(fp);
    console.log(`🗑 Supprimé ancien backup: ${f}`);
  }
});

console.log('Backup terminé.');
