// Núcleo: navegación, biblioteca de ejercicios con mapa muscular,
// ficha de ejercicio, progreso (peso, cargas, sesiones) y copia de seguridad.
(function () {
  "use strict";

  const U = window.NM.util;
  const S = window.NM.sesiones;
  const { $, esc, numero, kgTxt, formatoSeries, hoyISO, fechaCorta, aviso, almacen, ICONOS } = U;
  const EJERCICIOS = window.EJERCICIOS || [];

  // ---------- Navegación ----------
  const SECCIONES = ["rutina", "dieta", "fotos", "progreso", "ejercicios"];
  function mostrarSeccion() {
    const actual = SECCIONES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "rutina";
    document.querySelectorAll(".seccion").forEach((s) => { s.hidden = s.dataset.seccion !== actual; });
    document.querySelectorAll(".nav__link").forEach((a) => {
      if (a.dataset.seccion === actual) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (actual === "progreso") dibujarProgreso();
    if (actual === "fotos" && window.NM.fotos) window.NM.fotos.mostrar();
    if (actual === "dieta" && window.NM.diario) window.NM.diario.pintar();
  }
  window.addEventListener("hashchange", () => { mostrarSeccion(); window.scrollTo(0, 0); });

  // ---------- Ficha de un ejercicio ----------
  const dialogo = $("#detalle");
  function abrirDetalle(id) {
    const e = U.ejercicio(id);
    if (e.propio) return;
    const youtube = "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${e.nombreEn} exercise form`);
    $("#detalle-contenido").innerHTML = `
      <div class="detalle__cabecera">
        <div>
          <h2 id="detalle-titulo">${esc(e.nombre)}</h2>
          <p class="detalle__en" lang="en">${esc(e.nombreEn)}</p>
        </div>
        <button type="button" class="cerrar" data-cerrar aria-label="Cerrar">${ICONOS.cerrar}</button>
      </div>
      <div class="detalle__resumen">
        <div class="mapa">${NM.mapa.trabajo(e.musculo, e.secundarios)}</div>
        <div>
          <dl class="ficha">
            <div><dt>Músculo principal</dt><dd>${esc(e.musculo)}</dd></div>
            <div><dt>Equipo</dt><dd>${esc(e.equipo)}</dd></div>
          </dl>
          ${e.secundarios.length ? `<p class="secundarios" style="margin:10px 0 0">También trabaja: ${esc(e.secundarios.join(", "))}</p>` : ""}
          <p class="leyenda"><span><i></i>Principal</span>${e.secundarios.length ? '<span><i class="suave"></i>Secundario</span>' : ""}</p>
        </div>
      </div>
      <h3 class="sr">Cómo hacerlo</h3>
      <ol class="pasos">${e.pasos.map((p) => `<li><span>${esc(p)}</span></li>`).join("")}</ol>
      <div class="detalle__pie">
        <a class="boton" href="${youtube}" target="_blank" rel="noopener">Ver técnica en YouTube</a>
        <button type="button" class="boton boton--texto" data-cerrar>Cerrar</button>
      </div>`;
    if (!dialogo.open) dialogo.showModal();
    $(".cerrar", dialogo).focus();
  }
  dialogo.addEventListener("click", (ev) => {
    if (ev.target === dialogo || ev.target.closest("[data-cerrar]")) dialogo.close();
  });

  // ---------- Biblioteca ----------
  const POR_PAGINA = 60;
  const indice = EJERCICIOS.map((e) => ({
    e,
    texto: U.normalizar(`${e.nombre} ${e.nombreEn} ${e.musculo} ${e.equipo} ${e.zona} ${e.secundarios.join(" ")}`),
  }));
  let resultados = [];
  let mostrados = 0;

  function llenarSelect(sel, valores) {
    sel.insertAdjacentHTML("beforeend", valores.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join(""));
  }
  function valoresPorFrecuencia(campo) {
    const c = new Map();
    EJERCICIOS.forEach((e) => c.set(e[campo], (c.get(e[campo]) || 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  }

  function filtrar() {
    const tokens = U.normalizar($("#buscar").value.trim()).split(/\s+/).filter(Boolean);
    const zona = $("#filtro-zona").value;
    const musculo = $("#filtro-musculo").value;
    const equipo = $("#filtro-equipo").value;
    resultados = indice
      .filter(({ e, texto }) =>
        (!zona || e.zona === zona) &&
        (!musculo || e.musculo === musculo) &&
        (!equipo || e.equipo === equipo) &&
        tokens.every((t) => texto.includes(t)))
      .map(({ e }) => e);
    // Con búsqueda, los nombres más cortos suelen ser el ejercicio "base".
    if (tokens.length) resultados.sort((a, b) => a.nombre.length - b.nombre.length);
    mostrados = 0;
    $("#lista-ejercicios").innerHTML = "";
    pintarMas();
  }

  function pintarMas() {
    const lista = $("#lista-ejercicios");
    const lote = resultados.slice(mostrados, mostrados + POR_PAGINA);
    mostrados += lote.length;
    if (!resultados.length) {
      lista.innerHTML = '<li class="vacio">No hay ejercicios con esos filtros. Prueba con otra palabra o quita algún filtro.</li>';
    } else {
      lista.insertAdjacentHTML("beforeend", lote.map((e) => `
        <li>
          <button type="button" class="tarjeta" data-id="${e.id}">
            <span>
              <span class="tarjeta__nombre">${esc(e.nombre)}</span>
              <span class="tarjeta__en" lang="en" style="display:block">${esc(e.nombreEn)}</span>
            </span>
            <span class="etiquetas">
              <span class="etiqueta etiqueta--musculo">${esc(e.musculo)}</span>
              <span class="etiqueta">${esc(e.equipo)}</span>
            </span>
          </button>
        </li>`).join(""));
    }
    const n = resultados.length;
    $("#conteo").textContent = n === EJERCICIOS.length ? `Mostrando ${mostrados} de ${n}` : `${n} ${n === 1 ? "resultado" : "resultados"}`;
    $("#ver-mas").hidden = mostrados >= n;
  }

  // ---------- Mapa muscular ----------
  const CONTEOS = EJERCICIOS.reduce((c, e) => { c[e.musculo] = (c[e.musculo] || 0) + 1; return c; }, {});
  const textoConteo = (m) => `${(CONTEOS[m] || 0).toLocaleString("es")} ejercicios`;

  function infoMapa(musculo, previo) {
    if (musculo) {
      $("#mapa-titulo").textContent = musculo;
      $("#mapa-texto").textContent = previo ? `${textoConteo(musculo)}. Toca para verlos.` : textoConteo(musculo);
    } else {
      $("#mapa-titulo").textContent = "Toca un músculo";
      $("#mapa-texto").textContent = "y verás sus ejercicios.";
    }
  }

  function actualizarMapa() {
    const sel = $("#filtro-musculo").value;
    document.querySelectorAll("#mapa .region[data-musculo]").forEach((g) => {
      const activa = g.dataset.musculo === sel;
      g.classList.toggle("activa", activa);
      g.setAttribute("aria-pressed", String(activa));
    });
    $("#mapa-limpiar").hidden = !sel;
    infoMapa(sel);
  }

  function elegirMusculo(musculo) {
    const select = $("#filtro-musculo");
    select.value = select.value === musculo ? "" : musculo;
    $("#filtro-zona").value = ""; // evita combinar zona y músculo incompatibles
    filtrar();
    actualizarMapa();
    if (select.value && matchMedia("(max-width: 860px)").matches) {
      $("#conteo").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function iniciarMapa() {
    const mapa = $("#mapa");
    mapa.innerHTML = NM.mapa.interactivo($("#filtro-musculo").value, CONTEOS);
    const region = (ev) => ev.target.closest(".region[data-musculo]");
    const resaltar = (musculo) => {
      mapa.querySelectorAll(".region[data-musculo]").forEach((r) => r.classList.toggle("resaltada", r.dataset.musculo === musculo));
    };
    const enfocar = (g) => { resaltar(g.dataset.musculo); infoMapa(g.dataset.musculo, g.dataset.musculo !== $("#filtro-musculo").value); };
    const soltar = () => { resaltar(null); infoMapa($("#filtro-musculo").value); };
    mapa.addEventListener("click", (ev) => { const g = region(ev); if (g) elegirMusculo(g.dataset.musculo); });
    mapa.addEventListener("keydown", (ev) => {
      const g = region(ev);
      if (g && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); elegirMusculo(g.dataset.musculo); }
    });
    mapa.addEventListener("pointerover", (ev) => { const g = region(ev); if (g) enfocar(g); });
    mapa.addEventListener("pointerleave", soltar);
    mapa.addEventListener("focusin", (ev) => { const g = region(ev); if (g) enfocar(g); });
    mapa.addEventListener("focusout", soltar);
    $("#mapa-limpiar").addEventListener("click", () => elegirMusculo($("#filtro-musculo").value));
    actualizarMapa();
  }

  function iniciarBiblioteca() {
    $("#total-ejercicios").textContent = EJERCICIOS.length.toLocaleString("es");
    llenarSelect($("#filtro-zona"), [...new Set(EJERCICIOS.map((e) => e.zona))].sort((a, b) => a.localeCompare(b, "es")));
    llenarSelect($("#filtro-musculo"), [...new Set(EJERCICIOS.map((e) => e.musculo))].sort((a, b) => a.localeCompare(b, "es")));
    llenarSelect($("#filtro-equipo"), valoresPorFrecuencia("equipo"));
    let espera;
    $("#buscar").addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(filtrar, 120); });
    ["#filtro-zona", "#filtro-equipo"].forEach((s) => $(s).addEventListener("change", filtrar));
    $("#filtro-musculo").addEventListener("change", () => { filtrar(); actualizarMapa(); });
    $("#ver-mas").addEventListener("click", pintarMas);
    $("#lista-ejercicios").addEventListener("click", (ev) => {
      const t = ev.target.closest(".tarjeta");
      if (t) abrirDetalle(t.dataset.id);
    });
    iniciarMapa();
    filtrar();
  }

  // ---------- Progreso: peso y medidas ----------
  // Registro: { fecha, peso?, cintura?, pecho?, brazo?, muslo?, cadera?, nota? }
  const MEDIDAS = [["cintura", "Cintura"], ["pecho", "Pecho"], ["brazo", "Brazo"], ["muslo", "Muslo"], ["cadera", "Cadera"]];
  const CAMPOS = ["peso", ...MEDIDAS.map(([k]) => k)];
  const esRegistro = (r) => r && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) && CAMPOS.some((k) => typeof r[k] === "number");
  let registros = almacen.leer("nm.progreso", []).filter(esRegistro);
  let medida = "peso";
  let historialCompleto = false;

  function ordenar() { registros.sort((a, b) => a.fecha.localeCompare(b.fecha)); }
  const conDato = (k) => registros.filter((r) => typeof r[k] === "number");
  const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const signo = (dif, dec = 1) => `${dif > 0 ? "+" : dif < 0 ? "−" : ""}${numero(Math.abs(dif), dec)}`;
  const semanasEntre = (a, b) => Math.round((U.fechaDe(b.lunes) - U.fechaDe(a.lunes)) / 6048e5);

  // Semanas (lunes a domingo) desde el primer dato hasta hoy, con el promedio
  // de peso y los entrenamientos de cada una. El peso varía 1–2 kg de un día
  // a otro, así que el progreso se mide comparando promedios semanales.
  function semanas() {
    const mapa = new Map();
    const de = (lunes) => {
      if (!mapa.has(lunes)) mapa.set(lunes, { lunes, pesos: [], sesiones: 0, series: 0 });
      return mapa.get(lunes);
    };
    conDato("peso").forEach((r) => de(U.lunesDe(r.fecha)).pesos.push(r.peso));
    S.todas().forEach((s) => {
      const w = de(U.lunesDe(s.fecha));
      w.sesiones += 1;
      w.series += s.ejercicios.reduce((n, e) => n + e.series.length, 0);
    });
    if (!mapa.size) return [];
    const actual = U.lunesDe(hoyISO());
    const lista = [];
    for (let lunes = [...mapa.keys()].sort()[0]; lunes <= actual; lunes = U.sumarDias(lunes, 7)) {
      const w = de(lunes);
      w.promedio = w.pesos.length ? media(w.pesos) : null;
      lista.push(w);
    }
    return lista;
  }

  function metrica(etiqueta, valor, unidad, detalle) {
    return `<div class="metrica">
      <p class="metrica__etiqueta">${esc(etiqueta)}</p>
      <p class="metrica__valor">${valor}${unidad ? `<small>${unidad}</small>` : ""}</p>
      ${detalle ? `<p class="metrica__detalle">${detalle}</p>` : ""}
    </div>`;
  }

  function dibujarMetricas(sem) {
    const el = $("#metricas");
    const conPeso = sem.filter((w) => w.promedio != null);
    if (!conPeso.length) {
      el.innerHTML = metrica("Promedio semanal", "—", "", "Aún sin pesajes") + metrica("Vs. semana anterior", "—", "") +
        metrica("Ritmo", "—", "") + metrica("Cambio total", "—", "");
      return;
    }
    const ult = conPeso[conPeso.length - 1], previa = conPeso[conPeso.length - 2], primera = conPeso[0];
    const n = ult.pesos.length;
    // Ritmo: del promedio de hace hasta 4 semanas al de la última semana.
    const base = conPeso.find((w) => semanasEntre(w, ult) <= 4);
    const ritmo = base !== ult ? (ult.promedio - base.promedio) / semanasEntre(base, ult) : null;
    el.innerHTML =
      metrica("Promedio semanal", numero(ult.promedio), "kg", `Semana del ${esc(U.diaMes(ult.lunes))} · ${n} ${n === 1 ? "pesaje" : "pesajes"}`) +
      (previa
        ? metrica("Vs. semana anterior", signo(ult.promedio - previa.promedio), "kg", `Antes: ${numero(previa.promedio)} kg`)
        : metrica("Vs. semana anterior", "—", "", "Necesitas 2 semanas")) +
      (ritmo != null
        ? metrica("Ritmo", signo(ritmo, 2), "kg/sem", `${numero(Math.abs(ritmo) / ult.promedio * 100)} % de tu peso por semana`)
        : metrica("Ritmo", "—", "", "Necesitas 2 semanas")) +
      (previa
        ? metrica("Cambio total", signo(ult.promedio - primera.promedio), "kg", `Desde la semana del ${esc(U.diaMes(primera.lunes))}`)
        : metrica("Cambio total", "—", "", ""));
  }

  // Gráfica de línea. puntos: [{ fecha, valor, titulo? }] ordenados por fecha.
  // tenues: puntos sueltos de fondo (por ejemplo, los pesajes diarios).
  function graficaSVG(puntos, unidad, etiqueta, decimales = 1, tenues = []) {
    const W = 640, H = 240, m = { t: 14, r: 14, b: 28, l: 44 };
    const todos = puntos.concat(tenues);
    const tiempo = (f) => new Date(f).getTime();
    const t0 = Math.min(...todos.map((p) => tiempo(p.fecha)));
    const t1 = Math.max(...todos.map((p) => tiempo(p.fecha)));
    let min = Math.min(...todos.map((p) => p.valor)), max = Math.max(...todos.map((p) => p.valor));
    const margen = Math.max(0.5, (max - min) * 0.15);
    min -= margen; max += margen;
    const x = (f) => m.l + (t1 === t0 ? 0.5 : (tiempo(f) - t0) / (t1 - t0)) * (W - m.l - m.r);
    const y = (v) => m.t + (1 - (v - min) / (max - min)) * (H - m.t - m.b);
    const ticks = 4;
    const lineasY = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks);
    const d = puntos.map((p, i) => `${i ? "L" : "M"}${x(p.fecha).toFixed(1)},${y(p.valor).toFixed(1)}`).join("");
    const area = `${d}L${x(puntos[puntos.length - 1].fecha).toFixed(1)},${H - m.b}L${x(puntos[0].fecha).toFixed(1)},${H - m.b}Z`;
    const etiquetasX = [puntos[0], puntos[Math.floor((puntos.length - 1) / 2)], puntos[puntos.length - 1]]
      .filter((p, i, arr) => arr.findIndex((q) => q.fecha === p.fecha) === i);
    const ultimo = puntos.length - 1;
    const titulo = (p) => `${esc(p.titulo || fechaCorta(p.fecha))}: ${kgTxt(p.valor)} ${unidad}`;
    return `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etiqueta)}">
        ${lineasY.map((v) => `<line class="eje" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>
          <text class="eje-texto" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${numero(v, decimales)}</text>`).join("")}
        ${etiquetasX.map((p, i) => `<text class="eje-texto" x="${x(p.fecha)}" y="${H - 8}" text-anchor="${i === 0 ? "start" : i === etiquetasX.length - 1 ? "end" : "middle"}">${esc(p.titulo || fechaCorta(p.fecha))}</text>`).join("")}
        ${tenues.map((p) => `<circle class="punto-tenue" cx="${x(p.fecha)}" cy="${y(p.valor)}" r="2.5"><title>${titulo(p)}</title></circle>`).join("")}
        <path class="area" d="${area}"/>
        <path class="linea" d="${d}"/>
        ${puntos.map((p, i) => `<circle class="punto ${i === ultimo ? "punto-ultimo" : ""}" cx="${x(p.fecha)}" cy="${y(p.valor)}" r="${i === ultimo ? 5 : 3.5}"><title>${titulo(p)}</title></circle>`).join("")}
      </svg>`;
  }

  function dibujarGrafica(sem = semanas()) {
    // Solo se ofrecen las medidas que tienen algún dato.
    const disponibles = [["peso", "Peso"], ...MEDIDAS.filter(([k]) => conDato(k).length)];
    if (!disponibles.some(([k]) => k === medida)) medida = "peso";
    $("#medidas-pestanas").innerHTML = disponibles.map(([k, nombre]) =>
      `<button type="button" class="pestana" data-medida="${k}" aria-pressed="${k === medida}">${nombre}</button>`).join("");

    const el = $("#grafica");
    el.className = "grafica";
    const sueltos = conDato(medida).map((r) => ({ fecha: r.fecha, valor: r[medida] }));
    if (medida === "peso") {
      const promedios = sem.filter((w) => w.promedio != null)
        .map((w) => ({ fecha: U.sumarDias(w.lunes, 3), valor: w.promedio, titulo: `Sem. ${U.diaMes(w.lunes)}` }));
      if (promedios.length >= 2) {
        el.innerHTML = graficaSVG(promedios, "kg", "Promedio semanal de peso", 1, sueltos) +
          '<p class="grafica__nota">Línea: promedio de cada semana. Puntos grises: cada pesaje.</p>';
        return;
      }
    }
    if (sueltos.length < 2) {
      el.innerHTML = `<p class="vacio-progreso">Con 2 registros de ${medida} aparecerá aquí tu curva.</p>`;
      return;
    }
    el.innerHTML = graficaSVG(sueltos, medida === "peso" ? "kg" : "cm", `Evolución de ${medida}`) +
      (medida === "peso" ? '<p class="grafica__nota">Cuando tengas pesajes de 2 semanas, verás el promedio semanal.</p>' : "");
  }

  function dibujarHistorial() {
    const el = $("#historial");
    if (!registros.length) {
      el.innerHTML = '<p class="vacio-progreso">Aún no hay registros. Añade el primero con el formulario.</p>';
      return;
    }
    const LIMITE = 14;
    const lista = [...registros].reverse();
    const visibles = historialCompleto ? lista : lista.slice(0, LIMITE);
    el.innerHTML = `
      <table class="tabla">
        <thead><tr><th>Fecha</th><th>Peso</th><th>Medidas</th><th><span class="sr">Acciones</span></th></tr></thead>
        <tbody>
          ${visibles.map((r) => {
            const medidas = MEDIDAS.filter(([k]) => typeof r[k] === "number").map(([k, nombre]) => `${nombre} ${numero(r[k])}`).join(" · ");
            return `
            <tr>
              <td>${esc(fechaCorta(r.fecha))}${r.nota ? `<div class="nota">${esc(r.nota)}</div>` : ""}</td>
              <td>${typeof r.peso === "number" ? `${numero(r.peso)} kg` : "—"}</td>
              <td class="nota">${medidas ? `${esc(medidas)} cm` : "—"}</td>
              <td style="text-align:right"><button type="button" class="borrar" data-fecha="${esc(r.fecha)}">Borrar</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      ${lista.length > LIMITE ? `<button type="button" class="boton boton--texto boton--icono" data-historial-completo>${historialCompleto ? "Ver menos" : `Ver los ${lista.length} registros`}</button>` : ""}`;
  }

  // ---------- Progreso: estadísticas ----------
  function dibujarEstadisticas(sem) {
    const el = $("#estadisticas");
    if (!sem.length) {
      el.innerHTML = '<p class="vacio-progreso">Cuando registres pesajes o sesiones, aquí verás tu resumen semana a semana.</p>';
      return;
    }
    const actual = sem[sem.length - 1], anterior = sem[sem.length - 2];
    const plan = window.NM.plan && window.NM.plan.obtener();
    const meta = plan ? plan.rutina.dias.length : 0;

    // Promedio de sesiones de las últimas 4 semanas (o menos si empezaste hace poco).
    const primeraConSesion = sem.findIndex((w) => w.sesiones > 0);
    const recientes = primeraConSesion < 0 ? [] : sem.slice(Math.max(primeraConSesion, sem.length - 4));
    // Semanas seguidas con al menos una sesión. La semana en curso no rompe la racha.
    let racha = 0;
    for (let i = sem.length - 1; i >= 0; i--) {
      if (sem[i].sesiones > 0) racha += 1;
      else if (i !== sem.length - 1) break;
    }

    const medidas = MEDIDAS.map(([k, nombre]) => {
      const datos = conDato(k);
      if (!datos.length) return "";
      const primero = datos[0], ultimo = datos[datos.length - 1];
      const dif = ultimo[k] - primero[k];
      return `<li><span>${nombre}</span><strong>${numero(ultimo[k])} cm</strong>
        <span class="nota">${datos.length > 1 ? `${signo(dif)} cm desde el ${esc(U.diaMes(primero.fecha))}` : "primer registro"}</span></li>`;
    }).join("");

    let previo = null;
    const filas = sem.map((w) => {
      const cambio = w.promedio != null && previo != null ? w.promedio - previo : null;
      if (w.promedio != null) previo = w.promedio;
      return { ...w, cambio };
    }).reverse().slice(0, 8);

    el.innerHTML = `
      <div class="metricas metricas--4">
        ${metrica("Sesiones esta semana", actual.sesiones, meta ? `de ${meta}` : "", meta ? "según los días de tu rutina" : "")}
        ${metrica("Promedio", recientes.length ? numero(media(recientes.map((w) => w.sesiones))) : "—", recientes.length ? "ses/sem" : "",
          recientes.length ? `Últimas ${recientes.length} ${recientes.length === 1 ? "semana" : "semanas"}` : "Aún sin sesiones")}
        ${metrica("Racha", racha, racha === 1 ? "semana" : "semanas", "seguidas entrenando")}
        ${metrica("Series esta semana", actual.series, "", anterior ? `${anterior.series} la semana pasada` : "")}
      </div>
      ${medidas ? `<h3 class="estadisticas__titulo">Medidas</h3><ul class="medidas-resumen">${medidas}</ul>` : ""}
      <h3 class="estadisticas__titulo">Semana a semana</h3>
      <div class="tabla-scroll">
        <table class="tabla">
          <thead><tr><th>Semana del</th><th>Peso prom.</th><th>Cambio</th><th>Pesajes</th><th>Sesiones</th><th>Series</th></tr></thead>
          <tbody>
            ${filas.map((w) => `
              <tr>
                <td>${esc(U.diaMes(w.lunes))}${w === filas[0] && w.lunes === U.lunesDe(hoyISO()) ? ' <span class="nota">(en curso)</span>' : ""}</td>
                <td>${w.promedio != null ? `${numero(w.promedio)} kg` : "—"}</td>
                <td>${w.cambio != null ? `${signo(w.cambio)} kg` : "—"}</td>
                <td>${w.pesos.length || "—"}</td>
                <td>${w.sesiones || "—"}</td>
                <td>${w.series || "—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  // ---------- Progreso: cargas por ejercicio y sesiones ----------
  const nombreEj = (id, respaldo) => U.ejercicio(id, respaldo).nombre;

  function dibujarCargas() {
    const select = $("#cargas-ejercicio");
    const ids = S.ejerciciosRegistrados();
    if (!ids.length) {
      select.hidden = true;
      $("#grafica-cargas").innerHTML = '<p class="vacio-progreso">Cuando registres sesiones desde tu rutina, aquí verás cómo suben tus cargas en cada ejercicio.</p>';
      $("#cargas-detalle").innerHTML = "";
      $("#sesiones-lista").innerHTML = '<p class="vacio-progreso">Aún no hay sesiones. Usa "Registrar sesión" en cualquier día de tu rutina.</p>';
      return;
    }
    // Nombre guardado en la sesión, por si es un ejercicio propio.
    const nombres = {};
    S.todas().forEach((s) => s.ejercicios.forEach((e) => { if (e.nombre && !nombres[e.id]) nombres[e.id] = e.nombre; }));
    select.hidden = false;
    const actual = ids.includes(select.value) ? select.value : ids[0];
    select.innerHTML = ids.map((id) => `<option value="${esc(id)}" ${id === actual ? "selected" : ""}>${esc(nombreEj(id, nombres[id]))}</option>`).join("");

    const hist = S.historial(actual);
    const mejores = hist.map((h) => ({ fecha: h.fecha, ...S.mejor(h) }));
    const unidad = mejores.some((m) => m.unidad === "kg") ? "kg" : "reps";
    const puntos = mejores.filter((m) => m.unidad === unidad).map((m) => ({ fecha: m.fecha, valor: m.valor }));
    const grafica = $("#grafica-cargas");
    grafica.className = "grafica";
    grafica.innerHTML = puntos.length >= 2
      ? graficaSVG(puntos, unidad, `Mejor serie de ${nombreEj(actual, nombres[actual])}`, unidad === "kg" ? 1 : 0)
      : '<p class="vacio-progreso">Con 2 sesiones de este ejercicio aparecerá su curva.</p>';

    const primero = puntos[0], ultimo = puntos[puntos.length - 1];
    const dif = puntos.length >= 2 ? ultimo.valor - primero.valor : 0;
    $("#cargas-detalle").innerHTML = `
      <p class="cargas__resumen">${unidad === "kg" ? "Peso máximo por sesión" : "Repeticiones máximas por sesión"}${puntos.length >= 2
        ? ` · <strong class="${dif > 0 ? "baja" : dif < 0 ? "sube" : ""}">${dif > 0 ? "+" : dif < 0 ? "−" : ""}${kgTxt(Math.abs(dif))} ${unidad}</strong> desde ${esc(fechaCorta(primero.fecha))}`
        : ""}</p>
      <table class="tabla">
        <thead><tr><th>Fecha</th><th>Series</th></tr></thead>
        <tbody>${[...hist].reverse().slice(0, 8).map((h) => `
          <tr><td>${esc(fechaCorta(h.fecha))}</td><td>${esc(formatoSeries(h.series))}</td></tr>`).join("")}
        </tbody>
      </table>`;

    $("#sesiones-lista").innerHTML = `
      <ul class="sesiones">${S.todas().slice(0, 20).map((s) => `
        <li>
          <details>
            <summary>
              <span><strong>${esc(s.dia)}</strong> · ${esc(fechaCorta(s.fecha))}</span>
              <span class="bloque__meta">${s.ejercicios.length} ejercicios · ${s.ejercicios.reduce((n, e) => n + e.series.length, 0)} series</span>
            </summary>
            <ul class="sesion__detalle">${s.ejercicios.map((e) => `
              <li><span>${esc(nombreEj(e.id, e.nombre))}</span><span>${esc(formatoSeries(e.series))}</span></li>`).join("")}
            </ul>
            <button type="button" class="borrar" data-borrar-sesion="${esc(s.id)}">Borrar sesión</button>
          </details>
        </li>`).join("")}
      </ul>`;
  }

  function dibujarProgreso() {
    ordenar();
    const sem = semanas();
    dibujarMetricas(sem);
    dibujarGrafica(sem);
    dibujarEstadisticas(sem);
    dibujarHistorial();
    dibujarCargas();
  }

  function guardarProgreso() {
    almacen.guardar("nm.progreso", registros);
    dibujarProgreso();
  }

  // ---------- Copia de seguridad completa ----------
  async function exportarTodo() {
    aviso("Preparando copia…");
    const fotos = window.NM.fotos ? await window.NM.fotos.exportar() : [];
    U.descargarJSON({
      tipo: "nm-copia", version: 3, exportado: new Date().toISOString(),
      progreso: registros, plan: window.NM.plan.obtener(), progresion: window.NM.plan.ajustes(), sesiones: S.todas(), fotos,
      ...(window.NM.diario ? window.NM.diario.exportar() : {}),
    }, `proyecto-nm-copia-${hoyISO()}.json`);
  }

  async function importarTodo(archivo) {
    let datos;
    try { datos = JSON.parse(await archivo.text()); } catch { aviso("Ese archivo no es una copia válida"); return; }
    const progreso = (Array.isArray(datos.progreso) ? datos.progreso : []).filter(esRegistro);
    const sesiones = (Array.isArray(datos.sesiones) ? datos.sesiones : []).filter(S.valida);
    const fotos = Array.isArray(datos.fotos) ? datos.fotos : [];
    const plan = datos.plan && datos.plan.tipo === "nm-plan" ? datos.plan : null;
    const hayDiario = datos.diario && typeof datos.diario === "object" && Object.keys(datos.diario).length > 0;
    if (!progreso.length && !sesiones.length && !fotos.length && !plan && !hayDiario) { aviso("Ese archivo no es una copia válida"); return; }
    if (!confirm(`Se reemplazarán tus datos por la copia: ${progreso.length} registros de peso y medidas, ${sesiones.length} sesiones, ${fotos.length} fotos${plan ? " y tu plan" : ""}. ¿Continuar?`)) return;
    registros = progreso;
    S.reemplazar(sesiones);
    if (plan) window.NM.plan.reemplazar(plan);
    if (datos.progresion && typeof datos.progresion === "object") window.NM.plan.fijarAjustes(datos.progresion);
    if (window.NM.fotos) await window.NM.fotos.importar(fotos);
    if (window.NM.diario && (datos.diario || datos.alimentos)) window.NM.diario.importar({ diario: datos.diario || {}, alimentos: datos.alimentos });
    guardarProgreso();
    window.NM.plan.repintar();
    aviso("Copia restaurada");
  }

  function iniciarProgreso() {
    $("#p-fecha").value = hoyISO();
    $("#p-fecha").max = hoyISO();

    $("#form-progreso").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fecha = $("#p-fecha").value;
      const nota = $("#p-nota").value.trim();
      const valores = {};
      CAMPOS.forEach((k) => {
        const v = parseFloat($(`#p-${k}`).value);
        if (v > 0) valores[k] = v;
      });
      if (!fecha || !Object.keys(valores).length) { aviso("Anota el peso o alguna medida"); return; }
      // Si ya hay un registro ese día, se completa en vez de reemplazarlo.
      const existente = registros.findIndex((r) => r.fecha === fecha);
      const registro = { ...(existente >= 0 ? registros[existente] : {}), fecha, ...valores, ...(nota ? { nota } : {}) };
      if (existente >= 0) registros[existente] = registro; else registros.push(registro);
      guardarProgreso();
      CAMPOS.forEach((k) => { $(`#p-${k}`).value = ""; });
      $("#p-nota").value = "";
      $("#p-fecha").value = hoyISO();
      aviso(existente >= 0 ? "Registro actualizado" : "Registro guardado");
    });

    $("#historial").addEventListener("click", (ev) => {
      if (ev.target.closest("[data-historial-completo]")) {
        historialCompleto = !historialCompleto;
        dibujarHistorial();
        return;
      }
      const b = ev.target.closest(".borrar");
      if (!b) return;
      if (!confirm(`¿Borrar el registro del ${fechaCorta(b.dataset.fecha)}?`)) return;
      registros = registros.filter((r) => r.fecha !== b.dataset.fecha);
      guardarProgreso();
    });

    $("#cargas-ejercicio").addEventListener("change", dibujarCargas);
    $("#sesiones-lista").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-borrar-sesion]");
      if (!b) return;
      if (!confirm("¿Borrar esta sesión? No se puede deshacer.")) return;
      S.borrar(b.dataset.borrarSesion);
      dibujarProgreso();
      window.NM.plan.repintar();
    });

    $("#medidas-pestanas").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-medida]");
      if (!b) return;
      medida = b.dataset.medida;
      dibujarGrafica();
      $(`#medidas-pestanas [data-medida="${medida}"]`).focus();
    });

    $("#exportar").addEventListener("click", exportarTodo);
    $("#importar").addEventListener("change", (ev) => {
      const archivo = ev.target.files[0];
      ev.target.value = "";
      if (archivo) importarTodo(archivo);
    });
  }

  // Peso registrado en una fecha o el más cercano anterior (para las fotos).
  function pesoEn(fecha) {
    ordenar();
    let r = null;
    for (const x of conDato("peso")) { if (x.fecha <= fecha) r = x; else break; }
    return r && Math.abs(new Date(fecha) - new Date(r.fecha)) <= 7 * 864e5 ? r.peso : null;
  }

  // ---------- Inicio ----------
  window.NM.app = { abrirDetalle, dibujarCargas, pesoEn };
  iniciarBiblioteca();
  iniciarProgreso();
  // Otros módulos (plan, fotos) se cargan después de este archivo.
  document.addEventListener("DOMContentLoaded", mostrarSeccion);
})();
