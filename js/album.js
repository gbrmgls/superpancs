// Álbum de figurinhas: uma figurinha por carta, colada quando o jogador vence uma rodada com ela
// (contadas no fim da partida). Fica guardado neste navegador; sem armazenamento, o álbum só
// não é lembrado entre uma visita e outra. Sem DOM, para poder ser testado com node.

const CHAVE_ALBUM = 'superpancs-album';

// Curiosidade de cada carta (pelo id), mostrada no álbum.
const CURIOSIDADES = {
  1: 'Refogada no alho, é a companheira clássica da feijoada.',
  2: 'É quase toda feita de água: cerca de 95% da folha.',
  3: 'É da mesma família da abóbora, do pepino e da melancia.',
  4: 'Prima da alface, tem folhas mais firmes e um amargor leve.',
  5: 'O gosto picante vem de família: é parente da mostarda e do repolho.',
  6: 'A parte que a gente come são flores que ainda não abriram.',
  7: 'Junto com a salsa, forma o famoso cheiro-verde.',
  8: 'É o ingrediente principal do caruru baiano e do frango com quiabo mineiro.',
  9: 'Ficou famoso com o marinheiro Popeye, que ganhava força comendo espinafre.',
  10: 'Verde, amarelo e vermelho podem ser o mesmo pimentão em fases diferentes de amadurecimento.',
  11: 'Para a botânica, o tomate é uma fruta. Ele veio das montanhas dos Andes.',
  12: 'Gosta de água: cresce bem na beira de riachos e em terrenos alagados.',
  13: 'Picado e fermentado, vira chucrute.',
  14: 'Os picles mais famosos do mundo são pepinos em conserva.',
  15: 'Também chamada de salsinha, é uma das ervas mais usadas na cozinha brasileira.',
  16: 'É uma trepadeira: uma só planta se espalha pelo muro e dá muitos chuchus.',
  17: 'Apesar do nome, o prato baiano caruru é feito com quiabo. A planta é parente do amaranto.',
  18: 'Quando a folha é quebrada, solta um líquido branco, parecido com leite.',
  19: 'Suas sementes viajam com o vento, presas a paraquedas fofinhos.',
  20: 'É parente da alface, mas tem um gosto amarguinho e costuma ir para a panela.',
  21: 'Empanada e frita, a folha aveludada lembra peixe frito. Daí o nome.',
  22: 'Tem folhas carnudas e suculentas, boas cruas na salada ou refogadas.',
  23: 'Nasce sozinha no meio da horta e é uma das folhas mais ricas em ômega-3.',
  24: 'É um cacto com folhas! Tem tanta proteína que ganhou o apelido de "carne de pobre".',
  25: 'As flores coloridas são comestíveis e têm um sabor picante, parecido com o do agrião.',
  26: 'Trepadeira de folhas macias, é tradicional no Rio de Janeiro refogada com ovo.',
  27: 'Suas folhas suculentas podem substituir o espinafre em muitas receitas.',
  28: 'Atenção: as folhas só podem ser comidas bem cozidas. Cruas, irritam a boca e a garganta.',
  29: 'Deixa a boca tremendo e dormente! É estrela do tacacá e do pato no tucupi, no Pará.',
  30: 'É a base do arroz de cuxá, prato típico do Maranhão.',
  31: 'O nome não engana: tem um gosto azedinho, parecido com o de limão.',
  32: 'Símbolo do Cerrado. Nunca morda o caroço: embaixo da polpa há espinhos finos.',
};

// O armazenamento (localStorage) pode faltar ou dar erro (modo privado, bloqueado): aí o álbum começa vazio.
function carregarAlbum(armazenamento) {
  try {
    const ids = JSON.parse(armazenamento.getItem(CHAVE_ALBUM));
    return new Set(Array.isArray(ids) ? ids.filter(id => id in CURIOSIDADES) : []);
  } catch (e) {
    return new Set();
  }
}

function salvarAlbum(armazenamento, album) {
  try {
    armazenamento.setItem(CHAVE_ALBUM, JSON.stringify([...album].sort((a, b) => a - b)));
  } catch (e) { /* sem armazenamento: o álbum vale só nesta visita */ }
}

// Cola as figurinhas das cartas e devolve só os ids que ainda não estavam no álbum.
function colarFigurinhas(album, ids) {
  const novas = [...new Set(ids)].filter(id => !album.has(id));
  for (const id of novas) album.add(id);
  return novas;
}

if (typeof module !== 'undefined') {
  module.exports = { CHAVE_ALBUM, CURIOSIDADES, carregarAlbum, salvarAlbum, colarFigurinhas };
}
