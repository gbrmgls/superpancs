// Testes do motor. Rodar com: node --test testes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { CARTAS, ATRIBUTOS } = require('../js/cartas.js');
const {
  JOGADOR, COMPUTADOR, EMPATE, MODOS,
  embaralhar, novaPartida, cartaDoTopo, compararCartas, jogarRodada,
} = require('../js/jogo.js');

const porNome = nome => CARTAS.find(c => c.nome === nome);
const totalCartas = e => e.maos[JOGADOR].length + e.maos[COMPUTADOR].length + e.monteEmpate.length;

// Gerador pseudoaleatório com semente, para partidas reproduzíveis.
function semente(s) {
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Monta um estado com mãos definidas, para testar situações específicas.
function estadoCom(maoJogador, maoComputador, vez = JOGADOR, rodada = 1, limiteRodadas = 20) {
  return {
    maos: { [JOGADOR]: maoJogador.map(porNome), [COMPUTADOR]: maoComputador.map(porNome) },
    monteEmpate: [], vez, rodada, limiteRodadas, fim: false, campeao: null, motivoFim: null,
  };
}

test('embaralhar mantém as mesmas cartas e não altera a lista original', () => {
  const original = [...CARTAS];
  const embaralhado = embaralhar(CARTAS, semente(1));
  assert.deepEqual(CARTAS, original);
  assert.equal(embaralhado.length, 32);
  assert.deepEqual(new Set(embaralhado), new Set(CARTAS));
});

test('nova partida distribui 16 cartas para cada um, sem repetir', () => {
  const e = novaPartida(CARTAS, 'rapido', semente(2));
  assert.equal(e.maos[JOGADOR].length, 16);
  assert.equal(e.maos[COMPUTADOR].length, 16);
  assert.equal(new Set([...e.maos[JOGADOR], ...e.maos[COMPUTADOR]]).size, 32);
  assert.ok([JOGADOR, COMPUTADOR].includes(e.vez));
  assert.equal(e.fim, false);
});

test('o jogador humano sempre começa', () => {
  for (let s = 1; s <= 50; s++) {
    for (const modo of ['rapido', 'classico']) assert.equal(novaPartida(CARTAS, modo, semente(s)).vez, JOGADOR);
  }
});

test('maior valor vence no atributo escolhido', () => {
  // Caruru 5,58 de proteína × Pepino 0,7
  assert.deepEqual(compararCartas(porNome('Caruru'), porNome('Pepino'), 'proteina'), { vencedor: 'a', motivo: 'atributo' });
  assert.deepEqual(compararCartas(porNome('Pepino'), porNome('Caruru'), 'proteina'), { vencedor: 'b', motivo: 'atributo' });
});

test('valores iguais dão empate', () => {
  // Alface e Abobrinha: 600 kcal/h
  assert.equal(compararCartas(porNome('Alface'), porNome('Abobrinha'), 'calorias').vencedor, EMPATE);
});

test('Super Trunfo vence qualquer hortaliça comum, em qualquer atributo', () => {
  const st = porNome('Ora-pro-nóbis');
  for (const comum of CARTAS.filter(c => c.tipo === 'comum')) {
    for (const { chave } of ATRIBUTOS) {
      assert.deepEqual(compararCartas(st, comum, chave), { vencedor: 'a', motivo: 'superTrunfo' });
      assert.deepEqual(compararCartas(comum, st, chave), { vencedor: 'b', motivo: 'superTrunfo' });
    }
  }
});

test('Super Trunfo contra PANC é decidido pelo atributo', () => {
  const st = porNome('Ora-pro-nóbis'); // proteína 2,1
  assert.deepEqual(compararCartas(st, porNome('Caruru'), 'proteina'), { vencedor: 'b', motivo: 'atributo' }); // 5,58
  assert.deepEqual(compararCartas(st, porNome('Beldroega'), 'proteina'), { vencedor: 'a', motivo: 'atributo' }); // 1,27
});

test('vencedor da rodada leva as duas cartas para o fim do monte e passa a escolher', () => {
  const e = estadoCom(['Pepino', 'Couve'], ['Caruru', 'Alface'], JOGADOR);
  const r = jogarRodada(e, 'proteina');
  assert.equal(r.vencedor, COMPUTADOR);
  assert.equal(r.escolheu, JOGADOR);
  assert.equal(e.vez, COMPUTADOR);
  assert.deepEqual(e.maos[JOGADOR].map(c => c.nome), ['Couve']);
  assert.deepEqual(e.maos[COMPUTADOR].map(c => c.nome), ['Alface', 'Caruru', 'Pepino']);
  assert.equal(e.rodada, 2);
});

test('empate manda as cartas para o monte, mantém a vez, e o próximo vencedor leva tudo', () => {
  const e = estadoCom(['Alface', 'Caruru', 'Couve'], ['Abobrinha', 'Pepino', 'Chuchu'], COMPUTADOR);

  const r1 = jogarRodada(e, 'calorias'); // 600 × 600
  assert.equal(r1.vencedor, EMPATE);
  assert.equal(e.vez, COMPUTADOR);
  assert.equal(e.monteEmpate.length, 2);
  assert.equal(r1.monteEmpate, 2);

  const r2 = jogarRodada(e, 'proteina'); // Caruru 5,58 × Pepino 0,7
  assert.equal(r2.vencedor, JOGADOR);
  assert.deepEqual(r2.cartasGanhas.map(c => c.nome), ['Caruru', 'Pepino', 'Alface', 'Abobrinha']);
  assert.equal(e.monteEmpate.length, 0);
  assert.equal(e.vez, JOGADOR);
  assert.deepEqual(e.maos[JOGADOR].map(c => c.nome), ['Couve', 'Caruru', 'Pepino', 'Alface', 'Abobrinha']);
});

test('partida termina quando um jogador fica sem cartas', () => {
  const e = estadoCom(['Caruru'], ['Pepino'], JOGADOR);
  const r = jogarRodada(e, 'proteina');
  assert.equal(r.fim, true);
  assert.equal(r.campeao, JOGADOR);
  assert.equal(r.motivoFim, 'semCartas');
  assert.equal(e.rodada, 1);
  assert.throws(() => jogarRodada(e, 'proteina'), /já terminou/);
});

test('empate na última carta de quem tem só uma: perde quem ficou sem cartas', () => {
  const e = estadoCom(['Alface'], ['Abobrinha', 'Couve'], JOGADOR);
  const r = jogarRodada(e, 'calorias');
  assert.equal(r.vencedor, EMPATE);
  assert.equal(r.campeao, COMPUTADOR);
});

test('empate na última carta dos dois: partida empatada', () => {
  const e = estadoCom(['Alface'], ['Abobrinha'], JOGADOR);
  const r = jogarRodada(e, 'calorias');
  assert.equal(r.fim, true);
  assert.equal(r.campeao, EMPATE);
});

test('atributo inválido é recusado sem alterar o estado', () => {
  const e = estadoCom(['Couve'], ['Alface'], JOGADOR);
  assert.throws(() => jogarRodada(e, 'vitamina'), /Atributo desconhecido/);
  assert.equal(cartaDoTopo(e, JOGADOR).nome, 'Couve');
  assert.equal(cartaDoTopo(e, COMPUTADOR).nome, 'Alface');
});

test('modo rápido tem limite de 20 rodadas; clássico não tem limite', () => {
  assert.equal(novaPartida(CARTAS, 'rapido').limiteRodadas, 20);
  assert.equal(novaPartida(CARTAS, 'classico').limiteRodadas, null);
  assert.throws(() => novaPartida(CARTAS, 'turbo'), /Modo desconhecido/);
});

test('modo clássico continua depois da rodada 20', () => {
  const e = estadoCom(['Caruru', 'Couve'], ['Pepino', 'Alface'], JOGADOR, 20, null);
  const r = jogarRodada(e, 'proteina');
  assert.equal(r.fim, false);
  assert.equal(e.rodada, 21);
});

test('a rodada 19 não encerra a partida', () => {
  const e = estadoCom(['Caruru', 'Couve'], ['Pepino', 'Alface'], JOGADOR, 19);
  const r = jogarRodada(e, 'proteina');
  assert.equal(r.fim, false);
  assert.equal(e.rodada, 20);
});

test('após a rodada 20 vence quem tiver mais cartas', () => {
  const e = estadoCom(['Pepino', 'Couve', 'Salsa'], ['Caruru', 'Alface'], JOGADOR, 20);
  const r = jogarRodada(e, 'proteina'); // computador vence: fica 2 × 3
  assert.equal(r.rodada, 20);
  assert.equal(r.fim, true);
  assert.equal(r.motivoFim, 'limiteRodadas');
  assert.equal(r.campeao, COMPUTADOR);
  assert.equal(e.rodada, 20);
  assert.throws(() => jogarRodada(e, 'proteina'), /já terminou/);
});

test('após a rodada 20, mesma quantidade de cartas empata a partida', () => {
  const e = estadoCom(['Alface', 'Couve', 'Salsa'], ['Abobrinha', 'Pepino', 'Chuchu'], JOGADOR, 20);
  const r = jogarRodada(e, 'calorias'); // empate 600 × 600: fica 2 × 2, monte com 2
  assert.equal(r.vencedor, EMPATE);
  assert.equal(r.motivoFim, 'limiteRodadas');
  assert.equal(r.campeao, EMPATE);
});

test('cartas no monte de empate não contam na contagem final', () => {
  const e = estadoCom(['Alface', 'Couve'], ['Abobrinha', 'Pepino', 'Chuchu'], JOGADOR, 20);
  e.monteEmpate.push(porNome('Caruru'), porNome('Jambu'));
  const r = jogarRodada(e, 'calorias'); // empate: 1 × 2 na mão, monte com 4
  assert.equal(r.monteEmpate, 4);
  assert.equal(r.campeao, COMPUTADOR);
});

test('simulação: partidas nos dois modos terminam e nunca perdem cartas', () => {
  const aleatorio = semente(42);
  const chaves = ATRIBUTOS.map(a => a.chave);
  for (const [modo, partidas] of [['rapido', 10000], ['classico', 2000]]) {
    for (let p = 0; p < partidas; p++) {
      const e = novaPartida(CARTAS, modo, aleatorio);
      while (!e.fim) {
        jogarRodada(e, chaves[Math.floor(aleatorio() * chaves.length)]);
        assert.equal(totalCartas(e), 32);
        assert.ok(e.rodada < 5000, 'partida longa demais');
      }
      if (modo === 'rapido') assert.ok(e.rodada <= 20);
      else assert.equal(e.motivoFim, 'semCartas');
    }
  }
});
