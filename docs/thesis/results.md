# Фактичні результати експериментів

Проведено навчання 3 листопада 2026 року на офіційних UCI ZIP-архівах. Числа нижче зчитано з `ml/artifacts/*/comparison.csv` і `metrics.json`; наведено округлення до трьох знаків. `CV ROC-AUC` — середнє лише на train. Решта метрик — відкладений test.

| Набір | Алгоритм | CV ROC-AUC | Accuracy | Precision | Sensitivity | Specificity | F1 | Test ROC-AUC | Brier |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Heart | **Logistic Regression** | **0.902** | 0.885 | 0.839 | 0.929 | 0.848 | 0.881 | 0.966 | 0.080 |
| Heart | Random Forest | 0.897 | 0.869 | 0.813 | 0.929 | 0.818 | 0.867 | 0.943 | 0.102 |
| Diabetes | Logistic Regression | 0.973 | 0.804 | 0.903 | 0.800 | 0.813 | 0.848 | 0.923 | 0.113 |
| Diabetes | **Random Forest** | **0.976** | 0.922 | 1.000 | 0.886 | 1.000 | 0.939 | 0.964 | 0.080 |

Обрані моделі визначено за CV, а не за test. Heart: `C=1`, матриця `[[28,5],[2,26]]` (TN,FP / FN,TP). Diabetes: `n_estimators=200`, `max_depth=10`, матриця `[[16,0],[4,31]]`. Версії: `heart-b17cd273da9c-s42`, `diabetes-67594c0f1125-s42`.

**Критичне спостереження:** первинний випадковий split на всіх 520 diabetes-рядках давав майже ідеальний ROC-AUC ≈ 0.999, але 269 записів повторювали вже наявні вектори ознак. Цей результат не використовується. Після вилучення дублікатів **до** split тестова ROC-AUC становить 0.964. Навіть ця оцінка нестійка через test із 51 об'єкта та відсутність зовнішньої валідації.

## Артефакти

У кожному `ml/artifacts/{heart,diabetes}/`: `model.joblib`, `metrics.json`, `comparison.csv`, `confusion_matrix.png`, `roc_curve.png`, `class_distribution.png`, `missing_values.png`. У `metrics.json` є URL джерела, ліцензія, SHA-256 архіву, дати, ознаки, пропуски, розподіли класів, параметри, split і метрики.

Відтворення: `python -m pip install -r ml/requirements.txt`, далі `python -m ml.training.train`. Можна передати локальний архів через `--scenario` і `--archive`, як описано в README. Ніякої екстраполяції на клінічні рішення без зовнішньої та проспективної валідації.
