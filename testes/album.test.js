// Testes do álbum de figurinhas. Rodar com: node --test testes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { CARTAS } = require('../js/cartas.js');
const { CHAVE_ALBUM, CURIOSIDADES, carregarAlbum, salvarAlbum, colarFigurinhas } = require('../js/album.js');

// localStorage de mentira
function memoria(inicial = {}) {
  const dados = { ...inicial };
  return { getItem: k => (k in dados ? dados[k] : null), setItem: (k, v) => { dados[k] = String(v); }, dados };
}
const quebrado = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };

test('cada carta tem uma curiosidade', () => {
  assert.deepEqual(Object.keys(CURIOSIDADES).map(Number).sort((a, b) => a - b), CARTAS.map(c => c.id));
  for (const texto of Object.values(CURIOSIDADES)) assert.ok(texto.length > 10 && texto.length <= 120, texto);
});

test('álbum salva e carrega os ids colados', () => {
  const armazenamento = memoria();
  const album = carregarAlbum(armazenamento);
  assert.equal(album.size, 0);
  assert.deepEqual(colarFigurinhas(album, [5, 24, 5]), [5, 24]);
  assert.deepEqual(colarFigurinhas(album, [24, 32]), [32]); // só a nova
  salvarAlbum(armazenamento, album);
  assert.equal(armazenamento.dados[CHAVE_ALBUM], '[5,24,32]');
  assert.deepEqual([...carregarAlbum(armazenamento)], [5, 24, 32]);
});

test('álbum ignora dados estragados e armazenamento bloqueado', () => {
  assert.equal(carregarAlbum(memoria({ [CHAVE_ALBUM]: '{oops' })).size, 0);
  assert.deepEqual([...carregarAlbum(memoria({ [CHAVE_ALBUM]: '[3, 99, "x", 7]' }))], [3, 7]);
  assert.equal(carregarAlbum(quebrado).size, 0);
  assert.equal(carregarAlbum(null).size, 0);
  assert.doesNotThrow(() => salvarAlbum(quebrado, new Set([1])));
  assert.doesNotThrow(() => salvarAlbum(null, new Set([1])));
});
