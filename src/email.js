/**
 * EdeneBeauty — Service Email
 * Nodemailer + templates HTML
 */

const { queries } = require('./database');

let transporter = null;

/**
 * Initialiser le transporteur SMTP depuis la config DB
 */
function initTransporter() {
  try {
    const nodemailer = require('nodemailer');
    const config = {};
    queries.getConfig.all().forEach(r => { config[r.cle] = r.valeur; });

    if (!config.smtp_user || !config.smtp_pass) {
      console.log('[Email] SMTP non configuré — emails désactivés');
      return null;
    }

    transporter = nodemailer.createTransport({
      host: config.smtp_host || 'smtp.gmail.com',
      port: parseInt(config.smtp_port) || 587,
      secure: false,
      auth: { user: config.smtp_user, pass: config.smtp_pass },
    });

    console.log('[Email] SMTP initialisé:', config.smtp_host);
    return transporter;
  } catch (e) {
    console.error('[Email] Erreur init SMTP:', e.message);
    return null;
  }
}

/**
 * Template email confirmation d'inscription
 */
function templateConfirmation(inscrit) {
  const estPro = inscrit.type_profil === 'pro';
  return {
    sujet: `Votre pré-inscription EdeneBeauty est confirmée ✨`,
    corps: `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirmation EdeneBeauty</title>
</head>
<body style="margin:0;padding:0;background:#FAF6F0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E8D5B0;">
        
        <!-- HEADER -->
        <tr>
          <td style="background:#1A1208;padding:32px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:300;color:#C9A96E;letter-spacing:4px;font-family:Georgia,serif;">
              EdeneBeauty
            </p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:40px 48px;">
            <h1 style="font-size:24px;font-weight:300;color:#1A1208;margin:0 0 16px;font-family:Georgia,serif;">
              Bienvenue, ${inscrit.prenom} !
            </h1>
            <p style="color:#6B5C45;font-size:15px;line-height:1.7;margin:0 0 24px;">
              Votre pré-inscription ${estPro ? 'en tant que professionnelle' : 'à la communauté EdeneBeauty'} 
              a bien été enregistrée. Nous sommes ravis de vous compter parmi les premières à découvrir 
              notre univers beauté.
            </p>

            <!-- RECAP -->
            <table width="100%" cellpadding="0" cellspacing="0" 
                   style="background:#FAF6F0;border-left:3px solid #C9A96E;padding:20px;margin-bottom:24px;">
              <tr>
                <td style="padding:4px 0;">
                  <p style="margin:0;font-size:12px;color:#6B5C45;letter-spacing:2px;text-transform:uppercase;">
                    Récapitulatif
                  </p>
                </td>
              </tr>
              <tr><td style="padding-top:12px;">
                <p style="margin:4px 0;font-size:14px;color:#1A1208;"><strong>Nom :</strong> ${inscrit.prenom} ${inscrit.nom}</p>
                <p style="margin:4px 0;font-size:14px;color:#1A1208;"><strong>Email :</strong> ${inscrit.email}</p>
                <p style="margin:4px 0;font-size:14px;color:#1A1208;"><strong>Profil :</strong> ${estPro ? '💼 Professionnelle' : '✨ Future Cliente'}</p>
                ${inscrit.pays ? `<p style="margin:4px 0;font-size:14px;color:#1A1208;"><strong>Localisation :</strong> ${[inscrit.ville, inscrit.pays].filter(Boolean).join(', ')}</p>` : ''}
                ${estPro && inscrit.specialite ? `<p style="margin:4px 0;font-size:14px;color:#1A1208;"><strong>Spécialité :</strong> ${inscrit.specialite}</p>` : ''}
              </td></tr>
            </table>

            <p style="color:#6B5C45;font-size:14px;line-height:1.7;margin:0 0 32px;">
              Nous vous contacterons dès l'ouverture de la plateforme. En attendant, 
              suivez-nous sur les réseaux pour ne rien manquer de l'aventure EdeneBeauty.
            </p>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#C9A96E;padding:14px 32px;">
                  <a href="https://edenebeauty.com" 
                     style="color:#1A1208;font-size:14px;font-weight:500;text-decoration:none;letter-spacing:1px;">
                    Découvrir EdeneBeauty →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#1A1208;padding:24px 48px;text-align:center;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:1px;">
              © 2024 EdeneBeauty · Une vision portée par l'excellence et l'inclusivité
            </p>
            <p style="margin:8px 0 0;font-size:11px;">
              <a href="mailto:contact@edenebeauty.com" style="color:#C9A96E;text-decoration:none;">
                contact@edenebeauty.com
              </a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim()
  };
}

/**
 * Template email de bienvenue pro
 */
function templateWelcomePro(inscrit) {
  return {
    sujet: `EdeneBeauty — Votre espace pro est en préparation 💼`,
    corps: `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF6F0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" style="background:#fff;border:1px solid #E8D5B0;">
        <tr><td style="background:#1A1208;padding:28px;text-align:center;">
          <p style="margin:0;font-size:26px;color:#C9A96E;font-family:Georgia,serif;font-weight:300;letter-spacing:4px;">EdeneBeauty</p>
        </td></tr>
        <tr><td style="padding:40px 48px;">
          <h1 style="font-size:22px;font-weight:300;color:#1A1208;margin:0 0 16px;font-family:Georgia,serif;">
            Espace Professionnelle
          </h1>
          <p style="color:#6B5C45;font-size:15px;line-height:1.7;margin:0 0 20px;">
            Bonjour ${inscrit.prenom},<br><br>
            En tant que <strong>${inscrit.specialite || 'professionnelle de la beauté'}</strong>, 
            vous aurez accès à des fonctionnalités exclusives sur EdeneBeauty : portfolio, 
            mise en relation clients, agenda, et bien plus encore.
          </p>
          <p style="color:#6B5C45;font-size:14px;line-height:1.7;">
            Votre profil est en cours de validation. Nous revenons vers vous très prochainement.
          </p>
        </td></tr>
        <tr><td style="background:#1A1208;padding:20px 48px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);">© 2024 EdeneBeauty</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
    `.trim()
  };
}

/**
 * Envoyer un email
 */
async function sendEmail(inscritId, destinataire, sujet, corps) {
  const config = {};
  queries.getConfig.all().forEach(r => { config[r.cle] = r.valeur; });

  if (!transporter) transporter = initTransporter();

  if (!transporter) {
    // Logger sans envoyer
    queries.insertEmailLog.run(inscritId, destinataire, sujet, corps, 'en_attente', 'SMTP non configuré');
    return { success: false, reason: 'SMTP non configuré' };
  }

  try {
    await transporter.sendMail({
      from: config.email_from || 'EdeneBeauty <noreply@edenebeauty.com>',
      to: destinataire,
      subject: sujet,
      html: corps,
    });
    queries.insertEmailLog.run(inscritId, destinataire, sujet, corps, 'envoyé', null);
    return { success: true };
  } catch (err) {
    queries.insertEmailLog.run(inscritId, destinataire, sujet, corps, 'erreur', err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Envoyer confirmation d'inscription
 */
async function sendConfirmation(inscrit) {
  const config = {};
  queries.getConfig.all().forEach(r => { config[r.cle] = r.valeur; });
  if (config.email_confirmation_active !== '1') return;

  const tpl = templateConfirmation(inscrit);
  return sendEmail(inscrit.id, inscrit.email, tpl.sujet, tpl.corps);
}

module.exports = {
  initTransporter,
  sendEmail,
  sendConfirmation,
  templateConfirmation,
  templateWelcomePro,
};
