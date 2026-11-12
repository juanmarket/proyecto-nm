// Utilidades compartidas por todos los módulos.
(function () {
  "use strict";

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
  const normalizar = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const numero = (n, dec = 1) => n.toLocaleString("es", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const kgTxt = (n) => n.toLocaleString("es", { maximumFractionDigits: 2 });

  // [{kg:60,reps:10},{kg:60,reps:9}] -> "60 kg × 10, 9"
  function formatoSeries(series) {
    const pesos = new Set(series.map((s) => s.kg || 0));
    if (pesos.size === 1) {
      const kg = series[0].kg;
      const reps = series.map((s) => s.reps).join(", ");
      return kg ? `${kgTxt(kg)} kg × ${reps}` : `${reps} reps`;
    }
    return series.map((s) => (s.kg ? `${kgTxt(s.kg)} × ${s.reps}` : `${s.reps} reps`)).join(" · ");
  }

  // Fechas como "AAAA-MM-DD" en hora local.
  const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hoyISO = () => isoDe(new Date());
  function fechaDe(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    return new Date(a, m - 1, d);
  }
  const fechaCorta = (iso) => fechaDe(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  const diaMes = (iso) => fechaDe(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
  function sumarDias(iso, n) {
    const f = fechaDe(iso);
    f.setDate(f.getDate() + n);
    return isoDe(f);
  }
  // Lunes de la semana a la que pertenece la fecha.
  function lunesDe(iso) {
    const f = fechaDe(iso);
    return sumarDias(iso, -((f.getDay() + 6) % 7));
  }

  let temporizadorAviso;
  function aviso(texto) {
    let el = $(".aviso");
    if (!el) {
      el = document.createElement("div");
      el.className = "aviso";
      el.setAttribute("role", "status");
      document.body.append(el);
    }
    el.textContent = texto;
    el.classList.add("visible");
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => el.classList.remove("visible"), 2400);
  }

  const almacen = {
    leer(clave, def) {
      try { return JSON.parse(localStorage.getItem(clave)) ?? def; } catch { return def; }
    },
    guardar(clave, valor) {
      try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch {
        aviso("No se pudo guardar en este navegador");
        return false;
      }
    },
  };

  function descargarJSON(datos, nombre) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const slug = (t) => normalizar(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Datos de un ejercicio de la biblioteca, o uno propio (id "c-...").
  const POR_ID = new Map((window.EJERCICIOS || []).map((e) => [e.id, e]));
  function ejercicio(id, nombre) {
    return POR_ID.get(id) || { id, nombre: nombre || id, propio: true, equipo: "", equipoEn: "", musculo: "", secundarios: [], pasos: [] };
  }

  const ICONOS = {
    cerrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    arriba: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    abajo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    borrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  };

  window.NM = window.NM || {};
  window.NM.util = {
    $, esc, normalizar, numero, kgTxt, formatoSeries, hoyISO, fechaDe, fechaCorta, diaMes, sumarDias, lunesDe, aviso, almacen,
    descargarJSON, slug, ejercicio, ICONOS,
  };
})();
