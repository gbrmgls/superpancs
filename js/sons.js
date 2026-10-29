// Efeitos sonoros gerados com a Web Audio API (sem arquivos de áudio) e as vozes (arquivos .mp3).
// O navegador só libera o áudio depois de um toque/clique do usuário: chame liberarAudio()
// dentro de um evento de clique (por exemplo, no botão Jogar).
//
// Vozes: o jogo só toca as gravações (audio/falas/, audio/narrador/ e audio/comentarista/). Se um arquivo faltar
// ou não abrir, a fala aparece só em texto e o silêncio ocupa o lugar dela.
// Enquanto uma gravação toca, avisa aoFalar(true) (a música de fundo abaixa) e, no fim, aoFalar(false).

const Sons = (() => {
  let contexto = null;
  let ligado = true;     // efeitos
  let vozLigada = true;  // narrador, comentarista e rivais
  let volume = 1;        // volume de efeitos e vozes (0 a 1,5; as vozes param em 1, o máximo do navegador)
  let mestre = null;     // ganho por onde passam todos os efeitos

  function saida(ctx) {
    if (!mestre) {
      mestre = ctx.createGain();
      mestre.gain.value = volume;
      mestre.connect(ctx.destination);
    }
    return mestre;
  }

  function liberarAudio() {
    if (!contexto) {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) return null;
      contexto = new Contexto();
    }
    if (contexto.state === 'suspended') contexto.resume();
    return contexto;
  }

  // Uma nota com ataque rápido e decaimento suave.
  function nota(ctx, frequencia, inicio, duracao, { tipo = 'triangle', volume = 0.18 } = {}) {
    const t = ctx.currentTime + inicio;
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frequencia, t);
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
    osc.connect(ganho).connect(saida(ctx));
    osc.start(t);
    osc.stop(t + duracao + 0.05);
  }

  // Sopro curto de ruído filtrado, como uma carta virando.
  function sopro(ctx, inicio, duracao, volume = 0.12) {
    const t = ctx.currentTime + inicio;
    const amostras = Math.floor(ctx.sampleRate * duracao);
    const buffer = ctx.createBuffer(1, amostras, ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < amostras; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / amostras);
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.setValueAtTime(1200, t);
    filtro.frequency.exponentialRampToValueAtTime(3500, t + duracao);
    const ganho = ctx.createGain();
    ganho.gain.value = volume;
    fonte.connect(filtro).connect(ganho).connect(saida(ctx));
    fonte.start(t);
  }

  // Ruído filtrado com envelope (torcida, cesta, batida na madeira).
  function ruido(ctx, inicio, duracao, { tipo = 'bandpass', freq = 1000, q = 1, volume = 0.1, ataque = 0.01 } = {}) {
    const t = ctx.currentTime + inicio;
    const amostras = Math.floor(ctx.sampleRate * duracao);
    const buffer = ctx.createBuffer(1, amostras, ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < amostras; i++) dados[i] = Math.random() * 2 - 1;
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.value = freq;
    filtro.Q.value = q;
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(volume, t + ataque);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
    fonte.connect(filtro).connect(ganho).connect(saida(ctx));
    fonte.start(t);
  }

  // Apito de juiz: nota aguda com trinado.
  function apito(ctx, inicio, duracao) {
    const t = ctx.currentTime + inicio;
    const osc = ctx.createOscillator();
    const trinado = ctx.createOscillator();
    const profundidade = ctx.createGain();
    const ganho = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 2900;
    trinado.frequency.value = 28;
    profundidade.gain.value = 180;
    trinado.connect(profundidade).connect(osc.frequency);
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
    ganho.gain.setValueAtTime(0.07, t + duracao - 0.04);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
    osc.connect(ganho).connect(saida(ctx));
    osc.start(t); trinado.start(t);
    osc.stop(t + duracao + 0.05); trinado.stop(t + duracao + 0.05);
  }

  // Torcida: ruído largo que cresce e some, com um "uhh" grave por baixo.
  function torcida(ctx, inicio, duracao, volume = 0.09) {
    ruido(ctx, inicio, duracao, { freq: 900, q: 0.6, volume, ataque: duracao * 0.3 });
    ruido(ctx, inicio + 0.05, duracao * 0.9, { freq: 2200, q: 0.8, volume: volume * 0.5, ataque: duracao * 0.25 });
  }

  // Decepção da torcida: "ôôô" descendo.
  function decepcao(ctx) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filtro = ctx.createBiquadFilter();
    const ganho = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.9);
    filtro.type = 'lowpass';
    filtro.frequency.value = 900;
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.06, t + 0.12);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    osc.connect(filtro).connect(ganho).connect(saida(ctx));
    osc.start(t);
    osc.stop(t + 1.05);
    ruido(ctx, 0, 0.9, { freq: 500, q: 0.7, volume: 0.05, ataque: 0.15 });
  }

  const melodia = (ctx, notas, passo, opcoes) =>
    notas.forEach((f, i) => nota(ctx, f, i * passo, passo * 2.2, opcoes));

  const efeitos = {
    clique:      ctx => nota(ctx, 880, 0, 0.08, { volume: 0.12 }),
    virar:       ctx => sopro(ctx, 0, 0.22),
    vitoria:     ctx => melodia(ctx, [523, 659, 784], 0.09),
    derrota:     ctx => melodia(ctx, [392, 311], 0.14, { volume: 0.15 }),
    empate:      ctx => melodia(ctx, [494, 494], 0.12, { volume: 0.14 }),
    // vinheta do Super Trunfo: fanfarra subindo, acorde final e prato
    superTrunfo: ctx => {
      melodia(ctx, [392, 523, 659, 784], 0.09, { tipo: 'square', volume: 0.08 });
      [1047, 1319, 1568].forEach(f => nota(ctx, f, 0.38, 0.9, { tipo: 'square', volume: 0.05 }));
      ruido(ctx, 0.38, 0.8, { tipo: 'highpass', freq: 6000, volume: 0.06 });
      torcida(ctx, 0.3, 1.6, 0.07);
    },
    madeira:     ctx => {  // carta batendo na mesa de madeira
      nota(ctx, 150, 0, 0.09, { tipo: 'sine', volume: 0.22 });
      ruido(ctx, 0, 0.05, { tipo: 'lowpass', freq: 1400, volume: 0.12, ataque: 0.002 });
    },
    cesta:       ctx => {  // cartas caindo na cesta de vime
      for (let i = 0; i < 4; i++) ruido(ctx, i * 0.045, 0.07, { freq: 2400 + i * 300, q: 2, volume: 0.07, ataque: 0.003 });
    },
    apito:       ctx => { apito(ctx, 0, 0.18); apito(ctx, 0.26, 0.5); },
    decepcao,
    fimVitoria:  ctx => { apito(ctx, 0, 0.6); torcida(ctx, 0.2, 2.4, 0.1); melodia(ctx, [523, 659, 784, 659, 784, 1047], 0.13); },
    fimDerrota:  ctx => { apito(ctx, 0, 0.6); decepcao(ctx); melodia(ctx, [392, 370, 349, 262], 0.22, { volume: 0.12 }); },
    fimEmpate:   ctx => { apito(ctx, 0, 0.6); melodia(ctx, [440, 494, 440, 494], 0.16, { volume: 0.15 }); },
  };

  function tocar(nome) {
    if (!ligado) return;
    const ctx = liberarAudio();
    if (!ctx || !efeitos[nome]) return;
    try { efeitos[nome](ctx); } catch (e) { /* áudio indisponível: segue sem som */ }
  }

  // ---------- Vozes ----------

  const LIMITE_FALA = 8000; // segurança: um arquivo que não termina não trava a fila
  let atual = null;
  let filaVoz = 0;
  let aoFalar = () => {};

  function tocarArquivo(caminho) {
    return new Promise(pronto => {
      const audio = new Audio(caminho);
      audio.volume = Math.min(1, volume);
      atual = audio;
      const fim = () => {
        clearTimeout(limite);
        audio.onended = audio.onerror = audio.onplaying = null;
        aoFalar(false);
        pronto();
      };
      const limite = setTimeout(() => { audio.pause(); fim(); }, LIMITE_FALA);
      audio.parar = () => { audio.pause(); fim(); }; // interrompida: a fila segue na hora
      audio.onended = fim;
      audio.onerror = fim; // arquivo faltando: segue sem a voz
      audio.onplaying = () => aoFalar(true); // só abaixa a música quando a voz sai de verdade
      audio.play().catch(fim);
    });
  }

  // Toca as falas uma depois da outra, interrompendo a fila anterior, com "respiro" ms entre elas.
  // A promessa termina quando a fila acaba ou é interrompida.
  // Com { interromper: false }, não toca nada se já houver uma voz falando.
  async function falar(caminhos, { interromper = true, respiro = 0 } = {}) {
    if (!interromper && atual) return;
    pararVoz();
    const minha = filaVoz;
    if (!vozLigada || !liberarAudio()) return;
    for (const [i, caminho] of caminhos.entries()) {
      if (i && respiro) await new Promise(r => setTimeout(r, respiro));
      if (minha !== filaVoz) return;
      await tocarArquivo(caminho);
    }
    if (minha === filaVoz) atual = null;
  }

  function pararVoz() {
    filaVoz++;
    if (atual) { atual.parar(); atual = null; }
  }

  // Termina quando a voz que está tocando acabar (na hora, se não houver nenhuma).
  async function esperarVoz() {
    while (atual) await new Promise(r => setTimeout(r, 100));
  }

  return {
    liberarAudio,
    tocar,
    falar,
    pararVoz,
    esperarVoz,
    get ligado() { return ligado; },
    set ligado(valor) { ligado = Boolean(valor); },
    get vozLigada() { return vozLigada; },
    set vozLigada(valor) { vozLigada = Boolean(valor); if (!vozLigada) pararVoz(); },
    set aoFalar(funcao) { aoFalar = funcao; },
    get volume() { return volume; },
    set volume(valor) {
      volume = Math.max(0, Math.min(1.5, Number(valor) || 0));
      if (mestre) mestre.gain.value = volume;
      if (atual) atual.volume = Math.min(1, volume);
    },
  };
})();
