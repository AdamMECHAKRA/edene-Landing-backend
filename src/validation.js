/**
 * EdeneBeauty — Middleware de validation
 */

const SPECIALITES_PRO = [
  'Coiffure', 'Coiffure afro & texturée', 'Maquillage', 'Esthétique',
  'Soins de la peau', 'Nail Art & Ongles', 'Barbier', 'Microblading & Sourcils',
  'Extensions de cils', 'Soins capillaires', 'Massage & Bien-être', 'Autre'
];

const CENTRES_INTERET = [
  'Soins naturels', 'Maquillage', 'Coiffure afro', 'Skincare', 'Mode & style',
  'Bien-être', 'Nail Art', 'Parfums', 'Tutoriels beauté', 'Nutrition & beauté',
  'Beauté inclusive', 'Tendances', 'DIY beauté'
];

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

function validatePhone(phone) {
  if (!phone) return true; // optionnel
  return /^[+\d\s\-().]{6,20}$/.test(phone);
}

/**
 * Validation inscription
 */
function validateInscription(req, res, next) {
  const { nom, prenom, email, telephone, pays, ville, type_profil, specialite, centres_interet } = req.body;
  const errors = [];

  if (!nom || nom.trim().length < 2)        errors.push('Nom invalide (min 2 caractères).');
  if (!prenom || prenom.trim().length < 2)   errors.push('Prénom invalide (min 2 caractères).');
  if (!email || !validateEmail(email))       errors.push('Adresse email invalide.');
  if (telephone && !validatePhone(telephone)) errors.push('Numéro de téléphone invalide.');

  const profil = type_profil || 'cliente';
  if (!['pro', 'cliente'].includes(profil))  errors.push('Type de profil invalide.');

  if (profil === 'pro' && !specialite)       errors.push('Spécialité obligatoire pour les professionnelles.');

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' '), errors });
  }

  // Nettoyer les données
  req.body.nom    = nom.trim();
  req.body.prenom = prenom.trim();
  req.body.email  = email.toLowerCase().trim();
  req.body.type_profil = profil;

  next();
}

/**
 * Validation mise à jour status
 */
function validateStatusUpdate(req, res, next) {
  const validStatuts = ['nouveau', 'contacté', 'en_cours', 'validé', 'refusé'];
  if (req.body.status && !validStatuts.includes(req.body.status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs: ${validStatuts.join(', ')}` });
  }
  next();
}

module.exports = { validateInscription, validateStatusUpdate, SPECIALITES_PRO, CENTRES_INTERET };
