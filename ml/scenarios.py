"""Public feature contracts shared by training and inference."""

HEART = [
    ("age", "Вік", "number", 18, 100, "років", None),
    ("sex", "Стать у наборі", "select", None, None, "", {"0": "Жіноча", "1": "Чоловіча"}),
    ("cp", "Тип болю у грудях", "select", None, None, "", {"1": "Типова стенокардія", "2": "Атипова стенокардія", "3": "Неангінозний біль", "4": "Безсимптомний"}),
    ("trestbps", "Тиск у спокої", "number", 50, 250, "мм рт. ст.", None),
    ("chol", "Холестерин", "number", 50, 700, "мг/дл", None),
    ("fbs", "Глюкоза натще > 120 мг/дл", "select", None, None, "", {"0": "Ні", "1": "Так"}),
    ("restecg", "ЕКГ у спокої", "select", None, None, "", {"0": "Норма", "1": "ST–T зміни", "2": "Гіпертрофія ЛШ"}),
    ("thalach", "Максимальна ЧСС", "number", 50, 250, "уд/хв", None),
    ("exang", "Стенокардія при навантаженні", "select", None, None, "", {"0": "Ні", "1": "Так"}),
    ("oldpeak", "Депресія ST", "number", 0, 10, "", None),
    ("slope", "Нахил сегмента ST", "select", None, None, "", {"1": "Висхідний", "2": "Плоский", "3": "Низхідний"}),
    ("ca", "Кількість судин", "select", None, None, "", {"0": "0", "1": "1", "2": "2", "3": "3"}),
    ("thal", "Таласемія/дефект", "select", None, None, "", {"3": "Норма", "6": "Фіксований дефект", "7": "Оборотний дефект"}),
]

DIABETES_NAMES = [
    ("polyuria", "Часте сечовипускання"), ("polydipsia", "Сильна спрага"),
    ("sudden_weight_loss", "Раптова втрата ваги"), ("weakness", "Слабкість"),
    ("polyphagia", "Підвищений апетит"), ("genital_thrush", "Генітальний кандидоз"),
    ("visual_blurring", "Погіршення зору"), ("itching", "Свербіж"),
    ("irritability", "Дратівливість"), ("delayed_healing", "Повільне загоєння"),
    ("partial_paresis", "Частковий парез"), ("muscle_stiffness", "М'язова скутість"),
    ("alopecia", "Алопеція"), ("obesity", "Ожиріння"),
]
DIABETES = [
    ("age", "Вік", "number", 18, 100, "років", None),
    ("gender", "Стать у наборі", "select", None, None, "", {"Male": "Чоловіча", "Female": "Жіноча"}),
] + [(key, label, "select", None, None, "", {"No": "Ні", "Yes": "Так"}) for key, label in DIABETES_NAMES]

SCENARIOS = {
    "heart": {"title": "Ознаки серцевого захворювання", "dataset_id": 45, "fields": HEART},
    "diabetes": {"title": "Ознаки ранньої стадії діабету", "dataset_id": 529, "fields": DIABETES},
}


def public_scenarios():
    return [{"key": key, "title": value["title"], "dataset_id": value["dataset_id"],
             "fields": [{"key": f[0], "label": f[1], "type": f[2], "min": f[3],
                         "max": f[4], "unit": f[5], "options": f[6]} for f in value["fields"]]}
            for key, value in SCENARIOS.items()]


def validate_features(scenario: str, values: dict) -> dict:
    if scenario not in SCENARIOS:
        raise ValueError("Невідомий сценарій")
    fields = SCENARIOS[scenario]["fields"]
    if set(values) != {f[0] for f in fields}:
        raise ValueError("Набір полів має точно відповідати сценарію")
    cleaned = {}
    for key, _, kind, minimum, maximum, _, options in fields:
        value = values[key]
        if kind == "select":
            if str(value) not in options:
                raise ValueError(f"Некоректне значення: {key}")
            cleaned[key] = str(value)
        else:
            if isinstance(value, bool):
                raise ValueError(f"Некоректне значення: {key}")
            try:
                number = float(value)
            except (TypeError, ValueError):
                raise ValueError(f"Некоректне число: {key}") from None
            if not minimum <= number <= maximum:
                raise ValueError(f"Значення поза межами: {key}")
            cleaned[key] = number
    return cleaned
