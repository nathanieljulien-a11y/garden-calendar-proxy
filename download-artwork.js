name: Download Botanical Artwork

on:
  workflow_dispatch:

jobs:
  download:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download Köhler plates (original files, not thumbnails)
        run: |
          mkdir -p artwork
          python3 << 'PYEOF'
          import requests, hashlib, time, sys, os
          from urllib.parse import quote
          from PIL import Image
          import io

          # pip install pillow for resizing originals to reasonable size
          os.system('pip install pillow -q')
          from PIL import Image

          def get_original_url(filename):
              """Original file URL - not thumbnail, not IP-blocked"""
              md5 = hashlib.md5(filename.encode('utf-8')).hexdigest()
              a, ab = md5[0], md5[:2]
              enc = quote(filename, safe='')
              return f"https://upload.wikimedia.org/wikipedia/commons/{a}/{ab}/{enc}"

          PLATES = {
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
          }

          headers = {
              'User-Agent': 'GardenCalendarBot/1.0 (https://github.com/nathanieljulien-a11y; botanical artwork download for educational project)',
              'Accept': 'image/jpeg,image/png,image/*',
              'Referer': 'https://commons.wikimedia.org/',
          }

          ok, fail = 0, 0
          for name, filename in PLATES.items():
              is_png = filename.endswith('.png')
              ext = '.png' if is_png else '.jpg'
              dest = f'artwork/{name}{ext}'

              if os.path.exists(dest) and os.path.getsize(dest) > 5000:
                  print(f'  skip {name} (exists)')
                  ok += 1
                  continue

              url = get_original_url(filename)
              success = False
              for attempt in range(3):
                  try:
                      r = requests.get(url, headers=headers, timeout=30)
                      if r.ok and len(r.content) > 5000:
                          # Resize to max 800px wide to keep file sizes manageable
                          try:
                              img = Image.open(io.BytesIO(r.content))
                              if img.width > 800:
                                  ratio = 800 / img.width
                                  new_h = int(img.height * ratio)
                                  img = img.resize((800, new_h), Image.LANCZOS)
                              if is_png:
                                  img.save(dest, 'PNG', optimize=True)
                              else:
                                  if img.mode == 'RGBA':
                                      img = img.convert('RGB')
                                  img.save(dest, 'JPEG', quality=85, optimize=True)
                              size_kb = os.path.getsize(dest) // 1024
                              print(f'  OK {name} ({size_kb}KB, resized to {img.width}x{img.height})')
                          except Exception as e:
                              # Save raw if resize fails
                              with open(dest, 'wb') as f:
                                  f.write(r.content)
                              print(f'  OK {name} ({len(r.content)//1024}KB, raw)')
                          ok += 1
                          success = True
                          break
                      elif r.status_code == 429:
                          print(f'  {name}: rate limited, waiting 15s...')
                          time.sleep(15)
                      else:
                          print(f'  FAIL {name}: HTTP {r.status_code}')
                          fail += 1
                          break
                  except Exception as e:
                      print(f'  ERROR {name}: {e}')
                      if attempt < 2:
                          time.sleep(5)
                  time.sleep(1)  # polite delay between requests
              if not success and not any(c > 0 for c in []):
                  pass

          print(f'\nTotal: {ok} OK, {fail} failed')
          if fail > 0:
              sys.exit(1)
          PYEOF

      - name: Commit artwork to repo
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add artwork/
          git diff --staged --quiet || git commit -m "Add Köhler botanical artwork plates [automated]"
          git push
