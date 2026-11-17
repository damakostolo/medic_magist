import { FormEvent, useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
} from "recharts";
import {
  api,
  fmt,
  token,
  type Assessment,
  type Encounter,
  type Model,
  type Observation,
  type Patient,
  type Scenario,
} from "./api";

type User = { id: string; username: string; role: string };
const warning =
  "Навчально-дослідна система. Лише синтетичні картки. Результати моделей не є діагнозом, клінічним ризиком або рекомендацією щодо лікування.";

function useLoad<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = () => {
    setLoading(true);
    api<T>(path)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, deps);
  return { data, error, loading, refresh };
}
function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error";
}) {
  return <div className={`notice ${tone}`}>{children}</div>;
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
function Loader() {
  return <div className="empty">Завантаження даних…</div>;
}
function PageTitle({
  eyebrow,
  title,
  desc,
  action,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {desc && <p className="subtle">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("doctor"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ access_token: string; user: User }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ username, password }) },
      );
      sessionStorage.setItem("medinsight_token", result.access_token);
      onLogin(result.user);
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-shell">
      <div className="login-aside">
        <div className="brand big">
          <span className="brand-mark">
            <HeartPulse size={27} />
          </span>
          <span>MedInsight</span>
        </div>
        <div className="login-aside-body">
          <span className="pill light">
            <FlaskConical size={14} /> ДОСЛІДНИЦЬКИЙ ПРОТОТИП
          </span>
          <h2>
            Медичні дані.
            <br />
            Зрозумілий контекст.
            <br />
            <em>Відтворюваний аналіз.</em>
          </h2>
          <p>
            Єдиний простір для синтетичних карток пацієнтів, структурованих
            показників та перевірених ML-експериментів.
          </p>
        </div>
        <div className="aside-footer">
          Магістерський дослідницький проєкт · 2026
        </div>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-logo">
            <HeartPulse /> MedInsight
          </div>
          <div className="icon-circle">
            <ShieldCheck size={24} />
          </div>
          <p className="eyebrow">ЗАХИЩЕНИЙ ДОСТУП</p>
          <h1>Вхід до системи</h1>
          <p className="subtle">
            Увійдіть за демонстраційним обліковим записом.
          </p>
          {error && <Notice tone="error">{error}</Notice>}
          <label>
            Логін
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Введіть пароль із .env"
            />
          </label>
          <button className="btn primary full" disabled={busy}>
            {busy ? "Перевірка…" : "Увійти"} <ArrowRight size={17} />
          </button>
          <div className="login-note">
            <ShieldCheck size={18} /> {warning}
          </div>
        </form>
      </div>
    </div>
  );
}

const nav = [
  { to: "/", label: "Огляд", icon: LayoutDashboard },
  { to: "/patients", label: "Пацієнти", icon: Users },
  { to: "/assessment", label: "Нова оцінка", icon: Activity },
  { to: "/models", label: "Дослідження моделей", icon: BarChart3 },
];
function Shell({
  user,
  logout,
  children,
}: {
  user: User;
  logout: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <HeartPulse size={23} />
          </span>
          <span>
            MedInsight<small>RESEARCH PLATFORM</small>
          </span>
        </div>
        <div className="nav-label">РОБОЧИЙ ПРОСТІР</div>
        <nav>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <item.icon size={19} />
              {item.label}
            </NavLink>
          ))}
          {user.role === "admin" && (
            <NavLink
              to="/admin"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Settings size={19} />
              Адміністрування
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-card">
            <FlaskConical size={19} />
            <strong>Режим дослідження</strong>
            <span>Усі записи пацієнтів є синтетичними.</span>
          </div>
          <div className="profile">
            <span className="avatar">{user.username[0].toUpperCase()}</span>
            <div>
              <strong>{user.username}</strong>
              <small>{user.role === "admin" ? "Адміністратор" : "Лікар"}</small>
            </div>
            <button title="Вийти" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="menu" onClick={() => setOpen(!open)}>
            <Menu size={22} />
          </button>
          <div className="topbar-path">
            <span>MedInsight</span>
            <span className="slash">/</span>
            <span>Робочий простір</span>
          </div>
          <div className="topbar-right">
            <span className="status-dot" /> Дослідницька версія{" "}
            <span className="top-avatar">{user.username[0].toUpperCase()}</span>
          </div>
        </header>
        <main className="content">{children}</main>
        <footer className="footer">{warning}</footer>
      </div>
      {open && <div className="shade" onClick={() => setOpen(false)} />}
    </div>
  );
}

function Dashboard() {
  const { data, error, loading } = useLoad<{
    patients: number;
    encounters: number;
    observations: number;
    assessments: number;
    activity: { date: string; count: number }[];
  }>("/api/dashboard");
  const { data: list } = useLoad<{ items: Patient[] }>("/api/patients?size=5");
  if (loading) return <Loader />;
  if (error || !data) return <Notice tone="error">{error}</Notice>;
  const stats = [
    {
      label: "Демо-пацієнти",
      value: data.patients,
      icon: Users,
      color: "blue",
    },
    {
      label: "Обстеження",
      value: data.encounters,
      icon: Stethoscope,
      color: "teal",
    },
    {
      label: "Показники",
      value: data.observations,
      icon: Activity,
      color: "violet",
    },
    {
      label: "ML-оцінки",
      value: data.assessments,
      icon: ClipboardList,
      color: "amber",
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="ОГЛЯД СИСТЕМИ"
        title="Панель дослідження"
        desc="Актуальні дані зі сховища демонстраційних записів."
      />
      <Notice>
        <FlaskConical size={17} /> {warning}
      </Notice>
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className={`stat-icon ${s.color}`}>
              <s.icon size={22} />
            </div>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <small>На основі бази даних</small>
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <section className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">АКТИВНІСТЬ</p>
              <h2>Події системи</h2>
            </div>
            <span className="tag">Останні 500 подій</span>
          </div>
          {data.activity.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.activity}>
                  <defs>
                    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3aaeb9" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3aaeb9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#edf2f5" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#087f8c"
                    strokeWidth={3}
                    fill="url(#fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty text="Події з'являться після створення або зміни записів." />
          )}
        </section>
        <section className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">ОСТАННІ ЗАПИСИ</p>
              <h2>Пацієнти</h2>
            </div>
            <NavLink to="/patients" className="text-link">
              Усі <ArrowRight size={16} />
            </NavLink>
          </div>
          {list?.items.length ? (
            <div className="recent-list">
              {list.items.map((p) => (
                <NavLink
                  to={`/patients/${p.id}`}
                  key={p.id}
                  className="recent-row"
                >
                  <span className="mini-avatar">{p.name[0]}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.code}</small>
                  </span>
                  <ArrowRight size={16} />
                </NavLink>
              ))}
            </div>
          ) : (
            <Empty text="Демонстраційних пацієнтів ще немає." />
          )}
        </section>
      </div>
    </>
  );
}

const blankPatient = {
  code: "",
  name: "",
  birth_date: "",
  administrative_sex: "unknown",
  notes: "",
};
function PatientForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Patient;
  onSave: (value: typeof blankPatient) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          code: initial.code,
          name: initial.name,
          birth_date: initial.birth_date,
          administrative_sex: initial.administrative_sex,
          notes: initial.notes,
        }
      : blankPatient,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(form);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">СИНТЕТИЧНИЙ ЗАПИС</p>
            <h2>{initial ? "Редагувати пацієнта" : "Новий пацієнт"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="form-grid">
          <label>
            Демо-ім'я
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Демо Марія"
            />
          </label>
          <label>
            Ідентифікатор
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="DEMO-003"
            />
          </label>
          <label>
            Дата народження
            <input
              required
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </label>
          <label>
            Адміністративна стать
            <select
              value={form.administrative_sex}
              onChange={(e) =>
                setForm({ ...form, administrative_sex: e.target.value })
              }
            >
              <option value="unknown">Невідомо</option>
              <option value="female">Жіноча</option>
              <option value="male">Чоловіча</option>
              <option value="other">Інша</option>
            </select>
          </label>
        </div>
        <label>
          Примітки
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            placeholder="Тільки синтетична інформація"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>
            Скасувати
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Збереження…" : "Зберегти"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Patients() {
  const [q, setQ] = useState(""),
    [sex, setSex] = useState(""),
    [sort, setSort] = useState("created_at"),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<Patient | true | null>(null);
  const params = new URLSearchParams({
    q,
    sex,
    sort,
    direction: sort === "created_at" ? "desc" : "asc",
    page: String(page),
    size: "10",
  });
  const { data, error, loading, refresh } = useLoad<{
    items: Patient[];
    total: number;
  }>(`/api/patients?${params}`, [q, sex, sort, page]);
  async function save(value: typeof blankPatient) {
    await api(
      "/api/patients" + (editing && editing !== true ? `/${editing.id}` : ""),
      {
        method: editing && editing !== true ? "PATCH" : "POST",
        body: JSON.stringify(value),
      },
    );
    setEditing(null);
    refresh();
  }
  return (
    <>
      <PageTitle
        eyebrow="МЕДИЧНІ ЗАПИСИ"
        title="Пацієнти"
        desc="Синтетичні картки для демонстрації роботи системи."
        action={
          <button className="btn primary" onClick={() => setEditing(true)}>
            <Plus size={17} /> Додати пацієнта
          </button>
        }
      />
      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              placeholder="Пошук за ім'ям або кодом"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            value={sex}
            onChange={(e) => {
              setSex(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Усі статі</option>
            <option value="female">Жіноча</option>
            <option value="male">Чоловіча</option>
            <option value="other">Інша</option>
            <option value="unknown">Невідомо</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="created_at">Нові спочатку</option>
            <option value="name">За ім'ям</option>
            <option value="code">За кодом</option>
          </select>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {loading ? (
          <Loader />
        ) : data?.items.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ПАЦІЄНТ</th>
                    <th>КОД</th>
                    <th>ДАТА НАРОДЖЕННЯ</th>
                    <th>СТАТЬ</th>
                    <th>СТАТУС</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <NavLink
                          className="person-cell"
                          to={`/patients/${p.id}`}
                        >
                          <span className="mini-avatar">{p.name[0]}</span>
                          <strong>{p.name}</strong>
                        </NavLink>
                      </td>
                      <td className="mono">{p.code}</td>
                      <td>{p.birth_date}</td>
                      <td>
                        {
                          (
                            {
                              female: "Жіноча",
                              male: "Чоловіча",
                              other: "Інша",
                              unknown: "Невідомо",
                            } as Record<string, string>
                          )[p.administrative_sex]
                        }
                      </td>
                      <td>
                        <span className="tag green">Синтетичний</span>
                      </td>
                      <td>
                        <NavLink className="text-link" to={`/patients/${p.id}`}>
                          Відкрити <ArrowRight size={16} />
                        </NavLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>Знайдено: {data.total}</span>
              <div>
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Назад
                </button>
                <span>{page}</span>
                <button
                  disabled={page * 10 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Далі
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty text="За цими умовами пацієнтів не знайдено. Додайте синтетичний запис." />
        )}
      </div>
      {editing && (
        <PatientForm
          initial={editing === true ? undefined : editing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ObservationForm({
  onSave,
  onCancel,
  encounters,
  initial,
}: {
  onSave: (v: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  encounters: Encounter[];
  initial?: Observation;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    value: String(initial?.value ?? ""),
    unit: initial?.unit || "",
    measured_at:
      initial?.measured_at?.slice(0, 16) ||
      new Date().toISOString().slice(0, 16),
    source: initial?.source || "",
    notes: initial?.notes || "",
    encounter_id: initial?.encounter_id || "",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        ...form,
        value: Number(form.value),
        measured_at: new Date(form.measured_at).toISOString(),
        encounter_id: form.encounter_id || null,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">СТРУКТУРОВАНИЙ ПОКАЗНИК</p>
            <h2>{initial ? "Редагувати показник" : "Додати показник"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="form-grid">
          <label>
            Назва
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Артеріальний тиск"
            />
          </label>
          <label>
            Значення
            <input
              required
              type="number"
              step="any"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </label>
          <label>
            Одиниця
            <input
              required
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="мм рт. ст."
            />
          </label>
          <label>
            Дата й час
            <input
              required
              type="datetime-local"
              value={form.measured_at}
              onChange={(e) =>
                setForm({ ...form, measured_at: e.target.value })
              }
            />
          </label>
          <label>
            Джерело
            <input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="Демонстраційне вимірювання"
            />
          </label>
          <label>
            Обстеження
            <select
              value={form.encounter_id}
              onChange={(e) =>
                setForm({ ...form, encounter_id: e.target.value })
              }
            >
              <option value="">Без прив'язки</option>
              {encounters.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.kind} · {fmt(x.occurred_at)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Примітка
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>
            Скасувати
          </button>
          <button className="btn primary" disabled={busy}>
            Зберегти
          </button>
        </div>
      </form>
    </div>
  );
}

function EncounterForm({
  onSave,
  onCancel,
}: {
  onSave: (v: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState("Консультація"),
    [notes, setNotes] = useState(""),
    [occurred, setOccurred] = useState(new Date().toISOString().slice(0, 16)),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await onSave({
        kind,
        notes,
        occurred_at: new Date(occurred).toISOString(),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="modal-backdrop">
      <form className="modal small" onSubmit={submit}>
        <div className="modal-head">
          <h2>Нове обстеження</h2>
          <button type="button" className="icon-button" onClick={onCancel}>
            <X />
          </button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <label>
          Тип
          <input
            required
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          />
        </label>
        <label>
          Дата й час
          <input
            required
            type="datetime-local"
            value={occurred}
            onChange={(e) => setOccurred(e.target.value)}
          />
        </label>
        <label>
          Примітка
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>
            Скасувати
          </button>
          <button className="btn primary">Зберегти</button>
        </div>
      </form>
    </div>
  );
}

function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    data: p,
    error,
    loading,
    refresh,
  } = useLoad<Patient>(`/api/patients/${id}`, [id]);
  const obs = useLoad<Observation[]>(`/api/patients/${id}/observations`, [id]);
  const enc = useLoad<Encounter[]>(`/api/patients/${id}/encounters`, [id]);
  const ass = useLoad<Assessment[]>(`/api/patients/${id}/assessments`, [id]);
  const [edit, setEdit] = useState(false),
    [obsForm, setObsForm] = useState<Observation | true | null>(null),
    [encForm, setEncForm] = useState(false),
    [tab, setTab] = useState("overview");
  async function remove() {
    if (!confirm("Видалити синтетичну картку та її історію?")) return;
    await api(`/api/patients/${id}`, { method: "DELETE" });
    navigate("/patients");
  }
  async function saveObs(v: Record<string, unknown>) {
    await api(
      `/api/${obsForm && obsForm !== true ? `observations/${obsForm.id}` : `patients/${id}/observations`}`,
      {
        method: obsForm && obsForm !== true ? "PATCH" : "POST",
        body: JSON.stringify(v),
      },
    );
    setObsForm(null);
    obs.refresh();
  }
  if (loading) return <Loader />;
  if (error || !p) return <Notice tone="error">{error}</Notice>;
  const trend = [...(obs.data || [])]
    .reverse()
    .filter((o) => o.name === obs.data?.[0]?.name)
    .map((o) => ({
      date: new Date(o.measured_at).toLocaleDateString("uk-UA"),
      value: o.value,
    }));
  return (
    <>
      <NavLink to="/patients" className="back">
        <ArrowLeft size={16} /> Назад до пацієнтів
      </NavLink>
      <PageTitle
        eyebrow={`КАРТКА / ${p.code}`}
        title={p.name}
        desc="Демонстраційний синтетичний запис"
        action={
          <div className="actions">
            <button className="btn secondary" onClick={() => setEdit(true)}>
              Редагувати
            </button>
            <button className="btn danger" onClick={remove}>
              <Trash2 size={16} />
            </button>
          </div>
        }
      />
      <div className="patient-banner">
        <span className="avatar large">{p.name[0]}</span>
        <div>
          <strong>{p.code}</strong>
          <span>Дата народження: {p.birth_date}</span>
        </div>
        <div>
          <strong>Стать</strong>
          <span>
            {
              (
                {
                  female: "Жіноча",
                  male: "Чоловіча",
                  other: "Інша",
                  unknown: "Невідомо",
                } as Record<string, string>
              )[p.administrative_sex]
            }
          </span>
        </div>
        <span className="tag green">Синтетичний запис</span>
      </div>
      <div className="tabs">
        {[
          ["overview", "Огляд"],
          ["observations", "Показники"],
          ["encounters", "Обстеження"],
          ["assessments", "ML-оцінки"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="detail-grid">
          <section className="card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">ДИНАМІКА</p>
                <h2>Останній показник</h2>
              </div>
            </div>
            {trend.length > 1 ? (
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid vertical={false} stroke="#edf2f5" />
                    <XAxis dataKey="date" />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#087f8c"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty text="Додайте щонайменше два вимірювання одного показника для графіка." />
            )}
          </section>
          <section className="card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">ІНФОРМАЦІЯ</p>
                <h2>Нотатки та активність</h2>
              </div>
            </div>
            <p className="body-text">{p.notes || "Нотаток немає."}</p>
            <div className="small-stats">
              <div>
                <strong>{obs.data?.length ?? 0}</strong>
                <span>показників</span>
              </div>
              <div>
                <strong>{enc.data?.length ?? 0}</strong>
                <span>обстежень</span>
              </div>
              <div>
                <strong>{ass.data?.length ?? 0}</strong>
                <span>оцінок</span>
              </div>
            </div>
            <NavLink
              to={`/assessment?patient=${id}`}
              className="btn primary full"
            >
              Нова ML-оцінка <ArrowRight size={16} />
            </NavLink>
          </section>
        </div>
      )}
      {tab === "observations" && (
        <section className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">ІСТОРІЯ</p>
              <h2>Структуровані показники</h2>
            </div>
            <button className="btn primary" onClick={() => setObsForm(true)}>
              <Plus size={16} /> Додати
            </button>
          </div>
          {obs.error && <Notice tone="error">{obs.error}</Notice>}
          {obs.data?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ПОКАЗНИК</th>
                    <th>ЗНАЧЕННЯ</th>
                    <th>ДАТА</th>
                    <th>ДЖЕРЕЛО</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {obs.data.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.name}</strong>
                        <small className="cell-note">{o.notes}</small>
                      </td>
                      <td>
                        <strong>{o.value}</strong> {o.unit}
                      </td>
                      <td>{fmt(o.measured_at)}</td>
                      <td>{o.source || "—"}</td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => setObsForm(o)}
                        >
                          Змінити
                        </button>{" "}
                        <button
                          className="icon-button"
                          title="Видалити"
                          onClick={async () => {
                            if (confirm("Видалити показник?")) {
                              await api(`/api/observations/${o.id}`, {
                                method: "DELETE",
                              });
                              obs.refresh();
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="Показників ще немає." />
          )}
        </section>
      )}
      {tab === "encounters" && (
        <section className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">ВІЗИТИ</p>
              <h2>Обстеження</h2>
            </div>
            <button className="btn primary" onClick={() => setEncForm(true)}>
              <Plus size={16} /> Додати
            </button>
          </div>
          {enc.data?.length ? (
            <div className="timeline">
              {enc.data.map((e) => (
                <div key={e.id} className="timeline-row">
                  <span className="timeline-dot" />
                  <div>
                    <strong>{e.kind}</strong>
                    <p>{e.notes || "Без приміток"}</p>
                    <small>{fmt(e.occurred_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Обстежень ще немає." />
          )}
        </section>
      )}
      {tab === "assessments" && (
        <section className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">ЕКСПЕРИМЕНТАЛЬНІ ВИХОДИ</p>
              <h2>Історія ML-оцінок</h2>
            </div>
            <NavLink to={`/assessment?patient=${id}`} className="btn primary">
              <Plus size={16} /> Нова оцінка
            </NavLink>
          </div>
          {ass.data?.length ? (
            <div className="assessment-list">
              {ass.data.map((a) => (
                <div className="assessment-row" key={a.id}>
                  <span className="stat-icon teal">
                    <Activity size={20} />
                  </span>
                  <div>
                    <strong>
                      {a.scenario === "heart"
                        ? "Ознаки серцевого захворювання"
                        : "Ознаки ранньої стадії діабету"}
                    </strong>
                    <small>
                      {fmt(a.created_at)} · {a.author} · {a.model_version}
                    </small>
                    <details>
                      <summary>Snapshot вхідних параметрів</summary>
                      <pre>{JSON.stringify(a.input_snapshot, null, 2)}</pre>
                    </details>
                  </div>
                  <div className="score">
                    {(a.probability * 100).toFixed(1)}%
                    <small>поріг {(a.threshold * 100).toFixed(0)}%</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Збережених оцінок ще немає." />
          )}
        </section>
      )}
      {edit && (
        <PatientForm
          initial={p}
          onSave={async (v) => {
            await api(`/api/patients/${id}`, {
              method: "PATCH",
              body: JSON.stringify(v),
            });
            setEdit(false);
            refresh();
          }}
          onCancel={() => setEdit(false)}
        />
      )}
      {obsForm && (
        <ObservationForm
          initial={obsForm === true ? undefined : obsForm}
          encounters={enc.data || []}
          onSave={saveObs}
          onCancel={() => setObsForm(null)}
        />
      )}
      {encForm && (
        <EncounterForm
          onSave={async (v) => {
            await api(`/api/patients/${id}/encounters`, {
              method: "POST",
              body: JSON.stringify(v),
            });
            setEncForm(false);
            enc.refresh();
          }}
          onCancel={() => setEncForm(false)}
        />
      )}
    </>
  );
}

function AssessmentPage() {
  const [query] = useSearchParams();
  const [patientId, setPatientId] = useState(query.get("patient") || ""),
    [scenario, setScenario] = useState("heart"),
    [values, setValues] = useState<Record<string, string>>({}),
    [result, setResult] = useState<Assessment | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const patients = useLoad<{ items: Patient[] }>("/api/patients?size=100");
  const scenarios = useLoad<Scenario[]>("/api/scenarios");
  const current = scenarios.data?.find((s) => s.key === scenario);
  useEffect(() => {
    if (current) {
      const initial: Record<string, string> = {};
      current.fields.forEach((f) => {
        initial[f.key] =
          f.type === "select" ? Object.keys(f.options || {})[0] : "";
      });
      setValues(initial);
      setResult(null);
    }
  }, [scenario, scenarios.data]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const features: Record<string, string | number> = {};
      current?.fields.forEach((f) => {
        features[f.key] =
          f.type === "number" ? Number(values[f.key]) : values[f.key];
      });
      setResult(
        await api<Assessment>(`/api/patients/${patientId}/assessments`, {
          method: "POST",
          body: JSON.stringify({ scenario, features }),
        }),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="МОДЕЛЬНИЙ АНАЛІЗ"
        title="Нова ML-оцінка"
        desc="Оберіть сценарій і введіть саме ті ознаки, які використовувались під час навчання."
      />
      <Notice>
        <FlaskConical size={17} /> {warning}
      </Notice>
      <div className="assessment-layout">
        <form className="card assessment-form" onSubmit={submit}>
          <div className="card-heading">
            <div>
              <p className="eyebrow">КРОК 01</p>
              <h2>Сценарій та картка</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Демонстраційний пацієнт
              <select
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">Оберіть картку</option>
                {patients.data?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Захворювання
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              >
                <option value="heart">Серцеве захворювання</option>
                <option value="diabetes">Рання стадія діабету</option>
              </select>
            </label>
          </div>
          <div className="section-divider">
            <p className="eyebrow">КРОК 02</p>
            <h2>Вхідні ознаки</h2>
            <p className="subtle">
              Поля відповідають набору UCI #{current?.dataset_id}. Значення є
              демонстраційними.
            </p>
          </div>
          {scenarios.loading ? (
            <Loader />
          ) : (
            <div className="form-grid fields">
              {current?.fields.map((f) => (
                <label key={f.key}>
                  {f.label} {f.unit && <span className="unit">({f.unit})</span>}
                  {f.type === "select" ? (
                    <select
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                    >
                      {Object.entries(f.options || {}).map(([key, label]) => (
                        <option value={key} key={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      required
                      min={f.min ?? undefined}
                      max={f.max ?? undefined}
                      step={f.key === "oldpeak" ? "0.1" : "1"}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                      placeholder={f.min !== null ? `${f.min}–${f.max}` : ""}
                    />
                  )}
                  <small className="field-key">{f.key}</small>
                </label>
              ))}
            </div>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <button
            className="btn primary full submit"
            disabled={busy || !current || !patientId}
          >
            {busy ? "Обчислення…" : "Обчислити та зберегти оцінку"}{" "}
            <ArrowRight size={17} />
          </button>
        </form>
        <aside className="assessment-side">
          <div className="card result-card">
            <div className="icon-circle">
              <Activity size={24} />
            </div>
            <p className="eyebrow">РЕЗУЛЬТАТ МОДЕЛІ</p>
            {result ? (
              <>
                <div className="probability">
                  {(result.probability * 100).toFixed(1)}
                  <span>%</span>
                </div>
                <p>Модельна ймовірність позитивного класу</p>
                <div className="meter">
                  <span style={{ width: `${result.probability * 100}%` }} />
                </div>
                <div className="result-meta">
                  <span>Поріг класифікації</span>
                  <strong>{(result.threshold * 100).toFixed(0)}%</strong>
                </div>
                <div className="result-meta">
                  <span>Версія моделі</span>
                  <strong className="mono">{result.model_version}</strong>
                </div>
                <div className="result-meta">
                  <span>Збережено</span>
                  <strong>{fmt(result.created_at)}</strong>
                </div>
                <NavLink className="text-link" to={`/patients/${patientId}`}>
                  Відкрити історію пацієнта <ArrowRight size={16} />
                </NavLink>
              </>
            ) : (
              <>
                <h2>Очікування даних</h2>
                <p>
                  Після обчислення тут з'явиться фактичний вихід навченої моделі
                  та її версія.
                </p>
              </>
            )}
          </div>
          <div className="side-warning">
            <ShieldCheck size={20} />
            <div>
              <strong>Важливе обмеження</strong>
              <p>
                Цей вихід є експериментальною статистикою на малих дослідницьких
                вибірках. Його не можна використовувати для клінічних рішень.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Plot({
  scenario,
  name,
  alt,
}: {
  scenario: string;
  name: string;
  alt: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let objectUrl = "";
    const run = async () => {
      const response = await fetch(`/api/models/${scenario}/plots/${name}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (response.ok) {
        objectUrl = URL.createObjectURL(await response.blob());
        setUrl(objectUrl);
      }
    };
    run();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [scenario, name]);
  return url ? <img className="plot" src={url} alt={alt} /> : <Loader />;
}
function Models() {
  const { data, error, loading } = useLoad<Model[]>("/api/models");
  const [tab, setTab] = useState("heart");
  const comparison = useLoad<
    {
      algorithm: string;
      cv_roc_auc: number;
      accuracy: number;
      precision: number;
      recall: number;
      specificity: number;
      f1: number;
      roc_auc: number;
      brier: number;
    }[]
  >(`/api/models/${tab}/comparison`, [tab]);
  if (loading) return <Loader />;
  if (error || !data) return <Notice tone="error">{error}</Notice>;
  const model = data.find((m) => m.scenario === tab);
  return (
    <>
      <PageTitle
        eyebrow="ВІДТВОРЮВАНІ ЕКСПЕРИМЕНТИ"
        title="Дослідження моделей"
        desc="Фактичні результати відкладеного тестування двох незалежних наборів UCI."
      />
      <Notice>
        <FlaskConical size={17} /> Моделі обрано за кросвалідацією train.
        Показники test є оцінкою на відкладеній вибірці, не клінічною
        валідацією.
      </Notice>
      <div className="scenario-tabs">
        <button
          className={tab === "heart" ? "active" : ""}
          onClick={() => setTab("heart")}
        >
          <HeartPulse size={18} /> Серцеве захворювання
        </button>
        <button
          className={tab === "diabetes" ? "active" : ""}
          onClick={() => setTab("diabetes")}
        >
          <Activity size={18} /> Рання стадія діабету
        </button>
      </div>
      {model?.available === false || !model ? (
        <Notice tone="error">
          Модель ще не навчена. Запустіть скрипт навчання з README.
        </Notice>
      ) : (
        <>
          <div className="model-hero">
            <div>
              <p className="eyebrow">ОБРАНА МОДЕЛЬ</p>
              <h2>{model.algorithm}</h2>
              <p>
                UCI #{tab === "heart" ? "45" : "529"} · {model.source_rows} у
                джерелі · {model.rows} після очищення · CC BY 4.0
              </p>
            </div>
            <div className="model-badge">
              <span>ROC-AUC test</span>
              <strong>{Number(model.test_metrics.roc_auc).toFixed(3)}</strong>
            </div>
          </div>
          <div className="metric-grid">
            {[
              ["Accuracy", "accuracy"],
              ["Precision", "precision"],
              ["Sensitivity", "recall"],
              ["Specificity", "specificity"],
              ["F1", "f1"],
              ["Brier", "brier"],
            ].map(([label, key]) => (
              <div className="metric" key={key}>
                <span>{label}</span>
                <strong>{Number(model.test_metrics[key]).toFixed(3)}</strong>
              </div>
            ))}
          </div>
          <section className="card comparison">
            <div className="card-heading">
              <div>
                <p className="eyebrow">ПОРІВНЯННЯ</p>
                <h2>Алгоритми на відкладеній вибірці</h2>
              </div>
            </div>
            {comparison.error ? (
              <Notice tone="error">{comparison.error}</Notice>
            ) : comparison.loading ? (
              <Loader />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        "АЛГОРИТМ",
                        "CV ROC-AUC",
                        "ACCURACY",
                        "PRECISION",
                        "SENSITIVITY",
                        "SPECIFICITY",
                        "F1",
                        "TEST ROC-AUC",
                        "BRIER",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.data?.map((row) => (
                      <tr key={row.algorithm}>
                        <td>
                          <strong>{row.algorithm}</strong>
                          {row.algorithm === model.algorithm && (
                            <span className="tag green chosen">Обрана</span>
                          )}
                        </td>
                        {[
                          row.cv_roc_auc,
                          row.accuracy,
                          row.precision,
                          row.recall,
                          row.specificity,
                          row.f1,
                          row.roc_auc,
                          row.brier,
                        ].map((n, i) => (
                          <td key={i}>{n.toFixed(3)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <div className="model-grid">
            <section className="card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">ВІЗУАЛІЗАЦІЯ</p>
                  <h2>ROC-крива</h2>
                </div>
              </div>
              <Plot
                scenario={tab}
                name="roc_curve"
                alt="ROC-крива відкладеної вибірки"
              />
            </section>
            <section className="card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">ПЕРЕВІРКА</p>
                  <h2>Матриця помилок</h2>
                </div>
              </div>
              <Plot
                scenario={tab}
                name="confusion_matrix"
                alt="Матриця помилок"
              />
            </section>
            <section className="card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">ДАНІ</p>
                  <h2>Розподіл класів</h2>
                </div>
              </div>
              <Plot
                scenario={tab}
                name="class_distribution"
                alt="Розподіл класів"
              />
            </section>
            <section className="card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">ЯКІСТЬ ДАНИХ</p>
                  <h2>Пропуски</h2>
                </div>
              </div>
              <Plot
                scenario={tab}
                name="missing_values"
                alt="Пропущені значення"
              />
            </section>
          </div>
          <section className="card metadata">
            <h2>Паспорт експерименту</h2>
            <div className="metadata-grid">
              <div>
                <span>Версія</span>
                <strong className="mono">{model.version}</strong>
              </div>
              <div>
                <span>Навчання / тест</span>
                <strong>
                  {model.train_rows} / {model.test_rows}
                </strong>
              </div>
              <div>
                <span>CV ROC-AUC</span>
                <strong>{model.cv_roc_auc.toFixed(3)}</strong>
              </div>
              <div>
                <span>SHA-256 архіву</span>
                <strong className="mono">
                  {model.archive_sha256.slice(0, 20)}…
                </strong>
              </div>
            </div>
            <a
              className="text-link"
              href={model.source_url}
              target="_blank"
              rel="noreferrer"
            >
              Офіційне джерело UCI <ArrowRight size={16} />
            </a>
            <p className="subtle">
              Малі та зміщені вибірки; результати не можна переносити на
              клінічну практику без зовнішньої валідації.
            </p>
          </section>
        </>
      )}
    </>
  );
}

function Admin({ currentUser }: { currentUser: User }) {
  const users =
    useLoad<{ id: string; username: string; role: string; active: boolean }[]>(
      "/api/users",
    );
  const audit = useLoad<{
    items: {
      id: string;
      actor: string;
      action: string;
      entity_type: string;
      entity_id: string;
      created_at: string;
    }[];
    total: number;
  }>("/api/audit");
  const [form, setForm] = useState({
      username: "",
      password: "",
      role: "doctor",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ username: "", password: "", role: "doctor" });
      users.refresh();
      audit.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="УПРАВЛІННЯ ДОСТУПОМ"
        title="Адміністрування"
        desc="Демонстраційні облікові записи та журнал дій."
      />
      <div className="detail-grid">
        <section className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">КОРИСТУВАЧІ</p>
              <h2>Облікові записи</h2>
            </div>
          </div>
          {users.data?.map((u) => (
            <div className="admin-user" key={u.id}>
              <span className="mini-avatar">{u.username[0].toUpperCase()}</span>
              <div>
                <strong>{u.username}</strong>
                <small>{u.role}</small>
              </div>
              <button
                className={`tag ${u.active ? "green" : ""}`}
                disabled={u.id === currentUser.id}
                title={
                  u.id === currentUser.id
                    ? "Власний обліковий запис не можна вимкнути"
                    : "Змінити активність"
                }
                onClick={async () => {
                  try {
                    await api(`/api/users/${u.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ active: !u.active }),
                    });
                    users.refresh();
                    audit.refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {u.active ? "Активний" : "Вимкнений"}
              </button>
            </div>
          ))}
          <div className="section-divider">
            <h2>Додати користувача</h2>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <form onSubmit={create} className="stack">
            <label>
              Логін
              <input
                required
                minLength={3}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label>
              Пароль (від 12 символів)
              <input
                required
                type="password"
                minLength={12}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label>
              Роль
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="doctor">Лікар</option>
                <option value="admin">Адміністратор</option>
              </select>
            </label>
            <button className="btn primary" disabled={busy}>
              Створити обліковий запис
            </button>
          </form>
        </section>
        <section className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">АУДИТ</p>
              <h2>Останні події</h2>
            </div>
            <span className="tag">{audit.data?.total ?? 0} подій</span>
          </div>
          {audit.data?.items.length ? (
            <div className="audit-list">
              {audit.data.items.map((a) => (
                <div className="audit-row" key={a.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>
                      {a.actor} · {a.action}
                    </strong>
                    <small>
                      {a.entity_type} · {a.entity_id.slice(0, 8)} ·{" "}
                      {fmt(a.created_at)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Подій ще немає." />
          )}
        </section>
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(Boolean(token()));
  useEffect(() => {
    if (token())
      api<User>("/api/auth/me")
        .then(setUser)
        .catch(() => sessionStorage.removeItem("medinsight_token"))
        .finally(() => setLoading(false));
  }, []);
  if (loading) return <Loader />;
  if (!user)
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  return (
    <Shell
      user={user}
      logout={() => {
        sessionStorage.removeItem("medinsight_token");
        setUser(null);
      }}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route path="/models" element={<Models />} />
        <Route
          path="/admin"
          element={
            user.role === "admin" ? (
              <Admin currentUser={user} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}
