// Registro de cargas: sesiones de entrenamiento guardadas en el navegador.
// Sesión: { id, fecha: "AAAA-MM-DD", dia: "Torso A", creada: ISO,
//           ejercicios: [{ id, series: [{ kg: number|null, reps: number }] }] }
(function () {
  "use strict";

  const CLAVE = "nm.sesiones";

  function leer() {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  let sesiones = leer();

  function persistir() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(sesiones));
      return true;
    } catch {
      return false;
    }
  }

  const porFecha = (a, b) => a.fecha.localeCompare(b.fecha) || a.creada.localeCompare(b.creada);

  // Más recientes primero.
  function todas() {
    return sesiones.slice().sort(porFecha).reverse();
  }

  function agregar(sesion) {
    sesiones.push(sesion);
    return persistir();
  }

  function borrar(id) {
    sesiones = sesiones.filter((s) => s.id !== id);
    return persistir();
  }

  function reemplazar(lista) {
    sesiones = lista;
    return persistir();
  }

  function valida(s) {
    return s && typeof s.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha) && Array.isArray(s.ejercicios) &&
      s.ejercicios.every((e) => typeof e.id === "string" && Array.isArray(e.series) &&
        e.series.every((x) => typeof x.reps === "number" && (x.kg === null || typeof x.kg === "number")));
  }

  // Registros de un ejercicio, del más antiguo al más reciente.
  function historial(ejId) {
    return sesiones.slice().sort(porFecha).flatMap((s) =>
      s.ejercicios.filter((e) => e.id === ejId).map((e) => ({ fecha: s.fecha, series: e.series, sesionId: s.id })));
  }

  function ultima(ejId) {
    const h = historial(ejId);
    return h.length ? h[h.length - 1] : null;
  }

  // "8–12" -> { min: 8, tope: 12 }
  function rango(reps) {
    const n = (String(reps).match(/\d+/g) || []).map(Number);
    return n.length ? { min: n[0], tope: n[n.length - 1] } : null;
  }

  const totalReps = (series) => series.reduce((n, s) => n + s.reps, 0);
  const pesoMaximo = (series) => Math.max(0, ...series.map((s) => s.kg || 0));

  // ¿El registro b supera al a? Más peso, o el mismo peso con más repeticiones.
  function supera(a, b) {
    const pa = pesoMaximo(a.series), pb = pesoMaximo(b.series);
    return pb > pa || (pb === pa && totalReps(b.series) > totalReps(a.series));
  }

  // Sobrecarga progresiva (doble progresión) a ritmo realista. A partir de la
  // última sesión propone el objetivo de hoy para un ejercicio:
  //   - Normal: mismo peso y UNA repetición más en total (en la serie más floja).
  //   - Subir peso: solo cuando todas las series alcanzan las repeticiones que
  //     hacen falta para poder volver al mínimo del rango con el peso nuevo.
  //     Con saltos grandes (mancuernas de discos) eso supera el tope del rango.
  //   - Todas las series muy por debajo del mínimo: el peso es demasiado, baja.
  //   - Ya en el peso máximo disponible, o sin peso: más repeticiones.
  // ajustes: { paso: salto mínimo de peso en kg, maximo: peso máximo disponible }

  // Repeticiones que hay que dominar con `peso` para poder hacer `min` con
  // `peso + paso`, según la relación de Epley entre carga y repeticiones
  // (1RM = peso × (1 + reps / 30); cada repetición vale cerca de un 3 % de carga).
  function repsParaSubir(peso, paso, r) {
    const necesarias = Math.ceil(30 * ((1 + paso / peso) * (1 + r.min / 30) - 1) - 0.01);
    return Math.min(Math.max(r.tope, necesarias), r.tope + 8);
  }

  function sugerencia(ejId, presc, ajustes = {}) {
    const r = rango(presc.reps);
    if (!r) return null;
    const h = historial(ejId);
    if (!h.length) {
      return { tipo: "inicio", etiqueta: "Primera vez", series: [],
        texto: `Elige un peso con el que hagas ${r.min} repeticiones sintiendo que te quedaban 2 más. Lo que anotes hoy será tu punto de partida.` };
    }
    const kg = (n) => n.toLocaleString("es", { maximumFractionDigits: 2 });
    const u = h[h.length - 1];
    const n = Math.max(1, presc.series);
    const base = Array.from({ length: n }, (_, k) => u.series[k] || u.series[u.series.length - 1]);
    const paso = ajustes.paso > 0 ? ajustes.paso : 2.5;
    const maximo = ajustes.maximo > 0 ? ajustes.maximo : Infinity;
    const peso = pesoMaximo(base);
    const completas = u.series.length >= n;
    const todasCon = (reps) => completas && base.every((s) => s.reps >= reps);
    const todas = (k, reps) => base.map(() => ({ kg: k, reps }));
    // Una repetición más en la serie más floja (la primera, si hay empate).
    const unaMas = () => {
      const minimo = Math.min(...base.map((s) => s.reps));
      const cual = base.findIndex((s) => s.reps === minimo);
      return base.map((s, k) => ({ kg: s.kg || null, reps: k === cual ? s.reps + 1 : s.reps }));
    };
    const total = totalReps(base);

    if (!completas) {
      return { tipo: "reps", etiqueta: "Completa las series", series: base.map((s) => ({ kg: s.kg || null, reps: s.reps })),
        texto: `La vez pasada hiciste ${u.series.length} de ${n} series. Hoy completa las ${n}.` };
    }
    if (!peso) {
      return todasCon(r.tope)
        ? { tipo: "tope", etiqueta: "Rango dominado", series: unaMas(),
          texto: "Ya dominas el rango sin peso: sigue sumando repeticiones, baja en 3 segundos o añade lastre." }
        : { tipo: "reps", etiqueta: "+1 repetición", series: unaMas(),
          texto: `Suma al menos 1 repetición en total (la vez pasada: ${total}).` };
    }
    if (todasCon(r.tope) && base.some((s) => (s.kg || 0) < peso)) {
      return { tipo: "subir", etiqueta: "Sube peso", series: todas(peso, r.min),
        texto: `Usa ${kg(peso)} kg en todas las series.` };
    }
    if (peso >= maximo) {
      return todasCon(r.tope)
        ? { tipo: "tope", etiqueta: "Peso máximo", series: unaMas(),
          texto: "Ya usas tu peso máximo: sigue sumando repeticiones o baja en 3 segundos." }
        : { tipo: "reps", etiqueta: "+1 repetición", series: unaMas(),
          texto: `Mismo peso. Suma al menos 1 repetición en total (la vez pasada: ${total}).` };
    }
    const nuevo = Math.min(peso + paso, maximo);
    const necesarias = repsParaSubir(peso, nuevo - peso, r);
    if (todasCon(necesarias)) {
      return { tipo: "subir", etiqueta: "Sube peso", series: todas(nuevo, r.min),
        texto: `Dominaste ${kg(peso)} kg: sube a ${kg(nuevo)} kg. Es normal que bajes a unas ${r.min} repeticiones.` };
    }
    if (peso > paso && base.every((s) => s.reps < r.min - 2)) {
      return { tipo: "bajar", etiqueta: "Baja peso", series: todas(peso - paso, r.min),
        texto: `Quedaste lejos de ${r.min} repeticiones: baja a ${kg(peso - paso)} kg para trabajar dentro del rango.` };
    }
    // Estancado: cuatro sesiones con el mismo peso y sin sumar repeticiones.
    const ult = h.slice(-4);
    if (ult.length === 4 && ult.every((x) => pesoMaximo(x.series) === peso) && totalReps(ult[3].series) <= totalReps(ult[0].series)) {
      return { tipo: "estancado", etiqueta: "Estancado", series: unaMas(),
        texto: "Llevas 4 sesiones sin avanzar aquí. Revisa sueño y comida; si sigue igual, baja un poco el peso una semana y vuelve a subir." };
    }
    if (todasCon(r.tope)) {
      const salto = Math.round((nuevo / peso - 1) * 100);
      return { tipo: "reps", etiqueta: "+1 repetición", series: unaMas(),
        texto: `El salto a ${kg(nuevo)} kg es grande (+${salto} %). Sigue sumando repeticiones hasta llegar a ${necesarias} por serie y entonces sube.` };
    }
    return { tipo: "reps", etiqueta: "+1 repetición", series: unaMas(),
      texto: `Mismo peso. Suma al menos 1 repetición en total (la vez pasada: ${total}).` };
  }

  // Mejor marca de un registro: peso máximo, o repeticiones si es sin peso.
  function mejor(registro) {
    const conPeso = registro.series.filter((s) => s.kg > 0);
    if (conPeso.length) return { valor: Math.max(...conPeso.map((s) => s.kg)), unidad: "kg" };
    return { valor: Math.max(...registro.series.map((s) => s.reps)), unidad: "reps" };
  }

  // Ids de ejercicios con al menos un registro, el más reciente primero.
  function ejerciciosRegistrados() {
    const vistos = [];
    for (const s of todas()) for (const e of s.ejercicios) if (!vistos.includes(e.id)) vistos.push(e.id);
    return vistos;
  }

  window.NM = window.NM || {};
  window.NM.sesiones = {
    todas, agregar, borrar, reemplazar, valida, historial, ultima,
    sugerencia, supera, mejor, ejerciciosRegistrados,
  };
})();
