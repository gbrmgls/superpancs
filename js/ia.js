// Escolha de atributo pelo computador.
// - Fácil: escolhe ao acaso.
// - Difícil: escolhe o atributo com maior chance de vencer uma carta qualquer do resto do baralho
//   (as outras 31 cartas). Valores iguais contam como meia vitória. Para a Super Trunfo,
//   as hortaliças comuns são vitória certa em qualquer atributo.

const DIFICULDADES = {
  facil:   { nome: 'Fácil' },
  dificil: { nome: 'Difícil' },
};

function chanceDeVitoria(carta, chave, baralho) {
  let pontos = 0;
  let total = 0;
  for (const outra of baralho) {
    if (outra === carta) continue;
    total++;
    if (carta.superTrunfo && outra.tipo !== 'panc') { pontos++; continue; }
    if (outra.superTrunfo && carta.tipo !== 'panc') continue;
    const a = carta.valores[chave];
    const b = outra.valores[chave];
    if (a > b) pontos++;
    else if (a === b) pontos += 0.5;
  }
  return pontos / total;
}

// No navegador, CARTAS vem de cartas.js; no Node (testes), é carregado sob demanda.
function baralhoCompleto() {
  return typeof module !== 'undefined' ? require('./cartas.js').CARTAS : CARTAS;
}

function escolherAtributo(carta, dificuldade = 'facil', aleatorio = Math.random, baralho = baralhoCompleto()) {
  const chaves = Object.keys(carta.valores);
  if (dificuldade === 'facil') return chaves[Math.floor(aleatorio() * chaves.length)];
  if (dificuldade !== 'dificil') throw new Error(`Dificuldade desconhecida: ${dificuldade}`);

  let melhor = chaves[0];
  let melhorChance = -1;
  for (const chave of chaves) {
    const chance = chanceDeVitoria(carta, chave, baralho);
    if (chance > melhorChance) { melhor = chave; melhorChance = chance; }
  }
  return melhor;
}

if (typeof module !== 'undefined') {
  module.exports = { DIFICULDADES, chanceDeVitoria, escolherAtributo };
}
