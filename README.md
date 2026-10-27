# SuperPANCs

Jogo de cartas no estilo Super Trunfo sobre **PANCs, nutrição e esporte**, do projeto **+Rio em Movimento**. Roda direto no navegador (HTML, CSS e JavaScript puros, sem instalação nem servidor).

## Como jogar

São 32 cartas: 16 hortaliças comuns e 16 PANCs (plantas alimentícias não convencionais). Cada carta tem quatro atributos:

| Atributo | Unidade |
|---|---|
| Proteína | g/100g |
| Carboidrato | g/100g |
| Fibras | g/100g |
| Calorias gastas (no esporte da carta) | kcal/h |

- As cartas são embaralhadas e divididas: 16 para você, 16 para o computador. Você sempre escolhe o atributo na primeira rodada.
- Quem tem a vez escolhe um atributo da sua carta. **Vence o maior valor**, e o vencedor leva as duas cartas e escolhe na rodada seguinte.
- **Super Trunfo:** a **Ora-pro-nóbis** vence qualquer hortaliça comum. Contra outra PANC, vale o atributo escolhido.
- **Empate:** as duas cartas vão para o monte de empate. Quem tinha a vez escolhe de novo, e o vencedor da próxima rodada leva o monte junto.
- As estrelas das cartas são apenas ilustrativas: a comparação usa sempre o número.

### Modos de jogo

- **Rápido** (padrão): 20 rodadas. Vence quem tiver mais cartas na mão no final. Cartas no monte de empate não contam, e quantidades iguais empatam a partida. Dura cerca de 2 a 3 minutos.
- **Clássico:** joga até alguém ficar com todas as cartas. Pode passar de 20 minutos.

Em qualquer modo, quem fica sem cartas perde.

### Dificuldade

- **Fácil:** o computador escolhe atributos ao acaso.
- **Difícil:** o computador escolhe o atributo com maior chance de vencer as outras cartas do baralho.

### A mesa

O computador fica em cima e você embaixo. Cada um tem a sua **pilha de compras** à direita; o **monte de empate** fica no centro do tabuleiro. A cada rodada, as cartas saem das pilhas para o centro da mesa. Na sua vez, a sua carta dá um salto e os atributos pulsam; na vez do computador, a carta dele balança enquanto ele "pensa". Depois da revelação, um pop-up entre as duas cartas mostra o resultado da rodada; ao continuar, as cartas vão para a pilha de quem venceu (ou para o monte de empate). No computador, você clica direto no atributo da sua carta, e passar o mouse sobre uma carta aberta a amplia. No celular, um toque numa carta aberta a amplia no centro da tela; quando é a sua vez, você escolhe o atributo na carta ampliada.

Durante a partida dá para ligar/desligar o **som** e o **avanço automático** das rodadas. O jogo lembra essas escolhas, o modo e a dificuldade no navegador.

### Cadastro (opcional)

Ao abrir o jogo, aparece o cadastro com nome e e-mail. Tudo é opcional (botão **Pular**). O nome aparece na mesa no lugar de "Você" e fica lembrado no aparelho para preencher o cadastro da próxima vez. Ao tocar em **Continuar**, nome e e-mail são enviados na hora para a Planilha Google se a pessoa marcar a autorização (LGPD); o e-mail nunca fica guardado no aparelho.

## Rodar no computador

Abra o arquivo `index.html` no navegador (dois cliques). Não precisa de servidor nem de internet — sem internet, só a fonte dos títulos muda para uma do sistema.

## Estrutura

```
index.html                  telas do jogo (início, mesa, fim)
css/style.css               visual do tabuleiro, layouts (computador, celular em pé e deitado) e efeitos
js/cartas.js                dados das 32 cartas e dos 4 atributos
js/jogo.js                  motor: regras, rodadas, empate, Super Trunfo, fim de partida (sem tela)
js/ia.js                    escolha de atributo do computador (fácil / difícil)
js/cadastro.js              cadastro opcional (nome/e-mail) e envio para a Planilha Google
js/sons.js                  efeitos sonoros gerados no navegador (Web Audio, sem arquivos)
js/ui.js                    liga o motor à tela: tabuleiro, movimento das cartas, cliques, preferências
img/cartas/                 imagens otimizadas (WebP) usadas pelo jogo
imagens-cartas-superpancs/  imagens originais (JPG) — também usadas se o navegador não abrir WebP
testes/                     testes automáticos do motor e da IA
ferramentas/                utilitários de desenvolvimento (abaixo)
```

## Cadastros na Planilha Google

Os cadastros (com autorização) são gravados numa Planilha Google sua. Para ligar:

1. Crie uma planilha nova em [sheets.google.com](https://sheets.google.com) (ex.: "SuperPANCs – cadastros").
2. Na planilha, abra **Extensões → Apps Script**. Apague o conteúdo do arquivo `Código.gs` e cole o conteúdo de `ferramentas/planilha-cadastros.gs`. Salve.
3. Clique em **Implantar → Nova implantação**. Em "Selecione o tipo", escolha **App da Web**. Configure:
   - **Executar como:** Eu (sua conta)
   - **Quem pode acessar:** Qualquer pessoa
4. Clique em **Implantar**, autorize o acesso quando o Google pedir e copie a **URL do app da Web** (termina em `/exec`).
5. Cole essa URL em `js/cadastro.js`, na linha `const URL_PLANILHA = '';` (entre as aspas), e publique o site de novo.

Os cadastros aparecem na aba **Cadastros**, com data, nome, e-mail e a confirmação do consentimento. Enquanto `URL_PLANILHA` estiver vazia, o jogo funciona normalmente e simplesmente não envia nada.

Observações:
- Se mudar o script depois, use **Implantar → Gerenciar implantações → editar → Nova versão**, para manter a mesma URL.
- O script começa com a anotação `@OnlyCurrentDoc`, que limita o acesso dele só a essa planilha. Ao autorizar, o Google deve pedir permissão para "ver e editar a planilha em que este app está instalado" — e não para todas as suas planilhas.
- A URL do app fica visível no código do site; quem a tiver consegue enviar linhas para a planilha (mas não ler). O script só aceita cadastros com consentimento, limita o tamanho dos campos e impede que um texto vire fórmula. Se aparecer spam, basta criar uma nova implantação e trocar a URL.
- Pela LGPD, quem pedir para sair da lista deve ter a linha apagada da planilha.

## Testes

Precisa do [Node.js](https://nodejs.org/) 18 ou mais recente:

```bash
node --test testes/*.test.js
```

Os testes cobrem as regras (comparação, Super Trunfo, empates, monte, fim nos dois modos), a IA e simulam milhares de partidas completas para garantir que nenhuma carta se perde e que toda partida termina.

## Ferramentas

| Comando | Para que serve |
|---|---|
| abrir `ferramentas/conferencia.html` no navegador | Mostra cada carta ao lado dos dados de `js/cartas.js`, para conferir a digitação |
| `node ferramentas/simular-tempo.js` | Simula 20 mil partidas e estima quanto tempo cada uma dura |
| `bash ferramentas/otimizar-imagens.sh` | Gera de novo as imagens WebP a partir dos JPGs originais (requer ImageMagick 7) |

## Como alterar

- **Dados de uma carta:** edite a linha dela em `js/cartas.js` e rode os testes.
- **Imagem de uma carta:** substitua o JPG em `imagens-cartas-superpancs/` (mesmo nome) e rode `bash ferramentas/otimizar-imagens.sh`.
- **Número de rodadas do modo Rápido:** `limiteRodadas` em `MODOS`, no início de `js/jogo.js`.
- **Tempos (computador pensando, movimento das cartas, avanço automático):** objeto `TEMPO` no início de `js/ui.js`. Se mudar, ajuste também os tempos em `ferramentas/simular-tempo.js` para a estimativa continuar certa.

## Publicar no GitHub Pages

1. Envie todos os arquivos do projeto para um repositório no GitHub (branch `main`).
2. No repositório, vá em **Settings → Pages**.
3. Em **Build and deployment**, escolha **Source: Deploy from a branch**, depois **Branch: `main`** e pasta **`/ (root)`**, e clique em **Save**.
4. Em um ou dois minutos o endereço aparece no topo da mesma página, no formato `https://<seu-usuario>.github.io/<nome-do-repositorio>/`.

A cada novo envio para a branch `main`, o site é atualizado sozinho.
