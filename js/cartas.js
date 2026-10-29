// Dados das 32 cartas do SuperPANCs, transcritos das imagens em imagens-cartas-superpancs/.
// Valores numéricos: proteína, carboidrato e fibras em g/100g; calorias gastas em kcal/h.
// As estrelas (1 a 3) são apenas visuais — a comparação usa o valor numérico.

const ATRIBUTOS = [
  { chave: 'proteina',    nome: 'Proteína',        unidade: 'g/100g' },
  { chave: 'carboidrato', nome: 'Carboidrato',     unidade: 'g/100g' },
  { chave: 'fibras',      nome: 'Fibras',          unidade: 'g/100g' },
  { chave: 'calorias',    nome: 'Calorias gastas', unidade: 'kcal/h' },
];

// O jogo usa as versões otimizadas (WebP) em img/cartas/, geradas por ferramentas/otimizar-imagens.sh
// a partir dos JPGs originais. Se o navegador não abrir WebP, o index.html troca para o JPG original.
// Na mesa, a carta usa a imagem sem texto (img/cartas-limpas/) e o nome e os atributos são escritos por cima.
const VERSO = 'img/cartas/verso.webp';

function carta(id, arquivo, nome, esporte, tipo, valores, estrelas, superTrunfo = false) {
  const [proteina, carboidrato, fibras, calorias] = valores;
  const [eProteina, eCarboidrato, eFibras, eCalorias] = estrelas;
  return {
    id,
    nome,
    esporte,
    tipo, // 'comum' (hortaliça convencional) ou 'panc'
    superTrunfo,
    imagem: `img/cartas/${arquivo}.webp`,
    imagemLimpa: `img/cartas-limpas/${arquivo}.webp`,
    mascote: `img/mascotes/${arquivo}.webp`, // personagem animado (fundo transparente), gerado por ferramentas/animar-*.py
    imagemOriginal: `imagens-cartas-superpancs/${arquivo}.jpg`,
    valores: { proteina, carboidrato, fibras, calorias },
    estrelas: { proteina: eProteina, carboidrato: eCarboidrato, fibras: eFibras, calorias: eCalorias },
  };
}

const CARTAS = [
  // Hortaliças comuns
  carta(1,  1,  'Couve',      'Jiu-Jitsu',   'comum', [2.87, 4.33, 3.12, 850], [2, 2, 1, 3]),
  carta(2,  3,  'Alface',     'Basquete',    'comum', [1.08, 1.79, 1.87, 600], [1, 1, 1, 3]),
  carta(3,  5,  'Abobrinha',  'Natação',     'comum', [1.01, 3.71, 1.28, 600], [1, 2, 1, 3]),
  carta(4,  7,  'Chicória',   'Capoeira',    'comum', [1.14, 2.76, 2.2,  600], [1, 2, 1, 3]),
  carta(5,  9,  'Rúcula',     'Futebol',     'comum', [2.48, 2.73, 3.44, 325], [2, 2, 1, 2]),
  carta(6,  11, 'Brócolis',   'Handebol',    'comum', [4.14, 4.99, 3.04, 750], [3, 2, 1, 3]),
  carta(7,  13, 'Cebolinha',  'Zumba',       'comum', [1.66, 3.55, 2.39, 850], [1, 2, 1, 2]),
  carta(8,  15, 'Quiabo',     'Vôlei',       'comum', [1.77, 6.52, 4.08, 275], [1, 3, 2, 1]),
  carta(9,  17, 'Espinafre',  'Yoga',        'comum', [2.24, 4.17, 3.83, 300], [2, 2, 1, 2]),
  carta(10, 19, 'Pimentão',   'Boxe',        'comum', [1.04, 5.47, 1.59, 600], [1, 3, 1, 3]),
  carta(11, 21, 'Tomate',     'Musculação',  'comum', [1.04, 3.82, 1.6,  300], [1, 2, 1, 2]),
  carta(12, 23, 'Agrião',     'Muay Thai',   'comum', [3.17, 2.58, 1.98, 750], [2, 1, 1, 3]),
  carta(13, 25, 'Repolho',    'Kickboxing',  'comum', [1.12, 4.42, 1.92, 750], [1, 2, 1, 3]),
  carta(14, 27, 'Pepino',     'Funcional',   'comum', [0.7,  2.24, 1.04, 700], [1, 1, 1, 3]),
  carta(15, 29, 'Salsa',      'Judô',        'comum', [3.91, 8.14, 2.91, 750], [3, 3, 1, 3]),
  carta(16, 31, 'Chuchu',     'Pilates',     'comum', [0.89, 4.17, 1.14, 250], [1, 2, 1, 1]),

  // PANCs (plantas alimentícias não convencionais)
  carta(17, 33, 'Caruru',             'Funcional',  'panc', [5.58, 6.31,  7.38, 700], [3, 3, 3, 3]),
  carta(18, 35, 'Serralha',           'Boxe',       'panc', [3.57, 2.42,  4.34, 600], [2, 1, 2, 3]),
  carta(19, 37, 'Dente-de-leão',      'Basquete',   'panc', [4.5,  2.15,  1.72, 600], [3, 1, 1, 3]),
  carta(20, 39, 'Almeirão-roxo',      'Futebol',    'panc', [1.73, 4.5,   3.4,  325], [1, 2, 2, 2]),
  carta(21, 41, 'Peixinho-da-horta',  'Zumba',      'panc', [4.14, 4.23, 13.21, 450], [3, 2, 3, 2]),
  carta(22, 43, 'Maria-gorda',        'Kickboxing', 'panc', [3.7,  2.94,  0.9,  750], [2, 2, 1, 3]),
  carta(23, 45, 'Beldroega',          'Capoeira',   'panc', [1.27, 1.83,  2.76, 600], [1, 1, 1, 3]),
  carta(24, 47, 'Ora-pro-nóbis',      'Musculação', 'panc', [2.1,  2.65,  3.88, 300], [2, 1, 2, 2], true),
  carta(25, 49, 'Capuchinha',         'Vôlei',      'panc', [5,    5.17,  4.46, 275], [3, 2, 2, 1]),
  carta(26, 51, 'Bertalha',           'Natação',    'panc', [2.01, 1.31,  2.02, 600], [2, 1, 1, 2]),
  carta(27, 53, 'Major-gomes',        'Handebol',   'panc', [1.04, 2.28,  1.48, 750], [1, 1, 1, 3]),
  carta(28, 55, 'Taioba',             'Judô',       'panc', [3.05, 4.12,  3.89, 750], [2, 2, 2, 3]),
  carta(29, 57, 'Jambu',              'Jiu-Jitsu',  'panc', [3.85, 4.37,  6.53, 850], [3, 2, 2, 3]),
  carta(30, 59, 'Vinagreira',         'Muay Thai',  'panc', [3.97, 6.94,  5.3,  750], [3, 3, 2, 3]),
  carta(31, 61, 'Azedinha',           'Pilates',    'panc', [2.07, 1.95,  2.53, 250], [2, 1, 1, 1]),
  carta(32, 63, 'Pequi',              'Yoga',       'panc', [2.24, 12.54, 9.9,  300], [2, 3, 3, 2]),
];

if (typeof module !== 'undefined') {
  module.exports = { ATRIBUTOS, VERSO, CARTAS };
}
