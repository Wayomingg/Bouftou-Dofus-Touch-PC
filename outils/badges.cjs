// Les images sont livrées par GitHub ; seules leurs valeurs sont relues en ligne.
const fs = require('node:fs')
const path = require('node:path')
const DEPOT = 'Wayomingg/Bouftou-Dofus-Touch-PC'
const INVITATION = 'EmYwPHEqZH'

function nombre(valeur) {
  if (!Number.isSafeInteger(valeur) || valeur < 0) throw new Error('Compteur invalide')
  return valeur
}

async function statistiques({ demander = fetch, jeton = process.env.GITHUB_TOKEN } = {}) {
  async function lire(url) {
    const headers = { 'User-Agent': 'Bouftou-badges', Accept: 'application/json' }
    if (url.startsWith('https://api.github.com/') && jeton) headers.Authorization = 'Bearer ' + jeton
    const r = await demander(url, { headers, signal: AbortSignal.timeout(20000) })
    if (!r.ok) throw new Error('Service indisponible : ' + r.status)
    return r.json()
  }
  const [discord, derniere] = await Promise.all([
    lire('https://discord.com/api/v10/invites/' + INVITATION + '?with_counts=true'),
    lire('https://api.github.com/repos/' + DEPOT + '/releases/latest')
  ])
  if (discord.code !== INVITATION) throw new Error('Invitation Discord inattendue')
  if (!/^v?\d+\.\d+\.\d+$/.test(derniere.tag_name) || derniere.draft || derniere.prerelease) throw new Error('Version stable invalide')
  let telechargements = 0
  for (let page = 1;; page++) {
    const versions = await lire('https://api.github.com/repos/' + DEPOT + '/releases?per_page=100&page=' + page)
    if (!Array.isArray(versions)) throw new Error('Liste des versions invalide')
    for (const version of versions) {
      if (!Array.isArray(version.assets)) throw new Error('Liste des fichiers invalide')
      for (const fichier of version.assets) telechargements = nombre(telechargements + nombre(fichier.download_count))
    }
    if (versions.length < 100) break
    if (page >= 100) throw new Error('Trop de pages de versions')
  }
  return { membres: nombre(discord.approximate_member_count), version: derniere.tag_name, telechargements }
}

const xml = texte => String(texte).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
function badge(libelle, valeur, couleur) {
  const gauche = libelle.toUpperCase(), droite = String(valeur).toUpperCase()
  const a = Math.ceil(gauche.length * 8 + 24), b = Math.ceil(droite.length * 8 + 24)
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (a + b) + '" height="28" role="img" aria-label="' + xml(gauche + ': ' + droite) + '">\n' +
    '  <title>' + xml(gauche + ': ' + droite) + '</title>\n' +
    '  <rect width="' + a + '" height="28" fill="#555"/>\n' +
    '  <rect x="' + a + '" width="' + b + '" height="28" fill="' + couleur + '"/>\n' +
    '  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="bold" letter-spacing="1">\n' +
    '    <text x="' + a / 2 + '" y="18">' + xml(gauche) + '</text>\n' +
    '    <text x="' + (a + b / 2) + '" y="18">' + xml(droite) + '</text>\n' +
    '  </g>\n</svg>\n'
}

function images(stats) {
  nombre(stats.membres); nombre(stats.telechargements)
  if (!/^v?\d+\.\d+\.\d+$/.test(stats.version)) throw new Error('Version invalide')
  const fichiers = { 'badge-version.svg': badge('Version', stats.version, '#cdb57e'), 'badge-version-es.svg': badge('Versión', stats.version, '#cdb57e') }
  for (const [langue, mot, libelle] of [['en', 'members', 'Downloads'], ['fr', 'membres', 'Téléchargements'], ['es', 'miembros', 'Descargas']]) {
    fichiers['badge-discord-' + langue + '.svg'] = badge('Discord', stats.membres + ' ' + mot, '#5865F2')
    fichiers['badge-telechargements-' + langue + '.svg'] = badge(libelle, stats.telechargements, '#b9e154')
  }
  return fichiers
}

async function actualiser({ demander, jeton, dossier = path.join(__dirname, '..', 'images') } = {}) {
  // Une panne ne remplace pas les derniers badges valides par une image d’erreur.
  const stats = await statistiques({ demander, jeton })
  const fichiers = images(stats)
  for (const [nom, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(dossier, nom), contenu)
  return stats
}

if (require.main === module) actualiser().then(stats => console.log('Badges actualisés : ' + stats.version + ', ' + stats.membres + ' membres, ' + stats.telechargements + ' téléchargements.')).catch(() => { console.error('Actualisation indisponible ; les badges précédents sont conservés.'); process.exitCode = 1 })
module.exports = { statistiques, badge, images, actualiser }
