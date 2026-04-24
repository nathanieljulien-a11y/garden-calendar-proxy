// calendarTemplate.js (CommonJS)
// Page A: illustration left (full height) + commentary/inspo/climate right
// Page B: full-page calendar grid with key dates and holidays

var DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

var QUOTES = [
  { text: 'To forget how to dig the earth and tend the soil is to forget ourselves.', author: 'Mahatma Gandhi' },
  { text: 'A garden is a grand teacher. It teaches patience and careful watchfulness; it teaches industry and thrift.', author: 'Gertrude Jekyll, Home and Garden, 1900' },
  { text: "The kiss of the sun for pardon, the song of the birds for mirth — one is nearer God's heart in a garden than anywhere else on earth.", author: 'Dorothy Frances Gurney, 1913' },
  { text: 'God Almighty first planted a garden; and indeed it is the purest of human pleasures.', author: 'Francis Bacon, Essays, 1625' },
  { text: 'A garden must be looked into and dressed as the body.', author: 'George Herbert, Outlandish Proverbs, 1640' },
  { text: 'Who loves a garden still his Eden keeps, perennial pleasures plants, and wholesome harvests reaps.', author: 'Amos Bronson Alcott, 1868' },
  { text: "The garden is the poor man's apothecary.", author: 'German proverb' },
  { text: 'He who plants a garden plants happiness.', author: 'Chinese proverb' },
  { text: 'A garden is not made in a year; indeed it is never made in the sense of being finished.', author: 'H. H. Thomas, The Complete Gardener, 1912' },
  { text: 'All gardening is landscape painting.', author: 'Alexander Pope, c. 1720' },
  { text: 'The best place to find God is in a garden. You can dig for him there.', author: 'George Bernard Shaw, 1932' },
  { text: 'The glory of gardening: hands in the dirt, head in the sun, heart with nature.', author: 'Alfred Austin, The Garden That I Love, 1894' },
];

// Pre-computed direct upload.wikimedia.org URLs — no redirects, no CORS issues
var ARTWORK_URLS = {
  'rose': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Rosa_centifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-257.jpg/800px-Rosa_centifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-257.jpg',
  'wisteria': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Wisteria_sinensis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-285.jpg/800px-Wisteria_sinensis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-285.jpg',
  'lavender': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Lavandula_angustifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-088.jpg/800px-Lavandula_angustifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-088.jpg',
  'peony': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Paeonia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-164.jpg/800px-Paeonia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-164.jpg',
  'iris': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Iris_germanica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-187.jpg/800px-Iris_germanica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-187.jpg',
  'tulip': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Tulipa_gesneriana_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-272.jpg/800px-Tulipa_gesneriana_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-272.jpg',
  'sunflower': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Helianthus_annuus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-078.jpg/800px-Helianthus_annuus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-078.jpg',
  'camellia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Camellia_japonica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-025.jpg/800px-Camellia_japonica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-025.jpg',
  'magnolia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Magnolia_grandiflora_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-097.jpg/800px-Magnolia_grandiflora_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-097.jpg',
  'oleander': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Nerium_oleander_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-124.jpg/800px-Nerium_oleander_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-124.jpg',
  'foxglove': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Digitalis_purpurea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-052.jpg/800px-Digitalis_purpurea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-052.jpg',
  'hydrangea': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Hydrangea_macrophylla_SZ85.png/500px-Hydrangea_macrophylla_SZ85.png',
  'rosemary': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Rosmarinus_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-244.jpg/800px-Rosmarinus_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-244.jpg',
  'thyme': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Thymus_vulgaris_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-271.jpg/800px-Thymus_vulgaris_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-271.jpg',
  'sage': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Salvia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-246.jpg/800px-Salvia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-246.jpg',
  'mint': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Mentha_piperita_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-112.jpg/800px-Mentha_piperita_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-112.jpg',
  'fig': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Ficus_carica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-057.jpg/800px-Ficus_carica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-057.jpg',
  'peach': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Prunus_persica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-183.jpg/800px-Prunus_persica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-183.jpg',
  'cherry': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Prunus_cerasus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-180.jpg/800px-Prunus_cerasus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-180.jpg',
  'strawberry': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Fragaria_vesca_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-065.jpg/800px-Fragaria_vesca_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-065.jpg',
  'raspberry': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Rubus_idaeus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-237.jpg/800px-Rubus_idaeus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-237.jpg',
  'grape': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vitis_vinifera_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-280.jpg/800px-Vitis_vinifera_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-280.jpg',
  'lemon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Citrus_limon_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-036.jpg/800px-Citrus_limon_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-036.jpg',
  'olive': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Olea_europaea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-130.jpg/800px-Olea_europaea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-130.jpg',
  'pansy': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Viola_tricolor_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-278.jpg/800px-Viola_tricolor_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-278.jpg',
  'nasturtium': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Tropaeolum_majus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-273.jpg/800px-Tropaeolum_majus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-273.jpg',
  'borage': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Borago_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-023.jpg/800px-Borago_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-023.jpg',
  'snapdragon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Antirrhinum_majus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-013.jpg/800px-Antirrhinum_majus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-013.jpg',
  'valerian': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Valeriana_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-275.jpg/800px-Valeriana_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-275.jpg',
  'fennel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Foeniculum_vulgare_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-063.jpg/800px-Foeniculum_vulgare_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-063.jpg',
  'elderflower': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Sambucus_nigra_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-247.jpg/800px-Sambucus_nigra_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-247.jpg',
  'almond': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Prunus_dulcis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-177.jpg/800px-Prunus_dulcis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-177.jpg',
  'quince': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Cydonia_oblonga_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-047.jpg/800px-Cydonia_oblonga_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-047.jpg',
  'mulberry': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Morus_nigra_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-119.jpg/800px-Morus_nigra_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-119.jpg',
  'apricot': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Prunus_armeniaca_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-179.jpg/800px-Prunus_armeniaca_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-179.jpg',
};

// Hardcoded plant commentary — fact, care notes, enjoy notes per plant
// (generated once, curated, no API call needed)
var PLANT_COMMENTARY = {
  'rose':        { fact: 'Rosa has been cultivated for over 5,000 years. The oldest living rose is said to grow on the Cathedral of Hildesheim in Germany, planted around 815 AD.', care: 'Deadhead regularly to encourage continuous flowering. Feed with a high-potash fertiliser fortnightly from spring to late summer. Watch for blackspot in humid conditions.', enjoy: 'Few sights in the garden match a fully open rose in peak bloom — the layered petals, the scent carried on warm air, the colours deepening towards the centre.' },
  'iris':        { fact: 'The word iris means rainbow in Greek. The fleur-de-lis, symbol of French royalty, is derived from the iris — most likely Iris pseudacorus, the yellow flag iris native to France.', care: 'Divide congested rhizomes every three to four years, immediately after flowering. Plant shallowly with the top of the rhizome exposed to the sun to ripen and encourage flowering.', enjoy: 'Iris flowers have an almost architectural quality — the three upright standards and three drooping falls create a structure quite unlike any other flower in the garden.' },
  'lavender':    { fact: 'Lavender takes its name from the Latin lavare, to wash. Roman soldiers added it to their bathwater, and it was used to scent linen in Tudor England. It remains one of the most widely grown fragrance crops in the world.', care: 'Trim plants after flowering to prevent woodiness, but never cut into bare old wood. Perfect drainage is essential — more lavender dies from wet roots than from drought.', enjoy: 'The combination of silver-grey foliage and purple flower spikes, alive with bees and butterflies, makes lavender one of the most complete sensory experiences in the summer garden.' },
  'tulip':       { fact: "Tulip mania gripped Holland in the 1630s, when a single bulb of the striped 'Semper Augustus' variety sold for more than a skilled craftsman could earn in a year. The striking colours were caused by a virus.", care: 'Plant bulbs 15cm deep in autumn in well-drained soil. After flowering, allow the foliage to die back completely before removing — this replenishes the bulb for next year.', enjoy: 'Tulips bring an almost theatrical sense of colour to the spring garden. Their simple cup shape and jewel-bright colours seem to concentrate all the optimism of the season.' },
  'peony':       { fact: 'Peonies can live for over a century. There are records of specimens in English gardens that have been flowering in the same spot for more than 150 years without ever being divided.', care: 'Plant with the red growing buds (eyes) no more than 5cm below the soil surface. Planting too deep is the single most common reason peonies fail to flower.', enjoy: 'When a peony opens fully, it becomes one of the most extravagant flowers in cultivation — layers of silky petals, often fragrant, in colours from deepest crimson to palest blush.' },
  'wisteria':    { fact: 'The largest known wisteria in the world grows in Sierra Madre, California, planted in 1894. It covers over 4,000 square metres and weighs an estimated 250 tonnes.', care: 'Prune twice a year: cut all new growth back to five leaves in midsummer, then reduce the same shoots to two or three buds in late winter. This builds up the flowering spurs.', enjoy: "Few flowering climbers match wisteria in full bloom — cascading racemes of lilac-blue or white flowers, intensely fragrant on warm days, transforming whatever they cover." },
  'camellia':    { fact: "Camellias are closely related to the tea plant, Camellia sinensis. Both originated in East Asia, where camellias have been cultivated for over 1,000 years and appear frequently in Chinese and Japanese art.", care: 'Never let camellias dry out, especially in autumn when flower buds are forming. Mulch generously to retain moisture. Avoid planting in frost pockets — late frost kills open blooms.', enjoy: "Camellias are among the most glamorous of winter and early spring flowers — their glossy evergreen leaves and perfectly formed blooms appearing when little else is in flower." },
  'magnolia':    { fact: "Magnolias are among the most ancient of flowering plants, predating bees. They evolved to be pollinated by beetles, which is why the flowers are so robust — they have to withstand beetle traffic.", care: "Avoid planting in frost pockets, as late frosts can destroy the flowers. Prune only when necessary, immediately after flowering. Never prune in autumn — you will remove next year's flower buds.", enjoy: "There is nothing subtle about a magnolia in full flower. The large, silky blooms open from furry buds with an almost theatrical sense of occasion, dominating the garden for weeks." },
  'hydrangea':   { fact: "Hydrangea flower colour is directly affected by soil pH. In acid soils the flowers turn blue because the plant can absorb aluminium; in alkaline soils they turn pink because it cannot. White varieties are unaffected.", care: "Prune mophead and lacecap varieties in spring, cutting stems back to the first pair of fat, healthy buds. Leave old flowerheads on the plant over winter — they protect the new buds from frost.", enjoy: "Hydrangeas are the quintessential late-summer flowering shrub — large, rounded flowerheads in blues, pinks, and whites that persist for months and dry beautifully on the plant." },
  'foxglove':    { fact: "Digitalis, the heart medication derived from foxglove, was first described medicinally by William Withering in 1785 after he learned of its use in folk medicine. It remains an important drug today.", care: "Foxgloves are biennial — sow seed in June for flowers the following summer. They self-seed prolifically in the right conditions. Cut down flower spikes after flowering to encourage side shoots.", enjoy: "The tall spires of foxgloves bring a wild, woodland quality to the garden. Individually, each tubular flower is beautifully spotted inside — an invitation to peer in at the bee's-eye view." },
  'rosemary':    { fact: "Rosemary has been associated with memory since ancient Greece — students wore garlands of it during examinations. 'Rosemary for remembrance' appears in Shakespeare's Hamlet, spoken by Ophelia.", care: "Requires excellent drainage and full sun. Trim lightly after flowering to keep plants bushy, but never cut into old bare wood — rosemary will not regenerate from leafless stems.", enjoy: "Rosemary in full flower is a magnet for bees. The blue flowers, the silver-green needle-like foliage, and the intense Mediterranean fragrance make it one of the most useful plants in the garden." },
  'thyme':       { fact: "The ancient Greeks burned thyme as incense in their temples, and Roman soldiers bathed in thyme-infused water before battle, believing it conferred strength and courage.", care: "Trim hard after flowering to prevent plants becoming woody and sprawling. Excellent drainage is essential. Divide or replace plants every three to four years as they deteriorate with age.", enjoy: "Thyme in flower is a perfect miniature landscape — the tiny flowers covering every stem, alive with bumblebees on warm days, the whole plant intensely aromatic when touched." },
  'sage':        { fact: "The Latin name Salvia comes from salvare, to save — a reference to sage's long history as a medicinal herb. In medieval Europe it was said that a garden with sage needed no doctor.", care: "Cut back hard in spring to encourage fresh growth from the base. Replace plants every four to five years as they become woody. Excellent drainage is essential — sage detests wet roots.", enjoy: "Common sage is an underrated ornamental plant. The soft, textured grey-green leaves have a woolly surface that catches the light beautifully, and the purple flower spikes are attractive to bees." },
  'mint':        { fact: "There are over 600 varieties of mint, and they hybridise so freely that even botanists find them difficult to classify. Spearmint and peppermint are among the most familiar, but varieties range from apple mint to chocolate mint.", care: "Contain mint in pots or with a buried barrier — it spreads aggressively by underground runners and will take over a border within a season if left unchecked.", enjoy: "Mint is one of the most evocative garden scents — fresh, clean, and instantly recognisable. Running your hand along a stem and inhaling the scent is one of the small pleasures of the kitchen garden." },
  'fig':         { fact: "Figs are botanically unusual: what we eat is not a fruit but a syconium — an inverted flower structure containing hundreds of tiny flowers inside. The true fruits are the crunchy seeds within.", care: "Restrict roots to encourage fruiting — plant in a large container or line a pit with paving slabs. In cool climates, fan-train against a warm south-facing wall. Remove unripe figs in autumn.", enjoy: "A fig tree in full leaf brings a Mediterranean quality to any garden. The large, deeply lobed leaves are architectural and beautiful, and ripe figs have an intensity of sweetness matched by few fruits." },
  'peach':       { fact: "Peaches originated in China, where they have been cultivated for over 4,000 years. In Chinese culture they symbolise immortality and good fortune. They reached Europe via Persia, giving rise to the Latin name persica.", care: "Fan-train against a warm wall in cooler climates. Thin fruits to one per 20cm after the natural June drop for the best size and flavour. Net against peach leaf curl in late winter.", enjoy: "A peach ripened on a warm wall, picked and eaten in the garden still warm from the sun, is one of the great pleasures of the fruit garden — sweet, fragrant, and entirely seasonal." },
  'cherry':      { fact: "A mature sweet cherry tree can produce up to 7,000 individual fruits in a single season. The wood of the cherry tree is highly prized by furniture makers for its rich, warm grain.", care: "Prune only in summer to minimise the risk of silver leaf disease, which enters through winter wounds. Net trees when fruit begins to colour — birds can strip a tree overnight.", enjoy: "Cherry blossom is among the most celebrated of all flowering trees. The explosion of white or pink flowers in early spring, often before the leaves, is a moment of pure seasonal joy." },
  'strawberry':  { fact: "The strawberry is not technically a berry — botanically, a berry must develop from a single flower with one ovary. The red flesh of a strawberry is an enlarged receptacle; the true fruits are the small seeds on the surface.", care: "Replace plants every three years as productivity declines. Peg down runners into small pots to propagate. Mulch with straw as fruits develop to keep them clean and deter slugs.", enjoy: "The smell of a sun-warmed strawberry freshly picked from the plant is impossible to replicate commercially. Homegrown strawberries, eaten immediately, bear little resemblance to shop-bought fruit." },
  'raspberry':   { fact: "Raspberries are aggregate fruits, each composed of many small individual drupelets arranged around a central core. A single raspberry may contain up to 100 individual tiny fruits fused together.", care: "After fruiting, cut all canes of summer-fruiting varieties to the ground and tie in the new canes for the following year. Autumn-fruiting varieties can be cut to the ground in late winter.", enjoy: "Raspberries are one of the most rewarding of all soft fruits — prolific, easy to grow, and with a depth of flavour, especially in the red varieties, that intensifies when eaten fresh from the cane." },
  'grape':       { fact: "Evidence of winemaking dates back at least 8,000 years, making the grape one of the oldest cultivated plants. The genome of the grapevine contains more genes than the human genome.", care: "Prune hard to a framework of permanent rods each winter. Tie in new growth regularly during the growing season. Thin bunches in summer to improve air circulation and fruit size.", enjoy: "A grapevine in full growth has an extraordinary vitality — the tendrils reaching out to grip any support, the large leaves casting dappled shade, the developing bunches hanging in growing clusters." },
  'lemon':       { fact: "Lemon trees can carry flowers, unripe green fruit, and ripe yellow fruit all simultaneously. They never go fully dormant and, given warmth and light, will produce fruit year-round.", care: "Feed with a specialist citrus fertiliser monthly from spring to autumn. Bring under cover before the first frost in cool climates. Water consistently — erratic watering causes fruit to split.", enjoy: "A potted lemon tree in flower is one of the most intoxicating things in the garden. The intense, sweet fragrance of lemon blossom carries remarkable distances on still, warm evenings." },
  'olive':       { fact: "Some olive trees in the Mediterranean are genuinely ancient — carbon dating has confirmed specimens in Crete, Sardinia, and Lebanon that are estimated to be over 2,000 years old and still producing olives.", care: "Extremely drought-tolerant once established. Hardy to around -10°C, but young trees need protection in hard winters. Pot-grown olives should be moved under cover below -5°C.", enjoy: "The olive has an elegance and timelessness unlike almost any other tree. The silver-grey foliage catching the light, the gnarled ancient-looking trunks even on young specimens — it carries the Mediterranean with it." },
  'pansy':       { fact: "Pansies were developed from wild violas in the early 19th century by Lady Mary Bennett and her gardener at Walton-on-Thames. Within decades, hundreds of named varieties existed — one of horticulture's fastest developments.", care: "Deadhead regularly to extend flowering. Feed fortnightly with a high-potash fertiliser. In mild winters they will flower almost continuously; in cold areas, treat as an annual and replace each spring.", enjoy: "Pansies have a charm out of proportion to their small size. The velvety, face-like flowers in their combination of colours — purple, yellow, orange, white — are among the most expressive in the garden." },
  'nasturtium':  { fact: "Nasturtiums are entirely edible — flowers, leaves, and seeds. The peppery leaves and flowers add colour to salads; the unripe seeds can be pickled as a caper substitute.", care: "Sow direct where they are to flower after the last frost — they dislike transplanting. Grow in poor soil for more flowers and fewer leaves. Almost no care required once established.", enjoy: "Nasturtiums are among the most cheerful of all annual flowers — the round leaves catching raindrops, the trumpet flowers in shades of orange, red, and yellow tumbling over walls and banks." },
  'borage':      { fact: "Borage has been used medicinally since ancient times. The Romans believed it brought courage — 'I, borage, bring always courage' was a popular motto. It has one of the highest concentrations of gamma-linolenic acid of any plant.", care: "Sow direct where it is to grow — borage dislikes transplanting. It self-seeds prolifically once established and will appear each year without further effort. Deadhead to control self-seeding.", enjoy: "Borage produces some of the most intensely blue flowers of any plant in the garden. The star-shaped flowers, with their dramatic black anthers, are irresistible to bees and beautiful in ice cubes." },
  'snapdragon':  { fact: "The snapdragon's scientific name, Antirrhinum, comes from the Greek for 'nose-like' — a reference to the shape of the closed flower. Children have squeezed the sides of the flower to make it 'snap' for centuries.", care: "Pinch out the growing tips when young to encourage bushy growth and more flowers. Deadhead regularly to extend the season. In mild climates, plants may survive winter and flower again.", enjoy: "Snapdragons bring a vertical element to the summer border. The tall spikes of densely packed flowers, in colours from deepest crimson to palest yellow, have a richness and formality that suits formal planting." },
  'valerian':    { fact: "Valerian root has been used as a sedative and sleep aid since ancient Greece and Rome. Modern research has confirmed it contains compounds that interact with GABA receptors — the same pathway targeted by some sleeping medications.", care: "Cut to the ground in autumn. Divide clumps every three to four years in spring or autumn. Self-seeds freely — deadhead to prevent unwanted spread. Tolerates most soils.", enjoy: "Valerian in full flower is a cloud of tiny pale pink or white flowers on tall stems, humming with butterflies and bees. It has a wildness and informality that suits cottage and naturalistic planting." },
  'fennel':      { fact: "Fennel is one of the oldest cultivated plants. It was grown in ancient Egypt, Greece, and Rome, used as food, medicine, and — according to Pliny the Elder — as a remedy for improving eyesight.", care: "Fennel self-seeds vigorously — deadhead unless you want it to spread. Keep away from dill and coriander, which it will hybridise with. Cut to the ground in autumn.", enjoy: "Bronze fennel is one of the most beautiful foliage plants in the garden. The feathery, hair-fine leaves in deep copper-bronze catch the light and move gracefully in the slightest breeze." },
  'elderflower': { fact: "Elder has been considered a magical and medicinal plant throughout European history. Almost every part of the plant has been used — flowers for cordials and fritters, berries for wine and rob, bark for purgatives.", care: "Elder grows vigorously and can become large — cut back hard every two to three years in late winter to keep it to a manageable size. Tolerates most soils and positions including shade.", enjoy: "Elderflowers in June have one of the most evocative scents in the countryside — sweet, slightly musky, and intensely summery. The large flat-topped flowerheads are beautiful in their own right." },
  'almond':      { fact: "Almonds are the world's most widely grown tree nut. Botanically, the almond is a drupe — related to the peach, plum, and cherry. The part we eat is the seed inside the stone, not the fruit itself.", care: "In cool climates, plant against a warm south-facing wall to protect the early blossom from frost. Fan-training maximises heat absorption and fruit production in marginal climates.", enjoy: "Almond blossom appears very early in the year — sometimes in January or February — covering bare branches with pink-tinged white flowers before a single leaf has opened. A beautiful harbinger of spring." },
  'quince':      { fact: "Quince is believed to be the 'golden apple' of Greek mythology — the fruit of discord thrown by Eris at the wedding of Peleus and Thetis that led ultimately to the Trojan War.", care: "Quinces are largely self-fertile and require little pruning beyond removing dead wood and crossing branches. They fruit best in warm summers — in cool climates, wall training in a sheltered position helps.", enjoy: "Quince is spectacular in both spring and autumn. The large white or pale pink blossom in April is beautiful; in October the golden-yellow fruits hanging heavily on the branches are extraordinary." },
  'mulberry':    { fact: "The mulberry takes decades to begin fruiting seriously, which gave rise to a saying about long-term planning. James I planted thousands of black mulberry trees across England in 1609 to establish a silk industry — unfortunately silk worms prefer white mulberry leaves.", care: "Mulberries need almost no pruning — simply remove dead wood if necessary in late summer. Avoid disturbing the roots. Stake young trees firmly as they have a shallow root system.", enjoy: "A mature mulberry tree is one of the most characterful in the garden — the gnarled trunk, the large lobed leaves casting deep shade, and in late summer the dark red fruits that stain everything they touch." },
  'apricot':     { fact: "Apricots originated in China over 4,000 years ago and reached Europe via Armenia — hence the species name armeniaca. Alexander the Great is credited with bringing them west following his campaigns.", care: "Fan-train against a warm south-facing wall in cool climates. Protect blossom from late frosts with fleece — apricots flower very early and a single frost can destroy the entire crop.", enjoy: "Apricots ripening on a warm wall are among the most beautiful sights in the fruit garden — the orange-gold skin, the warm fragrance, the knowledge that this is genuinely one of the finest fruits you can grow." },
};

function getArtworkUrl(plant) {
  if (!plant) return null;
  return ARTWORK_URLS[plant.toLowerCase()] || null;
}

function getCommentary(plant) {
  if (!plant) return { fact: '', care: '', enjoy: '' };
  return PLANT_COMMENTARY[plant.toLowerCase()] || { fact: '', care: '', enjoy: '' };
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

// ── Page A: illustration + commentary + inspo + climate ───────────────────────
function buildPageA(opts) {
  var monthName     = opts.monthName;
  var monthIdx      = opts.monthIdx;
  var year          = opts.year;
  var plant         = opts.plant || '';
  var artworkB64    = opts.artworkB64 || '';
  var inspo         = opts.inspo || null;
  var climate       = opts.climate || '';
  var climateData   = opts.climateData || null;
  var recipientName = opts.recipientName || '';

  var plantDisplay  = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : monthName;
  var commentary    = getCommentary(plant);
  var quote         = QUOTES[monthIdx % QUOTES.length];
  var qrUrl         = encodeURIComponent('https://garden-calendar-frontend.vercel.app');

  var artworkSrc = artworkB64 || '';

  // Climate stats for this month
  var climateHtml = '';
  if (climateData && climateData._cd) {
    var cd = climateData._cd;
    var tMax  = cd.tMax  && cd.tMax[monthIdx]  != null ? Math.round(cd.tMax[monthIdx])  + '\u00b0C' : null;
    var tMin  = cd.tMin  && cd.tMin[monthIdx]  != null ? Math.round(cd.tMin[monthIdx])  + '\u00b0C' : null;
    var rain  = cd.precip && cd.precip[monthIdx]!= null ? Math.round(cd.precip[monthIdx]) + 'mm' : null;
    var sun   = cd.sunHrs && cd.sunHrs[monthIdx]!= null ? parseFloat(cd.sunHrs[monthIdx]).toFixed(1) + ' hrs sun/day' : null;
    var stats = [tMax ? ('High ' + tMax) : '', tMin ? ('Low ' + tMin) : '', rain ? (rain + ' rain') : '', sun || ''].filter(Boolean).join(' \u00b7 ');
    if (stats) {
      climateHtml = '<div class="climate-bar">'
        + '<span class="climate-region">' + climate + '</span>'
        + '<span class="climate-stats">' + stats + '</span>'
        + '</div>';
    }
  } else if (climate) {
    climateHtml = '<div class="climate-bar"><span class="climate-region">' + climate + '</span></div>';
  }

  // Inspo garden block
  var inspoHtml = '';
  if (inspo && inspo.name) {
    inspoHtml = '<div class="inspo-block">'
      + '<div class="section-label">Garden to visit this ' + monthName + '</div>'
      + '<div class="inspo-name">' + inspo.name + '</div>'
      + (inspo.location ? '<div class="inspo-location">' + inspo.location + '</div>' : '')
      + (inspo.highlight ? '<div class="inspo-highlight">' + inspo.highlight + '</div>' : '')
      + '</div>';
  }

  return '<div class="cal-page page-a">'
    + '<div class="bleed">'
    + '<div class="page-a-layout">'

    // Left: full-height artwork
    + '<div class="col-artwork">'
    + (artworkSrc
        ? '<img class="artwork-img" src="' + artworkSrc + '" alt="' + plantDisplay + ' botanical illustration"/>'
        : '<div class="artwork-placeholder"><div class="artwork-placeholder-text">' + plantDisplay + '</div></div>')
    + '<div class="artwork-footer">'
    + '<span class="artwork-plant-name">' + plantDisplay + '</span>'
    + '<span class="artwork-credit">K\u00f6hler\'s Medizinal-Pflanzen, 1887 \u00b7 Public Domain</span>'
    + '</div>'
    + '</div>'

    // Right: header + climate + commentary + inspo + quote + QR
    + '<div class="col-right">'

    + '<div class="page-header">'
    + '<div class="header-month">' + monthName + ' ' + year + '</div>'
    + (recipientName ? '<div class="header-recipient">' + recipientName + '\'s Garden Calendar</div>' : '')
    + '</div>'

    + climateHtml

    + (commentary.fact ? '<div class="commentary-section"><div class="section-label">Did you know?</div><div class="commentary-text fact-text">' + commentary.fact + '</div></div>' : '')
    + (commentary.enjoy ? '<div class="commentary-section"><div class="section-label">What to enjoy this month</div><div class="commentary-text">' + commentary.enjoy + '</div></div>' : '')
    + (commentary.care ? '<div class="commentary-section"><div class="section-label">Care notes</div><div class="commentary-text">' + commentary.care + '</div></div>' : '')

    + inspoHtml

    + '<div class="page-footer">'
    + '<div class="quote-text">\u201c' + quote.text + '\u201d</div>'
    + '<div class="quote-attr">\u2014 ' + quote.author + '</div>'
    + '<div class="qr-row">'
    + '<img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + qrUrl + '&margin=2" width="64" height="64" alt="app QR"/>'
    + '<div class="qr-label">Your digital<br/>garden calendar</div>'
    + '</div>'
    + '</div>'

    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
}

// ── Page B: full-page calendar grid ──────────────────────────────────────────
function buildPageB(opts) {
  var monthName     = opts.monthName;
  var monthIdx      = opts.monthIdx;
  var year          = opts.year;
  var plant         = opts.plant || '';
  var keyDates      = opts.keyDates || [];
  var holidays      = opts.holidays || [];
  var climate       = opts.climate || '';
  var recipientName = opts.recipientName || '';

  var plantDisplay = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : '';

  var keyDateMap = {};
  for (var i = 0; i < keyDates.length; i++) {
    var kd = keyDates[i];
    var kdate = new Date(kd.date);
    if (kdate.getFullYear() === year && kdate.getMonth() === monthIdx) {
      var kday = kdate.getDate();
      if (!keyDateMap[kday]) keyDateMap[kday] = [];
      keyDateMap[kday].push(kd.label || '');
    }
  }

  var holidayDays = {};
  var holidayLabelMap = {};
  for (var h = 0; h < holidays.length; h++) {
    var hol    = holidays[h];
    var hstart = new Date(hol.startDate);
    var hend   = new Date(hol.endDate);
    var hcur   = new Date(hstart.getTime());
    while (hcur <= hend) {
      if (hcur.getFullYear() === year && hcur.getMonth() === monthIdx) {
        var hday = hcur.getDate();
        holidayDays[hday] = true;
        if (hcur.getTime() === hstart.getTime()) holidayLabelMap[hday] = hol.label || 'Holiday';
      }
      hcur.setDate(hcur.getDate() + 1);
    }
  }

  var daysInMonth = getDaysInMonth(year, monthIdx);
  var firstDow    = getFirstDayOfWeek(year, monthIdx);

  var gridHtml = '';
  for (var dn = 0; dn < 7; dn++) {
    gridHtml += '<div class="cal-dow">' + DAY_NAMES[dn] + '</div>';
  }
  for (var e = 0; e < firstDow; e++) {
    gridHtml += '<div class="cal-cell cal-empty"></div>';
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var isHol   = !!holidayDays[d];
    var isHolS  = holidayLabelMap[d] !== undefined;
    var kdList  = keyDateMap[d] || [];
    var cls     = 'cal-cell' + (isHol ? ' cal-holiday' : '') + (kdList.length ? ' cal-event' : '');
    var inner   = '<span class="day-num">' + d + '</span>';
    if (isHolS) inner += '<span class="hol-label">' + holidayLabelMap[d] + '</span>';
    for (var k = 0; k < kdList.length; k++) {
      inner += '<span class="event-label">' + kdList[k] + '</span>';
    }
    gridHtml += '<div class="' + cls + '">' + inner + '</div>';
  }
  var total = firstDow + daysInMonth;
  var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var t = 0; t < trailing; t++) {
    gridHtml += '<div class="cal-cell cal-empty"></div>';
  }

  return '<div class="cal-page page-b">'
    + '<div class="bleed">'
    + '<div class="page-b-layout">'
    + '<div class="cal-header">'
    + '<div class="cal-header-month">' + monthName + '</div>'
    + '<div class="cal-header-year">' + year + '</div>'
    + (plantDisplay ? '<div class="cal-header-plant">' + plantDisplay + '</div>' : '')
    + (recipientName ? '<div class="cal-header-recipient">' + recipientName + '\'s Garden Calendar</div>' : '')
    + '</div>'
    + '<div class="cal-grid-full">' + gridHtml + '</div>'
    + '<div class="cal-footer">'
    + '<span class="cal-footer-text">The Garden Calendar \u00b7 garden-calendar-frontend.vercel.app</span>'
    + (climate ? '<span class="cal-footer-climate">' + climate + '</span>' : '')
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
}

// ── Shared CSS ────────────────────────────────────────────────────────────────
var SHARED_CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap');",
  ':root{--ink:#2C1A0A;--gold:#8B6914;--sage:#5A7A32;--cream:#F0EBE0;--parchment:#FDFAF4;--rust:#8A3A10;--muted:#7A5C2A;--border:rgba(139,105,20,0.22);}',
  'body{font-family:"Crimson Pro",Georgia,serif;color:var(--ink);background:var(--parchment);}',
  '.cal-page{width:426mm;height:303mm;position:relative;overflow:hidden;page-break-after:always;page-break-inside:avoid;background:var(--parchment);}',
  '.bleed{position:absolute;top:3mm;left:3mm;right:3mm;bottom:3mm;overflow:hidden;}',

  // PAGE A
  '.page-a-layout{display:grid;grid-template-columns:155mm 1fr;height:100%;}',
  '.col-artwork{position:relative;overflow:hidden;background:#F7F2E8;border-right:0.4mm solid var(--border);display:flex;flex-direction:column;}',
  '.artwork-img{flex:1;width:100%;min-height:0;object-fit:contain;display:block;filter:sepia(5%) contrast(1.06);}',
  '.artwork-placeholder{flex:1;display:flex;align-items:center;justify-content:center;}',
  '.artwork-placeholder-text{font-family:"Playfair Display",serif;font-style:italic;font-size:20pt;color:var(--muted);opacity:0.4;}',
  '.artwork-footer{flex-shrink:0;padding:2mm 4mm;background:rgba(240,235,224,0.95);border-top:0.3mm solid var(--border);display:flex;justify-content:space-between;align-items:baseline;}',
  '.artwork-plant-name{font-family:"Playfair Display",serif;font-style:italic;font-size:10pt;color:var(--ink);}',
  '.artwork-credit{font-size:7pt;color:var(--muted);opacity:0.6;}',
  '.col-right{display:flex;flex-direction:column;padding:4mm 5mm;overflow:hidden;gap:0;}',
  '.page-header{border-bottom:0.4mm solid var(--gold);padding-bottom:2.5mm;margin-bottom:2.5mm;flex-shrink:0;}',
  '.header-month{font-family:"Playfair Display",serif;font-size:18pt;font-weight:600;color:var(--ink);}',
  '.header-recipient{font-size:8.5pt;color:var(--muted);letter-spacing:0.05em;margin-top:0.5mm;}',
  '.climate-bar{display:flex;justify-content:space-between;align-items:baseline;padding:1.5mm 2.5mm;background:rgba(139,105,20,0.06);border-left:0.8mm solid var(--gold);margin-bottom:2.5mm;flex-shrink:0;}',
  '.climate-region{font-size:8.5pt;font-style:italic;color:var(--muted);}',
  '.climate-stats{font-size:8pt;color:var(--ink);font-family:"Playfair Display",serif;}',
  '.commentary-section{margin-bottom:2.5mm;flex-shrink:0;}',
  '.section-label{font-family:"Playfair Display",serif;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);margin-bottom:1mm;display:block;}',
  '.commentary-text{font-size:9.5pt;line-height:1.5;color:var(--ink);}',
  '.fact-text{font-style:italic;}',
  '.inspo-block{margin-bottom:2.5mm;padding:2.5mm 3mm;background:rgba(139,105,20,0.05);border-left:0.8mm solid var(--gold);flex-shrink:0;}',
  '.inspo-name{font-family:"Playfair Display",serif;font-size:10.5pt;font-weight:600;color:var(--ink);margin-bottom:0.5mm;}',
  '.inspo-location{font-size:8.5pt;color:var(--muted);margin-bottom:1mm;}',
  '.inspo-highlight{font-size:9pt;line-height:1.45;color:var(--ink);}',
  '.page-footer{margin-top:auto;border-top:0.3mm solid var(--border);padding-top:2.5mm;flex-shrink:0;}',
  '.quote-text{font-family:"Playfair Display",serif;font-style:italic;font-size:8.5pt;line-height:1.5;color:var(--ink);margin-bottom:1mm;}',
  '.quote-attr{font-size:7.5pt;color:var(--muted);margin-bottom:2mm;}',
  '.qr-row{display:flex;align-items:center;gap:3mm;}',
  '.qr-row img{border:0.3mm solid var(--border);border-radius:1mm;padding:1mm;background:white;}',
  '.qr-label{font-size:7pt;color:var(--muted);line-height:1.4;}',

  // PAGE B — calendar grid, 60% taller cells
  '.page-b-layout{display:flex;flex-direction:column;height:100%;}',
  '.cal-header{display:flex;align-items:baseline;gap:5mm;padding:3.5mm 5mm 3mm;background:var(--ink);color:var(--parchment);flex-shrink:0;}',
  '.cal-header-month{font-family:"Playfair Display",serif;font-size:26pt;font-weight:600;letter-spacing:0.01em;}',
  '.cal-header-year{font-size:15pt;opacity:0.6;}',
  '.cal-header-plant{font-size:10pt;font-style:italic;opacity:0.7;flex:1;}',
  '.cal-header-recipient{font-size:8pt;opacity:0.5;letter-spacing:0.05em;text-transform:uppercase;}',
  // Grid fills all remaining space; rows auto-size equally to fill
  '.cal-grid-full{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;min-height:0;border-left:0.3mm solid var(--border);border-top:0.3mm solid var(--border);}',
  '.cal-dow{font-size:8pt;text-align:center;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding:2.5mm;border-right:0.3mm solid var(--border);border-bottom:0.5mm solid var(--gold);background:rgba(139,105,20,0.04);grid-row:1;}',
  '.cal-cell{padding:2.5mm 3mm;border-right:0.3mm solid var(--border);border-bottom:0.3mm solid var(--border);display:flex;flex-direction:column;gap:1.2mm;overflow:hidden;}',
  '.cal-empty{background:rgba(0,0,0,0.015);}',
  '.cal-holiday{background:rgba(90,122,50,0.08);}',
  '.cal-event{background:rgba(139,105,20,0.05);}',
  '.day-num{font-size:15pt;font-weight:500;color:var(--ink);line-height:1;margin-bottom:1mm;}',
  '.cal-holiday .day-num{color:var(--sage);}',
  '.cal-event .day-num{color:var(--gold);}',
  '.hol-label{font-size:7.5pt;color:var(--sage);font-style:italic;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.event-label{font-size:8pt;color:var(--rust);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.cal-footer{display:flex;justify-content:space-between;align-items:center;padding:2mm 5mm;border-top:0.3mm solid var(--border);flex-shrink:0;}',
  '.cal-footer-text{font-size:7pt;color:var(--muted);opacity:0.6;letter-spacing:0.04em;}',
  '.cal-footer-climate{font-size:7pt;color:var(--muted);font-style:italic;opacity:0.7;}',
].join('\n');

module.exports = {
  buildPageA: buildPageA,
  buildPageB: buildPageB,
  getArtworkUrl: getArtworkUrl,
  getCommentary: getCommentary,
  SHARED_CSS: SHARED_CSS,
};
