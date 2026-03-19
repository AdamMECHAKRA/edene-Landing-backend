/**
 * EdeneBeauty — Script de données de démo
 * node scripts/seed.js
 */

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { createInscrit, queries } = require('../src/database');
const { v4: uuidv4 } = require('uuid');

const NOMS = ['Martin','Diallo','Koné','Mbaye','Touré','Bah','Coulibaly','N\'Guessan','Traoré','Camara','Sow','Diop','Fall','Ndiaye','Ouédraogo'];
const PRENOMS = ['Amara','Fatou','Sofia','Marie','Aïcha','Nadia','Sarah','Leila','Yasmine','Mariame','Awa','Kadiatou','Aminata','Rokhaya','Nafissatou'];
const PAYS_VILLES = [
  { pays: 'France', villes: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Nantes'] },
  { pays: 'Côte d\'Ivoire', villes: ['Abidjan', 'Bouaké', 'Yamoussoukro', 'San-Pédro'] },
  { pays: 'Sénégal', villes: ['Dakar', 'Saint-Louis', 'Thiès', 'Ziguinchor'] },
  { pays: 'Cameroun', villes: ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua'] },
  { pays: 'Maroc', villes: ['Casablanca', 'Rabat', 'Marrakech', 'Fès'] },
  { pays: 'Belgique', villes: ['Bruxelles', 'Liège', 'Anvers', 'Gand'] },
  { pays: 'Canada', villes: ['Montréal', 'Ottawa', 'Toronto', 'Québec'] },
];
const SPECIALITES = ['Coiffure', 'Coiffure afro & texturée', 'Maquillage', 'Esthétique', 'Nail Art & Ongles', 'Soins de la peau', 'Microblading & Sourcils'];
const CENTRES = ['Soins naturels','Maquillage','Coiffure afro','Skincare','Mode & style','Bien-être','Nail Art','Parfums','Tutoriels beauté'];
const STATUTS = ['nouveau','contacté','en_cours','validé','refusé'];
const SOURCES = ['landing_page','instagram','facebook','bouche_a_oreille','presse'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randSubset(arr, min = 1, max = 4) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, randInt(min, Math.min(max, arr.length)));
}

function seed(count = 85) {
  let inserted = 0;

  for (let i = 0; i < count; i++) {
    const pv = rand(PAYS_VILLES);
    const isPro = Math.random() > 0.45;
    const nom = rand(NOMS);
    const prenom = rand(PRENOMS);
    const email = `${prenom.toLowerCase().replace(/[^a-z]/g,'')}.${nom.toLowerCase().replace(/[^a-z]/g,'')}${randInt(1,999)}@example.com`;

    // Vérifier que l'email n'existe pas déjà
    if (queries.getByEmail.get(email)) continue;

    const daysAgo = randInt(0, 60);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    try {
      const id = createInscrit(
        {
          uuid: uuidv4(),
          nom, prenom, email,
          telephone: `+${randInt(1,99)} ${randInt(600000000,799999999)}`,
          pays: pv.pays,
          ville: rand(pv.villes),
          type_profil: isPro ? 'pro' : 'cliente',
          specialite: isPro ? rand(SPECIALITES) : null,
          source: rand(SOURCES),
          ip_address: `192.168.${randInt(1,255)}.${randInt(1,255)}`,
          user_agent: 'Mozilla/5.0 (Demo Seed)',
        },
        !isPro ? randSubset(CENTRES) : [],
        isPro ? [rand(SPECIALITES)] : []
      );

      // Assigner un statut aléatoire
      const status = rand(STATUTS);
      if (status !== 'nouveau') {
        queries.updateStatus.run(status, null, id);
      }

      // Forcer la date de création (hack SQLite)
      db.prepare(`UPDATE inscrits SET created_at = ? WHERE id = ?`).run(createdAt, id);

      inserted++;
    } catch (e) {
      // Ignorer les doublons
    }
  }

  console.log(`✅ Seed: ${inserted} inscrits créés`);
  return inserted;
}

// Importer db après que createInscrit l'ait initialisé
const { db } = require('../src/database');

// Exécution directe
if (require.main === module) {
  seed(85);
  process.exit(0);
}

module.exports = { seed };
