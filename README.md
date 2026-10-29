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

- As cartas são embaralhadas e divididas: 16 para você, 16 para o rival. Você sempre escolhe o atributo na primeira rodada.
- Quem tem a vez escolhe um atributo da sua carta. **Vence o maior valor**, e o vencedor leva as duas cartas e escolhe na rodada seguinte.
- **Super Trunfo:** a **Ora-pro-nóbis** vence qualquer hortaliça comum. Contra outra PANC, vale o atributo escolhido.
- **Empate:** as duas cartas vão para o monte de empate. Quem tinha a vez escolhe de novo, e o vencedor da próxima rodada leva o monte junto.
- As estrelas das cartas são apenas ilustrativas: a comparação usa sempre o número.

### Modos de jogo

- **Rápido** (padrão): 20 rodadas. Vence quem tiver mais cartas na mão no final. Cartas no monte de empate não contam, e quantidades iguais empatam a partida. Dura cerca de 5 a 6 minutos.
- **Clássico:** joga até alguém ficar com todas as cartas. Pode passar de 20 minutos.

Em qualquer modo, quem fica sem cartas perde.

### Rival (dificuldade)

A dificuldade é escolhida pelo rival, na tela inicial:

- **Seu Zé (Fácil):** feirante malandro, escolhe atributos ao acaso.
- **Dona Cida (Difícil):** feirante veterana, escolhe o atributo com maior chance de vencer as outras cartas do baralho.

### A mesa

A partida acontece numa banca de feira: lona listrada no alto, placar de TV, mesa de feltro. No computador, você fica à esquerda e o rival à direita, com a **cesta do empate** no meio; no celular em pé, o rival fica em cima e você embaixo. Na sua vez, a sua carta dá um salto e os atributos pulsam; na vez do rival, o rosto dele muda e ele "pensa". Depois da revelação, o painel no centro compara os dois valores, o mascote da carta vencedora aparece e o rival reage com uma fala. No Super Trunfo, a Ora-pro-nóbis faz uma entrada especial no centro da mesa. No computador, você clica direto no atributo da sua carta, e passar o mouse sobre uma carta aberta a amplia. No celular, um toque numa carta aberta a amplia no centro da tela; quando é a sua vez, você escolhe o atributo na carta ampliada.

Um **narrador** comenta cada rodada numa faixa "ao vivo", e o rival responde (com voz e texto). Durante a partida dá para ligar/desligar os **efeitos sonoros**, as **vozes** e o **avanço automático** das rodadas. O jogo lembra essas escolhas, o modo e o rival no navegador.

### Fim da partida e álbum

No fim, o pódio mostra quem ganhou, a sua carta **craque da partida** (a que mais venceu rodadas) e a súmula: rodadas vencidas, perdidas, empates, vitórias com o Super Trunfo e a maior diferença com que você venceu uma rodada.

Cada carta com que você vence uma rodada vira uma **figurinha** no **álbum** (botão na tela inicial), com uma curiosidade sobre a planta. O álbum fica guardado no navegador.

### Cadastro (opcional)

Ao abrir o jogo, aparece o cadastro com nome e e-mail. Tudo é opcional (botão **Pular**). O nome aparece na mesa no lugar de "Você" e fica lembrado no aparelho para preencher o cadastro da próxima vez. Ao tocar em **Continuar**, nome e e-mail são enviados na hora para a Planilha Google se a pessoa marcar a autorização (LGPD); o e-mail nunca fica guardado no aparelho.

## Rodar no computador

Abra o arquivo `index.html` no navegador (dois cliques). Não precisa de servidor nem de internet — sem internet, só as fontes mudam para as do sistema.

## Estrutura

```
index.html                  telas do jogo (cadastro, início, mesa, fim, álbum)
css/style.css               visual de feira, layouts (computador, celular em pé e deitado) e efeitos
js/cartas.js                dados das 32 cartas e dos 4 atributos
js/jogo.js                  motor: regras, rodadas, empate, Super Trunfo, fim de partida (sem tela)
js/ia.js                    escolha de atributo do rival (fácil / difícil)
js/falas-dados.js           falas dos rivais, do narrador e do Tião (GERADO a partir de falas/*.json)
js/falas.js                 escolha das falas: situação do placar, evento da rodada, sem repetir
js/album.js                 álbum de figurinhas: curiosidades e o que já foi colado
js/cadastro.js              cadastro opcional (nome/e-mail) e envio para a Planilha Google
js/sons.js                  efeitos sonoros (Web Audio, sem arquivos) e a fila de vozes (arquivos .mp3)
js/ui.js                    liga o motor à tela: mesa, movimento das cartas, rival, narrador, pódio
falas/                      textos das falas (JSON), roteiro de gravação e instruções (LEIAME.md)
audio/                      vozes: audio/falas/<rival>/, audio/narrador/ e audio/comentarista/ (as gravações; fala sem arquivo fica em silêncio)
img/cartas/                 imagens otimizadas (WebP) usadas pelo jogo
img/cartas-limpas/          cartas sem texto (WebP): na mesa, nome e atributos são escritos por cima
img/mascotes/               mascotes animados das cartas (WebP com fundo transparente)
img/rivais/                 rostos do Seu Zé e da Dona Cida (4 expressões cada)
imagens-cartas-superpancs/  imagens originais (JPG) — também usadas se o navegador não abrir WebP
testes/                     testes automáticos do motor, da IA, das falas e do álbum
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

Os testes cobrem as regras (comparação, Super Trunfo, empates, monte, fim nos dois modos), a IA e simulam milhares de partidas completas para garantir que nenhuma carta se perde e que toda partida termina. Também conferem as falas (se `js/falas-dados.js` está igual aos JSONs, se todo áudio existe e as regras do narrador) e o álbum.

## Ferramentas

| Comando | Para que serve |
|---|---|
| abrir `ferramentas/conferencia.html` no navegador | Mostra cada carta ao lado dos dados de `js/cartas.js`, para conferir a digitação |
| `node ferramentas/simular-tempo.js` | Simula 20 mil partidas e estima quanto tempo cada uma dura |
| `bash ferramentas/otimizar-imagens.sh` | Gera de novo as imagens WebP a partir dos JPGs originais (requer ImageMagick 7) |
| `python3 ferramentas/gerar-roteiro.py` | Depois de mudar uma fala em `falas/*.json`: gera `js/falas-dados.js` e o roteiro de gravação |
| `python3 ferramentas/importar-gravacoes.py` | Leva as gravações de `gravacoes/<personagem>/` para `audio/` (corta o silêncio das pontas, iguala o volume, MP3 mono) e avisa nomes errados, falas longas e o que falta. Só refaz o que mudou (requer ffmpeg) |
| `python3 ferramentas/gerar-pdf-roteiro.py` | Gera `falas/roteiro-gravacao.pdf`, o roteiro para imprimir, com caixinhas para marcar o que já foi gravado (requer Google Chrome) |
| `python3 ferramentas/animar-cartas.py` | Gera os mascotes animados (GIFs e os WebP transparentes do jogo) |

## Como alterar

- **Dados de uma carta:** edite a linha dela em `js/cartas.js` e rode os testes.
- **Imagem de uma carta:** substitua o JPG em `imagens-cartas-superpancs/` (mesmo nome) e rode `bash ferramentas/otimizar-imagens.sh`.
- **Número de rodadas do modo Rápido:** `limiteRodadas` em `MODOS`, no início de `js/jogo.js`.
- **Tempos (rival pensando, movimento das cartas, avanço automático, faixa do narrador):** objeto `TEMPO` no início de `js/ui.js`. Se mudar, ajuste também os tempos em `ferramentas/simular-tempo.js` para a estimativa continuar certa. O avanço automático espera a voz do narrador e do rival terminar; `respiro` é a pausa entre uma fala e o que vem depois.
- **Uma fala do rival, do narrador ou do Tião:** veja `falas/LEIAME.md`. Edite o JSON e rode `python3 ferramentas/gerar-roteiro.py`.
- **Colocar as gravações:** arquivos com os mesmos nomes do roteiro em `gravacoes/<personagem>/`, depois `python3 ferramentas/importar-gravacoes.py` (detalhes em `falas/LEIAME.md`). Não precisa mexer no código.
- **Curiosidade de uma figurinha:** `CURIOSIDADES` em `js/album.js`.

## Publicar no GitHub Pages

1. Envie todos os arquivos do projeto para um repositório no GitHub (branch `main`).
2. No repositório, vá em **Settings → Pages**.
3. Em **Build and deployment**, escolha **Source: Deploy from a branch**, depois **Branch: `main`** e pasta **`/ (root)`**, e clique em **Save**.
4. Em um ou dois minutos o endereço aparece no topo da mesma página, no formato `https://<seu-usuario>.github.io/<nome-do-repositorio>/`.

A cada novo envio para a branch `main`, o site é atualizado sozinho.
