// Testes das falas dos rivais. Rodar com: node --test testes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dados = require('../js/falas-dados.js');
const { JOGADOR, COMPUTADOR, EMPATE } = require('../js/jogo.js');
// no navegador, estes vêm dos <script> de falas-dados.js e jogo.js
Object.assign(globalThis, { FALAS: dados.FALAS, NARRADOR: dados.NARRADOR, JOGADOR, COMPUTADOR, EMPATE });
const { situacaoDoRival, sortearFala, falaDoRival, eventoDaRodada, falaDoEvento, audioDaFala } = require('../js/falas.js');

const lerJson = nome => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'falas', nome), 'utf8'));

function semente(s) {
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

test('js/falas-dados.js está igual aos JSONs (rode ferramentas/gerar-roteiro.py)', () => {
  assert.deepEqual(dados.FALAS, lerJson('falas.json'));
  assert.deepEqual(dados.NARRADOR, lerJson('narrador.json'));
  assert.deepEqual(dados.COMENTARISTA, lerJson('comentarista.json'));
});

test('o comentarista tem os mesmos eventos do narrador, 10 falas cada, com id e áudio únicos', () => {
  assert.deepEqual(Object.keys(dados.COMENTARISTA.eventos), Object.keys(dados.NARRADOR.eventos));
  const ids = new Set();
  const audios = new Set();
  for (const [evento, e] of Object.entries(dados.COMENTARISTA.eventos)) {
    assert.deepEqual(Object.keys(e.falas), ['geral'], evento);
    assert.equal(e.falas.geral.length, 10, evento);
    for (const fala of e.falas.geral) {
      assert.ok(fala.texto.trim(), fala.id);
      assert.ok(!ids.has(fala.id) && !audios.has(fala.audio), fala.id);
      assert.match(fala.audio, new RegExp(`^${evento}-\\d\\d\\.mp3$`));
      ids.add(fala.id);
      audios.add(fala.audio);
    }
  }
});

test('cada rival tem 20 falas por expressão, com id e áudio únicos', () => {
  const ids = new Set();
  const audios = new Set();
  for (const [rival, r] of Object.entries(dados.FALAS.rivais)) {
    for (const expressao of Object.keys(dados.FALAS.expressoes)) {
      const porSituacao = r.falas[expressao];
      assert.deepEqual(Object.keys(porSituacao).sort(), ['aperto', 'folga', 'parelho'], `${rival}/${expressao}`);
      const total = Object.values(porSituacao).reduce((n, lista) => n + lista.length, 0);
      assert.equal(total, 20, `${rival}/${expressao}`);
      for (const lista of Object.values(porSituacao)) {
        for (const fala of lista) {
          assert.ok(fala.texto.trim(), fala.id);
          assert.ok(!ids.has(fala.id), `id repetido: ${fala.id}`);
          assert.ok(!audios.has(fala.audio), `áudio repetido: ${fala.audio}`);
          assert.ok(fala.audio.startsWith(`${rival}/`), fala.audio);
          ids.add(fala.id);
          audios.add(fala.audio);
        }
      }
    }
  }
});

test('situação do rival segue a regra do falas.json', () => {
  assert.equal(situacaoDoRival(16, 16), 'parelho');
  assert.equal(situacaoDoRival(19, 13), 'folga');   // +6
  assert.equal(situacaoDoRival(18, 14), 'parelho'); // +4
  assert.equal(situacaoDoRival(13, 19), 'aperto');  // -6
  assert.equal(situacaoDoRival(4, 6), 'aperto');    // poucas cartas, mesmo com o placar perto
  assert.equal(situacaoDoRival(5, 7), 'parelho');
});

test('sorteio não repete uma fala até usar todas da lista', () => {
  const lista = dados.FALAS.rivais['seu-ze'].falas.comemorando.parelho;
  const usadas = new Set();
  const aleatorio = semente(7);
  const primeiraVolta = lista.map(() => sortearFala(lista, usadas, aleatorio).id);
  assert.equal(new Set(primeiraVolta).size, lista.length);
  // acabou a lista: recomeça
  const seguinte = sortearFala(lista, usadas, aleatorio);
  assert.ok(lista.includes(seguinte));
  assert.equal(usadas.size, 1);
});

test('fala do rival vem da expressão e situação pedidas, com caminho de áudio', () => {
  const fala = falaDoRival('dona-cida', 'frustrado', 'aperto', new Set(), semente(1));
  assert.ok(dados.FALAS.rivais['dona-cida'].falas.frustrado.aperto.includes(fala));
  assert.equal(audioDaFala(dados.FALAS, fala), `audio/falas/${fala.audio}`);
  assert.match(fala.audio, /^dona-cida\/frustrado-aperto-\d\d\.mp3$/);
});

// Rodada de mentira para o narrador: valores do atributo 'fibras' de cada lado.
function rodada({ vencedor, meu, dele, motivo = 'atributo', cesta = 0 }) {
  const carta = v => ({ valores: { fibras: v } });
  return {
    vencedor, motivo, atributo: 'fibras',
    cartaJogador: carta(meu), cartaComputador: carta(dele),
    cartasGanhas: vencedor === EMPATE ? [] : Array(2 + cesta).fill({}),
  };
}

test('narrador: evento da rodada segue a prioridade do narrador.json', () => {
  assert.equal(eventoDaRodada(rodada({ vencedor: JOGADOR, meu: 5, dele: 2 }), 1), 'vitoria');
  assert.equal(eventoDaRodada(rodada({ vencedor: COMPUTADOR, meu: 2, dele: 5 }), 1), 'derrota');
  assert.equal(eventoDaRodada(rodada({ vencedor: EMPATE, meu: 3, dele: 3 }), 0), 'empate');
  // por pouco: menos de 10% do maior valor (vale para os dois lados)
  assert.equal(eventoDaRodada(rodada({ vencedor: JOGADOR, meu: 5, dele: 4.6 }), 1), 'por_pouco');
  assert.equal(eventoDaRodada(rodada({ vencedor: COMPUTADOR, meu: 4.6, dele: 5 }), 1), 'por_pouco');
  assert.equal(eventoDaRodada(rodada({ vencedor: JOGADOR, meu: 5, dele: 4.5 }), 1), 'vitoria'); // exatamente 10%
  // sequência a partir da 3ª
  assert.equal(eventoDaRodada(rodada({ vencedor: JOGADOR, meu: 5, dele: 2 }), 2), 'vitoria');
  assert.equal(eventoDaRodada(rodada({ vencedor: JOGADOR, meu: 5, dele: 2 }), 3), 'sequencia_jogador');
  assert.equal(eventoDaRodada(rodada({ vencedor: COMPUTADOR, meu: 2, dele: 5 }), 4), 'sequencia_rival');
  // ordem: Super Trunfo > levou a cesta > por pouco > sequência
  assert.equal(eventoDaRodada(rodada({ vencedor: JOGADOR, meu: 5, dele: 4.9, cesta: 2 }), 3), 'levou_cesta');
  assert.equal(eventoDaRodada(rodada({ vencedor: JOGADOR, meu: 5, dele: 4.9 }), 3), 'por_pouco');
  assert.equal(eventoDaRodada(rodada({ vencedor: JOGADOR, meu: 1, dele: 9, motivo: 'superTrunfo', cesta: 2 }), 3), 'super_trunfo_jogador');
  assert.equal(eventoDaRodada(rodada({ vencedor: COMPUTADOR, meu: 9, dele: 1, motivo: 'superTrunfo' }), 1), 'super_trunfo_rival');
});

test('narrador: vitória e derrota usam as falas do atributo; os outros eventos, as gerais', () => {
  const v = falaDoEvento(dados.NARRADOR, 'vitoria', 'calorias', new Set(), semente(3));
  assert.ok(dados.NARRADOR.eventos.vitoria.falas.calorias.includes(v));
  const c = falaDoEvento(dados.NARRADOR, 'levou_cesta', 'calorias', new Set(), semente(3));
  assert.ok(dados.NARRADOR.eventos.levou_cesta.falas.geral.includes(c));
  assert.equal(audioDaFala(dados.NARRADOR, c), `audio/narrador/${c.audio}`);
  // o comentarista não separa por atributo
  const t = falaDoEvento(dados.COMENTARISTA, 'vitoria', 'calorias', new Set(), semente(3));
  assert.ok(dados.COMENTARISTA.eventos.vitoria.falas.geral.includes(t));
  assert.equal(audioDaFala(dados.COMENTARISTA, t), `audio/comentarista/${t.audio}`);
});

// As gravações podem chegar aos poucos (fala sem arquivo fica em silêncio), mas todo arquivo
// em audio/ tem de ser de uma fala: um nome errado nunca tocaria.
test('todo arquivo de áudio é de uma fala', () => {
  const todas = no => no.audio ? [no] : Object.values(no).flatMap(todas); // desce até as falas
  const esperados = new Set([
    ...todas(Object.values(dados.FALAS.rivais).map(r => r.falas)).map(f => `${dados.FALAS.audio.pasta}/${f.audio}`),
    ...[dados.NARRADOR, dados.COMENTARISTA].flatMap(d =>
      todas(Object.values(d.eventos).map(e => e.falas)).map(f => `${d.audio.pasta}/${f.audio}`)),
  ]);
  const raiz = path.join(__dirname, '..');
  const pasta = path.join(raiz, 'audio');
  const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta, { recursive: true })
    .map(f => `audio/${f.split(path.sep).join('/')}`)
    .filter(f => fs.statSync(path.join(raiz, f)).isFile()) : [];
  assert.deepEqual(arquivos.filter(f => !esperados.has(f)), []);
});
