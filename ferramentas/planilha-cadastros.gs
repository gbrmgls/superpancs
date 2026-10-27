/**
 * @OnlyCurrentDoc
 */
// A anotação acima limita o script à planilha em que ele está instalado:
// o Google passa a pedir acesso só a ela, e não a todas as suas planilhas.

// Recebe os cadastros do SuperPANCs e grava numa aba da Planilha Google.
// Como instalar: veja a seção "Cadastros na Planilha Google" do README.md.

const ABA = 'Cadastros';
const CABECALHO = ['Data', 'Nome', 'E-mail', 'Consentimento', 'Origem'];

function doPost(e) {
  const trava = LockService.getScriptLock();
  trava.waitLock(10000); // evita que dois envios ao mesmo tempo se atropelem
  try {
    const dados = JSON.parse(e.postData.contents);
    const nome = limpar(dados.nome, 30);
    const email = limpar(dados.email, 120);
    if (dados.consentimento !== true || (!nome && !email)) return resposta('ignorado');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta('email invalido');

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

// Corta o tamanho e impede que um texto começando com = + - @ vire fórmula na planilha.
function limpar(texto, maximo) {
  const t = String(texto || '').trim().slice(0, maximo);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function resposta(texto) {
  return ContentService.createTextOutput(texto);
}
