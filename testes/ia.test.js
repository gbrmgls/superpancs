// Testes da escolha de atributo do computador. Rodar com: node --test testes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { CARTAS, ATRIBUTOS } = require('../js/cartas.js');
const { JOGADOR, COMPUTADOR, EMPATE, novaPartida, cartaDoTopo, jogarRodada } = require('../js/jogo.js');
const { chanceDeVitoria, escolherAtributo } = require('../js/ia.js');

const porNome = nome => CARTAS.find(c => c.nome === nome);
const CHAVES = ATRIBUTOS.map(a => a.chave);

function semente(s) {
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

test('fácil sempre devolve um atributo válido e usa os quatro', () => {
  const aleatorio = semente(3);
  const usados = new Set();
  for (let i = 0; i < 200; i++) {
    const chave = escolherAtributo(porNome('Couve'), 'facil', aleatorio);
    assert.ok(CHAVES.includes(chave));
    usados.add(chave);
  }
  assert.equal(usados.size, 4);
});

test('dificuldade desconhecida é recusada', () => {
  assert.throws(() => escolherAtributo(porNome('Couve'), 'impossivel'), /Dificuldade desconhecida/);
});

test('chance de vitória: maior valor do baralho vence todas, menor não vence nenhuma', () => {
  assert.equal(chanceDeVitoria(porNome('Peixinho-da-horta'), 'fibras', CARTAS), 1); // 13,21
  assert.equal(chanceDeVitoria(porNome('Pepino'), 'proteina', CARTAS), 0);           // 0,7
});

test('chance de vitória conta empates como meia vitória', () => {
  // Couve 850 kcal/h: empata com Cebolinha e Jambu, perde para a Super Trunfo, vence as outras 28
  assert.equal(chanceDeVitoria(porNome('Couve'), 'calorias', CARTAS), (28 + 2 * 0.5) / 31);
});

test('chance de vitória considera a Super Trunfo', () => {
  // Salsa tem 8,14 de carboidrato: só o Pequi (12,54) tem mais, mas ela também perde
  // para a Ora-pro-nóbis (2,65) por ser hortaliça comum
  assert.equal(chanceDeVitoria(porNome('Salsa'), 'carboidrato', CARTAS), 29 / 31);
  // A Ora-pro-nóbis vence as 16 comuns em qualquer atributo
  for (const chave of CHAVES) assert.ok(chanceDeVitoria(porNome('Ora-pro-nóbis'), chave, CARTAS) >= 16 / 31);
});

test('difícil escolhe o ponto forte de cartas conhecidas', () => {
  assert.equal(escolherAtributo(porNome('Peixinho-da-horta'), 'dificil'), 'fibras');
  assert.equal(escolherAtributo(porNome('Pequi'), 'dificil'), 'carboidrato');
  assert.equal(escolherAtributo(porNome('Caruru'), 'dificil'), 'proteina');
  assert.equal(escolherAtributo(porNome('Cebolinha'), 'dificil'), 'calorias');
});

test('difícil vence bem mais que fácil nos dois modos', () => {
  const aleatorio = semente(11);
  for (const [modo, partidas] of [['rapido', 4000], ['classico', 1000]]) {
    const vitorias = { [JOGADOR]: 0, [COMPUTADOR]: 0, [EMPATE]: 0 };
    for (let p = 0; p < partidas; p++) {
      const e = novaPartida(CARTAS, modo, aleatorio);
      while (!e.fim) {
        // JOGADOR joga no fácil, COMPUTADOR no difícil
        const dificuldade = e.vez === JOGADOR ? 'facil' : 'dificil';
        jogarRodada(e, escolherAtributo(cartaDoTopo(e, e.vez), dificuldade, aleatorio));
      }
      vitorias[e.campeao]++;
    }
    const taxa = vitorias[COMPUTADOR] / partidas;
    console.log(`  ${modo}: difícil vence ${(100 * taxa).toFixed(1)}%, fácil ${(100 * vitorias[JOGADOR] / partidas).toFixed(1)}%, empates ${(100 * vitorias[EMPATE] / partidas).toFixed(1)}%`);
    assert.ok(taxa > 0.7, `difícil deveria vencer mais de 70% no modo ${modo}`);
  }
});
