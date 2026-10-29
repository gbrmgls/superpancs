// Música de fundo: um samba leve gerado com a Web Audio API (sem arquivos de áudio), em ciclo.
// Surdo, pandeiro, tamborim (teleco-teco), cavaquinho, baixaria de 7 cordas e, fora da partida, uma
// melodia de flauta. Tem três níveis (vitrine, menus e partida) e abaixa sozinha enquanto alguém fala
// (narrador, Tião ou rival), para nunca disputar com as vozes. Depende de Sons (js/sons.js).

const Musica = (() => {
  const BPM = 100;
  const SEMI = 60 / BPM / 4;   // semicolcheia: o samba é contado em 2/4, oito semicolcheias por compasso
  const ADIANTE = 0.25;        // agenda as notas com esse tanto de antecedência (segundos)
  // o "balanço": a 2ª e a 4ª semicolcheia de cada tempo chegam um tiquinho atrasadas
  const BALANCO = [0, 0.012, 0.004, 0.014];

  // Volume de cada nível e quanto sobra quando alguém fala (fração do nível)
  const NIVEIS = { vitrine: 0.75, menu: 0.6, jogo: 0.85 };
  const ABAFADO = 0.3;

  // Harmonia: 16 compassos (A e B), um acorde a cada compasso. baixo = nota MIDI da fundamental.
  const ACORDES = {
    C6:  { baixo: 36, notas: [64, 67, 69, 72] },
    A7:  { baixo: 33, notas: [64, 67, 69, 73] },
    Dm7: { baixo: 38, notas: [65, 69, 72, 74] },
    G7:  { baixo: 43, notas: [65, 67, 71, 74] },
    F6:  { baixo: 41, notas: [65, 69, 72, 74] },
    Fm6: { baixo: 41, notas: [65, 68, 72, 74] },
    CE:  { baixo: 40, notas: [64, 67, 69, 72] }, // C6 com o baixo em mi
  };
  const HARMONIA = ['C6', 'C6', 'A7', 'A7', 'Dm7', 'G7', 'C6', 'G7',
                    'F6', 'Fm6', 'CE', 'A7', 'Dm7', 'G7', 'C6', 'C6'];

  // Melodia da parte A (a B fica só no balanço): [nota MIDI, início, duração] em semicolcheias, por compasso.
  const MELODIA = [
    [[79, 0, 2], [76, 2, 2], [79, 5, 3]],
    [[81, 0, 2], [79, 2, 2], [76, 4, 4]],
    [[76, 0, 2], [79, 2, 2], [81, 4, 2], [79, 6, 2]],
    [[76, 0, 6], [73, 6, 2]],
    [[74, 0, 2], [77, 2, 2], [81, 4, 4]],
    [[79, 0, 2], [77, 2, 2], [74, 4, 2], [71, 6, 2]],
    [[72, 0, 2], [76, 2, 2], [79, 4, 4]],
    [[74, 4, 2], [76, 6, 2]],
  ];

  // Padrões de um compasso (8 semicolcheias): volume de cada batida (0 = não toca)
  const PANDEIRO = [0.5, 0.18, 0.28, 0.6, 0.45, 0.18, 0.28, 0.65];
  const CAVACO = [0.9, 0, 0.55, 0.7, 0, 0.6, 0, 0.75];
  // teleco-teco do tamborim: dois compassos
  const TAMBORIM = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0];

  let entrada = null;    // onde os instrumentos se juntam, antes do compressor
  let saida = null;      // ganho geral da música (nível e abafamento), depois do compressor
  let ruidoBuffer = null;
  let ligada = true;
  let fator = 1;         // volume escolhido pela pessoa (multiplica o nível da tela)
  let nivel = 'menu';
  let abafada = false;
  let timer = null;
  let passo = 0;         // semicolcheia atual no ciclo de 16 compassos
  let proxima = 0;       // quando toca a próxima semicolcheia (tempo do contexto de áudio)
  let timerVolta = null;

  const freq = midi => 440 * 2 ** ((midi - 69) / 12);

  function montar(ctx) {
    if (saida) return;
    // compressor antes do volume: segura os picos quando tudo soa junto, sem desfazer o abafamento
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 8;
    compressor.knee.value = 6;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.2;
    // limitador no fim: só age nos volumes mais altos, para não estourar
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -3;
    limitador.ratio.value = 20;
    limitador.knee.value = 0;
    limitador.attack.value = 0.002;
    limitador.release.value = 0.1;
    entrada = ctx.createGain();
    entrada.gain.value = 1.5;
    saida = ctx.createGain();
    saida.gain.value = 0.0001;
    entrada.connect(compressor).connect(saida).connect(limitador).connect(ctx.destination);
    ruidoBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const dados = ruidoBuffer.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
  }

  // ---------- Instrumentos ----------

  function envelope(ctx, t, volume, ataque, duracao) {
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(volume, t + ataque);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
    ganho.connect(entrada);
    return ganho;
  }

  function tom(ctx, t, f, duracao, { tipo = 'triangle', volume = 0.1, ataque = 0.005, filtro = null } = {}) {
    const osc = ctx.createOscillator();
    osc.type = tipo;
    osc.frequency.setValueAtTime(f, t);
    let no = osc;
    if (filtro) {
      const passa = ctx.createBiquadFilter();
      passa.type = 'lowpass';
      passa.frequency.value = filtro;
      no = osc.connect(passa);
    }
    no.connect(envelope(ctx, t, volume, ataque, duracao));
    osc.start(t);
    osc.stop(t + duracao + 0.05);
    return osc;
  }

  function chiado(ctx, t, duracao, { tipo = 'highpass', f = 6000, q = 0.7, volume = 0.05 } = {}) {
    const fonte = ctx.createBufferSource();
    fonte.buffer = ruidoBuffer;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.value = f;
    filtro.Q.value = q;
    fonte.connect(filtro).connect(envelope(ctx, t, volume, 0.002, duracao));
    fonte.start(t, Math.random() * 0.8, duracao + 0.05);
  }

  // Surdo: grave que cai de afinação. No 1º tempo vai abafado; o forte é no 2º (a marcação do samba).
  function surdo(ctx, t, forte) {
    const osc = tom(ctx, t, forte ? 74 : 82, forte ? 0.55 : 0.22, { tipo: 'sine', volume: forte ? 0.5 : 0.22, ataque: 0.004 });
    osc.frequency.exponentialRampToValueAtTime(forte ? 52 : 64, t + 0.25);
  }

  // Cavaquinho: o acorde "rasgado", nota por nota, com um timbre curto e brilhante.
  function cavaco(ctx, t, acorde, forca) {
    const notas = forca > 0.65 ? acorde.notas : acorde.notas.slice(1); // as batidas fracas só pegam as de cima
    notas.forEach((n, i) => tom(ctx, t + i * 0.007, freq(n), 0.16, { tipo: 'sawtooth', volume: 0.028 * forca, filtro: 2600 }));
  }

  function baixo(ctx, t, midi, duracao) {
    tom(ctx, t, freq(midi), duracao, { tipo: 'triangle', volume: 0.26, ataque: 0.008, filtro: 900 });
  }

  // Flauta: seno com um leve vibrato e sopro no começo.
  function flauta(ctx, t, midi, duracao) {
    const osc = tom(ctx, t, freq(midi), duracao, { tipo: 'sine', volume: 0.07, ataque: 0.04 });
    const vibrato = ctx.createOscillator();
    const profundidade = ctx.createGain();
    vibrato.frequency.value = 5.5;
    profundidade.gain.value = freq(midi) * 0.006;
    vibrato.connect(profundidade).connect(osc.frequency);
    vibrato.start(t + 0.12);
    vibrato.stop(t + duracao + 0.05);
    chiado(ctx, t, 0.06, { tipo: 'bandpass', f: freq(midi) * 2, q: 2, volume: 0.012 });
  }

  // ---------- Sequenciador ----------

  function tocarPasso(ctx, p, t) {
    const compasso = Math.floor(p / 8);
    const s = p % 8;           // semicolcheia dentro do compasso
    const acorde = ACORDES[HARMONIA[compasso]];
    const proximo = ACORDES[HARMONIA[(compasso + 1) % HARMONIA.length]];

    if (s === 0) surdo(ctx, t, false);
    if (s === 4) surdo(ctx, t, true);
    chiado(ctx, t, 0.045, { f: 7000, volume: 0.05 * PANDEIRO[s] });
    if (s === 0 || s === 4) chiado(ctx, t, 0.09, { tipo: 'lowpass', f: 300, volume: 0.06 }); // grave do pandeiro
    if (TAMBORIM[p % 16]) tom(ctx, t, 1250, 0.05, { tipo: 'square', volume: 0.012, filtro: 3000 });
    if (CAVACO[s]) cavaco(ctx, t, acorde, CAVACO[s]);

    // baixaria: fundamental no 1º tempo, quinta no 2º; no fim do compasso, caminha para o próximo acorde
    if (s === 0) baixo(ctx, t, acorde.baixo, SEMI * 3);
    if (s === 4) baixo(ctx, t, acorde.baixo + 7, SEMI * 2);
    if (s === 7 && proximo !== acorde) baixo(ctx, t, proximo.baixo + (proximo.baixo > acorde.baixo ? -1 : 1), SEMI);

    if (nivel !== 'jogo' && compasso < MELODIA.length) {
      for (const [n, inicio, dur] of MELODIA[compasso]) if (inicio === s) flauta(ctx, t, n, dur * SEMI);
    }
  }

  function agendar() {
    const ctx = Sons.liberarAudio();
    if (!ctx) return;
    while (proxima < ctx.currentTime + ADIANTE) {
      tocarPasso(ctx, passo, proxima + BALANCO[passo % 4]);
      proxima += SEMI;
      passo = (passo + 1) % (HARMONIA.length * 8);
    }
  }

  function volumeAlvo() {
    return Math.max(0.0001, NIVEIS[nivel] * fator * (abafada ? ABAFADO : 1));
  }

  function ajustarVolume(rapidez = 0.25) {
    const ctx = Sons.liberarAudio();
    if (ctx && saida) saida.gain.setTargetAtTime(volumeAlvo(), ctx.currentTime, rapidez);
  }

  // Começa (ou segue) tocando. Só funciona depois que o navegador liberou o áudio (um toque na tela).
  function tocar() {
    if (!ligada || timer) return;
    const ctx = Sons.liberarAudio();
    if (!ctx) return;
    if (ctx.state !== 'running') { // ainda sem toque na tela: começa assim que o navegador liberar
      ctx.resume().then(() => { if (ctx.state === 'running') tocar(); }).catch(() => {});
      return;
    }
    montar(ctx);
    passo = 0;
    proxima = ctx.currentTime + 0.1;
    saida.gain.cancelScheduledValues(ctx.currentTime);
    saida.gain.setValueAtTime(0.0001, ctx.currentTime);
    ajustarVolume(0.8); // entra devagar
    timer = setInterval(agendar, 50);
    agendar();
  }

  function parar() {
    clearInterval(timer);
    timer = null;
    const ctx = Sons.liberarAudio();
    if (ctx && saida) saida.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
  }

  // Nível da música para a tela: 'vitrine' (mais alto e com melodia), 'menu' ou 'jogo' (baixinho, sem melodia)
  function mudarNivel(novo) {
    if (!(novo in NIVEIS) || novo === nivel) return;
    nivel = novo;
    ajustarVolume(0.6);
  }

  // Enquanto uma voz toca, a música abaixa; volta devagar um pouco depois que a voz termina
  // (se outra fala vier logo em seguida, nem chega a subir).
  function abafar(sim) {
    clearTimeout(timerVolta);
    if (sim) {
      abafada = true;
      ajustarVolume(0.08);
    } else {
      timerVolta = setTimeout(() => { abafada = false; ajustarVolume(0.5); }, 900);
    }
  }

  return {
    tocar,
    parar,
    mudarNivel,
    abafar,
    get estado() { return { tocando: Boolean(timer), nivel, abafada }; }, // para conferir nos testes de navegador
    get volume() { return fator; },
    set volume(valor) { fator = Math.max(0, Number(valor) || 0); ajustarVolume(0.1); },
    get ligada() { return ligada; },
    set ligada(valor) { ligada = Boolean(valor); if (ligada) tocar(); else parar(); },
  };
})();
