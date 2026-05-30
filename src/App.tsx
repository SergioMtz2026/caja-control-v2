// @ts-nocheck
import { useState, useReducer, useMemo, useEffect } from "react";

// ── Paleta y estilos globales ───────────────────────────────────────────
const G = {
  bg: "#0f1117",
  surface: "#181c27",
  card: "#1e2333",
  border: "#2a3048",
  accent: "#f5a623",
  accentDim: "#b87a1a",
  green: "#2ecc71",
  red: "#e74c3c",
  blue: "#4a9eff",
  purple: "#a78bfa",
  text: "#e8eaf0",
  muted: "#7a859e",
  font: "'DM Mono', 'Courier New', monospace",
  fontSans: "'DM Sans', sans-serif",
};

const css = (styles) => styles;

// ── Utilidades ──────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
const now = () => new Date().toLocaleString("es-MX");
const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// ── Estado inicial ──────────────────────────────────────────────────────
const STORAGE_KEY = "cajacontrol_v1";

const defaultState = {
  caja: 0,
  ventas: [],
  movimientos: [],
  inventario: [],
  proveedores: [],
};

const loadState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultState;
  } catch {
    return defaultState;
  }
};

const initialState = loadState();

function reducer(state, action) {
  switch (action.type) {
    case "VENTA": {
      const { items, total, nota } = action;
      const newInv = state.inventario.map((p) => {
        const item = items.find((i) => i.id === p.id);
        return item ? { ...p, cantidad: p.cantidad - item.qty } : p;
      });
      const venta = { id: uid(), fecha: now(), items, total, nota, tipo: "venta" };
      return {
        ...state,
        caja: state.caja + total,
        ventas: [venta, ...state.ventas],
        movimientos: [{ id: uid(), fecha: now(), tipo: "entrada", concepto: `Venta #${venta.id}`, monto: total }, ...state.movimientos],
        inventario: newInv,
      };
    }
    case "GASTO": {
      const { concepto, monto } = action;
      return {
        ...state,
        caja: state.caja - monto,
        movimientos: [{ id: uid(), fecha: now(), tipo: "salida", concepto, monto }, ...state.movimientos],
      };
    }
    case "PROVEEDOR": {
      const { proveedor, items, total } = action;
      const newInv = state.inventario.map((p) => {
        const item = items.find((i) => i.id === p.id);
        return item ? { ...p, cantidad: p.cantidad + item.qty } : p;
      });
      const rec = { id: uid(), fecha: now(), proveedor, items, total };
      return {
        ...state,
        caja: state.caja - total,
        proveedores: [rec, ...state.proveedores],
        movimientos: [{ id: uid(), fecha: now(), tipo: "salida", concepto: `Proveedor: ${proveedor}`, monto: total }, ...state.movimientos],
        inventario: newInv,
      };
    }
    case "ADD_PRODUCTO": {
      if (state.inventario.length >= 75) return state;
      return { ...state, inventario: [...state.inventario, { ...action.prod, id: uid() }] };
    }
    case "EDIT_PRODUCTO": {
      return {
        ...state,
        inventario: state.inventario.map(p =>
          p.id === action.id ? { ...p, [action.field]: action.value } : p
        ),
      };
    }
    case "DELETE_PRODUCTO": {
      return { ...state, inventario: state.inventario.filter(p => p.id !== action.id) };
    }
    case "FONDO": {
      return {
        ...state,
        caja: state.caja + action.monto,
        movimientos: [{ id: uid(), fecha: now(), tipo: "entrada", concepto: "Fondo inicial / depósito", monto: action.monto }, ...state.movimientos],
      };
    }
    default:
      return state;
  }
}

// ── Componentes base ────────────────────────────────────────────────────
const Tag = ({ color, children }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontFamily: G.font }}>
    {children}
  </span>
);

const Btn = ({ onClick, children, color = G.accent, small, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: disabled ? "#2a3048" : color,
      color: disabled ? G.muted : color === G.accent ? "#111" : "#fff",
      border: "none",
      borderRadius: 6,
      padding: small ? "6px 14px" : "10px 20px",
      fontFamily: G.font,
      fontSize: small ? 12 : 13,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "opacity .15s",
    }}
  >
    {children}
  </button>
);

const Input = ({ value, onChange, placeholder, type = "text" }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      background: G.bg,
      border: `1px solid ${G.border}`,
      borderRadius: 6,
      padding: "8px 12px",
      color: G.text,
      fontFamily: G.font,
      fontSize: 13,
      width: "100%",
      outline: "none",
    }}
  />
);

const Card = ({ children, style }) => (
  <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 20, ...style }}>
    {children}
  </div>
);

const Divider = () => <div style={{ borderTop: `1px solid ${G.border}`, margin: "16px 0" }} />;

// ── MÓDULO: Dashboard ───────────────────────────────────────────────────
function Dashboard({ state, dispatch }) {
  const [fondo, setFondo] = useState("");

  const totalVentas = state.ventas.reduce((a, v) => a + v.total, 0);
  const totalGastos = state.movimientos.filter(m => m.tipo === "salida").reduce((a, m) => a + m.monto, 0);
  const stockBajo = state.inventario.filter(p => p.cantidad <= 5);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12 }}>
        {[
          { label: "CAJA ACTUAL", value: fmt(state.caja), color: G.accent },
          { label: "VENTAS TOTALES", value: fmt(totalVentas), color: G.green },
          { label: "EGRESOS TOTALES", value: fmt(totalGastos), color: G.red },
          { label: "MOVIMIENTOS", value: state.movimientos.length, color: G.blue },
        ].map((k) => (
          <Card key={k.label} style={{ textAlign: "center" }}>
            <div style={{ color: G.muted, fontFamily: G.font, fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>{k.label}</div>
            <div style={{ color: k.color, fontFamily: G.font, fontSize: 22, fontWeight: 700 }}>{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Fondo */}
      <Card>
        <div style={{ color: G.accent, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>AGREGAR FONDO / DEPÓSITO</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Input value={fondo} onChange={setFondo} placeholder="Monto a depositar" type="number" />
          <Btn onClick={() => { if (fondo > 0) { dispatch({ type: "FONDO", monto: +fondo }); setFondo(""); } }}>+ Agregar</Btn>
        </div>
      </Card>

      {/* Stock bajo */}
      {stockBajo.length > 0 && (
        <Card style={{ borderColor: G.red + "66" }}>
          <div style={{ color: G.red, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>⚠ STOCK BAJO</div>
          {stockBajo.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${G.border}`, color: G.text, fontFamily: G.font, fontSize: 13 }}>
              <span>{p.nombre}</span>
              <Tag color={G.red}>{p.cantidad} uds</Tag>
            </div>
          ))}
        </Card>
      )}

      {/* Últimos movimientos */}
      <Card>
        <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>ÚLTIMOS MOVIMIENTOS</div>
        {state.movimientos.slice(0, 8).map(m => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${G.border}` }}>
            <div>
              <div style={{ color: G.text, fontFamily: G.fontSans, fontSize: 13 }}>{m.concepto}</div>
              <div style={{ color: G.muted, fontSize: 11, fontFamily: G.font }}>{m.fecha}</div>
            </div>
            <Tag color={m.tipo === "entrada" ? G.green : G.red}>
              {m.tipo === "entrada" ? "+" : "-"}{fmt(m.monto)}
            </Tag>
          </div>
        ))}
        {state.movimientos.length === 0 && <div style={{ color: G.muted, fontFamily: G.font, fontSize: 13 }}>Sin movimientos aún</div>}
      </Card>
    </div>
  );
}

// ── MÓDULO: Nueva Venta ─────────────────────────────────────────────────
function NuevaVenta({ state, dispatch }) {
  const [carrito, setCarrito] = useState([]);
  const [nota, setNota] = useState("");
  const [done, setDone] = useState(null);

  const total = carrito.reduce((a, i) => a + i.precio * i.qty, 0);

  const addItem = (prod) => {
    setCarrito(prev => {
      const ex = prev.find(i => i.id === prod.id);
      if (ex) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...prod, qty: 1 }];
    });
  };

  const removeItem = (id) => setCarrito(prev => prev.filter(i => i.id !== id));

  const confirmar = () => {
    if (carrito.length === 0) return;
    dispatch({ type: "VENTA", items: carrito, total, nota });
    setDone({ items: carrito, total });
    setCarrito([]);
    setNota("");
    setTimeout(() => setDone(null), 3000);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Productos disponibles */}
      <Card>
        <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>PRODUCTOS</div>
        {state.inventario.map(p => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${G.border}` }}>
            <div>
              <div style={{ color: G.text, fontFamily: G.fontSans, fontSize: 14 }}>{p.nombre}</div>
              <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11 }}>Stock: {p.cantidad} · {fmt(p.precio)}</div>
            </div>
            <Btn small onClick={() => addItem(p)} disabled={p.cantidad === 0 || carrito.find(i => i.id === p.id)?.qty >= p.cantidad}>+ Agregar</Btn>
          </div>
        ))}
      </Card>

      {/* Carrito */}
      <Card>
        <div style={{ color: G.accent, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>CARRITO</div>
        {carrito.length === 0 && <div style={{ color: G.muted, fontFamily: G.font, fontSize: 13 }}>Agrega productos a la venta</div>}
        {carrito.map(i => (
          <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${G.border}` }}>
            <div>
              <div style={{ color: G.text, fontFamily: G.fontSans, fontSize: 13 }}>{i.nombre}</div>
              <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11 }}>x{i.qty} · {fmt(i.precio * i.qty)}</div>
            </div>
            <button onClick={() => removeItem(i.id)} style={{ background: "none", border: "none", color: G.red, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        ))}
        <Divider />
        <div style={{ marginBottom: 12 }}>
          <Input value={nota} onChange={setNota} placeholder="Nota (opcional)" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: G.accent, fontFamily: G.font, fontSize: 20, fontWeight: 700 }}>{fmt(total)}</div>
          <Btn onClick={confirmar} disabled={carrito.length === 0}>Confirmar venta</Btn>
        </div>
        {done && (
          <div style={{ marginTop: 12, padding: 12, background: G.green + "22", border: `1px solid ${G.green}44`, borderRadius: 6, color: G.green, fontFamily: G.font, fontSize: 13 }}>
            ✓ Venta registrada — {fmt(done.total)}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Celda editable inline ───────────────────────────────────────────────
function EditCell({ value, field, prodId, dispatch, type = "text", color }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  const commit = () => {
    const parsed = type === "number" ? +val : val;
    if (parsed !== value) dispatch({ type: "EDIT_PRODUCTO", id: prodId, field, value: parsed });
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        style={{
          background: G.bg, border: `1px solid ${G.accent}`, borderRadius: 4,
          color: G.accent, fontFamily: G.font, fontSize: 13,
          padding: "4px 8px", width: type === "number" ? 80 : 160, outline: "none",
        }}
      />
    );
  }

  return (
    <span
      onClick={() => { setVal(value); setEditing(true); }}
      title="Click para editar"
      style={{
        color: color || G.text, cursor: "text", borderBottom: `1px dashed ${G.border}`,
        padding: "2px 2px", fontFamily: G.font, fontSize: 13,
        transition: "border-color .15s",
      }}
    >
      {value}
    </span>
  );
}

// ── MÓDULO: Inventario ──────────────────────────────────────────────────
function Inventario({ state, dispatch }) {
  const [form, setForm] = useState({ nombre: "", cantidad: "", precio: "", costo: "" });
  const [ok, setOk] = useState(false);
  const [buscar, setBuscar] = useState("");

  const limite = 75;
  const total = state.inventario.length;
  const lleno = total >= limite;

  const agregar = () => {
    if (!form.nombre || !form.cantidad || !form.precio || lleno) return;
    dispatch({ type: "ADD_PRODUCTO", prod: { nombre: form.nombre, cantidad: +form.cantidad, precio: +form.precio, costo: +form.costo || 0 } });
    setForm({ nombre: "", cantidad: "", precio: "", costo: "" });
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  };

  const filtrados = state.inventario.filter(p =>
    p.nombre.toLowerCase().includes(buscar.toLowerCase())
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Tabla */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11, letterSpacing: 2 }}>
            INVENTARIO
            <span style={{ marginLeft: 10, color: lleno ? G.red : G.accent }}>{total}/{limite}</span>
          </div>
          <div style={{ width: 200 }}>
            <Input value={buscar} onChange={setBuscar} placeholder="Buscar producto…" />
          </div>
        </div>
        <div style={{ color: G.muted, fontFamily: G.font, fontSize: 10, marginBottom: 10, letterSpacing: 1 }}>
          ✎ Click en cualquier celda para editar
        </div>
        <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: G.font, fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: G.card, zIndex: 1 }}>
              <tr style={{ color: G.muted, textAlign: "left" }}>
                {["Producto", "Stock", "Precio venta", "Costo", "Margen", ""].map(h => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${G.border}`, fontWeight: 400, letterSpacing: 1, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const margen = p.costo > 0 ? (((p.precio - p.costo) / p.costo) * 100).toFixed(0) : "—";
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                    <td style={{ padding: "10px 12px" }}>
                      <EditCell value={p.nombre} field="nombre" prodId={p.id} dispatch={dispatch} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <EditCell value={p.cantidad} field="cantidad" prodId={p.id} dispatch={dispatch} type="number" color={p.cantidad <= 5 ? G.red : G.green} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <EditCell value={p.precio} field="precio" prodId={p.id} dispatch={dispatch} type="number" color={G.accent} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <EditCell value={p.costo} field="costo" prodId={p.id} dispatch={dispatch} type="number" color={G.muted} />
                    </td>
                    <td style={{ padding: "10px 12px", color: G.purple }}>{margen !== "—" ? `${margen}%` : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        onClick={() => dispatch({ type: "DELETE_PRODUCTO", id: p.id })}
                        title="Eliminar"
                        style={{ background: "none", border: "none", color: G.red, cursor: "pointer", fontSize: 14, opacity: 0.5 }}
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 16, color: G.muted, fontFamily: G.font, fontSize: 13 }}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Nuevo producto */}
      <Card style={{ borderColor: lleno ? G.red + "55" : G.border }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ color: G.accent, fontFamily: G.font, fontSize: 11, letterSpacing: 2 }}>AGREGAR PRODUCTO</div>
          {lleno && <span style={{ color: G.red, fontFamily: G.font, fontSize: 11 }}>⚠ Límite de 75 productos alcanzado</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, opacity: lleno ? 0.4 : 1 }}>
          <Input value={form.nombre} onChange={v => setForm(f => ({ ...f, nombre: v }))} placeholder="Nombre del producto" />
          <Input value={form.cantidad} onChange={v => setForm(f => ({ ...f, cantidad: v }))} placeholder="Cantidad" type="number" />
          <Input value={form.precio} onChange={v => setForm(f => ({ ...f, precio: v }))} placeholder="Precio venta" type="number" />
          <Input value={form.costo} onChange={v => setForm(f => ({ ...f, costo: v }))} placeholder="Costo (op.)" type="number" />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <Btn onClick={agregar} disabled={lleno}>Agregar</Btn>
          {ok && <span style={{ color: G.green, fontFamily: G.font, fontSize: 12 }}>✓ Producto agregado</span>}
        </div>
      </Card>
    </div>
  );
}

// ── MÓDULO: Proveedores ─────────────────────────────────────────────────
function Proveedores({ state, dispatch }) {
  const [nombre, setNombre] = useState("");
  const [items, setItems] = useState([]);
  const [done, setDone] = useState(false);

  const addItem = (prod) => {
    setItems(prev => {
      const ex = prev.find(i => i.id === prod.id);
      if (ex) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...prod, qty: 1 }];
    });
  };

  const total = items.reduce((a, i) => a + (i.costo || i.precio) * i.qty, 0);

  const registrar = () => {
    if (!nombre || items.length === 0) return;
    dispatch({ type: "PROVEEDOR", proveedor: nombre, items, total });
    setNombre("");
    setItems([]);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 14 }}>REGISTRAR RECIBO DE PROVEEDOR</div>
        <div style={{ marginBottom: 12 }}>
          <Input value={nombre} onChange={setNombre} placeholder="Nombre del proveedor" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11, marginBottom: 8 }}>Selecciona productos recibidos:</div>
          {state.inventario.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${G.border}` }}>
              <div style={{ color: G.text, fontFamily: G.fontSans, fontSize: 13 }}>{p.nombre} · <span style={{ color: G.muted }}>costo {fmt(p.costo || 0)}</span></div>
              <Btn small onClick={() => addItem(p)}>+ Recibir</Btn>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <>
            <Divider />
            <div style={{ color: G.accent, fontFamily: G.font, fontSize: 12, marginBottom: 8 }}>Recibido:</div>
            {items.map(i => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", color: G.text, fontFamily: G.font, fontSize: 13, padding: "4px 0" }}>
                <span>{i.nombre} x{i.qty}</span>
                <span style={{ color: G.muted }}>{fmt((i.costo || 0) * i.qty)}</span>
              </div>
            ))}
            <Divider />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: G.accent, fontFamily: G.font, fontSize: 18, fontWeight: 700 }}>Total: {fmt(total)}</div>
              <Btn onClick={registrar} color={G.purple}>Registrar recibo</Btn>
            </div>
          </>
        )}
        {done && <div style={{ marginTop: 10, color: G.green, fontFamily: G.font, fontSize: 12 }}>✓ Recibo registrado correctamente</div>}
      </Card>

      {/* Historial proveedores */}
      <Card>
        <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>HISTORIAL DE RECIBOS</div>
        {state.proveedores.length === 0 && <div style={{ color: G.muted, fontFamily: G.font, fontSize: 13 }}>Sin recibos aún</div>}
        {state.proveedores.map(r => (
          <div key={r.id} style={{ padding: "10px 0", borderBottom: `1px solid ${G.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: G.text, fontFamily: G.fontSans, fontSize: 14 }}>{r.proveedor}</div>
                <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11 }}>{r.fecha} · #{r.id}</div>
              </div>
              <Tag color={G.purple}>{fmt(r.total)}</Tag>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── MÓDULO: Gastos ──────────────────────────────────────────────────────
function Gastos({ state, dispatch }) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [ok, setOk] = useState(false);

  const registrar = () => {
    if (!concepto || !monto || monto <= 0) return;
    dispatch({ type: "GASTO", concepto, monto: +monto });
    setConcepto("");
    setMonto("");
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  };

  const gastos = state.movimientos.filter(m => m.tipo === "salida" && !m.concepto.startsWith("Proveedor:"));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={{ color: G.red, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 14 }}>REGISTRAR GASTO / SALIDA</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 12 }}>
          <Input value={concepto} onChange={setConcepto} placeholder="Concepto del gasto" />
          <Input value={monto} onChange={setMonto} placeholder="Monto" type="number" />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Btn onClick={registrar} color={G.red}>Registrar salida</Btn>
          {ok && <span style={{ color: G.green, fontFamily: G.font, fontSize: 12 }}>✓ Gasto registrado</span>}
        </div>
      </Card>

      <Card>
        <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>HISTORIAL DE GASTOS</div>
        {gastos.length === 0 && <div style={{ color: G.muted, fontFamily: G.font, fontSize: 13 }}>Sin gastos registrados</div>}
        {gastos.map(g => (
          <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${G.border}` }}>
            <div>
              <div style={{ color: G.text, fontFamily: G.fontSans, fontSize: 13 }}>{g.concepto}</div>
              <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11 }}>{g.fecha}</div>
            </div>
            <Tag color={G.red}>-{fmt(g.monto)}</Tag>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── MÓDULO: Historial de Ventas ─────────────────────────────────────────
function HistorialVentas({ state }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={{ color: G.muted, fontFamily: G.font, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>HISTORIAL DE VENTAS</div>
        {state.ventas.length === 0 && <div style={{ color: G.muted, fontFamily: G.font, fontSize: 13 }}>Sin ventas registradas</div>}
        {state.ventas.map(v => (
          <div key={v.id} style={{ padding: "12px 0", borderBottom: `1px solid ${G.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div>
                <span style={{ color: G.accent, fontFamily: G.font, fontSize: 12, marginRight: 10 }}>#{v.id}</span>
                <span style={{ color: G.muted, fontFamily: G.font, fontSize: 11 }}>{v.fecha}</span>
              </div>
              <Tag color={G.green}>{fmt(v.total)}</Tag>
            </div>
            {v.items.map(i => (
              <div key={i.id} style={{ color: G.muted, fontFamily: G.font, fontSize: 12, paddingLeft: 8 }}>
                · {i.nombre} x{i.qty} = {fmt(i.precio * i.qty)}
              </div>
            ))}
            {v.nota && <div style={{ color: G.blue, fontFamily: G.font, fontSize: 11, paddingLeft: 8, marginTop: 4 }}>📝 {v.nota}</div>}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── APP PRINCIPAL ───────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "venta", label: "Nueva Venta", icon: "⊕" },
  { id: "inventario", label: "Inventario", icon: "◫" },
  { id: "proveedores", label: "Proveedores", icon: "↓" },
  { id: "gastos", label: "Gastos", icon: "↑" },
  { id: "historial", label: "Historial", icon: "≡" },
];

export default function CajaControl() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  return (
    <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: G.fontSans }}>
      {/* Header */}
      <div style={{ background: G.surface, borderBottom: `1px solid ${G.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: G.accent, fontFamily: G.font, fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>CAJA</span>
          <span style={{ color: G.border, fontSize: 20 }}>|</span>
          <span style={{ color: G.muted, fontFamily: G.font, fontSize: 11, letterSpacing: 2 }}>CONTROL DE NEGOCIOS</span>
        </div>
        <div style={{ color: G.accent, fontFamily: G.font, fontSize: 16, fontWeight: 700 }}>{fmt(state.caja)}</div>
      </div>

      {/* Nav */}
      <div style={{ background: G.surface, borderBottom: `1px solid ${G.border}`, display: "flex", padding: "0 24px", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none",
            border: "none",
            borderBottom: tab === t.id ? `2px solid ${G.accent}` : "2px solid transparent",
            color: tab === t.id ? G.accent : G.muted,
            fontFamily: G.font,
            fontSize: 12,
            padding: "12px 16px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            letterSpacing: 1,
            transition: "color .15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {tab === "dashboard" && <Dashboard state={state} dispatch={dispatch} />}
        {tab === "venta" && <NuevaVenta state={state} dispatch={dispatch} />}
        {tab === "inventario" && <Inventario state={state} dispatch={dispatch} />}
        {tab === "proveedores" && <Proveedores state={state} dispatch={dispatch} />}
        {tab === "gastos" && <Gastos state={state} dispatch={dispatch} />}
        {tab === "historial" && <HistorialVentas state={state} />}
      </div>
    </div>
  );
}
