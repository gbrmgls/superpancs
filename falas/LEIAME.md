# Falas dos rivais e do narrador

**Situação atual:** os áudios serão gerados por voz sintética (texto para fala) só para desenvolver.
**Depois:** uma pessoa vai gravar todas as falas. A troca deve ser só substituir os arquivos em `audio/`, com os **mesmos nomes**, sem mexer em código.

- `falas.json`: falas dos rivais (fonte única dos textos).
- `narrador.json`: falas do narrador (fonte única dos textos).
- `roteiro-gravacao.md`: tudo formatado para quem vai gravar, com o nome de arquivo de cada fala. Não edite à mão: depois de mudar um JSON, rode `python3 ferramentas/gerar-roteiro.py`.

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

**Uma fala do narrador por rodada:** vale o primeiro evento de `prioridade_rodada` que se aplicar, nesta ordem: Super Trunfo, levou a cesta, por pouco, sequência, e por fim vitória, derrota ou empate.

O narrador fala primeiro, logo depois da revelação, e o rival reage em seguida.

## Trocar a voz sintética pela gravada

1. Grave seguindo `roteiro-gravacao.md`. Cada linha da tabela vira um arquivo com o nome indicado.
2. Substitua os arquivos em `audio/falas/<rival>/` e `audio/narrador/`.
3. Nos dois JSONs, troque `"fonte_atual": "sintetica"` por `"gravada"` (só como registro).

Se mudar ou acrescentar uma fala, edite o JSON, rode `python3 ferramentas/gerar-roteiro.py` e grave de novo só aquele arquivo.
