# Аналіз фактично завантажених наборів

Архіви завантажено з [UCI Heart Disease](https://archive.ics.uci.edu/dataset/45/heart+disease) та [UCI Early Stage Diabetes Risk Prediction](https://archive.ics.uci.edu/dataset/529/early+stage+diabetes+risk+prediction+). Обидва набори опубліковані під CC BY 4.0. Автори Heart Disease: Janosi, Steinbrunn, Pfisterer, Detrano (DOI 10.24432/C52P4X). Early Stage Diabetes Risk Prediction: UCI (DOI 10.24432/C5VG8H), дані анкетування Sylhet Diabetes Hospital, Bangladesh. Метадані SHA-256 містяться у `ml/artifacts/*/metrics.json`.

| Сценарій | Рядків у джерелі | Повторів ознак | Рядків після очищення | Класи у джерелі (0/1) | Класи після очищення (0/1) |
|---|---:|---:|---:|---:|---:|
| Cleveland, `num > 0` | 303 | 0 | 303 | 164 / 139 | 164 / 139 |
| Early Stage Diabetes, Positive | 520 | 269 | 251 | 200 / 320 | 78 / 173 |

Для diabetes однакові вектори ознак повторювались 269 разів без конфліктних міток. Повтори видалено **перед** train/test split, щоб однакові анкети не опинилися по різні боки розбиття. Графіки розподілу класів відображають очищені дані.

## Поля та пропуски

**Heart (13 ознак):** `age` (роки), `sex` (0/1), `cp` (1–4), `trestbps` (мм рт. ст.), `chol` (мг/дл), `fbs` (0/1), `restecg` (0–2), `thalach` (уд/хв), `exang` (0/1), `oldpeak`, `slope` (1–3), `ca` (0–3), `thal` (3/6/7). Пропуски: `ca` — 4, `thal` — 2; решта — 0.

**Diabetes (16 ознак):** `age` (роки), `gender` (Male/Female), `polyuria`, `polydipsia`, `sudden_weight_loss`, `weakness`, `polyphagia`, `genital_thrush`, `visual_blurring`, `itching`, `irritability`, `delayed_healing`, `partial_paresis`, `muscle_stiffness`, `alopecia`, `obesity` (усі симптоми Yes/No). У завантаженому CSV пропусків немає, хоча сторінка UCI вказує, що набір може містити пропуски. Імпутацію все одно залишено в pipeline.

Набори не репрезентують сучасну клінічну популяцію; відомі відмінності географії, часу, способу збору та class balance. Жоден рядок з них не є демонстраційною карткою системи.
