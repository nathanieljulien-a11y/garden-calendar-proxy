// download-artwork.js
// Run once during build: node download-artwork.js
// Downloads Köhler plates and saves as files in artwork/ directory
// Render build environment can reach Wikimedia; runtime cannot

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

const PLATES = {
  'rose':        'Rosa_centifolia_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-257.jpg',
  'wisteria':    'Wisteria_sinensis_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-285.jpg',
  'lavender':    'Lavandula_angustifolia_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-088.jpg',
  'peony':       'Paeonia_officinalis_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-164.jpg',
  'iris':        'Iris_germanica_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-187.jpg',
  'tulip':       'Tulipa_gesneriana_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-272.jpg',
  'sunflower':   'Helianthus_annuus_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-078.jpg',
  'camellia':    'Camellia_japonica_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-025.jpg',
  'magnolia':    'Magnolia_grandiflora_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-097.jpg',
  'oleander':    'Nerium_oleander_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-124.jpg',
  'foxglove':    'Digitalis_purpurea_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-052.jpg',
  'rosemary':    'Rosmarinus_officinalis_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-244.jpg',
  'thyme':       'Thymus_vulgaris_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-271.jpg',
  'sage':        'Salvia_officinalis_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-246.jpg',
  'mint':        'Mentha_piperita_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-112.jpg',
  'fig':         'Ficus_carica_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-057.jpg',
  'peach':       'Prunus_persica_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-183.jpg',
  'cherry':      'Prunus_cerasus_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-180.jpg',
  'strawberry':  'Fragaria_vesca_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-065.jpg',
  'raspberry':   'Rubus_idaeus_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-237.jpg',
  'grape':       'Vitis_vinifera_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-280.jpg',
  'lemon':       'Citrus_limon_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-036.jpg',
  'olive':       'Olea_europaea_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-130.jpg',
  'pansy':       'Viola_tricolor_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-278.jpg',
  'nasturtium':  'Tropaeolum_majus_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-273.jpg',
  'borage':      'Borago_officinalis_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-023.jpg',
  'snapdragon':  'Antirrhinum_majus_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-013.jpg',
  'valerian':    'Valeriana_officinalis_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-275.jpg',
  'fennel':      'Foeniculum_vulgare_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-063.jpg',
  'elderflower': 'Sambucus_nigra_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-247.jpg',
  'almond':      'Prunus_dulcis_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-177.jpg',
  'quince':      'Cydonia_oblonga_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-047.jpg',
  'mulberry':    'Morus_nigra_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-119.jpg',
  'apricot':     'Prunus_armeniaca_-_K\u00f6hler\u2013s_Medizinal-Pflanzen-179.jpg',
  'hydrangea':   'Hydrangea_macrophylla_SZ85.png',
};

function getUrl(filename) {
  const md5 = crypto.createHash('md5').update(filename).digest('hex');
  const a = md5[0], ab = md5.slice(0,2);
  const enc = encodeURIComponent(filename);
  const width = filename.endsWith('.png') ? '500' : '500';
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${a}/${ab}/${enc}/${width}px-${enc}`;
}

function fetchFile(url, dest) {
  return new Promise(function(resolve) {
    const client = url.startsWith('https') ? https : http;
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GardenCalendarBuild/1.0)',
        'Accept': 'image/jpeg,image/png,image/*',
        'Referer': 'https://commons.wikimedia.org/',
      }
    };
    const req = client.get(url, opts, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchFile(res.headers.location, dest).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        console.log('  FAIL HTTP', res.statusCode, url.slice(0,80));
        res.resume();
        resolve(false);
        return;
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', function() { resolve(true); });
      out.on('error', function() { resolve(false); });
    });
    req.on('error', function(e) { console.log('  ERR', e.message); resolve(false); });
    req.setTimeout(20000, function() { req.destroy(); resolve(false); });
  });
}

async function main() {
  const dir = path.join(__dirname, 'artwork');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  let ok = 0, fail = 0;
  for (const [name, filename] of Object.entries(PLATES)) {
    const dest = path.join(dir, name + (filename.endsWith('.png') ? '.png' : '.jpg'));
    if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
      console.log('  skip (exists):', name);
      ok++;
      continue;
    }
    const url = getUrl(filename);
    process.stdout.write('  ' + name + '... ');
    const success = await fetchFile(url, dest);
    if (success) { console.log('OK'); ok++; }
    else { fail++; }
    await new Promise(r => setTimeout(r, 200)); // be polite
  }
  console.log(`\nDone: ${ok} OK, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
