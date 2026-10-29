// Escolha das falas dos rivais, do narrador e do comentarista. Sem DOM, para poder ser testado com node.
// Os textos vêm de js/falas-dados.js (FALAS, NARRADOR e COMENTARISTA), gerado a partir dos JSONs em falas/.
// Usa JOGADOR, COMPUTADOR e EMPATE de js/jogo.js.

// Situação do rival no placar (regra_situacao em falas/falas.json).
// diferença = cartas na mão do rival - cartas na mão do jogador
const FOLGA = 6;         // diferença de 6 ou mais: rival folgado; -6 ou menos: no aperto
const POUCAS_CARTAS = 4; // com 4 cartas ou menos, o rival está no aperto, qualquer que seja o placar

function situacaoDoRival(cartasRival, cartasJogador) {
  const diferenca = cartasRival - cartasJogador;
  if (diferenca >= FOLGA) return 'folga';
  if (diferenca <= -FOLGA || cartasRival <= POUCAS_CARTAS) return 'aperto';
  return 'parelho';
}

// Sorteia uma fala da lista sem repetir até usar todas. "usadas" guarda os ids já ditos.
function sortearFala(lista, usadas, aleatorio = Math.random) {
  let livres = lista.filter(f => !usadas.has(f.id));
  if (livres.length === 0) {
    for (const f of lista) usadas.delete(f.id);
    livres = lista;
  }
  const fala = livres[Math.floor(aleatorio() * livres.length)];
  usadas.add(fala.id);
  return fala;
}

function falaDoRival(rival, expressao, situacao, usadas, aleatorio) {
  return sortearFala(FALAS.rivais[rival].falas[expressao][situacao], usadas, aleatorio);
}

// ---------- Narrador (regras em falas/narrador.json) ----------

const POR_POUCO = 0.1; // diferença menor que 10% do maior valor
const SEQUENCIA = 3;   // a partir da 3ª vitória seguida do mesmo lado

// Evento do narrador para uma rodada: o primeiro de prioridade_rodada que se aplica.
// "seguidas" é quantas rodadas seguidas o vencedor desta rodada já ganhou, contando esta.
function eventoDaRodada(r, seguidas) {
  const venceu = r.vencedor !== EMPATE;
  const doJogador = r.vencedor === JOGADOR;
  const doRival = r.vencedor === COMPUTADOR;
  const meu = r.cartaJogador.valores[r.atributo];
  const dele = r.cartaComputador.valores[r.atributo];
  const vale = {
    super_trunfo_jogador: r.motivo === 'superTrunfo' && doJogador,
    super_trunfo_rival: r.motivo === 'superTrunfo' && doRival,
    levou_cesta: venceu && r.cartasGanhas.length > 2, // as duas da rodada + as da cesta
    por_pouco: venceu && r.motivo === 'atributo' && Math.abs(meu - dele) < POR_POUCO * Math.max(meu, dele),
    sequencia_jogador: doJogador && seguidas >= SEQUENCIA,
    sequencia_rival: doRival && seguidas >= SEQUENCIA,
    vitoria: doJogador,
    derrota: doRival,
    empate: !venceu,
  };
  return NARRADOR.prioridade_rodada.find(evento => vale[evento]);
}

// Fala do narrador ou do comentarista ("dados": NARRADOR ou COMENTARISTA) para um evento.
// Em vitória e derrota, as falas do narrador são separadas pelo atributo; as do comentarista, não.
function falaDoEvento(dados, evento, atributo, usadas, aleatorio) {
  const falas = dados.eventos[evento].falas;
  return sortearFala(falas[atributo] || falas.geral, usadas, aleatorio);
}

// Caminho do arquivo de áudio de uma fala (a voz gravada substitui o arquivo com o mesmo nome).
const audioDaFala = (dados, fala) => `${dados.audio.pasta}/${fala.audio}`;

if (typeof module !== 'undefined') {
  module.exports = {
    FOLGA, POUCAS_CARTAS, situacaoDoRival, sortearFala, falaDoRival,
    POR_POUCO, SEQUENCIA, eventoDaRodada, falaDoEvento, audioDaFala,
  };
}
