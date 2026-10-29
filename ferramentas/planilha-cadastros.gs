/**
 * @OnlyCurrentDoc
 */
// A anotação acima limita o script à planilha em que ele está instalado:
// o Google passa a pedir acesso só a ela, e não a todas as suas planilhas.

// Recebe os cadastros do SuperPANCs e grava numa aba da Planilha Google.
// Também guarda o álbum de figurinhas de cada e-mail (aba Álbuns), para valer em qualquer aparelho.
// Como instalar: veja a seção "Cadastros na Planilha Google" do README.md.

const ABA = 'Cadastros';
const CABECALHO = ['Data', 'Nome', 'E-mail', 'Consentimento', 'Origem'];
const ABA_ALBUNS = 'Álbuns';
const CABECALHO_ALBUNS = ['E-mail', 'Figurinhas', 'Atualizado em'];
const TOTAL_CARTAS = 32;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET ?acao=album&email=...: devolve as figurinhas coladas daquele e-mail, em JSON ({ ids: [...] }).
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.acao !== 'album') return resposta('ok');
  const email = normalizar(p.email);
  if (!EMAIL_VALIDO.test(email)) return json({ ids: [] });
  const linha = linhaDoAlbum(abaAlbuns(), email);
  return json({ ids: linha ? lerIds(linha.ids) : [] });
}

function doPost(e) {
  const trava = LockService.getScriptLock();
  trava.waitLock(10000); // evita que dois envios ao mesmo tempo se atropelem
  try {
    const dados = JSON.parse(e.postData.contents);
    if (dados.acao === 'album') return guardarAlbum(dados);
    const nome = limpar(dados.nome, 30);
    const email = limpar(dados.email, 120);
    if (dados.consentimento !== true || (!nome && !email)) return resposta('ignorado');
    if (email && !EMAIL_VALIDO.test(email)) return resposta('email invalido');

    const planilha = SpreadsheetApp.getActiveSpreadsheet();
    const aba = planilha.getSheetByName(ABA) || planilha.insertSheet(ABA);
    if (aba.getLastRow() === 0) aba.appendRow(CABECALHO);
    aba.appendRow([new Date(), nome, email, 'sim', limpar(dados.origem, 200)]);
    return resposta('ok');
  } catch (erro) {
    return resposta('erro');
  } finally {
    trava.releaseLock();
  }
}

// Junta as figurinhas recebidas com as que o e-mail já tinha (nunca tira nenhuma).
function guardarAlbum(dados) {
  const email = normalizar(dados.email);
  if (dados.consentimento !== true || !EMAIL_VALIDO.test(email)) return resposta('ignorado');
  const aba = abaAlbuns();
  const linha = linhaDoAlbum(aba, email);
  const ids = lerIds([...(linha ? lerIds(linha.ids) : []), ...(Array.isArray(dados.ids) ? dados.ids : [])].join(','));
  const valores = [[limpar(email, 120), ids.join(','), new Date()]];
  if (linha) aba.getRange(linha.numero, 1, 1, 3).setValues(valores);
  else aba.appendRow(valores[0]);
  return resposta('ok');
}

function abaAlbuns() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName(ABA_ALBUNS) || planilha.insertSheet(ABA_ALBUNS);
  if (aba.getLastRow() === 0) aba.appendRow(CABECALHO_ALBUNS);
  aba.getRange('B:B').setNumberFormat('@'); // "1,5,24" fica como texto, não vira número
  return aba;
}

// Linha do e-mail na aba Álbuns: { numero, ids } ou null.
function linhaDoAlbum(aba, email) {
  const valores = aba.getRange(1, 1, aba.getLastRow(), 2).getValues();
  for (let i = 1; i < valores.length; i++) {
    if (normalizar(valores[i][0]) === email) return { numero: i + 1, ids: String(valores[i][1]) };
  }
  return null;
}

// "1,5,24" → [1, 5, 24]: só ids de cartas que existem, sem repetir, em ordem.
function lerIds(texto) {
  const ids = String(texto).split(',').map(Number).filter(id => Number.isInteger(id) && id >= 1 && id <= TOTAL_CARTAS);
  return [...new Set(ids)].sort((a, b) => a - b);
}

const normalizar = email => String(email || '').trim().toLowerCase().replace(/^'/, '');

// Corta o tamanho e impede que um texto começando com = + - @ vire fórmula na planilha.
function limpar(texto, maximo) {
  const t = String(texto || '').trim().slice(0, maximo);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function resposta(texto) {
  return ContentService.createTextOutput(texto);
}

function json(dados) {
  return ContentService.createTextOutput(JSON.stringify(dados)).setMimeType(ContentService.MimeType.JSON);
}
