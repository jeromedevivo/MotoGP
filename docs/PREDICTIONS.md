# Rankings and Predictions

How the backend turns official timing data into rider rankings and race predictions.

## Data

`backend/history.py` builds one flat row per classified rider per session, since 2018, for MotoGP, Moto2 and Moto3:

- races (`RAC`), sprints (`SPR`) and qualifying (`Q`) are always kept;
- practice and warm-up sessions are kept only when the track was not dry, because wet races are rare (1–3 per MotoGP season) and wet practice adds useful samples;
- each row carries the session conditions (track dry/wet, air and ground temperature, humidity, sky), the grid position for races, the field size, the gap and the top speed.

Riders are keyed by `legacy_id`. Circuit geometry (length, longest straight, left/right corners, layout SVG) comes from the broadcast API; records come from the race classification.

## Result score

Every result becomes a score between 0 and 1: `1 - (position - 1) / (field - 1)`. A race or sprint DNF counts as 0. Sessions are weighted: race 1.0, sprint 0.8, qualifying 0.6, practice 0.3.

Small samples are shrunk toward a prior (Bayesian average, `k = 3`):

```
score = (mean × n + prior × k) / (n + k)
```

## Rankings (`backend/analytics.py`)

| Ranking | Computation |
|---|---|
| Wet / dry / hot (ground ≥ 45 °C) / cold (≤ 20 °C) | Weighted score in that condition, shrunk toward the rider's overall level; `delta` = gain vs overall level |
| Talent at equal bike | Score minus the mean of the other riders on the same constructor in the same session, current season |
| Qualifying | Grid position score, last two seasons |
| Positions gained | Mean of grid − finish in races and sprints |
| Consistency | Standard deviation of race finishing positions (lower is better) |
| Retirements | Share of races and sprints not finished (lower is better) |
| Sprint vs race | Sprint score minus race score |
| Momentum | Last 5 races vs season average |
| Home effect | Score at the home GP minus elsewhere |
| Fast / technical / left / right circuits | Same as conditions, on a circuit family (top/bottom third by longest straight, corner balance) |

Riders below a minimum sample (5 races for race-craft rankings, 3 sessions for the bike ranking, 2 home races) are left out.

## Prediction (`backend/predict.py`)

Each entrant gets eight factors in [0, 1], computed only from history before the race:

| Factor | Weight | Source |
|---|---|---|
| Championship | 15 % | Points / leader's points |
| Form | 20 % | Mean score of the last 5 races and sprints this season |
| Bike | 15 % | Constructor's mean race score this season, relative to the best |
| Circuit | 15 % | Circuit ranking for this track, all classes |
| Conditions | 15 % | `wet_weight × wet score + (1 − wet_weight) × dry score` |
| Talent | 5 % | 0.5 + bike-relative score |
| Qualifying | 10 % | Qualifying ranking |
| Reliability | 5 % | 1 − retirement rate |

A home race adds 0.02. The weighted score is turned into win probabilities with a softmax whose temperature is fitted by maximum likelihood on the last 80 MotoGP races (each scored only with the data that existed before it). Podium, top 5 and expected position come from 3 000 simulated race orders (Plackett-Luce via the Gumbel trick).

## Weather (`backend/weather.py`)

The circuit coordinates feed an Open-Meteo forecast (free, no key, about 16 days ahead). `wet_weight` is the race-day rain probability, unless the user forces a scenario: dry = 0, mixed = 0.5, wet = 1.

## Circuit records (`backend/circuit_pdf.py`)

The official `CircuitInformation.pdf` adds what the JSON API does not expose: top speed and the records of all three classes, plus the previous edition. The text layer is parsed with `pypdf`. When the layout does not match the expected 3 classes × 4 records, the section is returned empty rather than misattributed. For an upcoming event, the PDF of the latest past edition on the same circuit is used.

## Speed

Everything above runs on the in-memory dataset: a prediction takes about 0.3 s, and results are cached per event, class and scenario until the next refresh.
