// Motor do SuperPANCs: regras do jogo, sem nenhuma dependência de tela (DOM).
// Funciona no navegador (via <script>) e no Node (via require, para os testes).
//
// Regras:
// - 32 cartas embaralhadas, 16 para cada jogador. O jogador humano sempre escolhe na primeira rodada.
// - Quem tem a vez escolhe um atributo; vence o maior valor numérico.
// - Super Trunfo (Ora-pro-nóbis) vence qualquer hortaliça comum; contra outra PANC vale o atributo.
// - Empate: as duas cartas vão para o monte de empate; quem tinha a vez escolhe de novo,
//   e o vencedor da próxima rodada leva o monte junto.
// - O vencedor da rodada coloca no fim do seu monte: a própria carta, a do adversário e o monte de empate.
// - Fim depende do modo escolhido na tela inicial:
//   - Clássico: quando um jogador fica sem cartas.
//   - Rápido: após a rodada 20 vence quem tiver mais cartas na mão; as cartas que estiverem no
//     monte de empate não contam, e quantidades iguais empatam a partida. Antes disso, a partida
//     também acaba se um jogador ficar sem cartas.
//   Em ambos, se os dois ficarem sem cartas ao mesmo tempo (empate na última carta de ambos),
//   a partida termina empatada.

const JOGADOR = 'jogador';
const COMPUTADOR = 'computador';
const EMPATE = 'empate';
const MODOS = {
  classico: { nome: 'Clássico', limiteRodadas: null },
  rapido:   { nome: 'Rápido',   limiteRodadas: 20 },
};

function embaralhar(lista, aleatorio = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function novaPartida(cartas, modo = 'rapido', aleatorio = Math.random) {
  if (!(modo in MODOS)) throw new Error(`Modo desconhecido: ${modo}`);
  const baralho = embaralhar(cartas, aleatorio);
  const metade = Math.floor(baralho.length / 2);
  return {
    maos: {
      [JOGADOR]: baralho.slice(0, metade),
      [COMPUTADOR]: baralho.slice(metade),
    },
    monteEmpate: [],
    vez: JOGADOR, // o jogador humano sempre começa
    modo,
    limiteRodadas: MODOS[modo].limiteRodadas,
    rodada: 1,
    fim: false,
    campeao: null, // JOGADOR, COMPUTADOR ou EMPATE quando fim === true
    motivoFim: null, // 'semCartas' ou 'limiteRodadas' quando fim === true
  };
}

function cartaDoTopo(estado, lado) {
  return estado.maos[lado][0] || null;
}

// Decide quem vence entre duas cartas no atributo escolhido.
// Retorna { vencedor: 'a' | 'b' | EMPATE, motivo: 'superTrunfo' | 'atributo' }.
function compararCartas(a, b, atributo) {
  if (a.superTrunfo && b.tipo !== 'panc') return { vencedor: 'a', motivo: 'superTrunfo' };
  if (b.superTrunfo && a.tipo !== 'panc') return { vencedor: 'b', motivo: 'superTrunfo' };

  const va = a.valores[atributo];
  const vb = b.valores[atributo];
  if (va > vb) return { vencedor: 'a', motivo: 'atributo' };
  if (vb > va) return { vencedor: 'b', motivo: 'atributo' };
  return { vencedor: EMPATE, motivo: 'atributo' };
}

// Joga uma rodada com o atributo escolhido por quem tem a vez.
// Altera o estado e devolve um resumo da rodada para a interface exibir.
function jogarRodada(estado, atributo) {
  if (estado.fim) throw new Error('A partida já terminou.');

  const cartaJogador = estado.maos[JOGADOR].shift();
  const cartaComputador = estado.maos[COMPUTADOR].shift();
  if (!(atributo in cartaJogador.valores)) {
    estado.maos[JOGADOR].unshift(cartaJogador);
    estado.maos[COMPUTADOR].unshift(cartaComputador);
    throw new Error(`Atributo desconhecido: ${atributo}`);
  }

  const { vencedor: lado, motivo } = compararCartas(cartaJogador, cartaComputador, atributo);
  const vencedor = lado === 'a' ? JOGADOR : lado === 'b' ? COMPUTADOR : EMPATE;
  const escolheu = estado.vez;
  const rodada = estado.rodada;
  let cartasGanhas = [];

  if (vencedor === EMPATE) {
    estado.monteEmpate.push(cartaJogador, cartaComputador);
  } else {
    const [propria, doAdversario] = vencedor === JOGADOR
      ? [cartaJogador, cartaComputador]
      : [cartaComputador, cartaJogador];
    cartasGanhas = [propria, doAdversario, ...estado.monteEmpate];
    estado.maos[vencedor].push(...cartasGanhas);
    estado.monteEmpate = [];
    estado.vez = vencedor;
  }

  const qtdJogador = estado.maos[JOGADOR].length;
  const qtdComputador = estado.maos[COMPUTADOR].length;
  if (qtdJogador === 0 || qtdComputador === 0) {
    estado.fim = true;
    estado.motivoFim = 'semCartas';
  } else if (estado.limiteRodadas && rodada >= estado.limiteRodadas) {
    estado.fim = true;
    estado.motivoFim = 'limiteRodadas';
  }

  if (estado.fim) {
    estado.campeao = qtdJogador > qtdComputador ? JOGADOR
      : qtdComputador > qtdJogador ? COMPUTADOR
      : EMPATE;
  } else {
    estado.rodada++;
  }

  return {
    rodada,
    escolheu,
    atributo,
    cartaJogador,
    cartaComputador,
    vencedor,
    motivo,
    cartasGanhas,
    monteEmpate: estado.monteEmpate.length,
    fim: estado.fim,
    campeao: estado.campeao,
    motivoFim: estado.motivoFim,
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    JOGADOR, COMPUTADOR, EMPATE, MODOS,
    embaralhar, novaPartida, cartaDoTopo, compararCartas, jogarRodada,
  };
}
