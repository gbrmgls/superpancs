// Testes do álbum de figurinhas. Rodar com: node --test testes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { CARTAS } = require('../js/cartas.js');
const { CHAVE_ALBUM, CURIOSIDADES, chaveDoAlbum, idsValidos, carregarAlbum, salvarAlbum, colarFigurinhas } = require('../js/album.js');

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

test('cada e-mail tem a sua cópia do álbum, sem o e-mail por extenso', () => {
  const chave = chaveDoAlbum('Pessoa@Feira.com ');
  assert.equal(chave, chaveDoAlbum('pessoa@feira.com')); // maiúsculas e espaços não mudam o álbum
  assert.notEqual(chave, chaveDoAlbum('outra@feira.com'));
  assert.ok(chave.startsWith(`${CHAVE_ALBUM}:`) && !chave.includes('feira'));
  const armazenamento = memoria();
  salvarAlbum(armazenamento, new Set([2, 9]), chave);
  assert.deepEqual([...carregarAlbum(armazenamento, chave)], [2, 9]);
  assert.equal(carregarAlbum(armazenamento, chaveDoAlbum('outra@feira.com')).size, 0);
});

test('ids que vêm da planilha são filtrados', () => {
  assert.deepEqual(idsValidos([1, '2', 33, 0, 4.5, 32, null]), [1, 32]);
  assert.deepEqual(idsValidos('1,2'), []);
});
