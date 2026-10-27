// Interface do SuperPANCs: liga o motor (jogo.js) à tela.
// As cartas são elementos soltos numa camada por cima do tabuleiro; cada movimento (comprar da pilha,
// revelar, recolher para o vencedor ou para o monte de empate) "levanta" a carta, leva até o destino
// e "pousa" — feito com a Web Animations API.

// Tempos em ms.
const TEMPO = {
  computadorPensa: 1500,
  comprar: 650,        // carta saindo da pilha até o lugar de jogo
  revelar: 700,        // carta do computador levantando e virando no lugar
  recolher: 650,       // cartas indo para a pilha do vencedor ou para o monte de empate
  intervalo: 110,      // atraso entre cartas que se movem juntas
  autoAvancar: 3000,   // resultado na tela antes de avançar sozinho
};

const $ = id => document.getElementById(id);
const telas = { cadastro: $('tela-cadastro'), inicio: $('tela-inicio'), jogo: $('tela-jogo'), fim: $('tela-fim') };
const el = {
  tabuleiro: $('tabuleiro'),
  camada: $('camada-cartas'),
  slot: { [JOGADOR]: $('slot-jogador'), [COMPUTADOR]: $('slot-computador') },
  pilha: { [JOGADOR]: $('pilha-jogador'), [COMPUTADOR]: $('pilha-computador') },
  empate: $('pilha-empate'),
  popup: $('popup-rodada'),
  anuncio: $('anuncio'),
  rodada: $('texto-rodada'),
  mensagem: $('mensagem'),
  detalhe: $('detalhe'),
  continuar: $('botao-continuar'),
  som: $('botao-som'),
  auto: $('botao-auto'),
  sair: $('botao-sair'),
  zoom: $('zoom'),
  zoomCarta: $('zoom-carta'),
  zoomDica: $('zoom-dica'),
  fim: $('fim'),
  fimConfig: $('fim-config'),
  fimTitulo: $('fim-titulo'),
  fimTexto: $('fim-texto'),
};

const CHAVE_PREFERENCIAS = 'superpancs-preferencias';
const PROPORCAO = 1181 / 708; // altura / largura das cartas

let estado = null;
let config = { modo: 'rapido', dificuldade: 'facil', som: true, auto: true };
let ultimaRodada = null;
let estatisticas = null;
let geracao = 0;        // muda a cada partida nova ou saída; passos assíncronos antigos param sozinhos
let resolvendo = false; // impede escolher duas vezes durante a revelação
let timerComputador = null;
let timerAuto = null;
let timerSair = null;
let nomeJogador = ''; // nome do cadastro; vazio = "Você"
let zoomAberto = null; // { lado, retomarAuto } enquanto a carta ampliada está na tela

// O que está desenhado na mesa
const mesa = {
  emJogo: { [JOGADOR]: null, [COMPUTADOR]: null }, // { carta, el }
  noMonte: [],                                       // { carta, el, rot, dx, dy }
  naPilha: { [JOGADOR]: 0, [COMPUTADOR]: 0 },       // quantas cartas cada pilha mostra
  voando: 0,
};

const formatar = n => n.toLocaleString('pt-BR');
const nomeAtributo = chave => ATRIBUTOS.find(a => a.chave === chave).nome;
const valorComUnidade = (carta, chave) =>
  `${formatar(carta.valores[chave])} ${ATRIBUTOS.find(a => a.chave === chave).unidade}`;
const plural = (n, palavra) => `${n} ${palavra}${n === 1 ? '' : 's'}`;
// Número em negrito seguido do rótulo no singular ou plural.
function preencherContagem(elemento, n, singular, pluralTexto) {
  elemento.innerHTML = `<b>${n}</b> ${n === 1 ? singular : pluralTexto}`;
}

const movimentoReduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pausa = ms => new Promise(r => setTimeout(r, ms));
const proximoQuadro = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

// Reinicia uma animação CSS, mesmo que a classe já esteja aplicada.
function reanimar(elemento, classe) {
  elemento.classList.remove(classe);
  void elemento.offsetWidth;
  elemento.classList.add(classe);
}

function preCarregarImagens() {
  for (const src of [VERSO, ...CARTAS.map(c => c.imagem)]) new Image().src = src;
}

function mostrarTela(nome) {
  for (const [chave, tela] of Object.entries(telas)) tela.hidden = chave !== nome;
  window.scrollTo(0, 0);
}

// ---------- Cartas: criação, posição e movimento ----------

function criarCarta(carta, lado) {
  const elemento = document.createElement('div');
  elemento.className = `carta virada do-${lado}`;
  elemento.innerHTML = `
    <div class="carta-escala">
      <div class="carta-interna">
        <div class="face face-frente"><img alt=""><div class="faixas"></div></div>
        <div class="face face-verso"><img src="${VERSO}" alt="Carta virada para baixo"></div>
      </div>
    </div>`;
  const frente = elemento.querySelector('.face-frente img');
  frente.src = carta.imagem;

  const faixas = elemento.querySelector('.faixas');
  for (const atributo of ATRIBUTOS) {
    const ehJogador = lado === JOGADOR;
    const faixa = document.createElement(ehJogador ? 'button' : 'span');
    faixa.className = 'faixa';
    faixa.dataset.chave = atributo.chave;
    if (ehJogador) {
      faixa.type = 'button';
      faixa.disabled = true;
      faixa.setAttribute('aria-label', `${atributo.nome}: ${valorComUnidade(carta, atributo.chave)}`);
      faixa.addEventListener('click', () => escolherJogador(atributo.chave));
    }
    faixas.appendChild(faixa);
  }
  // No celular (sem mouse), um toque numa carta aberta da mesa amplia a carta.
  // Escuta na fase de captura para ter prioridade sobre o clique direto nas faixas.
  elemento.addEventListener('click', evento => {
    if (!modoToque() || !elemento.classList.contains('na-mesa') || elemento.classList.contains('virada')) return;
    evento.stopPropagation();
    abrirZoom(lado);
  }, true);
  el.camada.appendChild(elemento);
  return elemento;
}

// Deixa a frente da carta acessível (ou não) para leitores de tela.
function anunciarFace(elemento, carta, deFrente) {
  elemento.querySelector('.face-frente img').alt = deFrente ? `${carta.nome} — ${carta.esporte}` : '';
  elemento.querySelector('.face-verso img').alt = deFrente ? '' : 'Carta virada para baixo';
}

// Posição (em relação ao tabuleiro) de uma carta encaixada num elemento-âncora (slot, pilha ou monte).
function posicaoEm(ancora, { rot = 0, dx = 0, dy = 0 } = {}) {
  const r = ancora.getBoundingClientRect();
  const t = el.tabuleiro.getBoundingClientRect();
  const largura = larguraCarta();
  const escala = r.width / largura;
  return {
    x: r.left - t.left + (r.width - largura) / 2 + dx,
    y: r.top - t.top + (r.height - largura * PROPORCAO) / 2 + dy,
    s: escala,
    rot,
  };
}

function larguraCarta() {
  return el.slot[JOGADOR].getBoundingClientRect().width;
}

const transformar = p => `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${p.s})`;

function colocar(elemento, posicao) {
  elemento.style.transform = transformar(posicao);
}

// Levanta a carta, leva de "de" até "para" e pousa. Se "virarPara" for 'frente' ou 'verso',
// a carta gira durante o trajeto. Resolve quando a carta pousa.
async function voar(elemento, de, para, { virarPara = null, duracao = 650, atraso = 0 } = {}) {
  const tempo = movimentoReduzido() ? 1 : duracao;
  const espera = movimentoReduzido() ? 0 : atraso;
  const levantar = (p, fator) => ({ ...p, y: p.y - 14, s: p.s * fator });
  const g = geracao; // voos de uma partida já encerrada não mexem mais no contador

  mesa.voando++;
  elemento.classList.remove('na-mesa');
  colocar(elemento, de);
  if (espera) await pausa(espera);
  elemento.classList.add('voando', 'levantada');

  const passos = { duration: tempo, easing: 'ease-in-out', fill: 'forwards' };
  const movimento = elemento.animate([
    { transform: transformar(de), offset: 0 },
    { transform: transformar(levantar(de, 1.1)), offset: 0.2 },
    { transform: transformar(levantar(para, 1.1)), offset: 0.8 },
    { transform: transformar(para), offset: 1 },
  ], passos);

  let giro = null;
  if (virarPara) {
    const interna = elemento.querySelector('.carta-interna');
    const inicio = elemento.classList.contains('virada') ? 180 : 0;
    const fim = virarPara === 'verso' ? 180 : 0;
    // Leva sempre "pra frente" no giro (0→180 ou 180→360) para parecer uma carta sendo virada.
    const destino = fim === inicio ? inicio : (fim > inicio ? fim : 360);
    giro = interna.animate([
      { transform: `rotateY(${inicio}deg)`, offset: 0 },
      { transform: `rotateY(${inicio}deg)`, offset: 0.2 },
      { transform: `rotateY(${destino}deg)`, offset: 0.8 },
      { transform: `rotateY(${destino}deg)`, offset: 1 },
    ], passos);
  }

  await movimento.finished.catch(() => {});
  if (giro) await giro.finished.catch(() => {});
  colocar(elemento, para);
  if (virarPara) elemento.classList.toggle('virada', virarPara === 'verso');
  movimento.cancel();
  if (giro) giro.cancel();
  elemento.classList.remove('voando', 'levantada');
  if (g === geracao) mesa.voando--;
}

// Recoloca as cartas paradas quando a janela muda de tamanho ou gira.
function reposicionarMesa() {
  if (!estado || mesa.voando > 0) return;
  for (const lado of [JOGADOR, COMPUTADOR]) {
    const emJogo = mesa.emJogo[lado];
    if (emJogo) colocar(emJogo.el, posicaoEm(el.slot[lado]));
  }
  for (const item of mesa.noMonte) colocar(item.el, posicaoEm(el.empate, item));
}

// Chamar só depois de mudar "geracao", para os voos cancelados não descontarem do contador novo.
function limparMesa() {
  for (const elemento of [...el.camada.children]) {
    elemento.getAnimations({ subtree: true }).forEach(a => a.cancel());
    elemento.remove();
  }
  mesa.emJogo = { [JOGADOR]: null, [COMPUTADOR]: null };
  mesa.noMonte = [];
  mesa.voando = 0;
}

// ---------- Pilhas e monte de empate ----------

function desenharPilha(lado, animar = false) {
  const n = mesa.naPilha[lado];
  const pilha = el.pilha[lado];
  const qtd = pilha.querySelector('.pilha-qtd');
  if (animar && qtd.textContent !== String(n)) reanimar(qtd, 'mudou');
  qtd.textContent = n;
  pilha.classList.toggle('vazia', n === 0);
  // Espessura: uma "camada" a cada 3 cartas, até 6.
  const camadas = Math.min(6, Math.ceil(n / 3));
  const sombras = [];
  for (let i = 1; i <= camadas; i++) sombras.push(`${i}px ${i}px 0 ${i % 2 ? '#d8e6d2' : '#b9cdb2'}`);
  sombras.push(`${camadas + 2}px ${camadas + 3}px 8px rgba(0, 0, 0, .22)`);
  pilha.style.setProperty('--sombra-pilha', sombras.join(', '));
}

function desenharMonte(animar = false) {
  const qtd = el.empate.querySelector('.pilha-qtd');
  const n = mesa.noMonte.length;
  if (animar && qtd.textContent !== String(n)) reanimar(qtd, 'mudou');
  qtd.textContent = n;
  qtd.hidden = n === 0;
}

// ---------- Partida ----------

function cancelarTimers() {
  clearTimeout(timerComputador);
  pararAvancoAutomatico();
}

async function iniciarPartida() {
  fecharZoom(false);
  cancelarTimers();
  geracao++;
  const g = geracao;
  resolvendo = false;
  estado = novaPartida(CARTAS, config.modo);
  estatisticas = { vencidas: 0, perdidas: 0, empatadas: 0, vitoriasPorCarta: new Map() };
  limparMesa();
  mesa.naPilha[JOGADOR] = estado.maos[JOGADOR].length;
  mesa.naPilha[COMPUTADOR] = estado.maos[COMPUTADOR].length;
  desenharPilha(JOGADOR);
  desenharPilha(COMPUTADOR);
  desenharMonte();
  esconderPopup();
  mostrarTela('jogo');
  await proximoQuadro(); // espera o tabuleiro ter tamanho antes de calcular posições
  if (g !== geracao) return;
  prepararRodada();
}

// Coloca o pop-up no meio do espaço entre a carta do computador e a sua.
// (No celular deitado as cartas ficam coladas; ali o CSS o põe na área livre à direita.)
function posicionarPopup() {
  const deitado = window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches;
  if (deitado) { el.popup.style.top = ''; return; }
  const t = el.tabuleiro.getBoundingClientRect();
  const cima = el.slot[COMPUTADOR].getBoundingClientRect().bottom;
  const baixo = el.slot[JOGADOR].getBoundingClientRect().top;
  el.popup.style.top = `${(cima + baixo) / 2 - t.top}px`;
}

function esconderPopup() {
  el.popup.hidden = true;
  el.continuar.hidden = true;
}

function mostrarNumeroRodada(n) {
  el.rodada.textContent = estado.limiteRodadas ? `Rodada ${n} de ${estado.limiteRodadas}` : `Rodada ${n}`;
}

// Cada jogador compra a carta do topo da sua pilha e a coloca no lugar de jogo.
async function prepararRodada() {
  const g = geracao;
  esconderPopup();

  const compras = [JOGADOR, COMPUTADOR].map((lado, i) => {
    const carta = cartaDoTopo(estado, lado);
    const elemento = criarCarta(carta, lado);
    mesa.emJogo[lado] = { carta, el: elemento };
    const origem = posicaoEm(el.pilha[lado]);
    mesa.naPilha[lado]--;
    desenharPilha(lado);
    return voar(elemento, origem, posicaoEm(el.slot[lado]), {
      virarPara: lado === JOGADOR ? 'frente' : null,
      duracao: TEMPO.comprar,
      atraso: i * TEMPO.intervalo,
    });
  });
  Sons.tocar('virar');
  await Promise.all(compras);
  if (g !== geracao) return;

  const minha = mesa.emJogo[JOGADOR];
  anunciarFace(minha.el, minha.carta, true);
  for (const lado of [JOGADOR, COMPUTADOR]) mesa.emJogo[lado].el.classList.add('na-mesa');

  const rodada = estado.limiteRodadas ? `Rodada ${estado.rodada} de ${estado.limiteRodadas}` : `Rodada ${estado.rodada}`;
  if (estado.vez === JOGADOR) {
    // Na tela, a vez é indicada pela carta (salto + faixas pulsando); o texto é só para leitores de tela.
    el.anuncio.textContent = `${rodada}. Sua vez: ` + (modoToque()
      ? 'toque na sua carta para ampliar e escolher um atributo.'
      : 'escolha um atributo da sua carta.');
    minha.el.classList.add('escolhendo');
    minha.el.querySelectorAll('.faixa').forEach(f => { f.disabled = false; });
    minha.el.querySelector('.faixa').focus({ preventScroll: true });
  } else {
    el.anuncio.textContent = `${rodada}. Vez do computador.`;
    mesa.emJogo[COMPUTADOR].el.classList.add('pensando');
    timerComputador = setTimeout(() => {
      if (g !== geracao) return;
      resolverRodada(escolherAtributo(cartaDoTopo(estado, COMPUTADOR), config.dificuldade));
    }, TEMPO.computadorPensa);
  }
}

function escolherJogador(chave) {
  if (!estado || estado.fim || estado.vez !== JOGADOR || resolvendo || !mesa.emJogo[JOGADOR]) return;
  if (mesa.voando > 0 || !mesa.emJogo[JOGADOR].el.classList.contains('escolhendo')) return;
  Sons.tocar('clique');
  resolverRodada(chave);
}

async function resolverRodada(chave) {
  const g = geracao;
  fecharZoom(false);
  resolvendo = true;
  const minha = mesa.emJogo[JOGADOR];
  const dele = mesa.emJogo[COMPUTADOR];
  minha.el.classList.remove('escolhendo');
  minha.el.querySelectorAll('.faixa').forEach(f => { f.disabled = true; });
  minha.el.querySelector(`.faixa[data-chave="${chave}"]`).classList.add('escolhida');

  const r = jogarRodada(estado, chave);
  ultimaRodada = r;
  registrarEstatisticas(r);

  // Revela a carta do computador: levanta, vira e pousa no mesmo lugar
  dele.el.classList.remove('pensando');
  Sons.tocar('virar');
  const lugar = posicaoEm(el.slot[COMPUTADOR]);
  await voar(dele.el, lugar, lugar, { virarPara: 'frente', duracao: TEMPO.revelar });
  if (g !== geracao) return;
  dele.el.classList.add('na-mesa');
  anunciarFace(dele.el, dele.carta, true);

  // Resultado
  dele.el.querySelector(`.faixa[data-chave="${chave}"]`).classList.add('escolhida');
  const classe = lado => r.vencedor === EMPATE ? 'empate' : r.vencedor === lado ? 'vitoria' : 'derrota';
  minha.el.classList.add(classe(JOGADOR));
  dele.el.classList.add(classe(COMPUTADOR));
  if (r.motivo === 'superTrunfo') mesa.emJogo[r.vencedor].el.classList.add('super-trunfo');

  Sons.tocar(r.motivo === 'superTrunfo' ? 'superTrunfo'
    : r.vencedor === JOGADOR ? 'vitoria'
    : r.vencedor === COMPUTADOR ? 'derrota'
    : 'empate');

  el.popup.className = `popup-rodada ${classe(JOGADOR)}`;
  el.mensagem.className = `mensagem ${classe(JOGADOR)}`;
  el.mensagem.textContent = {
    [JOGADOR]: 'Você venceu a rodada!',
    [COMPUTADOR]: 'O computador venceu a rodada.',
    [EMPATE]: 'Empate! As cartas vão para o monte.',
  }[r.vencedor];
  el.detalhe.textContent = descreverRodada(r);
  mostrarNumeroRodada(r.rodada);

  el.continuar.textContent = r.fim ? 'Ver resultado' : 'Próxima rodada';
  el.continuar.hidden = false;
  el.popup.hidden = false;
  posicionarPopup();
  el.continuar.focus({ preventScroll: true });
  resolvendo = false;
  if (config.auto && !r.fim) iniciarAvancoAutomatico();
}

function descreverRodada(r) {
  const partes = [];
  if (r.escolheu === COMPUTADOR) partes.push(`O computador escolheu ${nomeAtributo(r.atributo)}.`);

  if (r.motivo === 'superTrunfo') {
    const st = r.cartaJogador.superTrunfo ? r.cartaJogador : r.cartaComputador;
    partes.push(`Super Trunfo! A ${st.nome} vence qualquer hortaliça comum.`);
  } else {
    partes.push(`${nomeAtributo(r.atributo)}: ${r.cartaJogador.nome} ${valorComUnidade(r.cartaJogador, r.atributo)} × ` +
      `${valorComUnidade(r.cartaComputador, r.atributo)} ${r.cartaComputador.nome}.`);
  }

  const doMonte = r.cartasGanhas.length - 2;
  if (doMonte > 0) partes.push(`Levou também ${plural(doMonte, 'carta')} do monte de empate.`);
  return partes.join(' ');
}

function registrarEstatisticas(r) {
  if (r.vencedor === EMPATE) { estatisticas.empatadas++; return; }
  if (r.vencedor === JOGADOR) estatisticas.vencidas++;
  else estatisticas.perdidas++;
  const carta = r.vencedor === JOGADOR ? r.cartaJogador : r.cartaComputador;
  const chave = `${r.vencedor}:${carta.id}`;
  const atual = estatisticas.vitoriasPorCarta.get(chave) || { lado: r.vencedor, carta, vitorias: 0 };
  atual.vitorias++;
  estatisticas.vitoriasPorCarta.set(chave, atual);
}

// Carta que mais venceu rodadas para o jogador; se ele não venceu nenhuma, a do computador.
function cartaDestaque() {
  const lista = [...estatisticas.vitoriasPorCarta.values()];
  const melhorDo = lado => lista.filter(x => x.lado === lado).sort((a, b) => b.vitorias - a.vitorias)[0];
  return melhorDo(JOGADOR) || melhorDo(COMPUTADOR) || null;
}

// ---------- Carta ampliada (celular) ----------

// Sem mouse (ou tela estreita) não há zoom ao passar o mouse: aí o toque amplia a carta.
const modoToque = () => !window.matchMedia('(hover: hover) and (min-width: 701px)').matches;

function montarZoom() {
  const faixas = el.zoomCarta.querySelector('.faixas');
  for (const atributo of ATRIBUTOS) {
    const faixa = document.createElement('button');
    faixa.type = 'button';
    faixa.className = 'faixa';
    faixa.dataset.chave = atributo.chave;
    faixa.addEventListener('click', evento => {
      evento.stopPropagation();
      if (!el.zoomCarta.classList.contains('escolhendo')) return;
      fecharZoom(true);
      escolherJogador(atributo.chave);
    });
    faixas.appendChild(faixa);
  }
  el.zoom.querySelector('.zoom-fundo').addEventListener('click', () => fecharZoom(true));
  $('zoom-fechar').addEventListener('click', () => fecharZoom(true));
  el.zoomCarta.addEventListener('click', () => { if (!el.zoomCarta.classList.contains('escolhendo')) fecharZoom(true); });
  document.addEventListener('keydown', evento => { if (evento.key === 'Escape' && zoomAberto) fecharZoom(true); });
}

// Transform que faz a carta ampliada parecer estar no lugar da carta da mesa.
function transformDaMesa(lado) {
  const item = mesa.emJogo[lado];
  if (!item) return null;
  const de = item.el.querySelector('.face-frente').getBoundingClientRect();
  const para = el.zoomCarta.getBoundingClientRect();
  if (!para.width) return null;
  const dx = de.left + de.width / 2 - (para.left + para.width / 2);
  const dy = de.top + de.height / 2 - (para.top + para.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${de.width / para.width})`;
}

function abrirZoom(lado) {
  const item = mesa.emJogo[lado];
  if (!item || zoomAberto) return;
  const podeEscolher = lado === JOGADOR && item.el.classList.contains('escolhendo') && !resolvendo;

  const img = el.zoomCarta.querySelector('img');
  img.src = item.carta.imagem;
  img.alt = `${item.carta.nome} — ${item.carta.esporte}`;
  el.zoomCarta.classList.toggle('escolhendo', podeEscolher);
  el.zoomCarta.querySelectorAll('.faixa').forEach(f => {
    const chave = f.dataset.chave;
    f.disabled = !podeEscolher;
    f.setAttribute('aria-label', `${nomeAtributo(chave)}: ${valorComUnidade(item.carta, chave)}`);
    // mostra no zoom o atributo já escolhido na rodada
    f.classList.toggle('escolhida', item.el.querySelector(`.faixa[data-chave="${chave}"]`).classList.contains('escolhida'));
  });
  el.zoomDica.textContent = podeEscolher
    ? 'Toque em um atributo para escolher'
    : `${item.carta.nome} · ${item.carta.esporte}`;

  // Enquanto o jogador lê a carta, o avanço automático espera
  const retomarAuto = !el.continuar.hidden && el.continuar.classList.contains('contando');
  if (retomarAuto) pararAvancoAutomatico();
  zoomAberto = { lado, retomarAuto };

  el.zoom.hidden = false;
  const origem = transformDaMesa(lado);
  if (origem && !movimentoReduzido()) {
    el.zoomCarta.animate([{ transform: origem }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2, .8, .3, 1)' });
    el.zoom.querySelector('.zoom-fundo').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  }
  (podeEscolher ? el.zoomCarta.querySelector('.faixa') : $('zoom-fechar')).focus({ preventScroll: true });
}

// animar = false fecha na hora (quando o jogo segue sozinho).
function fecharZoom(animar) {
  if (!zoomAberto) return;
  const { lado, retomarAuto } = zoomAberto;
  zoomAberto = null;
  const terminar = () => {
    if (zoomAberto) return; // outra carta foi ampliada enquanto esta fechava
    el.zoom.hidden = true;
    el.zoomCarta.getAnimations().forEach(a => a.cancel());
  };
  const destino = animar && !movimentoReduzido() ? transformDaMesa(lado) : null;
  if (destino) {
    el.zoom.querySelector('.zoom-fundo').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
      .finished.then(a => a.cancel()).catch(() => {});
    el.zoomCarta.animate([{ transform: 'none' }, { transform: destino }], { duration: 220, easing: 'ease-in', fill: 'forwards' })
      .finished.then(terminar).catch(terminar);
  } else {
    terminar();
  }
  if (retomarAuto && estado && !estado.fim && !el.continuar.hidden && config.auto) iniciarAvancoAutomatico();
}

// ---------- Recolher as cartas e avançar ----------

function iniciarAvancoAutomatico() {
  pararAvancoAutomatico();
  el.continuar.style.setProperty('--duracao-auto', `${TEMPO.autoAvancar}ms`);
  reanimar(el.continuar, 'contando');
  timerAuto = setTimeout(continuar, TEMPO.autoAvancar);
}

function pararAvancoAutomatico() {
  clearTimeout(timerAuto);
  el.continuar.classList.remove('contando');
}

// Leva as cartas da rodada para a pilha do vencedor (com o monte de empate, se houver)
// ou, no empate, para o monte do centro.
async function recolherCartas(r) {
  const g = geracao;
  const naMesa = [JOGADOR, COMPUTADOR].map(lado => mesa.emJogo[lado]);
  mesa.emJogo = { [JOGADOR]: null, [COMPUTADOR]: null };
  for (const item of naMesa) {
    item.el.classList.remove('na-mesa', 'escolhendo', 'vitoria', 'derrota', 'empate', 'super-trunfo');
    item.el.querySelectorAll('.faixa').forEach(f => f.classList.remove('escolhida'));
  }

  if (r.vencedor === EMPATE) {
    Sons.tocar('virar');
    await Promise.all(naMesa.map((item, i) => {
      const lugar = {
        carta: item.carta,
        el: item.el,
        rot: Math.round(Math.random() * 24 - 12),
        dx: Math.round(Math.random() * 10 - 5),
        dy: Math.round(Math.random() * 10 - 5),
      };
      mesa.noMonte.push(lugar);
      anunciarFace(item.el, item.carta, false);
      return voar(item.el, posicaoEm(el.slot[i === 0 ? JOGADOR : COMPUTADOR]), posicaoEm(el.empate, lugar), {
        virarPara: 'verso', duracao: TEMPO.recolher, atraso: i * TEMPO.intervalo,
      }).then(() => { if (g === geracao) desenharMonte(true); });
    }));
    return;
  }

  // Ordem igual à do motor: carta do vencedor, carta do perdedor, depois o monte de empate
  const porCarta = new Map([...naMesa, ...mesa.noMonte].map(item => [item.carta, item]));
  const deOnde = item => mesa.noMonte.includes(item)
    ? posicaoEm(el.empate, item)
    : posicaoEm(el.slot[item === naMesa[0] ? JOGADOR : COMPUTADOR]);
  const destino = el.pilha[r.vencedor];
  const voos = r.cartasGanhas.map((carta, i) => {
    const item = porCarta.get(carta);
    const origem = deOnde(item);
    anunciarFace(item.el, item.carta, false);
    return voar(item.el, origem, posicaoEm(destino), {
      virarPara: 'verso', duracao: TEMPO.recolher, atraso: i * TEMPO.intervalo,
    }).then(() => {
      item.el.remove();
      if (g !== geracao) return;
      mesa.naPilha[r.vencedor]++;
      desenharPilha(r.vencedor, true);
    });
  });
  mesa.noMonte = [];
  desenharMonte();
  Sons.tocar('virar');
  await Promise.all(voos);
}

async function continuar() {
  if (!estado || el.continuar.hidden) return;
  const g = geracao;
  fecharZoom(false);
  pararAvancoAutomatico();
  esconderPopup();

  await recolherCartas(ultimaRodada);
  if (g !== geracao) return;
  if (estado.fim) {
    await pausa(movimentoReduzido() ? 0 : 300);
    if (g === geracao) mostrarFim();
    return;
  }
  prepararRodada();
}

// ---------- Fim de partida ----------

function mostrarFim() {
  const r = ultimaRodada;
  const meu = estado.maos[JOGADOR].length;
  const dele = estado.maos[COMPUTADOR].length;
  const noMonte = estado.monteEmpate.length;

  el.fim.className = 'fim ' + { [JOGADOR]: 'vitoria', [COMPUTADOR]: 'derrota', [EMPATE]: 'empate' }[r.campeao];
  el.fimConfig.textContent = `Modo ${MODOS[config.modo].nome} · ${DIFICULDADES[config.dificuldade].nome}`;
  el.fimTitulo.textContent = {
    [JOGADOR]: nomeJogador ? `${nomeJogador} venceu!` : 'Você venceu!',
    [COMPUTADOR]: 'O computador venceu',
    [EMPATE]: 'Empate!',
  }[r.campeao];

  let texto;
  if (r.motivoFim === 'limiteRodadas') {
    texto = r.campeao === EMPATE
      ? `Depois de ${r.rodada} rodadas, vocês terminaram com a mesma quantidade de cartas.`
      : `Depois de ${r.rodada} rodadas, ${r.campeao === JOGADOR ? 'você terminou' : 'o computador terminou'} com mais cartas.`;
    if (noMonte > 0) texto += ` ${plural(noMonte, 'carta')} ${noMonte === 1 ? 'ficou' : 'ficaram'} no monte de empate e não ${noMonte === 1 ? 'conta' : 'contam'}.`;
  } else if (r.campeao === EMPATE) {
    texto = 'As últimas cartas dos dois empataram e ninguém ficou com cartas na mão.';
  } else {
    texto = r.campeao === JOGADOR
      ? `Você ficou com todas as cartas em ${r.rodada} rodadas.`
      : `O computador ficou com todas as cartas em ${r.rodada} rodadas.`;
  }
  el.fimTexto.textContent = texto;

  $('fim-qtd-jogador').textContent = meu;
  $('fim-qtd-computador').textContent = dele;
  preencherContagem($('fim-vencidas'), estatisticas.vencidas, 'rodada vencida', 'rodadas vencidas');
  preencherContagem($('fim-perdidas'), estatisticas.perdidas, 'rodada perdida', 'rodadas perdidas');
  preencherContagem($('fim-empatadas'), estatisticas.empatadas, 'empate', 'empates');

  const destaque = cartaDestaque();
  $('fim-destaque').hidden = !destaque;
  if (destaque) {
    const { carta, vitorias, lado } = destaque;
    $('fim-destaque-img').src = carta.imagem;
    $('fim-destaque-img').alt = carta.nome;
    $('fim-destaque-rotulo').textContent = lado === JOGADOR ? 'Sua carta destaque' : 'Destaque do computador';
    $('fim-destaque-nome').textContent = carta.nome;
    $('fim-destaque-texto').textContent = `${carta.esporte} · venceu ${plural(vitorias, 'rodada')}`;
  }

  Sons.tocar({ [JOGADOR]: 'fimVitoria', [COMPUTADOR]: 'fimDerrota', [EMPATE]: 'fimEmpate' }[r.campeao]);
  mostrarTela('fim');
  $('botao-de-novo').focus();
}

// ---------- Sair da partida (pede confirmação com um segundo toque) ----------

function sair() {
  if (!el.sair.classList.contains('confirmar')) {
    el.sair.classList.add('confirmar');
    el.sair.textContent = 'Toque de novo para sair da partida';
    timerSair = setTimeout(restaurarSair, 3000);
    return;
  }
  restaurarSair();
  fecharZoom(false);
  cancelarTimers();
  geracao++;
  estado = null;
  mostrarTela('inicio');
}

function restaurarSair() {
  clearTimeout(timerSair);
  el.sair.classList.remove('confirmar');
  el.sair.textContent = 'Sair';
}

// ---------- Som e avanço automático ----------

function atualizarControles() {
  el.som.textContent = `Som: ${config.som ? 'ligado' : 'desligado'}`;
  el.som.setAttribute('aria-pressed', String(config.som));
  el.auto.textContent = `Avançar sozinho: ${config.auto ? 'sim' : 'não'}`;
  el.auto.setAttribute('aria-pressed', String(config.auto));
  Sons.ligado = config.som;
}

function alternarSom() {
  config.som = !config.som;
  atualizarControles();
  salvarPreferencias();
  Sons.tocar('clique');
}

function alternarAuto() {
  config.auto = !config.auto;
  atualizarControles();
  salvarPreferencias();
  const aguardando = estado && !estado.fim && !el.continuar.hidden;
  if (!aguardando) return;
  if (config.auto) iniciarAvancoAutomatico();
  else pararAvancoAutomatico();
}

// ---------- Cadastro (nome e e-mail, opcional) ----------

function aplicarNome(nome) {
  nomeJogador = nome;
  $('rotulo-jogador').textContent = nome || 'Você';
  $('fim-nome-jogador').textContent = nome || 'Você';
}

function abrirCadastro() {
  $('campo-nome').value = nomeJogador;
  $('campo-email').value = '';
  $('campo-consentimento').checked = false;
  $('cadastro-erro').hidden = true;
  mostrarTela('cadastro');
}

function concluirCadastro(evento) {
  evento.preventDefault();
  const dados = {
    nome: $('campo-nome').value.trim().replace(/\s+/g, ' '),
    email: $('campo-email').value.trim(),
    consentimento: $('campo-consentimento').checked,
  };
  const erro = Cadastro.validar(dados);
  $('cadastro-erro').hidden = !erro;
  if (erro) {
    $('cadastro-erro').textContent = erro;
    return;
  }
  Cadastro.salvar(dados.nome);
  Cadastro.enviar(dados); // segue em segundo plano; o jogo não espera a planilha
  aplicarNome(dados.nome);
  mostrarTela('inicio');
}

function pularCadastro() {
  aplicarNome(nomeJogador); // segue com o nome lembrado neste aparelho (ou "Você")
  mostrarTela('inicio');
}

// ---------- Preferências (lembradas neste navegador) ----------

function carregarPreferencias() {
  try {
    const salvas = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS)) || {};
    if (salvas.modo in MODOS) config.modo = salvas.modo;
    if (salvas.dificuldade in DIFICULDADES) config.dificuldade = salvas.dificuldade;
    if (typeof salvas.som === 'boolean') config.som = salvas.som;
    if (typeof salvas.auto === 'boolean') config.auto = salvas.auto;
  } catch (e) { /* sem armazenamento: usa o padrão */ }
  document.querySelector(`input[name="modo"][value="${config.modo}"]`).checked = true;
  document.querySelector(`input[name="dificuldade"][value="${config.dificuldade}"]`).checked = true;
  atualizarControles();
}

function salvarPreferencias() {
  try { localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(config)); } catch (e) { /* ignora */ }
}

// ---------- Eventos ----------

preCarregarImagens();
carregarPreferencias();
montarZoom();

// O cadastro aparece sempre que o jogo é aberto, já com o nome lembrado neste aparelho.
const jogadorSalvo = Cadastro.carregar();
aplicarNome(jogadorSalvo ? jogadorSalvo.nome : '');
abrirCadastro();
$('form-cadastro').addEventListener('submit', concluirCadastro);
$('botao-pular').addEventListener('click', pularCadastro);

$('botao-jogar').addEventListener('click', () => {
  Sons.liberarAudio(); // o navegador só libera o áudio dentro de um clique
  config.modo = document.querySelector('input[name="modo"]:checked').value;
  config.dificuldade = document.querySelector('input[name="dificuldade"]:checked').value;
  salvarPreferencias();
  iniciarPartida();
});
el.continuar.addEventListener('click', continuar);
el.som.addEventListener('click', alternarSom);
el.auto.addEventListener('click', alternarAuto);
el.sair.addEventListener('click', sair);
$('botao-de-novo').addEventListener('click', iniciarPartida);
$('botao-menu').addEventListener('click', () => mostrarTela('inicio'));

let timerRedimensionar = null;
window.addEventListener('resize', () => {
  clearTimeout(timerRedimensionar);
  timerRedimensionar = setTimeout(() => {
    reposicionarMesa();
    if (!el.popup.hidden) posicionarPopup();
  }, 80);
});
