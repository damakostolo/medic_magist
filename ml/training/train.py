"""Download UCI archives and reproduce both independent experiments."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import requests
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (ConfusionMatrixDisplay, RocCurveDisplay, accuracy_score,
                             brier_score_loss, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ml.scenarios import SCENARIOS

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ARTIFACTS = ROOT / "artifacts"
URLS = {
    "heart": "https://archive.ics.uci.edu/static/public/45/heart+disease.zip",
    "diabetes": "https://archive.ics.uci.edu/static/public/529/early+stage+diabetes+risk+prediction+dataset.zip",
}
SEED = 42


def archive(scenario: str, local: Path | None = None):
    DATA.mkdir(exist_ok=True)
    path = DATA / f"{scenario}.zip"
    if local:
        payload = local.read_bytes()
        path.write_bytes(payload)
    elif path.exists():
        payload = path.read_bytes()
    else:
        response = requests.get(URLS[scenario], timeout=60)
        response.raise_for_status()
        payload = response.content
        path.write_bytes(payload)
    try:
        bundle = zipfile.ZipFile(io.BytesIO(payload))
    except zipfile.BadZipFile as exc:
        raise RuntimeError(f"Некоректний ZIP для {scenario}: {path}") from exc
    return bundle, hashlib.sha256(payload).hexdigest()


def load(scenario: str, local: Path | None = None):
    bundle, digest = archive(scenario, local)
    if scenario == "heart":
        names = [f[0] for f in SCENARIOS[scenario]["fields"]] + ["num"]
        frame = pd.read_csv(bundle.open("processed.cleveland.data"), header=None, names=names, na_values="?")
        for name in names:
            frame[name] = pd.to_numeric(frame[name], errors="coerce")
        x = frame[names[:-1]].copy()
        y = (frame.num > 0).astype(int)
        categorical = ["sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal"]
        for name in categorical:
            x[name] = x[name].map(lambda v: str(int(v)) if pd.notna(v) else np.nan).astype(object)
    else:
        frame = pd.read_csv(bundle.open("diabetes_data_upload.csv"))
        frame.columns = [re.sub(r"[^a-z0-9]+", "_", c.lower()).strip("_") for c in frame.columns]
        frame = frame.rename(columns={"class": "target"})
        names = [f[0] for f in SCENARIOS[scenario]["fields"]]
        if set(names) - set(frame.columns):
            raise ValueError(f"Відсутні поля: {set(names) - set(frame.columns)}")
        x = frame[names].copy()
        x["age"] = pd.to_numeric(x.age, errors="coerce")
        y = frame.target.map({"Positive": 1, "Negative": 0})
        categorical = names[1:]
    if y.isna().any() or len(x) != len(y):
        raise ValueError("Цільові мітки відсутні або пошкоджені")
    return x.copy(), y.astype(int), categorical, digest


def scores(y, probability):
    prediction = (probability >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, prediction, labels=[0, 1]).ravel()
    return {"accuracy": accuracy_score(y, prediction), "precision": precision_score(y, prediction, zero_division=0),
            "recall": recall_score(y, prediction, zero_division=0), "specificity": tn / (tn + fp),
            "f1": f1_score(y, prediction, zero_division=0), "roc_auc": roc_auc_score(y, probability),
            "brier": brier_score_loss(y, probability), "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]]}


def train(scenario: str, local: Path | None = None):
    x, y, categorical, digest = load(scenario, local)
    source_rows = len(x)
    source_counts = {str(k): int(v) for k, v in y.value_counts().sort_index().items()}
    # Repeated questionnaire rows would otherwise occur in both train and test.
    combined = pd.concat([x, y.rename("target")], axis=1)
    if combined.groupby(list(x.columns), dropna=False).target.nunique().gt(1).any():
        raise ValueError("Однакові ознаки мають суперечливі мітки")
    unique = combined.drop_duplicates(subset=list(x.columns)).reset_index(drop=True)
    x, y = unique[x.columns], unique.target.astype(int)
    numeric = [c for c in x if c not in categorical]
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, stratify=y, random_state=SEED)
    preprocess = ColumnTransformer([
        ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), numeric),
        ("categorical", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")),
                                  ("encoder", OneHotEncoder(handle_unknown="ignore"))]), categorical),
    ])
    candidates = {
        "Logistic Regression": (LogisticRegression(max_iter=2000, random_state=SEED), {"model__C": [0.1, 1, 10]}),
        "Random Forest": (RandomForestClassifier(random_state=SEED, n_jobs=1),
                          {"model__n_estimators": [100, 200], "model__max_depth": [None, 5, 10]}),
    }
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    rows = []
    fitted = {}
    for label, (estimator, grid) in candidates.items():
        search = GridSearchCV(Pipeline([("preprocess", preprocess), ("model", estimator)]), grid,
                              scoring="roc_auc", cv=cv, n_jobs=1, refit=True)
        search.fit(x_train, y_train)
        fitted[label] = search
        rows.append({"algorithm": label, "cv_roc_auc": float(search.best_score_), "parameters": search.best_params_})
    winner = max(rows, key=lambda row: row["cv_roc_auc"])["algorithm"]
    output = ARTIFACTS / scenario
    output.mkdir(parents=True, exist_ok=True)
    comparison = []
    for row in rows:
        probability = fitted[row["algorithm"]].predict_proba(x_test)[:, 1]
        comparison.append({"algorithm": row["algorithm"], "cv_roc_auc": row["cv_roc_auc"],
                           **{k: v for k, v in scores(y_test, probability).items() if k != "confusion_matrix"},
                           "parameters": json.dumps(row["parameters"], sort_keys=True)})
    pd.DataFrame(comparison).to_csv(output / "comparison.csv", index=False)
    model = fitted[winner].best_estimator_
    probability = model.predict_proba(x_test)[:, 1]
    metrics = scores(y_test, probability)
    version = f"{scenario}-{digest[:12]}-s{SEED}"
    metadata = {"scenario": scenario, "dataset": SCENARIOS[scenario]["title"],
                "dataset_id": SCENARIOS[scenario]["dataset_id"], "source_url": URLS[scenario],
                "archive_sha256": digest, "license": "CC BY 4.0", "version": version,
                "trained_at_utc": datetime.now(timezone.utc).isoformat(), "seed": SEED,
                "source_rows": source_rows, "duplicates_removed": source_rows - len(x),
                "source_class_counts": source_counts, "rows": len(x), "train_rows": len(x_train), "test_rows": len(x_test),
                "features": list(x.columns), "missing_by_feature": {k: int(v) for k, v in x.isna().sum().items()},
                "class_counts": {str(k): int(v) for k, v in y.value_counts().sort_index().items()},
                "algorithm": winner, "parameters": fitted[winner].best_params_,
                "cv_roc_auc": fitted[winner].best_score_, "threshold": 0.5,
                "test_metrics": metrics}
    joblib.dump(model, output / "model.joblib")
    (output / "metrics.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    ConfusionMatrixDisplay.from_predictions(y_test, probability >= 0.5, labels=[0, 1], cmap="Blues")
    plt.title(f"{scenario}: test confusion matrix")
    plt.tight_layout(); plt.savefig(output / "confusion_matrix.png", dpi=150); plt.close()
    RocCurveDisplay.from_predictions(y_test, probability)
    plt.title(f"{scenario}: held-out ROC")
    plt.tight_layout(); plt.savefig(output / "roc_curve.png", dpi=150); plt.close()
    y.value_counts().sort_index().plot.bar(color=["#5daeb4", "#1e6384"])
    plt.title(f"{scenario}: class distribution"); plt.xlabel("Class"); plt.ylabel("Rows")
    plt.tight_layout(); plt.savefig(output / "class_distribution.png", dpi=150); plt.close()
    x.isna().sum().plot.bar(color="#267c91")
    plt.title(f"{scenario}: missing values"); plt.ylabel("Rows"); plt.xticks(rotation=60, ha="right")
    plt.tight_layout(); plt.savefig(output / "missing_values.png", dpi=150); plt.close()
    print(f"{scenario}: {winner}, CV ROC-AUC={metadata['cv_roc_auc']:.3f}, test ROC-AUC={metrics['roc_auc']:.3f}")
    return metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", choices=["heart", "diabetes", "all"], default="all")
    parser.add_argument("--archive", type=Path, help="Local UCI ZIP for a single scenario")
    args = parser.parse_args()
    if args.archive and args.scenario == "all":
        parser.error("--archive requires one scenario")
    for name in (["heart", "diabetes"] if args.scenario == "all" else [args.scenario]):
        train(name, args.archive)
