// Efeitos sonoros gerados com a Web Audio API (sem arquivos de áudio).
// O navegador só libera o áudio depois de um toque/clique do usuário: chame liberarAudio()
// dentro de um evento de clique (por exemplo, no botão Jogar).

const Sons = (() => {
  let contexto = null;
  let ligado = true;

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
    osc.connect(ganho).connect(ctx.destination);
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
    fonte.connect(filtro).connect(ganho).connect(ctx.destination);
    fonte.start(t);
  }

  const melodia = (ctx, notas, passo, opcoes) =>
    notas.forEach((f, i) => nota(ctx, f, i * passo, passo * 2.2, opcoes));

  const efeitos = {
    clique:      ctx => nota(ctx, 880, 0, 0.08, { volume: 0.12 }),
    virar:       ctx => sopro(ctx, 0, 0.22),
    vitoria:     ctx => melodia(ctx, [523, 659, 784], 0.09),
    derrota:     ctx => melodia(ctx, [392, 311], 0.14, { volume: 0.15 }),
    empate:      ctx => melodia(ctx, [494, 494], 0.12, { volume: 0.14 }),
    superTrunfo: ctx => melodia(ctx, [523, 659, 784, 1047, 1319], 0.08, { tipo: 'square', volume: 0.09 }),
    fimVitoria:  ctx => melodia(ctx, [523, 659, 784, 659, 784, 1047], 0.13),
    fimDerrota:  ctx => melodia(ctx, [392, 370, 349, 262], 0.22, { volume: 0.15 }),
    fimEmpate:   ctx => melodia(ctx, [440, 494, 440, 494], 0.16, { volume: 0.15 }),
  };

  function tocar(nome) {
    if (!ligado) return;
    const ctx = liberarAudio();
    if (!ctx || !efeitos[nome]) return;
    try { efeitos[nome](ctx); } catch (e) { /* áudio indisponível: segue sem som */ }
  }

  return {
    liberarAudio,
    tocar,
    get ligado() { return ligado; },
    set ligado(valor) { ligado = Boolean(valor); },
  };
})();
