// Interface do SuperPANCs: liga o motor (jogo.js) à tela.
// As cartas são elementos soltos numa camada por cima do tabuleiro; cada movimento (comprar da pilha,
// revelar, recolher para o vencedor ou para o monte de empate) "levanta" a carta, leva até o destino
// e "pousa" — feito com a Web Animations API.

// Tempos em ms.
const TEMPO = {
  computadorPensa: 1500, // mínimo; se o rival estiver falando, ele termina a fala antes de escolher
  comprar: 650,        // carta saindo da pilha até o lugar de jogo
  revelar: 700,        // carta do computador levantando e virando no lugar
  afastar: 320,        // cartas abrindo espaço para a comparação no centro
  balaoNeutro: 3200,   // fala do rival na sua vez: some sozinha depois disso
  superTrunfo: 1900,   // Ora-pro-nóbis parada no centro, com raios e letreiro
  stEntrar: 520,       // carta indo para o centro (e voltando) na entrada do Super Trunfo
  recolher: 650,       // cartas indo para a pilha do vencedor ou para o monte de empate
  intervalo: 110,      // atraso entre cartas que se movem juntas
  autoAvancar: 2000,   // depois que o rival reage e termina de falar, espera isso e avança sozinho
  narrador: 1200,      // a faixa "ao vivo" ainda fica isso na tela depois de a fala terminar
  respiro: 700,        // pausa entre uma fala e o que vem depois (outra fala, uma carta)
  semVoz: 1200,        // sem voz (desligada ou sem gravação), tempo mínimo para ler cada fala da faixa
};

const $ = id => document.getElementById(id);
const telas = { cadastro: $('tela-cadastro'), inicio: $('tela-inicio'), jogo: $('tela-jogo'), fim: $('tela-fim'), album: $('tela-album') };
const el = {
  tabuleiro: $('tabuleiro'),
  camada: $('camada-cartas'),
  slot: { [JOGADOR]: $('slot-jogador'), [COMPUTADOR]: $('slot-computador') },
  pilha: { [JOGADOR]: $('pilha-jogador'), [COMPUTADOR]: $('pilha-computador') },
  empate: $('pilha-empate'),
  qtdEmpate: $('qtd-empate'),
  placar: { [JOGADOR]: $('placar-jogador'), [COMPUTADOR]: $('placar-rival') },
  placarRodada: $('placar-rodada'),
  dica: $('dica'),
  retrato: $('retrato-rival'),
  balao: $('balao'),
  revelacao: $('revelacao'),
  stFundo: $('st-fundo'),
  stLetreiro: $('st-letreiro'),
  mascote: $('mascote'),
  anuncio: $('anuncio'),
  mensagem: $('mensagem'),
  detalhe: $('detalhe'),
  continuar: $('botao-continuar'),
  som: $('botao-som'),
  voz: $('botao-voz'),
  auto: $('botao-auto'),
  sair: $('botao-sair'),
  zoom: $('zoom'),
  zoomCarta: $('zoom-carta'),
  zoomDica: $('zoom-dica'),
  fim: $('fim'),
  fimConfig: $('fim-config'),
  fimTitulo: $('fim-titulo'),
  fimTexto: $('fim-texto'),
  narrador: $('narrador'),
  narradorTexto: $('narrador-texto'),
  narradorQuem: $('narrador-quem'),
};

const CHAVE_PREFERENCIAS = 'superpancs-preferencias';
const PROPORCAO = 1181 / 708; // altura / largura das cartas

// A dificuldade escolhida define quem joga do outro lado da banca.
const RIVAIS = {
  facil:   { id: 'seu-ze',    nome: 'Seu Zé',    de: 'do Seu Zé' },
  dificil: { id: 'dona-cida', nome: 'Dona Cida', de: 'da Dona Cida' },
};
const rival = () => RIVAIS[config.dificuldade];
const imagemRival = (id, expressao) => `img/rivais/${id}-${expressao}.svg`;
const EXPRESSOES = Object.keys(FALAS.expressoes); // neutro, pensando, comemorando, frustrado
const CHANCE_FALA_NEUTRA = 0.4; // na sua vez o rival só às vezes provoca (para não falar o tempo todo)

let estado = null;
let config = { modo: 'rapido', dificuldade: 'facil', som: true, voz: true, auto: true };
let ultimaRodada = null;
let estatisticas = null;
let geracao = 0;        // muda a cada partida nova ou saída; passos assíncronos antigos param sozinhos
let resolvendo = false; // impede escolher duas vezes durante a revelação
let timerAuto = null;
let timerSair = null;
let nomeJogador = ''; // nome do cadastro; vazio = "Você"
let zoomAberto = null; // { lado, retomarAuto } enquanto a carta ampliada está na tela
let timerBalao = null;
let timerNarrador = null;
let transmissao = 0; // muda a cada fala de narrador + comentarista iniciada ou interrompida
let cicloAuto = 0; // muda a cada avanço automático iniciado ou parado
let autoAguardando = false; // avanço automático em andamento (esperando o rival ou contando)
let reacaoDoRival = Promise.resolve(); // termina quando o rival já reagiu à rodada (e parou de falar)
let seguidas = { lado: null, n: 0 }; // rodadas seguidas vencidas pelo mesmo lado (para o narrador)
const falasUsadas = new Set(); // ids das falas já ditas (rivais, narrador e comentarista), para não se repetirem
const armazenamento = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const album = carregarAlbum(armazenamento); // ids das cartas com a figurinha colada

// O que está desenhado na mesa
const mesa = {
  emJogo: { [JOGADOR]: null, [COMPUTADOR]: null }, // { carta, el, desvio } (desvio: afastamento na revelação)
  noMonte: [],                                       // { carta, el, rot, dx, dy }
  naPilha: { [JOGADOR]: 0, [COMPUTADOR]: 0 },       // quantas cartas cada pilha mostra
  voando: 0,
};

const formatar = n => n.toLocaleString('pt-BR');
const nomeAtributo = chave => ATRIBUTOS.find(a => a.chave === chave).nome;
const valorComUnidade = (carta, chave) =>
  `${formatar(carta.valores[chave])} ${ATRIBUTOS.find(a => a.chave === chave).unidade}`;
const plural = (n, palavra) => `${n} ${palavra}${n === 1 ? '' : 's'}`;
// Na carta, os rótulos são curtos: "Calorias gastas" → "Calorias", "g/100g" → "g".
const rotuloCurto = atributo => atributo.nome.split(' ')[0];
// "+4,47 g de fibra": o que vem depois da diferença no painel de comparação
const DE_QUE = { proteina: 'de proteína', carboidrato: 'de carboidrato', fibras: 'de fibra', calorias: 'gastas' };
const unidadeCurta = atributo => atributo.unidade.replace('/100g', '');

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
  const rivais = Object.values(RIVAIS).flatMap(r => EXPRESSOES.map(e => imagemRival(r.id, e)));
  for (const src of [VERSO, ...CARTAS.map(c => c.imagemLimpa), ...rivais]) new Image().src = src;
}

function mostrarTela(nome) {
  if (nome === 'inicio') $('album-contagem').textContent = `${album.size}/${CARTAS.length}`;
  for (const [chave, tela] of Object.entries(telas)) tela.hidden = chave !== nome;
  window.scrollTo(0, 0);
}

// ---------- Cartas: criação, posição e movimento ----------

// Frente da carta: a imagem sem texto e, por cima, nome, esporte e os quatro atributos.
// Com "aoEscolher", os atributos viram botões (começam desativados).
function montarFrente(face, carta, aoEscolher = null) {
  face.classList.toggle('super', carta.superTrunfo);
  face.innerHTML = `<img alt="" src="${carta.imagemLimpa}">` +
    (carta.tipo === 'panc' ? '<span class="selo">PANC</span>' : '') +
    (carta.superTrunfo ? '<span class="selo-st">★ Super Trunfo</span>' : '') +
    '<div class="info"><span class="nome"></span><span class="esporte"></span><div class="faixas"></div></div>';
  const nome = face.querySelector('.nome');
  nome.textContent = carta.nome;
  // nomes compridos ("Peixinho-da-horta") encolhem para caber numa linha
  nome.style.setProperty('--tam-nome', `${Math.min(10.5, 140 / carta.nome.length)}cqw`);
  face.querySelector('.esporte').textContent = carta.esporte;

  const faixas = face.querySelector('.faixas');
  for (const atributo of ATRIBUTOS) {
    const faixa = document.createElement(aoEscolher ? 'button' : 'span');
    faixa.className = 'faixa';
    faixa.dataset.chave = atributo.chave;
    faixa.innerHTML = '<span></span><b><small></small></b>';
    faixa.querySelector('span').textContent = rotuloCurto(atributo);
    faixa.querySelector('b').prepend(formatar(carta.valores[atributo.chave]));
    faixa.querySelector('small').textContent = unidadeCurta(atributo);
    if (aoEscolher) {
      faixa.type = 'button';
      faixa.disabled = true;
      faixa.setAttribute('aria-label', `${atributo.nome}: ${valorComUnidade(carta, atributo.chave)}`);
      faixa.addEventListener('click', evento => aoEscolher(atributo.chave, evento));
    }
    faixas.appendChild(faixa);
  }
}

function criarCarta(carta, lado) {
  const elemento = document.createElement('div');
  elemento.className = `carta virada do-${lado}`;
  elemento.innerHTML = `
    <div class="carta-escala">
      <div class="carta-interna">
        <div class="face face-frente"></div>
        <div class="face face-verso"><img src="${VERSO}" alt="Carta virada para baixo"></div>
      </div>
    </div>`;
  montarFrente(elemento.querySelector('.face-frente'), carta, lado === JOGADOR ? escolherJogador : null);
  anunciarFace(elemento, carta, false);
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
// (Nome e atributos são texto de verdade: virada para baixo, a frente fica escondida dos leitores.)
function anunciarFace(elemento, carta, deFrente) {
  elemento.querySelector('.face-frente').setAttribute('aria-hidden', String(!deFrente));
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

// Posição atual da carta em jogo de um lado (no lugar dela, ou afastada durante a revelação).
const posicaoEmJogo = lado => posicaoEm(el.slot[lado], mesa.emJogo[lado].desvio);

// Recoloca as cartas paradas quando a janela muda de tamanho ou gira.
function reposicionarMesa() {
  if (!estado || mesa.voando > 0 || el.tabuleiro.classList.contains('st-ativo')) return;
  for (const lado of [JOGADOR, COMPUTADOR]) {
    const emJogo = mesa.emJogo[lado];
    if (!emJogo) continue;
    if (emJogo.desvio) emJogo.desvio = desvioRevelacao(lado);
    colocar(emJogo.el, posicaoEmJogo(lado));
  }
  for (const item of mesa.noMonte) colocar(item.el, posicaoEm(el.empate, item));
}

// Chamar só depois de mudar "geracao", para os voos cancelados não descontarem do contador novo.
function limparMesa() {
  esconderNarrador();
  el.stFundo.hidden = true;
  el.stFundo.classList.remove('saindo');
  el.stLetreiro.hidden = true;
  el.tabuleiro.classList.remove('st-ativo');
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
  for (let i = 1; i <= camadas; i++) sombras.push(`${i}px ${i}px 0 ${i % 2 ? '#f6e7c8' : '#c9b48a'}`);
  sombras.push(`${camadas + 2}px ${camadas + 4}px 0 rgba(0, 0, 0, .3)`);
  pilha.style.setProperty('--sombra-pilha', sombras.join(', '));
}

function desenharMonte(animar = false) {
  const qtd = el.qtdEmpate;
  const n = mesa.noMonte.length;
  if (animar && qtd.textContent !== String(n)) reanimar(qtd, 'mudou');
  qtd.textContent = n;
  qtd.hidden = n === 0;
}

// ---------- Placar e rival ----------

// Placar de TV: cartas de cada um (atualizado quando as cartas chegam às pilhas) e a rodada.
function atualizarPlacar(animar = false) {
  for (const lado of [JOGADOR, COMPUTADOR]) {
    const n = String(estado.maos[lado].length);
    if (animar && el.placar[lado].textContent !== n) reanimar(el.placar[lado], 'mudou');
    el.placar[lado].textContent = n;
  }
  el.placarRodada.textContent = estado.limiteRodadas ? `${estado.rodada}/${estado.limiteRodadas}` : estado.rodada;
}

function mostrarRival() {
  const r = rival();
  $('placar-nome-rival').textContent = r.nome;
  $('etiqueta-rival').textContent = r.nome;
  $('etiqueta-nivel').textContent = DIFICULDADES[config.dificuldade].nome;
  el.retrato.alt = r.nome;
  mudarExpressao('neutro');
  esconderBalao();
}

// ---------- Rival: rosto e falas ----------

function mudarExpressao(expressao) {
  el.retrato.src = imagemRival(rival().id, expressao);
  el.retrato.dataset.expressao = expressao;
}

// O rival muda de cara e diz uma fala da expressão, escolhida pela situação do placar.
// "duracao" (ms) faz o balão sumir sozinho; sem ela, fica até a próxima mudança.
function falar(expressao, duracao = 0) {
  mudarExpressao(expressao);
  const situacao = situacaoDoRival(estado.maos[COMPUTADOR].length, estado.maos[JOGADOR].length);
  const fala = falaDoRival(rival().id, expressao, situacao, falasUsadas);
  clearTimeout(timerBalao);
  el.balao.textContent = fala.texto;
  el.balao.hidden = false;
  reanimar(el.balao, 'surgindo');
  if (duracao) timerBalao = setTimeout(esconderBalao, duracao);
  return audioDaFala(FALAS, fala);
}

// Narrador ou comentarista ("quem": NARRADOR ou COMENTARISTA): mostra a fala na faixa "ao vivo"
// e devolve o caminho do áudio dela.
function narrar(quem, evento, atributo) {
  const fala = falaDoEvento(quem, evento, atributo, falasUsadas);
  clearTimeout(timerNarrador);
  el.narradorTexto.textContent = fala.texto;
  el.narradorQuem.textContent = quem === COMENTARISTA ? COMENTARISTA.nome : 'Ao vivo';
  el.narrador.classList.toggle('do-comentarista', quem === COMENTARISTA);
  el.narrador.hidden = false;
  reanimar(el.narrador, 'entrando');
  return audioDaFala(quem, fala);
}

// O narrador fala do evento e o Tião comenta em seguida, com um respiro entre os dois.
// Sem voz, cada fala fica o tempo de ler. Termina quando os dois acabam (ou na hora, se interrompida).
async function transmitir(evento, atributo) {
  const minha = ++transmissao;
  for (const quem of [NARRADOR, COMENTARISTA]) {
    if (quem === COMENTARISTA) await pausa(TEMPO.respiro);
    if (minha !== transmissao) return;
    await Promise.all([Sons.falar([narrar(quem, evento, atributo)]), pausa(TEMPO.semVoz)]);
    // a faixa fica até a fala terminar e mais um pouco (a próxima fala a substitui)
    if (minha === transmissao) timerNarrador = setTimeout(esconderNarrador, TEMPO.narrador);
  }
}

function pararTransmissao() {
  transmissao++;
  esconderNarrador();
}

function esconderNarrador() {
  clearTimeout(timerNarrador);
  el.narrador.hidden = true;
}

function esconderBalao() {
  clearTimeout(timerBalao);
  el.balao.hidden = true;
}

// Dica visível de quem tem a vez (o texto para leitores de tela vai em #anuncio).
function mostrarDica(html) {
  el.dica.innerHTML = html;
  el.dica.classList.toggle('oculta', !html);
}

// ---------- Partida ----------

function cancelarTimers() {
  esconderBalao();
  pararTransmissao();
  pararAvancoAutomatico();
  Sons.pararVoz();
}

async function iniciarPartida() {
  fecharZoom(false);
  cancelarTimers();
  geracao++;
  const g = geracao;
  resolvendo = false;
  estado = novaPartida(CARTAS, config.modo);
  estatisticas = { vencidas: 0, perdidas: 0, empatadas: 0, superTrunfo: 0, pancada: null, vitoriasPorCarta: new Map() };
  seguidas = { lado: null, n: 0 };
  limparMesa();
  mesa.naPilha[JOGADOR] = estado.maos[JOGADOR].length;
  mesa.naPilha[COMPUTADOR] = estado.maos[COMPUTADOR].length;
  desenharPilha(JOGADOR);
  desenharPilha(COMPUTADOR);
  desenharMonte();
  mostrarRival();
  atualizarPlacar();
  esconderRevelacao();
  mostrarTela('jogo');
  await proximoQuadro(); // espera o tabuleiro ter tamanho antes de calcular posições
  if (g !== geracao) return;
  Sons.tocar('apito');
  // narrador e Tião abrem a partida; as primeiras cartas só saem das pilhas depois
  await transmitir('inicio_partida');
  await pausa(TEMPO.respiro);
  if (g !== geracao) return;
  prepararRodada();
}

// Espera a voz que estiver tocando terminar e mais um respiro (para as falas não se atropelarem).
async function esperarFala() {
  await Sons.esperarVoz();
  await pausa(TEMPO.respiro);
}

// ---------- Revelação: comparação no centro e mascote do vencedor ----------

// Cartas lado a lado (computador, celular deitado) ou uma em cima da outra (celular em pé)?
function ladoALado() {
  return el.slot[COMPUTADOR].getBoundingClientRect().left >= el.slot[JOGADOR].getBoundingClientRect().right;
}

// Lado a lado, as cartas se afastam e inclinam para o painel caber entre elas.
function desvioRevelacao(lado) {
  if (!ladoALado()) return { rot: 0, dx: 0 };
  const t = el.tabuleiro.getBoundingClientRect();
  const j = el.slot[JOGADOR].getBoundingClientRect();
  const c = el.slot[COMPUTADOR].getBoundingClientRect();
  const painel = el.revelacao.querySelector('.comparacao').offsetWidth || 260;
  const falta = Math.max(0, (painel + 28 - (c.left - j.right)) / 2);
  // sem passar da borda da mesa
  const dx = lado === JOGADOR ? -Math.min(falta, j.left - t.left - 8) : Math.min(falta, t.right - c.right - 8);
  return { rot: lado === JOGADOR ? -3 : 3, dx: Math.round(dx) };
}

// O painel fica no centro do vão entre as cartas.
function posicionarRevelacao() {
  const t = el.tabuleiro.getBoundingClientRect();
  const j = el.slot[JOGADOR].getBoundingClientRect();
  const c = el.slot[COMPUTADOR].getBoundingClientRect();
  const [x, y] = ladoALado()
    ? [(j.right + c.left) / 2, (j.top + j.bottom) / 2]
    : [t.left + t.width / 2, (c.bottom + j.top) / 2];
  el.revelacao.style.left = `${x - t.left}px`;
  el.revelacao.style.top = `${y - t.top}px`;
  if (!el.mascote.hidden) posicionarMascote();
}

// O mascote fica de pé ao lado da carta vencedora, do lado de fora da mesa.
function posicionarMascote() {
  const lado = el.mascote.dataset.lado;
  const item = mesa.emJogo[lado];
  if (!item) return;
  const t = el.tabuleiro.getBoundingClientRect();
  const r = item.el.querySelector('.face-frente').getBoundingClientRect();
  const w = el.mascote.offsetWidth;
  const h = w * 0.94; // proporção dos quadros do mascote
  const paraFora = ladoALado() ? lado === JOGADOR : false;
  el.mascote.style.left = `${(paraFora ? r.left - w * 0.6 : r.right - w * 0.4) - t.left}px`;
  el.mascote.style.top = `${r.bottom - h * 0.92 - t.top}px`;
}

function mostrarMascote(r) {
  el.mascote.hidden = true;
  if (r.vencedor === EMPATE) return;
  const carta = r.vencedor === JOGADOR ? r.cartaJogador : r.cartaComputador;
  el.mascote.dataset.lado = r.vencedor;
  el.mascote.classList.toggle('do-rival', r.vencedor === COMPUTADOR);
  el.mascote.onerror = () => { el.mascote.hidden = true; }; // sem a animação, a rodada segue sem mascote
  el.mascote.src = carta.mascote;
  el.mascote.hidden = false;
  posicionarMascote();
  reanimar(el.mascote, 'entrando');
}

function preencherLado(painel, quem, carta, chave, maior, classe) {
  const atributo = ATRIBUTOS.find(a => a.chave === chave);
  painel.className = `lado ${classe}`;
  painel.querySelector('.quem').textContent = `${quem} · ${carta.nome}`;
  const valor = painel.querySelector('.valor');
  valor.innerHTML = '<small></small>';
  valor.prepend(formatar(carta.valores[chave]));
  valor.querySelector('small').textContent = unidadeCurta(atributo);
  painel.querySelector('.barra i').style.width = `${maior ? Math.max(4, carta.valores[chave] / maior * 100) : 0}%`;
}

function mostrarRevelacao(r) {
  const resultado = { [JOGADOR]: 'vitoria', [COMPUTADOR]: 'derrota', [EMPATE]: 'empate' }[r.vencedor];
  el.revelacao.className = `revelacao ${resultado}`;
  el.mensagem.textContent = {
    [JOGADOR]: 'Você leva!',
    [COMPUTADOR]: `${rival().nome} leva!`,
    [EMPATE]: 'Empatou!',
  }[r.vencedor];

  const chave = r.atributo;
  const atributo = ATRIBUTOS.find(a => a.chave === chave);
  const meu = r.cartaJogador.valores[chave];
  const dele = r.cartaComputador.valores[chave];
  const maior = Math.max(meu, dele);
  const classe = lado => r.vencedor === EMPATE ? 'empata' : r.vencedor === lado ? 'ganha' : 'perde';
  $('comparacao-titulo').textContent = r.motivo === 'superTrunfo' ? 'Super Trunfo' : rotuloCurto(atributo);
  preencherLado($('lado-jogador'), nomeJogador || 'Você', r.cartaJogador, chave, maior, classe(JOGADOR));
  preencherLado($('lado-rival'), rival().nome, r.cartaComputador, chave, maior, classe(COMPUTADOR));
  const diferenca = Math.round(Math.abs(meu - dele) * 100) / 100;
  $('diferenca').textContent = r.motivo === 'superTrunfo'
    ? 'Ora-pro-nóbis vence hortaliça comum'
    : diferenca === 0 ? 'Valores iguais: tudo para a cesta' : `+${formatar(diferenca)} ${unidadeCurta(atributo)} ${DE_QUE[chave]}`;

  el.detalhe.textContent = detalheRodada(r);
  el.continuar.textContent = r.fim ? 'Ver resultado' : 'Próxima rodada';
  el.continuar.hidden = false;
  el.revelacao.hidden = false;
  posicionarRevelacao();
}

function esconderRevelacao() {
  el.revelacao.hidden = true;
  el.continuar.hidden = true;
  el.mascote.hidden = true;
}

// Cada jogador compra a carta do topo da sua pilha e a coloca no lugar de jogo.
async function prepararRodada() {
  const g = geracao;
  esconderRevelacao();

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
  Sons.tocar('madeira');
  if (estado.limiteRodadas && estado.rodada === estado.limiteRodadas) {
    // a última rodada é anunciada antes de a vez começar, para ninguém falar por cima
    await transmitir('ultima_rodada');
    await pausa(TEMPO.respiro);
    if (g !== geracao) return;
  }

  const minha = mesa.emJogo[JOGADOR];
  anunciarFace(minha.el, minha.carta, true);
  for (const lado of [JOGADOR, COMPUTADOR]) mesa.emJogo[lado].el.classList.add('na-mesa');

  const rodada = estado.limiteRodadas ? `Rodada ${estado.rodada} de ${estado.limiteRodadas}` : `Rodada ${estado.rodada}`;
  atualizarPlacar();
  if (estado.vez === JOGADOR) {
    // Na tela, a vez é indicada pela carta (salto + faixas pulsando); o texto é só para leitores de tela.
    el.anuncio.textContent = `${rodada}. Sua vez: ` + (modoToque()
      ? 'toque na sua carta para ampliar e escolher um atributo.'
      : 'escolha um atributo da sua carta.');
    mostrarDica(modoToque() ? 'Sua vez: <b>toque na sua carta</b>' : 'Sua vez: <b>escolha um atributo</b>');
    // às vezes o rival provoca, um pouco depois de a carta chegar e sem interromper outra voz
    mudarExpressao('neutro');
    esconderBalao();
    if (Math.random() < CHANCE_FALA_NEUTRA) {
      pausa(TEMPO.respiro).then(() => {
        if (g !== geracao || resolvendo || !minha.el.classList.contains('escolhendo')) return;
        Sons.falar([falar('neutro', TEMPO.balaoNeutro)], { interromper: false });
      });
    }
    minha.el.classList.add('escolhendo');
    minha.el.querySelectorAll('.faixa').forEach(f => { f.disabled = false; });
    minha.el.querySelector('.faixa').focus({ preventScroll: true });
  } else {
    el.anuncio.textContent = `${rodada}. Vez ${rival().de}.`;
    mostrarDica(`<b>${rival().nome}</b> está escolhendo…`);
    Sons.falar([falar('pensando')], { interromper: false });
    mesa.emJogo[COMPUTADOR].el.classList.add('pensando');
    // o rival só revela a carta depois de terminar de falar (e nunca antes do tempo mínimo)
    Promise.all([pausa(TEMPO.computadorPensa), esperarFala()]).then(() => {
      if (g !== geracao) return;
      resolverRodada(escolherAtributo(cartaDoTopo(estado, COMPUTADOR), config.dificuldade));
    });
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
  mostrarDica('');
  resolvendo = true;
  const minha = mesa.emJogo[JOGADOR];
  const dele = mesa.emJogo[COMPUTADOR];
  minha.el.classList.remove('escolhendo');
  minha.el.querySelectorAll('.faixa').forEach(f => { f.disabled = true; });
  minha.el.querySelector(`.faixa[data-chave="${chave}"]`).classList.add('escolhida');

  const r = jogarRodada(estado, chave);
  ultimaRodada = r;
  registrarEstatisticas(r);
  if (r.vencedor === EMPATE) seguidas = { lado: null, n: 0 };
  else seguidas = { lado: r.vencedor, n: seguidas.lado === r.vencedor ? seguidas.n + 1 : 1 };

  // Revela a carta do computador: levanta, vira e pousa no mesmo lugar
  dele.el.classList.remove('pensando');
  Sons.tocar('virar');
  const lugar = posicaoEm(el.slot[COMPUTADOR]);
  await voar(dele.el, lugar, lugar, { virarPara: 'frente', duracao: TEMPO.revelar });
  if (g !== geracao) return;
  Sons.tocar('madeira');
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
  el.anuncio.textContent = `${{ [JOGADOR]: 'Você venceu a rodada.', [COMPUTADOR]: `${rival().nome} venceu a rodada.`, [EMPATE]: 'Empate: as cartas vão para a cesta.' }[r.vencedor]} ${descreverRodada(r)}`;

  // O narrador fala primeiro e o Tião comenta; o rival só reage depois dos dois (reagirRival).
  // No Super Trunfo, a carta faz a entrada especial antes da comparação.
  esconderBalao();
  const comentarios = transmitir(eventoDaRodada(r, seguidas.n), r.atributo);
  if (r.motivo === 'superTrunfo') {
    await entradaSuperTrunfo(r.vencedor);
    if (g !== geracao) return;
  }

  // As cartas abrem espaço e o painel de comparação aparece no meio
  mostrarRevelacao(r);
  await Promise.all([JOGADOR, COMPUTADOR].map(lado => {
    const item = mesa.emJogo[lado];
    const de = posicaoEmJogo(lado);
    item.desvio = desvioRevelacao(lado);
    return voar(item.el, de, posicaoEmJogo(lado), { duracao: TEMPO.afastar });
  }));
  if (g !== geracao) return;
  for (const lado of [JOGADOR, COMPUTADOR]) mesa.emJogo[lado].el.classList.add('na-mesa');
  mostrarMascote(r);
  el.continuar.focus({ preventScroll: true });
  resolvendo = false;
  reacaoDoRival = reagirRival(r, comentarios);
  if (config.auto && !r.fim) iniciarAvancoAutomatico();
}

// O rival reage à rodada depois do narrador e do Tião, com um respiro entre as falas.
// Não reage se a pessoa já seguiu para a próxima rodada.
async function reagirRival(r, comentarios) {
  await comentarios;
  await pausa(TEMPO.respiro);
  if (ultimaRodada !== r || el.revelacao.hidden) return;
  if (r.vencedor === EMPATE) { mudarExpressao('pensando'); return; }
  await Sons.falar([falar(r.vencedor === COMPUTADOR ? 'comemorando' : 'frustrado')]);
}

// A Ora-pro-nóbis vai para o centro da mesa escura, maior, com raios girando atrás e o letreiro
// no alto; depois volta para o lugar e a rodada segue com a comparação de sempre.
async function entradaSuperTrunfo(lado) {
  const g = geracao;
  const item = mesa.emJogo[lado];
  const t = el.tabuleiro.getBoundingClientRect();
  const largura = larguraCarta();
  const altura = largura * PROPORCAO;
  // no celular em pé, o letreiro fica mais baixo (embaixo do rival): a carta desce um pouco
  const emPe = !ladoALado();
  const escala = Math.min(1.25, (t.height * (emPe ? 0.62 : 0.7)) / altura);
  const cx = t.width / 2;
  const cy = t.height * (emPe ? 0.62 : 0.57);
  const centro = { x: cx - largura / 2, y: cy - altura / 2, s: escala, rot: 0 };
  const lugar = posicaoEmJogo(lado);

  el.stFundo.style.setProperty('--cx', `${cx}px`);
  el.stFundo.style.setProperty('--cy', `${cy}px`);
  el.stFundo.style.setProperty('--tam', `${altura * escala * 1.9}px`);
  el.tabuleiro.classList.add('st-ativo');
  el.stFundo.hidden = false;
  el.stLetreiro.hidden = false;
  reanimar(el.stLetreiro, 'entrando');
  item.el.classList.add('em-destaque', 'holo');
  await voar(item.el, lugar, centro, { duracao: TEMPO.stEntrar });
  if (g !== geracao) return;
  await pausa(TEMPO.superTrunfo);
  if (g !== geracao) return;

  el.stFundo.classList.add('saindo');
  el.stLetreiro.hidden = true;
  await voar(item.el, centro, lugar, { duracao: TEMPO.stEntrar });
  if (g !== geracao) return;
  item.el.classList.remove('em-destaque', 'holo');
  el.stFundo.hidden = true;
  el.stFundo.classList.remove('saindo');
  el.tabuleiro.classList.remove('st-ativo');
}

// Texto curto embaixo do painel: o que não aparece nos números.
function detalheRodada(r) {
  const partes = [];
  if (r.escolheu === COMPUTADOR) partes.push(`${rival().nome} escolheu ${nomeAtributo(r.atributo)}.`);
  const daCesta = r.cartasGanhas.length - 2;
  if (daCesta > 0) partes.push(`${r.vencedor === JOGADOR ? 'Você' : rival().nome} levou também ${plural(daCesta, 'carta')} da cesta!`);
  if (r.vencedor === EMPATE) partes.push('As cartas vão para a cesta.');
  return partes.join(' ');
}

function descreverRodada(r) {
  const partes = [];
  if (r.escolheu === COMPUTADOR) partes.push(`${rival().nome} escolheu ${nomeAtributo(r.atributo)}.`);

  if (r.motivo === 'superTrunfo') {
    const st = r.cartaJogador.superTrunfo ? r.cartaJogador : r.cartaComputador;
    partes.push(`Super Trunfo! A ${st.nome} vence qualquer hortaliça comum.`);
  } else {
    partes.push(`${nomeAtributo(r.atributo)}: ${r.cartaJogador.nome} ${valorComUnidade(r.cartaJogador, r.atributo)} × ` +
      `${valorComUnidade(r.cartaComputador, r.atributo)} ${r.cartaComputador.nome}.`);
  }

  const doMonte = r.cartasGanhas.length - 2;
  if (doMonte > 0) partes.push(`Levou também ${plural(doMonte, 'carta')} da cesta.`);
  return partes.join(' ');
}

function registrarEstatisticas(r) {
  if (r.vencedor === EMPATE) { estatisticas.empatadas++; return; }
  if (r.vencedor === JOGADOR) {
    estatisticas.vencidas++;
    if (r.motivo === 'superTrunfo') estatisticas.superTrunfo++;
    // Maior pancada: a maior diferença numa rodada que o jogador venceu pelo atributo
    const diferenca = Math.round((r.cartaJogador.valores[r.atributo] - r.cartaComputador.valores[r.atributo]) * 100) / 100;
    if (r.motivo === 'atributo' && diferenca > (estatisticas.pancada?.diferenca ?? 0)) {
      estatisticas.pancada = { diferenca, atributo: r.atributo };
    }
  } else {
    estatisticas.perdidas++;
  }
  const carta = r.vencedor === JOGADOR ? r.cartaJogador : r.cartaComputador;
  const chave = `${r.vencedor}:${carta.id}`;
  const atual = estatisticas.vitoriasPorCarta.get(chave) || { lado: r.vencedor, carta, vitorias: 0 };
  atual.vitorias++;
  estatisticas.vitoriasPorCarta.set(chave, atual);
}

// Craque da partida: a carta que mais venceu rodadas para o jogador (null se ele não venceu nenhuma).
function cartaDestaque() {
  return [...estatisticas.vitoriasPorCarta.values()]
    .filter(x => x.lado === JOGADOR)
    .sort((a, b) => b.vitorias - a.vitorias)[0] || null;
}

// ---------- Carta ampliada (celular) ----------

// Sem mouse (ou tela estreita) não há zoom ao passar o mouse: aí o toque amplia a carta.
const modoToque = () => !window.matchMedia('(hover: hover) and (min-width: 701px)').matches;

// Escolha feita num atributo da carta ampliada.
function escolherNoZoom(chave, evento) {
  evento.stopPropagation();
  if (!el.zoomCarta.classList.contains('escolhendo')) return;
  fecharZoom(true);
  escolherJogador(chave);
}

function montarZoom() {
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

  montarFrente(el.zoomCarta, item.carta, escolherNoZoom);
  el.zoomCarta.classList.toggle('escolhendo', podeEscolher);
  // o resultado da rodada (vitória, derrota, empate) também aparece na carta ampliada
  for (const classe of ['vitoria', 'derrota', 'empate']) el.zoomCarta.classList.toggle(classe, item.el.classList.contains(classe));
  el.zoomCarta.querySelectorAll('.faixa').forEach(f => {
    f.disabled = !podeEscolher;
    f.classList.toggle('escolhida', item.el.querySelector(`.faixa[data-chave="${f.dataset.chave}"]`).classList.contains('escolhida'));
  });
  el.zoomDica.textContent = podeEscolher
    ? 'Toque em um atributo para escolher'
    : `${item.carta.nome} · ${item.carta.esporte}`;

  // Enquanto o jogador lê a carta, o avanço automático espera
  const retomarAuto = !el.continuar.hidden && autoAguardando;
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

// Avança sozinho: espera o rival reagir e terminar de falar, depois conta TEMPO.autoAvancar.
async function iniciarAvancoAutomatico() {
  pararAvancoAutomatico();
  const ciclo = cicloAuto;
  autoAguardando = true;
  await reacaoDoRival;
  await Sons.esperarVoz();
  if (ciclo !== cicloAuto) return;
  el.continuar.style.setProperty('--duracao-auto', `${TEMPO.autoAvancar}ms`);
  reanimar(el.continuar, 'contando');
  timerAuto = setTimeout(continuar, TEMPO.autoAvancar);
}

function pararAvancoAutomatico() {
  cicloAuto++;
  autoAguardando = false;
  clearTimeout(timerAuto);
  el.continuar.classList.remove('contando');
}

// Leva as cartas da rodada para a pilha do vencedor (com o monte de empate, se houver)
// ou, no empate, para o monte do centro.
async function recolherCartas(r) {
  const g = geracao;
  const naMesa = [JOGADOR, COMPUTADOR].map(lado => mesa.emJogo[lado]);
  const origens = [JOGADOR, COMPUTADOR].map(posicaoEmJogo);
  mesa.emJogo = { [JOGADOR]: null, [COMPUTADOR]: null };
  for (const item of naMesa) {
    item.el.classList.remove('na-mesa', 'escolhendo', 'vitoria', 'derrota', 'empate', 'super-trunfo');
    item.el.querySelectorAll('.faixa').forEach(f => f.classList.remove('escolhida'));
  }

  if (r.vencedor === EMPATE) {
    Sons.tocar('virar');
    setTimeout(() => Sons.tocar('cesta'), TEMPO.recolher * 0.85);
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
      return voar(item.el, origens[i], posicaoEm(el.empate, lugar), {
        virarPara: 'verso', duracao: TEMPO.recolher, atraso: i * TEMPO.intervalo,
      }).then(() => { if (g === geracao) desenharMonte(true); });
    }));
    return;
  }

  // Ordem igual à do motor: carta do vencedor, carta do perdedor, depois o monte de empate
  const porCarta = new Map([...naMesa, ...mesa.noMonte].map(item => [item.carta, item]));
  const deOnde = item => mesa.noMonte.includes(item)
    ? posicaoEm(el.empate, item)
    : origens[item === naMesa[0] ? 0 : 1];
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
  if (!estado || el.continuar.hidden || resolvendo) return;
  const g = geracao;
  fecharZoom(false);
  pararAvancoAutomatico();
  esconderRevelacao();
  esconderBalao();
  pararTransmissao();
  Sons.pararVoz();

  await recolherCartas(ultimaRodada);
  if (g !== geracao) return;
  atualizarPlacar(true);
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
  el.fimConfig.textContent = plural(r.rodada, 'rodada');
  el.fimTitulo.textContent = { [JOGADOR]: 'Vitória!', [COMPUTADOR]: 'Quase lá!', [EMPATE]: 'Empate!' }[r.campeao];

  let texto;
  if (r.motivoFim === 'limiteRodadas') {
    texto = r.campeao === EMPATE
      ? `Depois de ${r.rodada} rodadas, vocês terminaram com a mesma quantidade de cartas.`
      : `Depois de ${r.rodada} rodadas, ${r.campeao === JOGADOR ? 'você terminou' : `${rival().nome} terminou`} com mais cartas.`;
    if (noMonte > 0) texto += ` ${plural(noMonte, 'carta')} ${noMonte === 1 ? 'ficou' : 'ficaram'} na cesta do empate e não ${noMonte === 1 ? 'conta' : 'contam'}.`;
  } else if (r.campeao === EMPATE) {
    texto = 'As últimas cartas dos dois empataram e ninguém ficou com cartas na mão.';
  } else {
    texto = r.campeao === JOGADOR
      ? `Você ficou com todas as cartas em ${r.rodada} rodadas.`
      : `${rival().nome} ficou com todas as cartas em ${r.rodada} rodadas.`;
  }
  el.fimTexto.textContent = texto;

  $('fim-qtd-jogador').textContent = meu;
  $('fim-qtd-computador').textContent = dele;
  $('fim-nome-rival').textContent = rival().nome;
  $('fim-vencidas').textContent = estatisticas.vencidas;
  $('fim-perdidas').textContent = estatisticas.perdidas;
  $('fim-empatadas').textContent = estatisticas.empatadas;
  $('fim-super-trunfo').textContent = `${estatisticas.superTrunfo}×`;
  const { pancada } = estatisticas;
  const atributoPancada = pancada && ATRIBUTOS.find(a => a.chave === pancada.atributo);
  $('fim-pancada').textContent = pancada
    ? `${formatar(pancada.diferenca)} ${unidadeCurta(atributoPancada)} ${DE_QUE[pancada.atributo]}`
    : '—';

  const vozRival = montarPodio(r.campeao);
  colarNoAlbum();
  // narrador, Tião e rival, um depois do outro
  const evento = { [JOGADOR]: 'fim_vitoria', [COMPUTADOR]: 'fim_derrota', [EMPATE]: 'fim_empate' }[r.campeao];
  const fala = falaDoEvento(NARRADOR, evento, null, falasUsadas);
  const comentario = falaDoEvento(COMENTARISTA, evento, null, falasUsadas);
  $('fim-narrador-texto').textContent = fala.texto;
  $('fim-comentarista-texto').textContent = comentario.texto;
  Sons.falar([audioDaFala(NARRADOR, fala), audioDaFala(COMENTARISTA, comentario), vozRival].filter(Boolean),
    { respiro: TEMPO.respiro });
  Sons.tocar({ [JOGADOR]: 'fimVitoria', [COMPUTADOR]: 'fimDerrota', [EMPATE]: 'fimEmpate' }[r.campeao]);
  mostrarTela('fim');
  $('botao-de-novo').focus({ preventScroll: true }); // a tela começa do alto, com o resultado
}

// Pódio: o vencedor no degrau mais alto (no empate, os dois na mesma altura).
// Do lado do jogador, a carta craque da partida com o mascote; do outro, o rival com uma fala
// (devolve o áudio da fala, ou null se ele não falar).
function montarPodio(campeao) {
  const palco = $('palco');
  const postos = { [JOGADOR]: $('posto-jogador'), [COMPUTADOR]: $('posto-rival') };
  const nomes = { [JOGADOR]: nomeJogador || 'Você', [COMPUTADOR]: rival().nome };
  palco.classList.toggle('empatados', campeao === EMPATE);
  for (const lado of [JOGADOR, COMPUTADOR]) {
    const primeiro = campeao === EMPATE || campeao === lado;
    postos[lado].classList.toggle('primeiro', campeao === lado);
    postos[lado].classList.toggle('segundo', campeao !== EMPATE && campeao !== lado);
    const degrau = postos[lado].querySelector('.degrau');
    degrau.innerHTML = '<span class="degrau-num"></span><span class="degrau-nome"></span>';
    degrau.querySelector('.degrau-num').textContent = primeiro ? '1º' : '2º';
    degrau.querySelector('.degrau-nome').textContent = nomes[lado];
  }

  const destaque = cartaDestaque();
  $('fim-destaque').hidden = !destaque;
  if (destaque) {
    const { carta, vitorias } = destaque;
    $('fim-destaque-carta').innerHTML = '<div class="face face-frente"></div>';
    montarFrente($('fim-destaque-carta').firstChild, carta);
    $('fim-destaque-rotulo').textContent = '⭐ Craque da partida';
    $('fim-destaque-texto').textContent = `${carta.nome}, ${carta.esporte}: venceu ${plural(vitorias, 'rodada')}`;
    const mascote = $('fim-destaque-mascote');
    mascote.hidden = false;
    mascote.onerror = () => { mascote.hidden = true; }; // mascote ainda não gerado: fica só a carta
    mascote.src = carta.mascote;
  }

  // O rival comemora se venceu e fica frustrado se perdeu; no empate, fica sem fala.
  const expressao = { [JOGADOR]: 'frustrado', [COMPUTADOR]: 'comemorando', [EMPATE]: 'neutro' }[campeao];
  $('fim-retrato').src = imagemRival(rival().id, expressao);
  $('fim-retrato').alt = rival().nome;
  const balao = $('fim-balao');
  balao.hidden = campeao === EMPATE;
  if (campeao === EMPATE) return null;
  const situacao = situacaoDoRival(estado.maos[COMPUTADOR].length, estado.maos[JOGADOR].length);
  const fala = falaDoRival(rival().id, expressao, situacao, falasUsadas);
  balao.textContent = fala.texto;
  return audioDaFala(FALAS, fala); // a voz do rival, depois do narrador e do Tião
}

// ---------- Álbum de figurinhas ----------

// No fim da partida, cola as figurinhas das cartas com que o jogador venceu rodadas e avisa das novas.
function colarNoAlbum() {
  const vencedoras = [...estatisticas.vitoriasPorCarta.values()].filter(x => x.lado === JOGADOR).map(x => x.carta.id);
  const novas = colarFigurinhas(album, vencedoras).map(id => CARTAS.find(c => c.id === id));
  salvarAlbum(armazenamento, album);
  const aviso = $('fim-figurinha');
  aviso.hidden = novas.length === 0;
  if (!novas.length) return;
  $('fim-figurinha-img').src = novas[0].imagem;
  const nomes = novas.map(c => c.nome);
  const lista = nomes.length === 1 ? nomes[0]
    : nomes.length <= 3 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
    : `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`; // muitas novas: o álbum mostra todas
  $('fim-figurinha-texto').textContent =
    `${lista} ${novas.length === 1 ? 'entrou' : 'entraram'} no seu álbum · ${album.size}/${CARTAS.length}`;
  aviso.querySelector('b').textContent = novas.length === 1 ? 'Figurinha nova!' : `${novas.length} figurinhas novas!`;
}

function abrirAlbum() {
  const lista = $('album-lista');
  lista.innerHTML = '';
  for (const carta of CARTAS) {
    const colada = album.has(carta.id);
    const item = document.createElement('li');
    item.className = 'figurinha' + (colada ? ' colada' : '') + (carta.tipo === 'panc' ? ' panc' : '');
    item.innerHTML = `<span class="figurinha-num">${String(carta.id).padStart(2, '0')}</span>
      <img alt="" src="${colada ? carta.imagem : VERSO}"><span class="figurinha-texto"><b></b><small></small><span></span></span>`;
    const texto = item.querySelector('.figurinha-texto');
    if (colada) {
      texto.querySelector('b').textContent = carta.nome;
      texto.querySelector('small').textContent = `${carta.tipo === 'panc' ? 'PANC' : 'Hortaliça'} · ${carta.esporte}`;
      texto.querySelector('span').textContent = CURIOSIDADES[carta.id];
    } else {
      texto.querySelector('b').textContent = '???';
      texto.querySelector('small').textContent = carta.tipo === 'panc' ? 'PANC' : 'Hortaliça';
      texto.querySelector('span').textContent = 'Ainda não colada.';
      item.setAttribute('aria-label', `Figurinha ${carta.id}: ainda não colada`);
    }
    lista.appendChild(item);
  }
  $('album-total').textContent = `${album.size}/${CARTAS.length}`;
  mostrarTela('album');
  $('botao-voltar-album').focus({ preventScroll: true });
}

// ---------- Tela inicial: leque de cartas ----------

const CARTAS_DO_LEQUE = [19, 57, 47, 21]; // número do arquivo da imagem (img/cartas/<n>.webp)

function montarLeque() {
  const leque = $('leque');
  for (const arquivo of CARTAS_DO_LEQUE) {
    const carta = CARTAS.find(c => c.imagem.endsWith(`/${arquivo}.webp`));
    const item = document.createElement('div');
    item.className = 'carta-leque';
    item.innerHTML = '<div class="face face-frente"></div>';
    montarFrente(item.firstChild, carta);
    leque.appendChild(item);
  }
}

function trocarRival() {
  mostrarTela('inicio');
  document.querySelector('input[name="dificuldade"]:checked').focus();
}

// ---------- Sair da partida (pede confirmação com um segundo toque) ----------

function sair() {
  if (!el.sair.classList.contains('confirmar')) {
    el.sair.classList.add('confirmar');
    el.sair.setAttribute('aria-label', 'Toque de novo para sair da partida');
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
  el.sair.setAttribute('aria-label', 'Sair da partida');
}

// ---------- Som e avanço automático ----------

function atualizarControles() {
  el.som.setAttribute('aria-pressed', String(config.som));
  el.som.title = config.som ? 'Efeitos ligados' : 'Efeitos desligados';
  el.voz.setAttribute('aria-pressed', String(config.voz));
  el.voz.title = config.voz ? 'Vozes ligadas' : 'Vozes desligadas';
  el.auto.setAttribute('aria-pressed', String(config.auto));
  el.auto.title = config.auto ? 'Avançar sozinho: sim' : 'Avançar sozinho: não';
  Sons.ligado = config.som;
  Sons.vozLigada = config.voz;
}

function alternarSom() {
  config.som = !config.som;
  atualizarControles();
  salvarPreferencias();
  Sons.tocar('clique');
}

function alternarVoz() {
  config.voz = !config.voz;
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
  $('placar-nome-jogador').textContent = nome || 'Você';
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
    if (typeof salvas.voz === 'boolean') config.voz = salvas.voz;
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
montarLeque();

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
// Na revelação, um toque em qualquer ponto livre da mesa também avança
el.tabuleiro.addEventListener('click', evento => {
  if (el.revelacao.hidden || el.continuar.hidden || evento.target.closest('.carta, button')) return;
  continuar();
});
el.som.addEventListener('click', alternarSom);
el.voz.addEventListener('click', alternarVoz);
el.auto.addEventListener('click', alternarAuto);
el.sair.addEventListener('click', sair);
$('botao-de-novo').addEventListener('click', iniciarPartida);
$('botao-trocar-rival').addEventListener('click', trocarRival);
$('botao-album').addEventListener('click', abrirAlbum);
$('botao-voltar-album').addEventListener('click', () => {
  mostrarTela('inicio');
  $('botao-album').focus();
});
$('botao-menu').addEventListener('click', () => mostrarTela('inicio'));

let timerRedimensionar = null;
window.addEventListener('resize', () => {
  clearTimeout(timerRedimensionar);
  timerRedimensionar = setTimeout(() => {
    reposicionarMesa();
    if (!el.revelacao.hidden) posicionarRevelacao();
  }, 80);
});
