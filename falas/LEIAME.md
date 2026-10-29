# Falas dos rivais, do narrador e do comentarista

Uma pessoa grava todas as falas. Cada gravação é um arquivo em `audio/`, com o **mesmo nome** do roteiro; não é preciso mexer em código. O jogo não tem voz sintética: fala sem arquivo aparece só em texto, em silêncio.

- `falas.json`: falas dos rivais (fonte única dos textos).
- `narrador.json`: falas do narrador (fonte única dos textos).
- `comentarista.json`: falas do Tião da Xepa, o comentarista (fonte única dos textos).
- `bastidores.json`: textos da faixa de plantão da TV (só texto, sem voz).
- `mvp.json`: quais falas o MVP usa (veja "MVP" abaixo).
- `roteiro-gravacao.md`: tudo formatado para quem vai gravar, com o nome de arquivo de cada fala.
- `roteiro-gravacao.pdf`: o mesmo roteiro para imprimir (`python3 ferramentas/gerar-pdf-roteiro.py`).
- `../js/falas-dados.js`: as mesmas falas, para o jogo (o jogo abre direto do arquivo, sem servidor, e o navegador não deixa ler o JSON).

Não edite o roteiro nem o `falas-dados.js` à mão: depois de mudar um JSON, rode `python3 ferramentas/gerar-roteiro.py`. Os testes avisam se o `falas-dados.js` ficou diferente dos JSONs.

Cada fala tem `id`, `texto` e `audio` (o caminho do arquivo dentro da pasta de áudio).

## Rivais: `falas.json` → `audio/falas/`

- **Rivais:** `seu-ze` (Fácil, feirante malandro) e `dona-cida` (Difícil, feirante veterana).
- **Expressões:** o rosto do rival e as falas que valem em cada momento.
  - `neutro`: vez do jogador.
  - `pensando`: vez do rival.
  - `comemorando`: o rival venceu a rodada.
  - `frustrado`: o rival perdeu a rodada.
- **Situações:** dependem do placar (diferença = cartas do rival − cartas do jogador).
  - `folga`: diferença ≥ 6.
  - `aperto`: diferença ≤ −6, ou o rival tem 4 cartas ou menos.
  - `parelho`: qualquer outro caso.
- **Quantidade:** 20 falas por expressão para cada rival, 160 no total.
- **Desenhos:** `img/rivais/<rival>-<expressao>.svg`.

## Narrador: `narrador.json` → `audio/narrador/`

Há 14 eventos com 20 falas cada, 280 no total. Em `vitoria` e `derrota`, as falas são separadas pelo atributo escolhido (proteína, carboidrato, fibras, calorias), com 5 de cada.

| Evento | Quando |
|---|---|
| `inicio_partida` | antes da primeira rodada |
| `ultima_rodada` | início da última rodada (só no Rápido) |
| `vitoria` / `derrota` | o jogador / o rival venceu a rodada |
| `empate` | empate na rodada; as cartas vão para a cesta |
| `por_pouco` | diferença menor que 10% do maior valor |
| `sequencia_jogador` / `sequencia_rival` | 3ª vitória seguida do mesmo lado, ou mais |
| `levou_cesta` | alguém venceu e levou as cartas da cesta |
| `super_trunfo_jogador` / `super_trunfo_rival` | a Ora-pro-nóbis venceu uma hortaliça comum |
| `fim_vitoria` / `fim_derrota` / `fim_empate` | tela final |

**Uma fala do narrador por rodada:** vale o primeiro evento de `prioridade_rodada` que se aplicar, nesta ordem: Super PANC, levou a cesta, por pouco, sequência, e por fim vitória, derrota ou empate.

O narrador fala primeiro, logo depois da revelação; o Tião comenta e o rival reage por último.

## Comentarista: `comentarista.json` → `audio/comentarista/`

**Tião da Xepa** é um frequentador da feira, meio bobo: o alívio cômico da transmissão. O narrador, mais sério, dá a deixa; o Tião comenta o mesmo evento logo depois. Ele confunde as coisas e conta causos da feira, mas nunca debocha de quem está perdendo.

Tem os mesmos 14 eventos do narrador, com 10 falas cada (140 no total), sem separar por atributo. As falas reagem ao evento, não a uma fala específica do narrador, então qualquer combinação funciona.

**Ordem em toda rodada:** a faixa de plantão aparece; narrador → respiro → Tião → respiro → rival. Também falam os dois na abertura e no aviso de última rodada. Na rodada que encerra a partida, em vez do lance, os dois já falam do fim (`fim_vitoria`, `fim_derrota` ou `fim_empate`); na tela final só o rival fala. A faixa de plantão fica na tela até a pessoa seguir para a próxima rodada. Se ficar demorado, a regra está em `transmitir()` e `reagirRival()`, em `js/ui.js`.

## Faixa de plantão: `bastidores.json`

A faixa "Plantão" embaixo da mesa **não** mostra o que o narrador e o Tião falam: as falas deles aparecem no **radinho**, no canto da mesa: quem fala (Agrião Bueno à esquerda, Tião à direita) sobe de trás do rádio e se mexe, e o balão dele mostra o nome e a fala (o rádio balança enquanto a voz toca; sem gravação, pelo tempo mínimo de uma fala). Com o rádio desligado, os dois ficam calados e a rodada segue direto para o rival. Ela mostra textos da equipe de bastidores, com tom de boletim oficial de TV, um pouco burocrático: explica o que aconteceu e o que vem agora, sem repetir as falas.

Os eventos são os mesmos do narrador, com 4 ou 5 textos cada. Os textos podem ter variáveis, trocadas pelos valores da rodada: `{rival}`, `{atributo}`, `{seguidas}`, `{vencedor}`, `{cesta}`, `{meu}` e `{dele}` (a lista está no próprio JSON). Esses textos não entram no roteiro de gravação.

## MVP: menos falas por enquanto

**O jogo final terá todas as falas dos JSONs:** narrador 280, Tião 140, Seu Zé 80 e Dona Cida 80. Nada foi apagado.

Para o MVP não ficar com situações sem voz enquanto as gravações não terminam, o jogo usa só as falas listadas em `mvp.json` (266 no total: narrador 162, Tião 56, cada rival 24). A lista inclui tudo o que já tinha sido gravado e garante pelo menos uma fala para cada evento, atributo, expressão e situação (os testes conferem).

- O roteiro (`roteiro-gravacao.md`) marca as falas do MVP com ★, e o PDF mostra só as do MVP (`--completo` mostra todas).
- **Para voltar ao jogo completo:** em `mvp.json`, troque `"ativo": true` por `false` e rode `python3 ferramentas/gerar-roteiro.py`. Depois, grave as que faltarem (o PDF com `--completo` mostra quais).

## Gravações

1. Grave seguindo `roteiro-gravacao.md`. Cada linha da tabela vira um arquivo com o nome indicado.
2. Coloque os arquivos em `gravacoes/<personagem>/` (`narrador`, `comentarista`, `seu-ze`, `dona-cida`) e rode `python3 ferramentas/importar-gravacoes.py`. Ele corta o silêncio das pontas, iguala o volume, converte para MP3 mono e põe tudo em `audio/`. Também avisa nomes que não são de nenhuma fala (com uma sugestão), falas com mais de 4 s e quantas ainda faltam. As gravações originais não são alteradas.
3. Dá para entregar aos poucos: o que ainda não foi gravado fica em silêncio.

Se mudar ou acrescentar uma fala, edite o JSON, rode `python3 ferramentas/gerar-roteiro.py` (e o `gerar-pdf-roteiro.py`, se for imprimir) e grave de novo só aquele arquivo. O teste "todo arquivo de áudio é de uma fala" avisa se algum arquivo estiver com o nome errado.
