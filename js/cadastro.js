// Cadastro opcional do jogador (nome e e-mail).
// - O nome fica guardado neste aparelho, para aparecer na mesa no lugar de "Você".
// - Com o consentimento marcado, nome e e-mail são enviados para uma Planilha Google,
//   por meio do script em ferramentas/planilha-cadastros.gs (passo a passo no README).

// Endereço do "App da Web" do Google Apps Script. Enquanto estiver vazio, nada é enviado.
const URL_PLANILHA = 'https://script.google.com/macros/s/AKfycbxDWNgtiwahfueAVSS1i1IrnVLUFQswzjSJ6domGdNSK54YlAROBggJbRzR_ipAIyoa/exec';

const Cadastro = (() => {
  const CHAVE = 'superpancs-jogador';
  const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Jogador salvo neste aparelho: { nome } ou null (nunca se cadastrou).
  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE));
      return salvo && typeof salvo.nome === 'string' ? salvo : null;
    } catch (e) {
      return null;
    }
  }

  // Guarda só o nome (o e-mail não fica no aparelho), para preencher o cadastro na próxima vez.
  function salvar(nome) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ nome })); } catch (e) { /* sem armazenamento */ }
  }

  // Confere os campos. Devolve uma mensagem de erro ou null.
  function validar({ nome, email, consentimento }) {
    if (email && !EMAIL_VALIDO.test(email)) return 'Confira o e-mail: parece incompleto.';
    if (email && !consentimento) return 'Para guardarmos seu e-mail, marque a autorização. Se preferir, apague o e-mail.';
    if (nome.length > 30) return 'Use um nome com até 30 letras.';
    return null;
  }

  // Envia para a planilha, sem travar o jogo se a internet falhar.
  // "text/plain" evita a checagem prévia (CORS) que o Apps Script não responde.
  function enviar({ nome, email, consentimento }) {
    if (!URL_PLANILHA || !consentimento || (!nome && !email)) return Promise.resolve(false);
    return fetch(URL_PLANILHA, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ nome, email, consentimento: true, origem: origem() }),
    }).then(() => true).catch(() => false);
  }

  // De onde veio o cadastro (site publicado ou arquivo aberto no computador), sem expor caminhos locais.
  function origem() {
    return location.protocol === 'file:' ? 'arquivo local' : location.origin + location.pathname;
  }

  return { carregar, salvar, validar, enviar };
})();
