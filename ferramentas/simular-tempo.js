// Estima a duração das partidas do modo Rápido simulando milhares de jogos com o motor real.
// Rodar com: node ferramentas/simular-tempo.js
const { CARTAS } = require('../js/cartas.js');
const { JOGADOR, COMPUTADOR, EMPATE, novaPartida, cartaDoTopo, jogarRodada } = require('../js/jogo.js');
const { escolherAtributo } = require('../js/ia.js');

const PARTIDAS = 20000;

// Tempos (em segundos) da interface — os mesmos de TEMPO em js/ui.js.
const TEMPO = {
  inicio: 0,            // a primeira compra já está contada em "recolher"
  computadorPensa: 1.5,
  revelar: 0.7,         // carta do computador levantando e virando
  resultado: 3,         // avanço automático
  recolher: 1.52,       // cartas indo para a pilha do vencedor + compra da rodada seguinte (2 × (0,65 + 0,11))
};
const PERFIS = { 'rápido': 3, 'típico': 6, 'pensativo': 10 }; // segundos para o jogador escolher

// Estratégias de escolha de atributo: as mesmas do computador (js/ia.js).
const estrategias = {
  aleatoria: (carta, aleatorio) => escolherAtributo(carta, 'facil', aleatorio),
  melhorAtributo: carta => escolherAtributo(carta, 'dificil'),
};

function semente(s) {
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

function simular(estrategiaJogador, estrategiaComputador) {
  const aleatorio = semente(7);
  const res = { rodadas: [], turnosJogador: [], antes20: 0, empatesRodada: 0, campeao: { [JOGADOR]: 0, [COMPUTADOR]: 0, [EMPATE]: 0 }, margem: [] };
  for (let p = 0; p < PARTIDAS; p++) {
    const e = novaPartida(CARTAS, 'rapido', aleatorio);
    let turnosJogador = 0;
    while (!e.fim) {
      const lado = e.vez;
      const estrategia = lado === JOGADOR ? estrategiaJogador : estrategiaComputador;
      if (lado === JOGADOR) turnosJogador++;
      const r = jogarRodada(e, estrategia(cartaDoTopo(e, lado), aleatorio));
      if (r.vencedor === EMPATE) res.empatesRodada++;
    }
    res.rodadas.push(e.rodada);
    res.turnosJogador.push(turnosJogador);
    if (e.motivoFim === 'semCartas') res.antes20++;
    res.campeao[e.campeao]++;
    res.margem.push(Math.abs(e.maos[JOGADOR].length - e.maos[COMPUTADOR].length));
  }
  return res;
}

const media = v => v.reduce((s, n) => s + n, 0) / v.length;
const pct = n => (100 * n / PARTIDAS).toFixed(1) + '%';
const minSeg = segundos => {
  const s = Math.round(segundos);
  return `${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}s`;
};

function duracao(rodadas, turnosJogador, segEscolha) {
  const turnosComputador = rodadas - turnosJogador;
  const comum = TEMPO.revelar + TEMPO.resultado + TEMPO.recolher;
  return TEMPO.inicio + turnosJogador * (segEscolha + comum) + turnosComputador * (TEMPO.computadorPensa + comum);
}

for (const [nome, [ej, ec]] of Object.entries({
  'Computador fácil (aleatório) × jogador aleatório': [estrategias.aleatoria, estrategias.aleatoria],
  'Computador difícil × jogador que escolhe bem': [estrategias.melhorAtributo, estrategias.melhorAtributo],
  'Computador difícil × jogador aleatório': [estrategias.aleatoria, estrategias.melhorAtributo],
})) {
  const r = simular(ej, ec);
  const ordenadas = [...r.rodadas].sort((a, b) => a - b);
  console.log(`\n== ${nome} (${PARTIDAS} partidas)`);
  console.log(`rodadas: média ${media(r.rodadas).toFixed(1)}, mín ${ordenadas[0]}, máx ${ordenadas.at(-1)}; terminaram antes da 20ª: ${pct(r.antes20)}`);
  console.log(`rodadas empatadas: ${(100 * r.empatesRodada / r.rodadas.reduce((s, n) => s + n, 0)).toFixed(1)}% · vez do jogador em ${(100 * media(r.turnosJogador) / media(r.rodadas)).toFixed(0)}% das rodadas`);
  console.log(`resultado: jogador ${pct(r.campeao[JOGADOR])}, computador ${pct(r.campeao[COMPUTADOR])}, partida empatada ${pct(r.campeao[EMPATE])}; diferença média de cartas ${media(r.margem).toFixed(1)}`);
  for (const [perfil, seg] of Object.entries(PERFIS)) {
    const tempos = r.rodadas.map((n, i) => duracao(n, r.turnosJogador[i], seg)).sort((a, b) => a - b);
    console.log(`  jogador ${perfil.padEnd(9)} (${seg}s p/ escolher): média ${minSeg(media(tempos))}, 90% das partidas até ${minSeg(tempos[Math.floor(tempos.length * 0.9)])}`);
  }
}
