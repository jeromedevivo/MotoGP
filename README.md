# Point de Corde

Compagnon d'analyse MotoGP en français : classements des pilotes par condition, fiches circuit complètes et prédictions de course qui tiennent compte de la météo.

> Projet de fan indépendant, non affilié à MotoGP™ ni à Dorna.

## Ce que fait l'appli

- **Prédictions** : probabilités de victoire, podium et top 5 pour chaque pilote, avec 8 facteurs expliqués (championnat, forme, moto, circuit, conditions, talent, qualif, fiabilité). La météo du week-end vient d'Open-Meteo, et un simulateur sec/mixte/mouillé permet de tester les scénarios. La prédiction répond en ~0,3 s.
- **Pilotes** : 16 classements calculés sur tous les résultats depuis 2018 (MotoGP, Moto2, Moto3) : piste mouillée, sèche, chaleur, froid, talent à moto égale, qualification, remontées, régularité, abandons, sprint vs course, dynamique, effet domicile, circuits rapides/sinueux/gauche/droite. S'y ajoutent un duel face à face et une fiche pilote complète.
- **Grands Prix** : tracé officiel, données techniques, records des 3 catégories extraits du PDF officiel (vitesse de pointe incluse), édition précédente, palmarès, conditions des éditions passées, spécialistes du tracé, programme et résultats de chaque session.

## Lancer le projet

Prérequis : Node.js 18+ et Python 3.10+.

```sh
npm install
pip install -r backend/requirements.txt

# terminal 1 : API (port 8000)
cd backend && python -m uvicorn main:app --port 8000

# terminal 2 : interface (port 8080, /api est proxifié vers le backend)
npm run dev
```

**Premier lancement :** le backend télécharge tout l'historique depuis 2018 (environ 36 000 résultats). L'API officielle limite le débit, donc les requêtes sont espacées et l'opération prend une dizaine de minutes. Les pages affichent un message en attendant. Le jeu de données est ensuite gardé dans `backend/data/` et mis à jour toutes les 6 heures, uniquement pour les nouveaux GP. On peut forcer une mise à jour avec `POST /api/insights/refresh`.

## Tests

```sh
cd backend && python -m pytest     # moteur d'analyse, dataset, PDF, météo, prédiction, API
npm test                            # helpers front (Vitest)
```

## Architecture

| Fichier | Rôle |
|---|---|
| `backend/history.py` | Construit le jeu de données (requêtes parallèles, rythme limité, retries sur 429, mises à jour incrémentales) |
| `backend/analytics.py` | Classements des pilotes (fonctions pures, lissage bayésien des petits échantillons) |
| `backend/predict.py` | Score explicable, température calibrée sur les courses passées, simulation des courses |
| `backend/circuit_pdf.py` | Extraction des records depuis `CircuitInformation.pdf` |
| `backend/weather.py` | Prévisions Open-Meteo du week-end |
| `src/lib/insights.ts` | Client API et formatage côté front |

## Documentation

- [`docs/PREDICTIONS.md`](docs/PREDICTIONS.md) : classements, facteurs de prédiction, calibration et météo
- [`docs/API.md`](docs/API.md) : endpoints du backend
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) : exploitation, premier lancement, limite de débit
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) et [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)

## Licence

Code sous licence MIT (voir `LICENSE`). Les données et images restent la propriété de leurs ayants droit.
