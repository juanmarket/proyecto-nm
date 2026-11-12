// Plan personal: rutina y dieta. Se arma en el chat, se importa como
// archivo JSON y se puede editar aquí. También registra las sesiones.
//
// Formato del plan (nm.plan):
// { tipo: "nm-plan", version: 1, actualizado: ISO,
//   rutina: { notas, dias: [{ titulo, notas, ejercicios: [
//     { id, nombre, series, reps, descanso, notas }] }] },
//   dieta: { notas, objetivos: { kcal, proteina, carbohidratos, grasas },
//     comidas: [{ nombre, hora, notas, alimentos: [
//       { nombre, cantidad, kcal, proteina, carbohidratos, grasas }] }] } }
// "id" es el de la biblioteca o "c-<nombre>" para ejercicios propios.
(function () {
  "use strict";

  const U = window.NM.util;
  const S = window.NM.sesiones;
  const { $, esc, aviso, almacen, fechaCorta, hoyISO, formatoSeries, ICONOS } = U;
  const EJERCICIOS = window.EJERCICIOS || [];

  // ---------- Modelo ----------
  const texto = (v, max = 300) => (typeof v === "string" ? v.slice(0, max) : v == null ? "" : String(v).slice(0, max));
  const num = (v) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
  };

  function limpiarEjercicio(e) {
    const nombre = texto(e.nombre, 120).trim();
    let id = texto(e.id, 80).trim();
    if (!id || (!U.ejercicio(id).nombreEn && !id.startsWith("c-"))) id = "c-" + U.slug(nombre || "ejercicio");
    return {
      id,
      nombre: nombre || U.ejercicio(id).nombre,
      series: Math.max(1, Math.min(20, parseInt(e.series, 10) || 3)),
      reps: texto(e.reps, 20) || "8–12",
      descanso: texto(e.descanso, 20),
      notas: texto(e.notas, 300),
    };
  }

  function limpiarAlimento(a) {
    return {
      nombre: texto(a.nombre, 120), cantidad: texto(a.cantidad, 40),
      kcal: num(a.kcal), proteina: num(a.proteina), carbohidratos: num(a.carbohidratos), grasas: num(a.grasas),
    };
  }

  function limpiarPlan(p) {
    p = p && typeof p === "object" ? p : {};
    const r = p.rutina && typeof p.rutina === "object" ? p.rutina : {};
    const d = p.dieta && typeof p.dieta === "object" ? p.dieta : {};
    const obj = d.objetivos && typeof d.objetivos === "object" ? d.objetivos : {};
    return {
      tipo: "nm-plan",
      version: 1,
      actualizado: new Date().toISOString(),
      rutina: {
        notas: texto(r.notas, 2000),
        dias: (Array.isArray(r.dias) ? r.dias : []).slice(0, 14).map((dia, i) => ({
          titulo: texto(dia.titulo, 60) || `Día ${i + 1}`,
          notas: texto(dia.notas, 300),
          ejercicios: (Array.isArray(dia.ejercicios) ? dia.ejercicios : []).slice(0, 30).map(limpiarEjercicio),
        })),
      },
      dieta: {
        notas: texto(d.notas, 3000),
        objetivos: { kcal: num(obj.kcal), proteina: num(obj.proteina), carbohidratos: num(obj.carbohidratos), grasas: num(obj.grasas) },
        comidas: (Array.isArray(d.comidas) ? d.comidas : []).slice(0, 12).map((c, i) => ({
          nombre: texto(c.nombre, 60) || `Comida ${i + 1}`,
          hora: texto(c.hora, 20),
          notas: texto(c.notas, 300),
          alimentos: (Array.isArray(c.alimentos) ? c.alimentos : []).slice(0, 40).map(limpiarAlimento),
        })),
      },
    };
  }

  let plan = almacen.leer("nm.plan", null);
  if (!plan || plan.tipo !== "nm-plan") plan = null;

  // Sobrecarga progresiva: salto mínimo de peso y peso máximo disponible (kg).
  const AJUSTES_INICIALES = { paso: 2.5, maximo: 20 };
  let ajustes = { ...AJUSTES_INICIALES, ...almacen.leer("nm.progresion", {}) };
  const objetivo = (b) => S.sugerencia(b.id, b, ajustes);
  const etiquetaObjetivo = (s) => `<span class="objetivo objetivo--${s.tipo}">${esc(s.etiqueta)}</span>`;

  function guardarPlan(nuevo) {
    plan = limpiarPlan(nuevo);
    almacen.guardar("nm.plan", plan);
    pintarRutina();
    pintarDieta();
    if (window.NM.diario) window.NM.diario.pintar(); // los objetivos pueden haber cambiado
  }

  const copia = (o) => JSON.parse(JSON.stringify(o));
  const planVacio = () => limpiarPlan({});

  function mover(lista, i, delta) {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }

  // ---------- Selector de ejercicios ----------
  const dialogoSelector = $("#selector");
  let alElegir = null;
  const indice = EJERCICIOS.map((e) => ({ e, t: U.normalizar(`${e.nombre} ${e.nombreEn} ${e.musculo} ${e.equipo}`) }));

  function pintarSelector() {
    const q = $("#selector-buscar").value.trim();
    const tokens = U.normalizar(q).split(/\s+/).filter(Boolean);
    const res = tokens.length
      ? indice.filter(({ t }) => tokens.every((k) => t.includes(k))).map(({ e }) => e).sort((a, b) => a.nombre.length - b.nombre.length).slice(0, 40)
      : [];
    $("#selector-lista").innerHTML =
      (q ? `<li><button type="button" class="selector__item selector__item--propio" data-propio="${esc(q)}">
          <span>Usar «${esc(q)}» como ejercicio propio</span></button></li>` : "") +
      res.map((e) => `<li><button type="button" class="selector__item" data-id="${e.id}">
          <span class="tarjeta__nombre">${esc(e.nombre)}</span>
          <span class="bloque__meta">${esc(e.musculo)} · ${esc(e.equipo)}</span></button></li>`).join("") +
      (!q ? '<li class="vacio">Escribe para buscar entre 1.324 ejercicios.</li>' : !res.length ? '<li class="vacio">Sin resultados en la biblioteca.</li>' : "");
  }

  function elegirEjercicio(cb) {
    alElegir = cb;
    $("#selector-buscar").value = "";
    pintarSelector();
    dialogoSelector.showModal();
    $("#selector-buscar").focus();
  }

  dialogoSelector.addEventListener("input", pintarSelector);
  dialogoSelector.addEventListener("click", (ev) => {
    if (ev.target === dialogoSelector || ev.target.closest("[data-cerrar-selector]")) { dialogoSelector.close(); return; }
    const b = ev.target.closest(".selector__item");
    if (!b || !alElegir) return;
    const elegido = b.dataset.id
      ? { id: b.dataset.id, nombre: U.ejercicio(b.dataset.id).nombre }
      : { id: "c-" + U.slug(b.dataset.propio), nombre: b.dataset.propio };
    dialogoSelector.close();
    alElegir(elegido);
  });

  // ---------- Rutina: vista ----------
  function ultimaHTML(b) {
    const u = S.ultima(b.id);
    if (!u) return "";
    const s = objetivo(b);
    return `<p class="bloque__ultima">Última (${esc(fechaCorta(u.fecha))}): ${esc(formatoSeries(u.series))}</p>` +
      (s && s.series.length ? `<p class="bloque__objetivo">${etiquetaObjetivo(s)} Hoy: ${esc(formatoSeries(s.series))}</p>` : "");
  }

  // Sesión que toca: la que quedó a medias, o la siguiente a la última
  // registrada en el orden del plan.
  function sesionSiguiente() {
    const dias = plan.rutina.dias;
    const borrador = almacen.leer("nm.borrador", null);
    if (borrador && borrador.planActualizado === plan.actualizado && dias[borrador.dia]) {
      return { dia: borrador.dia, etiqueta: "Sesión a medias", boton: "Continuar sesión" };
    }
    const ultima = S.todas()[0];
    const i = ultima ? dias.findIndex((d) => d.titulo === ultima.dia) : -1;
    for (let k = 1; k <= dias.length; k++) {
      const j = (i + k) % dias.length;
      if (!dias[j].ejercicios.length) continue;
      const hoyHecho = ultima && ultima.fecha === hoyISO();
      return { dia: j, etiqueta: hoyHecho ? "Hoy ya entrenaste. Después sigue" : ultima ? "Te toca" : "Empieza por", boton: "Registrar sesión" };
    }
    return null;
  }

  function pintarRutina() {
    const cont = $("#rutina-vista");
    if (!cont) return;
    $("#rutina-acciones").hidden = editandoRutina;
    $("#rutina-opciones").hidden = editandoRutina;
    $("#progresion").hidden = editandoRutina;
    if (editandoRutina) return;
    const dias = plan ? plan.rutina.dias : [];
    if (!dias.length) {
      cont.innerHTML = `
        <div class="panel vacio-plan">
          <h2>Aún no tienes rutina</h2>
          <p>La armamos juntos en el chat y la cargas con <strong>Importar plan</strong>. También puedes crearla tú con <strong>Editar rutina</strong>.</p>
        </div>`;
      return;
    }
    const sig = sesionSiguiente();
    cont.innerHTML = `
      ${sig ? `
        <section class="panel siguiente" aria-label="Sesión que toca">
          <div class="siguiente__texto">
            <p class="siguiente__etiqueta">${esc(sig.etiqueta)}</p>
            <h2>${esc(dias[sig.dia].titulo)}</h2>
            <p class="bloque__meta">${dias[sig.dia].ejercicios.length} ejercicios${dias[sig.dia].notas ? ` · ${esc(dias[sig.dia].notas)}` : ""}</p>
          </div>
          <button type="button" class="boton boton--primario" data-registrar="${sig.dia}">${sig.boton}</button>
        </section>` : ""}
      ${plan.rutina.notas ? `
        <details class="panel consejos notas-rutina">
          <summary><h2>Notas de la rutina</h2></summary>
          <p class="notas-plan">${esc(plan.rutina.notas)}</p>
        </details>` : ""}
      <div class="dias">
        ${dias.map((dia, d) => {
          const ultimaSesion = S.todas().find((s) => s.dia === dia.titulo);
          return `
          <article class="panel dia${sig && sig.dia === d ? " dia--siguiente" : ""}">
            <header class="dia__cabecera">
              <div>
                <p class="dia__num">Día ${d + 1}</p>
                <h3>${esc(dia.titulo)}</h3>
                <p class="bloque__meta">${dia.ejercicios.length} ejercicios${ultimaSesion ? ` · último registro ${esc(fechaCorta(ultimaSesion.fecha))}` : ""}</p>
              </div>
              ${dia.ejercicios.length ? `<button type="button" class="boton boton--icono boton--registrar" data-registrar="${d}" aria-label="Registrar sesión de ${esc(dia.titulo)}">Registrar</button>` : ""}
            </header>
            ${dia.notas ? `<p class="dia__notas">${esc(dia.notas)}</p>` : ""}
            <ol>
              ${dia.ejercicios.map((b) => {
                const e = U.ejercicio(b.id, b.nombre);
                const f = U.fotos(b.id);
                const datos = `data-id="${esc(b.id)}" data-nombre="${esc(b.nombre)}"`;
                return `
                <li class="bloque">
                  <div class="bloque__info">
                    ${e.propio && !f
                      ? `<p class="bloque__nombre">${esc(b.nombre)}</p>`
                      : `<button type="button" class="bloque__nombre" ${datos}>${esc(b.nombre || e.nombre)}</button>`}
                    ${e.equipo ? `<p class="bloque__meta">${esc(e.musculo)} · ${esc(e.equipo)}</p>` : ""}
                    <p class="bloque__dosis"><strong>${b.series} × ${esc(b.reps)}</strong>${b.descanso ? ` · descanso ${esc(b.descanso)}` : ""}</p>
                    ${b.notas ? `<p class="bloque__nota">${esc(b.notas)}</p>` : ""}
                    ${ultimaHTML(b)}
                  </div>
                  ${f ? `<button type="button" class="bloque__foto" ${datos} aria-label="Ver ejemplo de ${esc(b.nombre)}">
                    <img src="${esc(f.inicio)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></button>` : ""}
                </li>`;
              }).join("")}
            </ol>
          </article>`;
        }).join("")}
      </div>`;
  }

  // ---------- Rutina: editor ----------
  let editandoRutina = false;
  let edRutina = null;

  function pintarEditorRutina() {
    const cont = $("#rutina-vista");
    cont.innerHTML = `
      <form class="editor" id="editor-rutina">
        <div class="panel">
          <label class="selector"><span>Notas generales de la rutina</span>
            <textarea rows="3" data-campo="notas" placeholder="Ej.: calentar 10 min, subir peso cuando llegues al tope de repeticiones…">${esc(edRutina.notas)}</textarea>
          </label>
        </div>
        ${edRutina.dias.map((dia, d) => `
          <section class="panel editor__dia">
            <div class="editor__dia-cabecera">
              <label class="selector"><span>Día ${d + 1}</span>
                <input type="text" value="${esc(dia.titulo)}" data-d="${d}" data-campo="titulo" maxlength="60">
              </label>
              <div class="acciones-fila">
                <button type="button" class="icono-btn" data-accion="subir-dia" data-d="${d}" aria-label="Subir día">${ICONOS.arriba}</button>
                <button type="button" class="icono-btn" data-accion="bajar-dia" data-d="${d}" aria-label="Bajar día">${ICONOS.abajo}</button>
                <button type="button" class="icono-btn icono-btn--peligro" data-accion="borrar-dia" data-d="${d}" aria-label="Borrar día">${ICONOS.borrar}</button>
              </div>
            </div>
            <label class="selector"><span>Notas del día <em>opcional</em></span>
              <input type="text" value="${esc(dia.notas)}" data-d="${d}" data-campo="notas-dia" maxlength="300">
            </label>
            <ol class="editor__lista">
              ${dia.ejercicios.map((b, i) => `
                <li class="editor__ej">
                  <div class="editor__ej-cabecera">
                    <button type="button" class="editor__ej-nombre" data-accion="cambiar-ej" data-d="${d}" data-i="${i}" title="Cambiar ejercicio">
                      ${esc(b.nombre)}<span>Cambiar</span>
                    </button>
                    <div class="acciones-fila">
                      <button type="button" class="icono-btn" data-accion="subir-ej" data-d="${d}" data-i="${i}" aria-label="Subir ejercicio">${ICONOS.arriba}</button>
                      <button type="button" class="icono-btn" data-accion="bajar-ej" data-d="${d}" data-i="${i}" aria-label="Bajar ejercicio">${ICONOS.abajo}</button>
                      <button type="button" class="icono-btn icono-btn--peligro" data-accion="borrar-ej" data-d="${d}" data-i="${i}" aria-label="Quitar ejercicio">${ICONOS.borrar}</button>
                    </div>
                  </div>
                  <div class="editor__ej-campos">
                    <label class="selector"><span>Series</span><input type="number" min="1" max="20" inputmode="numeric" value="${b.series}" data-d="${d}" data-i="${i}" data-campo="series"></label>
                    <label class="selector"><span>Reps</span><input type="text" value="${esc(b.reps)}" data-d="${d}" data-i="${i}" data-campo="reps" maxlength="20" placeholder="8–12"></label>
                    <label class="selector"><span>Descanso</span><input type="text" value="${esc(b.descanso)}" data-d="${d}" data-i="${i}" data-campo="descanso" maxlength="20" placeholder="90 s"></label>
                    <label class="selector editor__nota"><span>Nota</span><input type="text" value="${esc(b.notas)}" data-d="${d}" data-i="${i}" data-campo="notas-ej" maxlength="300" placeholder="Técnica, tempo…"></label>
                  </div>
                </li>`).join("")}
            </ol>
            <button type="button" class="boton boton--icono" data-accion="agregar-ej" data-d="${d}">+ Añadir ejercicio</button>
          </section>`).join("")}
        <button type="button" class="boton" data-accion="agregar-dia">+ Añadir día</button>
        <div class="editor__pie">
          <button type="button" class="boton boton--texto" data-accion="cancelar">Cancelar</button>
          <button type="submit" class="boton boton--primario">Guardar rutina</button>
        </div>
      </form>`;
  }

  function editarRutina() {
    editandoRutina = true;
    edRutina = copia((plan || planVacio()).rutina);
    if (!edRutina.dias.length) edRutina.dias.push({ titulo: "Día 1", notas: "", ejercicios: [] });
    pintarRutina();
    pintarEditorRutina();
  }

  function terminarEdicionRutina() {
    editandoRutina = false;
    edRutina = null;
    pintarRutina();
  }

  function iniciarRutina() {
    $("#editar-rutina").addEventListener("click", editarRutina);
    $("#imprimir-rutina").addEventListener("click", () => window.print());

    const cont = $("#rutina-vista");
    cont.addEventListener("input", (ev) => {
      if (!editandoRutina) return;
      const t = ev.target, c = t.dataset.campo;
      if (!c) return;
      if (c === "notas") edRutina.notas = t.value;
      else if (c === "titulo") edRutina.dias[t.dataset.d].titulo = t.value;
      else if (c === "notas-dia") edRutina.dias[t.dataset.d].notas = t.value;
      else {
        const ej = edRutina.dias[t.dataset.d].ejercicios[t.dataset.i];
        if (c === "series") ej.series = t.value;
        else if (c === "notas-ej") ej.notas = t.value;
        else ej[c] = t.value;
      }
    });

    cont.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const base = plan || planVacio();
      guardarPlan({ ...base, rutina: edRutina });
      terminarEdicionRutina();
      aviso("Rutina guardada");
    });

    cont.addEventListener("click", (ev) => {
      const btnDetalle = ev.target.closest(".bloque [data-id]");
      if (btnDetalle && !editandoRutina) { window.NM.app.abrirDetalle(btnDetalle.dataset.id, btnDetalle.dataset.nombre); return; }
      const registrar = ev.target.closest("[data-registrar]");
      if (registrar) { abrirSesion(Number(registrar.dataset.registrar)); return; }

      const b = ev.target.closest("[data-accion]");
      if (!b || !editandoRutina) return;
      const d = Number(b.dataset.d), i = Number(b.dataset.i);
      const dias = edRutina.dias;
      switch (b.dataset.accion) {
        case "cancelar":
          if (confirm("¿Salir sin guardar los cambios?")) terminarEdicionRutina();
          return;
        case "agregar-dia":
          dias.push({ titulo: `Día ${dias.length + 1}`, notas: "", ejercicios: [] });
          break;
        case "borrar-dia":
          if (!confirm(`¿Borrar «${dias[d].titulo}» y sus ejercicios?`)) return;
          dias.splice(d, 1);
          break;
        case "subir-dia": mover(dias, d, -1); break;
        case "bajar-dia": mover(dias, d, 1); break;
        case "subir-ej": mover(dias[d].ejercicios, i, -1); break;
        case "bajar-ej": mover(dias[d].ejercicios, i, 1); break;
        case "borrar-ej": dias[d].ejercicios.splice(i, 1); break;
        case "agregar-ej":
          elegirEjercicio((e) => {
            dias[d].ejercicios.push({ ...e, series: 3, reps: "8–12", descanso: "90 s", notas: "" });
            pintarEditorRutina();
          });
          return;
        case "cambiar-ej":
          elegirEjercicio((e) => {
            Object.assign(dias[d].ejercicios[i], e);
            pintarEditorRutina();
          });
          return;
        default: return;
      }
      pintarEditorRutina();
    });
  }

  // ---------- Registro de sesión ----------
  // Se guarda un borrador en cuanto se anota algo, así no se pierde nada si
  // se cierra la ventana a mitad del entrenamiento.
  const dialogoSesion = $("#sesion");
  let sesion = null;

  function nuevaSesion(d) {
    return {
      dia: d,
      planActualizado: plan.actualizado,
      fecha: hoyISO(),
      ejercicios: plan.rutina.dias[d].ejercicios.map((b) => {
        // Se propone el peso del objetivo de hoy; las repeticiones las anota la persona.
        const s = objetivo(b);
        const series = Array.from({ length: b.series }, (_, k) => {
          const meta = s && s.series[k];
          return { kg: meta && meta.kg ? String(meta.kg) : "", reps: "" };
        });
        return { id: b.id, series };
      }),
    };
  }

  const guardarBorrador = () => almacen.guardar("nm.borrador", sesion);

  function htmlSeries(ej, e) {
    const b = plan.rutina.dias[sesion.dia].ejercicios[e];
    const sinPeso = U.ejercicio(ej.id).equipoEn === "body weight";
    const meta = objetivo(b);
    return ej.series.map((s, k) => {
      // Repeticiones objetivo de esta serie: se muestran como guía y la casilla
      // se pone verde al alcanzarlas.
      const reps = meta && meta.series[k] ? meta.series[k].reps : null;
      return `
      <div class="serie-fila">
        <span class="serie-num">${k + 1}</span>
        <input type="number" inputmode="decimal" step="0.25" min="0" max="1000" aria-label="Serie ${k + 1}: kilos"
          placeholder="${sinPeso ? "lastre" : "kg"}" value="${esc(s.kg)}" data-e="${e}" data-s="${k}" data-campo="kg">
        <input type="number" inputmode="numeric" step="1" min="1" max="200" aria-label="Serie ${k + 1}: repeticiones"
          placeholder="${esc(reps ?? b.reps)}" value="${esc(s.reps)}" data-e="${e}" data-s="${k}" data-campo="reps"
          ${reps ? `data-objetivo="${reps}"` : ""} class="${reps && Number(s.reps) >= reps ? "cumplida" : ""}">
      </div>`;
    }).join("");
  }

  function pintarSesion() {
    const dia = plan.rutina.dias[sesion.dia];
    $("#sesion-contenido").innerHTML = `
      <form class="sesion__form" id="form-sesion" novalidate>
        <div class="detalle__cabecera">
          <div>
            <p class="dia__num">Día ${sesion.dia + 1}</p>
            <h2 id="sesion-titulo">${esc(dia.titulo)}</h2>
          </div>
          <button type="button" class="cerrar" data-cerrar-sesion aria-label="Cerrar">${ICONOS.cerrar}</button>
        </div>
        <div class="sesion__intro">
          <label class="selector sesion__fecha">
            <span>Fecha</span>
            <input type="date" id="sesion-fecha" value="${esc(sesion.fecha)}" max="${hoyISO()}" required>
          </label>
          <p class="sesion__ayuda">Anota el peso y las repeticiones de cada serie. Las series sin repeticiones no se guardan.</p>
        </div>
        ${sesion.ejercicios.map((ej, e) => {
          const b = dia.ejercicios[e];
          const u = S.ultima(ej.id);
          const s = objetivo(b);
          return `
          <section class="ej-sesion">
            <div class="ej-sesion__cabecera">
              <h3>${!U.ejercicio(ej.id).propio || U.fotos(ej.id)
                ? `<button type="button" class="ej-sesion__ver" data-id="${esc(ej.id)}" data-nombre="${esc(b.nombre)}" title="Ver ejemplo">${esc(b.nombre)}</button>`
                : esc(b.nombre)}</h3>
              <span class="etiqueta">${b.series} × ${esc(b.reps)}</span>
            </div>
            ${b.notas ? `<p class="bloque__nota">${esc(b.notas)}</p>` : ""}
            ${u ? `<p class="ej-sesion__ultima">Última vez (${esc(fechaCorta(u.fecha))}): ${esc(formatoSeries(u.series))}</p>` : ""}
            ${s ? `<p class="ej-sesion__objetivo">${etiquetaObjetivo(s)} ${esc(s.texto)}</p>` : ""}
            <div class="series">
              <div class="serie-fila serie-fila--cabecera" aria-hidden="true"><span>Serie</span><span>kg</span><span>Reps</span></div>
              <div data-series="${e}">${htmlSeries(ej, e)}</div>
            </div>
            <button type="button" class="boton boton--texto boton--icono" data-agregar-serie="${e}">+ Añadir serie</button>
          </section>`;
        }).join("")}
        <div class="sesion__pie">
          <button type="button" class="boton boton--texto" data-descartar>Descartar</button>
          <button type="submit" class="boton boton--primario">Guardar sesión</button>
        </div>
      </form>`;
  }

  function abrirSesion(d) {
    const borrador = almacen.leer("nm.borrador", null);
    const ejercicios = plan.rutina.dias[d].ejercicios;
    const valido = borrador && borrador.dia === d && borrador.planActualizado === plan.actualizado &&
      Array.isArray(borrador.ejercicios) && borrador.ejercicios.length === ejercicios.length &&
      borrador.ejercicios.every((ej, i) => ej.id === ejercicios[i].id);
    sesion = valido ? borrador : nuevaSesion(d);
    pintarSesion();
    dialogoSesion.showModal();
    if (valido) aviso("Recuperamos tu borrador");
    const primero = dialogoSesion.querySelector('input[data-campo="reps"]');
    if (primero) primero.focus();
  }

  function terminarSesion() {
    localStorage.removeItem("nm.borrador");
    sesion = null;
    dialogoSesion.close();
  }

  function guardarSesion() {
    const fecha = $("#sesion-fecha").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { aviso("Elige una fecha válida"); return; }
    const dia = plan.rutina.dias[sesion.dia];
    const ejercicios = sesion.ejercicios.map((ej, e) => ({
      id: ej.id,
      nombre: dia.ejercicios[e].nombre,
      series: ej.series
        .map((s) => ({ kg: parseFloat(s.kg), reps: parseInt(s.reps, 10) }))
        .filter((s) => s.reps > 0 && s.reps <= 200)
        .map((s) => ({ kg: s.kg > 0 && s.kg <= 1000 ? s.kg : null, reps: s.reps })),
    })).filter((ej) => ej.series.length);
    if (!ejercicios.length) { aviso("Anota las repeticiones de al menos una serie"); return; }
    const nueva = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      fecha, dia: dia.titulo, creada: new Date().toISOString(), ejercicios,
    };
    const conPrevio = ejercicios.map((ej) => [S.ultima(ej.id), ej]).filter(([previo]) => previo);
    const mejoras = conPrevio.filter(([previo, ej]) => S.supera(previo, ej)).length;
    if (!S.agregar(nueva)) { aviso("No se pudo guardar en este navegador"); return; }
    terminarSesion();
    pintarRutina();
    window.NM.app.dibujarCargas();
    aviso(conPrevio.length
      ? `Sesión guardada · progresaste en ${mejoras} de ${conPrevio.length} ejercicios`
      : "Sesión guardada: ya tienes tu punto de partida");
  }

  function iniciarSesiones() {
    dialogoSesion.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!sesion) return;
      if (t.id === "sesion-fecha") sesion.fecha = t.value;
      else if (t.dataset.campo) {
        sesion.ejercicios[t.dataset.e].series[t.dataset.s][t.dataset.campo] = t.value;
        if (t.dataset.objetivo) t.classList.toggle("cumplida", Number(t.value) >= Number(t.dataset.objetivo));
      }
      guardarBorrador();
    });
    dialogoSesion.addEventListener("click", (ev) => {
      if (ev.target === dialogoSesion || ev.target.closest("[data-cerrar-sesion]")) { dialogoSesion.close(); return; }
      const ver = ev.target.closest(".ej-sesion__ver");
      if (ver) { window.NM.app.abrirDetalle(ver.dataset.id, ver.dataset.nombre); return; }
      const agregar = ev.target.closest("[data-agregar-serie]");
      if (agregar) {
        const e = Number(agregar.dataset.agregarSerie);
        const series = sesion.ejercicios[e].series;
        series.push({ kg: series.length ? series[series.length - 1].kg : "", reps: "" });
        guardarBorrador();
        $(`[data-series="${e}"]`, dialogoSesion).innerHTML = htmlSeries(sesion.ejercicios[e], e);
        const nuevos = dialogoSesion.querySelectorAll(`[data-e="${e}"][data-campo="reps"]`);
        nuevos[nuevos.length - 1].focus();
        return;
      }
      if (ev.target.closest("[data-descartar]") && confirm("¿Descartar lo anotado en esta sesión?")) terminarSesion();
    });
    dialogoSesion.addEventListener("submit", (ev) => { ev.preventDefault(); guardarSesion(); });
    dialogoSesion.addEventListener("close", () => {
      if (sesion && localStorage.getItem("nm.borrador")) aviso("Guardado como borrador");
      pintarRutina(); // actualiza la sesión que toca (a medias o siguiente)
    });
  }

  // ---------- Dieta ----------
  const MACROS = [
    ["kcal", "Calorías", "kcal"],
    ["proteina", "Proteína", "g"],
    ["carbohidratos", "Carbohidratos", "g"],
    ["grasas", "Grasas", "g"],
  ];
  const sumar = (alimentos) => Object.fromEntries(MACROS.map(([k]) => [k, alimentos.reduce((s, a) => s + (a[k] || 0), 0)]));
  const fmt = (n) => Math.round(n).toLocaleString("es");

  let editandoDieta = false;
  let edDieta = null;

  function pintarDieta() {
    const cont = $("#dieta-vista");
    if (!cont) return;
    $("#dieta-acciones").hidden = editandoDieta;
    $("#diario").hidden = editandoDieta;
    if (editandoDieta) return;
    const dieta = plan ? plan.dieta : null;
    const hayObjetivos = dieta && MACROS.some(([k]) => dieta.objetivos[k] != null);
    if (!dieta || (!dieta.comidas.length && !dieta.notas && !hayObjetivos)) {
      cont.innerHTML = `
        <div class="panel vacio-plan">
          <h2>Aún no tienes dieta</h2>
          <p>La armamos juntos en el chat según tus datos, gustos y horarios, y la cargas con <strong>Importar plan</strong> en la sección Rutina. También puedes crearla tú con <strong>Editar dieta</strong>.</p>
        </div>`;
      return;
    }
    const total = sumar(dieta.comidas.flatMap((c) => c.alimentos));
    const hayDatos = dieta.comidas.some((c) => c.alimentos.some((a) => a.kcal != null));
    cont.innerHTML = `
      <div class="metricas metricas--4">
        ${MACROS.map(([k, etiqueta, u]) => {
          const obj = dieta.objetivos[k];
          return `<div class="metrica">
            <p class="metrica__etiqueta">${etiqueta}</p>
            <p class="metrica__valor">${obj != null ? fmt(obj) : "—"}<small>${u}</small></p>
            ${hayDatos ? `<p class="metrica__detalle">El ejemplo suma ${fmt(total[k])} ${u}</p>` : ""}
          </div>`;
        }).join("")}
      </div>
      ${dieta.notas ? `<div class="panel notas-plan"><h2>Guía</h2><p>${esc(dieta.notas)}</p></div>` : ""}
      ${dieta.comidas.length ? '<h2 class="comidas__titulo">Comidas</h2>' : ""}
      <div class="comidas">
        ${dieta.comidas.map((c) => {
          const t = sumar(c.alimentos);
          return `
          <article class="panel comida">
            <header class="comida__cabecera">
              <h3>${esc(c.nombre)}</h3>
              ${c.hora ? `<span class="etiqueta">${esc(c.hora)}</span>` : ""}
            </header>
            <ul class="alimentos">
              ${c.alimentos.map((a) => `
                <li>
                  <span class="alimento__nombre">${esc(a.nombre)}${a.cantidad ? ` <em>${esc(a.cantidad)}</em>` : ""}</span>
                  ${a.kcal != null ? `<span class="alimento__macros">${fmt(a.kcal)} kcal${a.proteina != null ? ` · ${fmt(a.proteina)} g P` : ""}</span>` : ""}
                </li>`).join("")}
            </ul>
            ${c.alimentos.some((a) => a.kcal != null) ? `<p class="comida__total">${fmt(t.kcal)} kcal · P ${fmt(t.proteina)} g · C ${fmt(t.carbohidratos)} g · G ${fmt(t.grasas)} g</p>` : ""}
            ${c.notas ? `<p class="bloque__nota">${esc(c.notas)}</p>` : ""}
          </article>`;
        }).join("")}
      </div>`;
  }

  function pintarEditorDieta() {
    const o = edDieta.objetivos;
    $("#dieta-vista").innerHTML = `
      <form class="editor" id="editor-dieta">
        <div class="panel">
          <h2>Objetivos diarios</h2>
          <div class="editor__macros">
            ${MACROS.map(([k, etiqueta, u]) => `
              <label class="selector"><span>${etiqueta} (${u})</span>
                <input type="number" min="0" inputmode="decimal" value="${o[k] ?? ""}" data-obj="${k}">
              </label>`).join("")}
          </div>
        </div>
        ${edDieta.comidas.map((c, m) => `
          <section class="panel editor__dia">
            <div class="editor__dia-cabecera">
              <div class="editor__comida-datos">
                <label class="selector"><span>Comida ${m + 1}</span><input type="text" value="${esc(c.nombre)}" data-m="${m}" data-campo="nombre" maxlength="60"></label>
                <label class="selector"><span>Hora</span><input type="text" value="${esc(c.hora)}" data-m="${m}" data-campo="hora" maxlength="20" placeholder="7:00"></label>
              </div>
              <div class="acciones-fila">
                <button type="button" class="icono-btn" data-accion="subir-comida" data-m="${m}" aria-label="Subir comida">${ICONOS.arriba}</button>
                <button type="button" class="icono-btn" data-accion="bajar-comida" data-m="${m}" aria-label="Bajar comida">${ICONOS.abajo}</button>
                <button type="button" class="icono-btn icono-btn--peligro" data-accion="borrar-comida" data-m="${m}" aria-label="Borrar comida">${ICONOS.borrar}</button>
              </div>
            </div>
            <div class="alimentos-editor">
              <div class="alimento-fila alimento-fila--cabecera" aria-hidden="true">
                <span>Alimento</span><span>Cantidad</span><span>kcal</span><span>P</span><span>C</span><span>G</span><span></span>
              </div>
              ${c.alimentos.map((a, i) => `
                <div class="alimento-fila">
                  <input type="text" value="${esc(a.nombre)}" data-m="${m}" data-i="${i}" data-campo="nombre" aria-label="Alimento" placeholder="Alimento">
                  <input type="text" value="${esc(a.cantidad)}" data-m="${m}" data-i="${i}" data-campo="cantidad" aria-label="Cantidad" placeholder="100 g">
                  ${["kcal", "proteina", "carbohidratos", "grasas"].map((k) => `
                    <input type="number" min="0" step="0.1" inputmode="decimal" value="${a[k] ?? ""}" data-m="${m}" data-i="${i}" data-campo="${k}" aria-label="${k}">`).join("")}
                  <button type="button" class="icono-btn icono-btn--peligro" data-accion="borrar-alimento" data-m="${m}" data-i="${i}" aria-label="Quitar alimento">${ICONOS.borrar}</button>
                </div>`).join("")}
            </div>
            <button type="button" class="boton boton--icono" data-accion="agregar-alimento" data-m="${m}">+ Añadir alimento</button>
            <label class="selector"><span>Notas de la comida <em>opcional</em></span>
              <input type="text" value="${esc(c.notas)}" data-m="${m}" data-campo="notas" maxlength="300">
            </label>
          </section>`).join("")}
        <button type="button" class="boton" data-accion="agregar-comida">+ Añadir comida</button>
        <div class="panel">
          <label class="selector"><span>Notas generales (suplementos, agua, comidas libres…)</span>
            <textarea rows="4" data-campo="notas-dieta">${esc(edDieta.notas)}</textarea>
          </label>
        </div>
        <div class="editor__pie">
          <button type="button" class="boton boton--texto" data-accion="cancelar">Cancelar</button>
          <button type="submit" class="boton boton--primario">Guardar dieta</button>
        </div>
      </form>`;
  }

  function editarDieta() {
    editandoDieta = true;
    edDieta = copia((plan || planVacio()).dieta);
    if (!edDieta.comidas.length) edDieta.comidas.push({ nombre: "Desayuno", hora: "", notas: "", alimentos: [] });
    pintarDieta();
    pintarEditorDieta();
  }

  function terminarEdicionDieta() {
    editandoDieta = false;
    edDieta = null;
    pintarDieta();
  }

  function iniciarDieta() {
    $("#editar-dieta").addEventListener("click", editarDieta);
    const cont = $("#dieta-vista");
    cont.addEventListener("input", (ev) => {
      if (!editandoDieta) return;
      const t = ev.target;
      if (t.dataset.obj) { edDieta.objetivos[t.dataset.obj] = t.value; return; }
      const c = t.dataset.campo;
      if (c === "notas-dieta") { edDieta.notas = t.value; return; }
      if (!c) return;
      const comida = edDieta.comidas[t.dataset.m];
      if (t.dataset.i != null) comida.alimentos[t.dataset.i][c] = t.value;
      else comida[c] = t.value;
    });
    cont.addEventListener("submit", (ev) => {
      ev.preventDefault();
      // Quita filas de alimento vacías antes de guardar.
      edDieta.comidas.forEach((c) => { c.alimentos = c.alimentos.filter((a) => String(a.nombre).trim()); });
      guardarPlan({ ...(plan || planVacio()), dieta: edDieta });
      terminarEdicionDieta();
      aviso("Dieta guardada");
    });
    cont.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-accion]");
      if (!b || !editandoDieta) return;
      const m = Number(b.dataset.m), i = Number(b.dataset.i);
      const comidas = edDieta.comidas;
      switch (b.dataset.accion) {
        case "cancelar":
          if (confirm("¿Salir sin guardar los cambios?")) terminarEdicionDieta();
          return;
        case "agregar-comida": comidas.push({ nombre: `Comida ${comidas.length + 1}`, hora: "", notas: "", alimentos: [] }); break;
        case "borrar-comida":
          if (!confirm(`¿Borrar «${comidas[m].nombre}»?`)) return;
          comidas.splice(m, 1);
          break;
        case "subir-comida": mover(comidas, m, -1); break;
        case "bajar-comida": mover(comidas, m, 1); break;
        case "agregar-alimento":
          comidas[m].alimentos.push({ nombre: "", cantidad: "", kcal: null, proteina: null, carbohidratos: null, grasas: null });
          pintarEditorDieta();
          cont.querySelector(`[data-m="${m}"][data-i="${comidas[m].alimentos.length - 1}"][data-campo="nombre"]`).focus();
          return;
        case "borrar-alimento": comidas[m].alimentos.splice(i, 1); break;
        default: return;
      }
      pintarEditorDieta();
    });
  }

  // ---------- Importar / exportar plan ----------
  // Importa un plan ya leído. Puede traer solo la rutina o solo la dieta: la
  // otra parte se conserva.
  function importarDatos(datos) {
    if (!datos || datos.tipo !== "nm-plan") throw new Error("tipo");
    const traeRutina = Boolean(datos.rutina && typeof datos.rutina === "object");
    const traeDieta = Boolean(datos.dieta && typeof datos.dieta === "object");
    if (!traeRutina && !traeDieta) throw new Error("vacío");
    const nuevo = limpiarPlan({
      rutina: traeRutina ? datos.rutina : plan && plan.rutina,
      dieta: traeDieta ? datos.dieta : plan && plan.dieta,
    });
    const partes = [
      traeRutina && `rutina de ${nuevo.rutina.dias.length} días`,
      traeDieta && `dieta de ${nuevo.dieta.comidas.length} comidas`,
    ].filter(Boolean).join(" y ");
    const reemplaza = plan && ((traeRutina && plan.rutina.dias.length) || (traeDieta && plan.dieta.comidas.length));
    if (reemplaza && !confirm(`Vas a cargar ${partes}. Reemplazará lo que tienes ahora en esa parte; lo demás y tu historial de cargas se mantienen. ¿Continuar?`)) return;
    guardarPlan(nuevo);
    aviso(`Importado: ${partes}`);
  }

  // Enlace directo: index.html?plan=planes/archivo.json carga ese plan desde la
  // propia web. Solo acepta archivos de la carpeta planes/.
  async function importarDesdeEnlace() {
    const params = new URLSearchParams(location.search);
    const ruta = params.get("plan");
    if (!ruta) return;
    params.delete("plan");
    const resto = params.toString();
    history.replaceState(null, "", `${location.pathname}${resto ? `?${resto}` : ""}#rutina`);
    if (!/^planes\/[\w.-]+\.json$/.test(ruta)) { aviso("Ese enlace de plan no es válido"); return; }
    try {
      const respuesta = await fetch(ruta, { cache: "no-store" });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      importarDatos(await respuesta.json());
    } catch {
      aviso("No se pudo cargar el plan del enlace");
    }
  }

  // Carga automática: si este dispositivo aún no tiene rutina o dieta, trae la
  // publicada en planes/actual.json. Se hace una sola vez por parte, para no
  // reponer algo que la persona borró a propósito.
  async function cargarPlanPublicado() {
    if (!/^https?:$/.test(location.protocol)) return;
    const hecho = almacen.leer("nm.plan.auto", {});
    const hayDieta = plan && (plan.dieta.comidas.length || plan.dieta.notas || MACROS.some(([k]) => plan.dieta.objetivos[k] != null));
    const falta = {
      rutina: !hecho.rutina && !(plan && plan.rutina.dias.length),
      dieta: !hecho.dieta && !hayDieta,
    };
    if (!falta.rutina && !falta.dieta) return;
    try {
      const actual = await (await fetch("planes/actual.json", { cache: "no-store" })).json();
      const partes = {};
      for (const parte of ["rutina", "dieta"]) {
        const archivo = actual[parte];
        if (!falta[parte] || !/^[\w.-]+\.json$/.test(archivo || "")) continue;
        const datos = await (await fetch(`planes/${archivo}`, { cache: "no-store" })).json();
        if (datos && datos.tipo === "nm-plan" && datos[parte]) partes[parte] = datos[parte];
      }
      if (!Object.keys(partes).length) return;
      guardarPlan({ rutina: partes.rutina || (plan && plan.rutina), dieta: partes.dieta || (plan && plan.dieta) });
      almacen.guardar("nm.plan.auto", { ...hecho, ...Object.fromEntries(Object.keys(partes).map((k) => [k, true])) });
      aviso("Cargamos tu plan");
    } catch {
      // Sin conexión o sin plan publicado: la app sigue como estaba.
    }
  }

  function iniciarImportacion() {
    $("#exportar-plan").addEventListener("click", () => {
      if (!plan) { aviso("Aún no hay plan para exportar"); return; }
      U.descargarJSON(plan, `plan-nm-${hoyISO()}.json`);
    });
    $("#importar-plan").addEventListener("change", async (ev) => {
      const archivo = ev.target.files[0];
      ev.target.value = "";
      if (!archivo) return;
      try {
        importarDatos(JSON.parse(await archivo.text()));
      } catch {
        aviso("Ese archivo no es un plan válido");
      }
    });
  }

  // Ajustes de sobrecarga progresiva
  function pintarAjustes() {
    $("#prog-paso").value = ajustes.paso;
    $("#prog-maximo").value = ajustes.maximo;
  }
  function fijarAjustes(nuevos) {
    const paso = parseFloat(nuevos && nuevos.paso), maximo = parseFloat(nuevos && nuevos.maximo);
    ajustes = {
      paso: paso > 0 && paso <= 50 ? paso : AJUSTES_INICIALES.paso,
      maximo: maximo > 0 && maximo <= 500 ? maximo : AJUSTES_INICIALES.maximo,
    };
    almacen.guardar("nm.progresion", ajustes);
    pintarAjustes();
    pintarRutina();
  }
  $("#progresion").addEventListener("change", (ev) => {
    if (!ev.target.matches("#prog-paso, #prog-maximo")) return;
    fijarAjustes({ paso: $("#prog-paso").value, maximo: $("#prog-maximo").value });
    aviso("Ajustes guardados");
  });
  pintarAjustes();

  iniciarRutina();
  iniciarSesiones();
  iniciarDieta();
  iniciarImportacion();
  pintarRutina();
  pintarDieta();
  importarDesdeEnlace().then(cargarPlanPublicado);

  window.NM.plan = {
    obtener: () => plan,
    reemplazar: (p) => { if (p && p.tipo === "nm-plan") guardarPlan(p); },
    repintar: pintarRutina,
    ajustes: () => ajustes,
    fijarAjustes,
  };
})();
