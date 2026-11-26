const { test } = require('node:test')
const assert = require('node:assert/strict')
const { statistiques, badge, images, actualiser } = require('../outils/badges.cjs')

function reponse(contenu, statut = 200) { return { ok: statut === 200, status: statut, json: async () => contenu } }
function service({ membres = 77, version = 'v0.4.40', versions = [{ assets: [{ download_count: 10 }, { download_count: 22 }] }] } = {}) {
  return async url => url.includes('discord.com') ? reponse({ code: 'EmYwPHEqZH', approximate_member_count: membres }) : url.includes('/latest') ? reponse({ tag_name: version }) : reponse(versions)
}

test('Valeurs publiques et compte de tous les téléchargements', async () => {
  assert.deepEqual(await statistiques({ demander: service(), jeton: '' }), { membres: 77, version: 'v0.4.40', telechargements: 32 })
})
test('Les pages supplémentaires de versions sont comptées', async () => {
  const base = service()
  const demander = async url => url.includes('per_page=100&page=1') ? reponse(Array.from({ length: 100 }, () => ({ assets: [{ download_count: 1 }] }))) : url.includes('page=2') ? reponse([{ assets: [{ download_count: 3 }] }]) : base(url)
  assert.equal((await statistiques({ demander, jeton: '' })).telechargements, 103)
})
test('Le jeton GitHub reste réservé à l’API GitHub', async () => {
  const base = service()
  await statistiques({ jeton: 'jeton-fictif', demander: async (url, options) => {
    assert.equal(options.headers.Authorization, url.startsWith('https://api.github.com/') ? 'Bearer jeton-fictif' : undefined)
    return base(url)
  } })
})
test('Les compteurs et versions invalides sont refusés', async () => {
  for (const valeurs of [{ membres: -1 }, { membres: undefined }, { version: 'v0.5.0-essai.1' }, { versions: [{ assets: [{ download_count: -1 }] }] }]) {
    if (valeurs.membres === undefined && Object.hasOwn(valeurs, 'membres')) valeurs.membres = null
    await assert.rejects(statistiques({ demander: service(valeurs), jeton: '' }))
  }
})
test('Les huit images locales sont traduites et autonomes', () => {
  const fichiers = images({ membres: 77, version: 'v0.4.40', telechargements: 32 })
  assert.equal(Object.keys(fichiers).length, 8)
  for (const svg of Object.values(fichiers)) {
    assert.match(svg, /<svg/); assert.match(svg, /height="28"/)
    assert.doesNotMatch(svg, /<image|<script|href=/)
  }
  assert.match(fichiers['badge-discord-en.svg'], /77 MEMBERS/)
  assert.match(fichiers['badge-discord-fr.svg'], /77 MEMBRES/)
  assert.match(fichiers['badge-discord-es.svg'], /77 MIEMBROS/)
  assert.match(fichiers['badge-version-es.svg'], /VERSIÓN: V0.4.40/)
  assert.match(fichiers['badge-telechargements-fr.svg'], /TÉLÉCHARGEMENTS: 32/)
})
test('Les caractères spéciaux sont protégés dans les SVG', () => {
  assert.doesNotMatch(badge('<test>', '&', '#555'), /<TEST>/)
  assert.match(badge('<test>', '&', '#555'), /&lt;TEST&gt;/)
})
test('Une panne conserve les badges déjà publiés', async () => {
  await assert.rejects(actualiser({ demander: async () => reponse({}, 503), dossier: 'dossier-volontairement-inexistant' }), /Service indisponible : 503/)
})
test('Discord, version et téléchargements sont servis par le dépôt dans les trois langues', () => {
  const fs = require('node:fs'), path = require('node:path')
  for (const [nom, langue] of [['README.md', 'en'], ['README.fr.md', 'fr'], ['README.es.md', 'es']]) {
    const texte = fs.readFileSync(path.join(__dirname, '..', nom), 'utf8')
    const cibles = ['badge-discord-' + langue + '.svg', 'badge-version' + (langue === 'es' ? '-es' : '') + '.svg', 'badge-telechargements-' + langue + '.svg']
    for (const cible of cibles) {
      assert.ok(texte.includes('](images/' + cible + ')'), nom + ' : ' + cible)
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'images', cible)))
    }
    assert.doesNotMatch(texte, /img\.shields\.io\/(?:badge\/dynamic|github\/v\/release|github\/downloads)/)
    assert.match(texte, /https:\/\/discord\.gg\/EmYwPHEqZH/)
    assert.match(texte, /https:\/\/github\.com\/Wayomingg\/Bouftou-Dofus-Touch-PC\/releases\/latest/)
  }
})
