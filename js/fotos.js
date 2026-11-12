// Fotos de progreso. La cámara muestra la foto anterior de la misma pose en
// transparencia para alinearse igual cada vez. Las fotos se guardan solo en
// este dispositivo (IndexedDB), recortadas a 3:4 tal como se ven en el visor.
(function () {
  "use strict";

  const U = window.NM.util;
  const { $, esc, aviso, almacen, fechaCorta, hoyISO, ICONOS } = U;

  const POSES = [
    { id: "frente", nombre: "Frente" },
    { id: "perfil", nombre: "Perfil" },
    { id: "espalda", nombre: "Espalda" },
  ];
  const ASPECTO = 3 / 4; // ancho / alto
  const ANCHO_MAX = 1200;

  // ---------- Almacenamiento (IndexedDB) ----------
  let dbPromesa = null;
  function db() {
    if (!dbPromesa) {
      dbPromesa = new Promise((ok, mal) => {
        const r = indexedDB.open("nm-fotos", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("fotos", { keyPath: "id" });
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      });
    }
    return dbPromesa;
  }
  async function operar(modo, fn) {
    const base = await db();
    return new Promise((ok, mal) => {
      const t = base.transaction("fotos", modo);
      const pet = fn(t.objectStore("fotos"));
      t.oncomplete = () => ok(pet && "result" in pet ? pet.result : undefined);
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error);
    });
  }
  const leerTodas = () => operar("readonly", (st) => st.getAll());
  const guardar = (foto) => operar("readwrite", (st) => st.put(foto));
  const borrar = (id) => operar("readwrite", (st) => st.delete(id));

  // ---------- Estado ----------
  let fotos = []; // ordenadas de la más antigua a la más reciente
  const urls = new Map();
  let pose = almacen.leer("nm.fotos.pose", "frente");
  let cargado = false;

  const porFecha = (a, b) => a.fecha.localeCompare(b.fecha) || a.creada.localeCompare(b.creada);
  const dePose = (p = pose) => fotos.filter((f) => f.pose === p);
  const nombrePose = (p) => POSES.find((x) => x.id === p).nombre;

  function url(foto) {
    if (!urls.has(foto.id)) urls.set(foto.id, URL.createObjectURL(foto.blob));
    return urls.get(foto.id);
  }

  async function recargar() {
    try {
      fotos = (await leerTodas()).sort(porFecha);
    } catch {
      fotos = [];
      aviso("Este navegador no permite guardar fotos");
    }
    const vivas = new Set(fotos.map((f) => f.id));
    for (const [id, u] of urls) if (!vivas.has(id)) { URL.revokeObjectURL(u); urls.delete(id); }
    cargado = true;
    pintar();
  }

  function etiquetaFoto(f) {
    const peso = window.NM.app.pesoEn(f.fecha);
    return `${fechaCorta(f.fecha)}${peso ? ` · ${U.numero(peso)} kg` : ""}`;
  }

  // ---------- Sección ----------
  let antesId = null, despuesId = null, modoComparar = "deslizar";

  function pintar() {
    if (!cargado) return;
    document.querySelectorAll("#poses .pestana").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pose === pose)));
    const lista = dePose();
    $("#tomar-foto").textContent = lista.length ? `Tomar foto de ${nombrePose(pose).toLowerCase()}` : `Primera foto de ${nombrePose(pose).toLowerCase()}`;

    // Galería
    $("#galeria").innerHTML = lista.length
      ? [...lista].reverse().map((f) => `
        <li>
          <button type="button" class="galeria__item" data-ver="${f.id}">
            <img src="${url(f)}" alt="${esc(nombrePose(f.pose))} del ${esc(fechaCorta(f.fecha))}" loading="lazy">
            <span>${esc(etiquetaFoto(f))}</span>
          </button>
        </li>`).join("")
      : `<li class="vacio-progreso">Aún no hay fotos de ${nombrePose(pose).toLowerCase()}.</li>`;
    $("#fotos-conteo").textContent = lista.length ? `${lista.length} ${lista.length === 1 ? "foto" : "fotos"}` : "";

    // Comparador
    const panel = $("#comparador-panel");
    if (lista.length < 2) {
      panel.innerHTML = `<h2>Comparar</h2><p class="vacio-progreso">Con 2 fotos de ${nombrePose(pose).toLowerCase()} podrás comparar el antes y el después.</p>`;
      return;
    }
    if (!lista.some((f) => f.id === antesId)) antesId = lista[0].id;
    if (!lista.some((f) => f.id === despuesId)) despuesId = lista[lista.length - 1].id;
    const antes = lista.find((f) => f.id === antesId), despues = lista.find((f) => f.id === despuesId);
    const opciones = (sel) => lista.map((f) => `<option value="${f.id}" ${f.id === sel ? "selected" : ""}>${esc(etiquetaFoto(f))}</option>`).join("");
    const dias = Math.round((new Date(despues.fecha) - new Date(antes.fecha)) / 864e5);
    panel.innerHTML = `
      <div class="grafica__cabecera">
        <h2>Comparar</h2>
        <div class="pestanas" role="group" aria-label="Modo de comparación">
          <button type="button" class="pestana" data-modo="deslizar" aria-pressed="${modoComparar === "deslizar"}">Deslizar</button>
          <button type="button" class="pestana" data-modo="lado" aria-pressed="${modoComparar === "lado"}">Lado a lado</button>
        </div>
      </div>
      <div class="comparador__selects">
        <label class="selector"><span>Antes</span><select data-comparar="antes">${opciones(antesId)}</select></label>
        <label class="selector"><span>Después</span><select data-comparar="despues">${opciones(despuesId)}</select></label>
      </div>
      ${modoComparar === "deslizar" ? `
        <div class="comparador" style="--corte: 50%">
          <img src="${url(despues)}" alt="Después">
          <img src="${url(antes)}" alt="Antes" class="comparador__antes">
          <span class="comparador__linea" aria-hidden="true"></span>
          <span class="comparador__rotulo">Antes</span>
          <span class="comparador__rotulo comparador__rotulo--der">Después</span>
          <input type="range" min="0" max="100" value="50" class="comparador__rango" aria-label="Deslizar entre antes y después">
        </div>` : `
        <div class="lado-a-lado">
          <figure><img src="${url(antes)}" alt="Antes"><figcaption>${esc(etiquetaFoto(antes))}</figcaption></figure>
          <figure><img src="${url(despues)}" alt="Después"><figcaption>${esc(etiquetaFoto(despues))}</figcaption></figure>
        </div>`}
      <p class="cargas__resumen">${dias > 0 ? `${dias} días entre las dos fotos.` : dias < 0 ? "La foto «antes» es más reciente que la de «después»." : "Las dos fotos son del mismo día."}</p>`;
  }

  // ---------- Cámara ----------
  const cam = {
    raiz: $("#camara"), visor: $("#cam-visor"), video: $("#cam-video"), fantasma: $("#cam-fantasma"),
    captura: $("#cam-captura"), cuenta: $("#cam-cuenta"), error: $("#cam-error"),
    controles: $("#cam-controles"), revision: $("#cam-revision"), fecha: $("#cam-fecha"),
  };
  let flujo = null;
  let frontal = almacen.leer("nm.fotos.frontal", true);
  let temporizador = almacen.leer("nm.fotos.temporizador", 0);
  let pendiente = null; // { blob, ancho, alto }
  let cuentaAtras = null;
  let focoPrevio = null;

  function ajustarVisor() {
    const marco = cam.visor.parentElement;
    const estilo = getComputedStyle(marco);
    const disponibleAncho = marco.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
    let alto = marco.clientHeight, ancho = alto * ASPECTO;
    if (ancho > disponibleAncho) { ancho = disponibleAncho; alto = ancho / ASPECTO; }
    cam.visor.style.width = `${Math.floor(ancho)}px`;
    cam.visor.style.height = `${Math.floor(alto)}px`;
  }

  function pintarControles() {
    $("#cam-temporizador-valor").textContent = temporizador ? `${temporizador} s` : "No";
    $("#cam-temporizador").setAttribute("aria-label", temporizador ? `Temporizador de ${temporizador} segundos` : "Sin temporizador");
    cam.video.classList.toggle("espejo", frontal);
    cam.fantasma.style.opacity = $("#cam-opacidad").value / 100;
    $("#cam-opacidad-valor").textContent = `${$("#cam-opacidad").value}%`;
  }

  function ponerFantasma() {
    const lista = dePose();
    const ultima = lista[lista.length - 1];
    cam.fantasma.hidden = !ultima;
    $("#cam-opacidad-control").hidden = !ultima;
    if (ultima) cam.fantasma.src = url(ultima);
    $("#cam-pose").textContent = `${nombrePose(pose)}${ultima ? ` · anterior: ${fechaCorta(ultima.fecha)}` : " · primera foto"}`;
  }

  function detenerFlujo() {
    if (flujo) flujo.getTracks().forEach((t) => t.stop());
    flujo = null;
    cam.video.srcObject = null;
  }

  async function iniciarFlujo() {
    detenerFlujo();
    cam.error.hidden = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      mostrarError("Este navegador no da acceso a la cámara aquí. Abre la app desde una dirección https o usa «Subir foto».");
      return;
    }
    try {
      flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: frontal ? "user" : "environment", width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      cam.video.srcObject = flujo;
      await cam.video.play().catch(() => {});
    } catch (e) {
      mostrarError(e && e.name === "NotAllowedError"
        ? "No diste permiso para usar la cámara. Actívalo en la configuración del navegador o usa «Subir foto»."
        : "No se pudo abrir la cámara. Puedes usar «Subir foto» con una foto de tu galería.");
    }
  }

  function mostrarError(texto) {
    cam.error.textContent = texto;
    cam.error.hidden = false;
  }

  function modoRevision(activo) {
    cam.controles.hidden = activo;
    cam.revision.hidden = !activo;
    cam.captura.hidden = !activo;
    cam.video.hidden = activo;
    $("#cam-girar").hidden = activo;
  }

  async function abrirCamara() {
    focoPrevio = document.activeElement;
    cam.raiz.hidden = false;
    document.documentElement.classList.add("sin-scroll");
    modoRevision(false);
    ponerFantasma();
    pintarControles();
    ajustarVisor();
    $("#cam-disparar").focus();
    await iniciarFlujo();
  }

  function cerrarCamara() {
    cancelarCuenta();
    detenerFlujo();
    pendiente = null;
    cam.raiz.hidden = true;
    document.documentElement.classList.remove("sin-scroll");
    if (focoPrevio) focoPrevio.focus();
  }

  // Recorta la imagen al centro en 3:4 (igual que object-fit: cover del visor).
  function recortar(fuente, anchoFuente, altoFuente, espejo) {
    let sw = anchoFuente, sh = altoFuente;
    if (sw / sh > ASPECTO) sw = sh * ASPECTO; else sh = sw / ASPECTO;
    const sx = (anchoFuente - sw) / 2, sy = (altoFuente - sh) / 2;
    const ancho = Math.round(Math.min(sw, ANCHO_MAX)), alto = Math.round(ancho / ASPECTO);
    const lienzo = Object.assign(document.createElement("canvas"), { width: ancho, height: alto });
    const ctx = lienzo.getContext("2d");
    if (espejo) { ctx.translate(ancho, 0); ctx.scale(-1, 1); }
    ctx.drawImage(fuente, sx, sy, sw, sh, 0, 0, ancho, alto);
    return new Promise((ok) => lienzo.toBlob((blob) => ok({ blob, ancho, alto }), "image/jpeg", 0.88));
  }

  function revisar(resultado, fecha) {
    pendiente = resultado;
    if (cam.captura.src) URL.revokeObjectURL(cam.captura.src);
    cam.captura.src = URL.createObjectURL(resultado.blob);
    cam.fecha.value = fecha;
    cam.fecha.max = hoyISO();
    modoRevision(true);
    $("#cam-guardar").focus();
  }

  // Espera a que el video muestre un cuadro real (al abrir, el primero puede ser negro).
  function siguienteCuadro(video) {
    return new Promise((ok) => {
      const limite = setTimeout(ok, 1000);
      const listo = () => { clearTimeout(limite); ok(); };
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => listo());
      else if (video.readyState >= 2) listo();
      else video.addEventListener("loadeddata", listo, { once: true });
    });
  }

  async function disparar() {
    if (!flujo || !cam.video.videoWidth) { aviso("La cámara aún no está lista"); return; }
    const boton = $("#cam-disparar");
    if (boton.disabled) return;
    boton.disabled = true;
    try {
      await siguienteCuadro(cam.video);
      cam.visor.classList.add("flash");
      setTimeout(() => cam.visor.classList.remove("flash"), 250);
      const r = await recortar(cam.video, cam.video.videoWidth, cam.video.videoHeight, frontal);
      revisar(r, hoyISO());
    } finally {
      boton.disabled = false;
    }
  }

  function cancelarCuenta() {
    clearInterval(cuentaAtras);
    cuentaAtras = null;
    cam.cuenta.hidden = true;
  }

  function iniciarDisparo() {
    if (cuentaAtras) { cancelarCuenta(); return; }
    if (!temporizador) { disparar(); return; }
    let n = temporizador;
    cam.cuenta.textContent = n;
    cam.cuenta.hidden = false;
    cuentaAtras = setInterval(() => {
      n -= 1;
      if (n <= 0) { cancelarCuenta(); disparar(); } else cam.cuenta.textContent = n;
    }, 1000);
  }

  async function guardarPendiente() {
    if (!pendiente) return;
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(cam.fecha.value) ? cam.fecha.value : hoyISO();
    const foto = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      pose, fecha, creada: new Date().toISOString(), ...pendiente,
    };
    try {
      await guardar(foto);
      // Pide al navegador no borrar las fotos si falta espacio.
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch {
      aviso("No se pudo guardar la foto (¿poco espacio?)");
      return;
    }
    cerrarCamara();
    despuesId = foto.id;
    await recargar();
    aviso("Foto guardada");
  }

  async function subirArchivo(archivo) {
    try {
      const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
      const r = await recortar(bitmap, bitmap.width, bitmap.height, false);
      bitmap.close && bitmap.close();
      focoPrevio = document.activeElement;
      cam.raiz.hidden = false;
      document.documentElement.classList.add("sin-scroll");
      ponerFantasma();
      pintarControles();
      ajustarVisor();
      const f = new Date(archivo.lastModified || Date.now());
      const fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
      revisar(r, fecha > hoyISO() ? hoyISO() : fecha);
    } catch {
      aviso("No se pudo leer esa imagen");
    }
  }

  // ---------- Ver una foto ----------
  const dialogoFoto = $("#foto-vista");
  function verFoto(id) {
    const f = fotos.find((x) => x.id === id);
    if (!f) return;
    $("#foto-vista-contenido").innerHTML = `
      <div class="detalle__cabecera">
        <div>
          <h2>${esc(nombrePose(f.pose))}</h2>
          <p class="detalle__en">${esc(etiquetaFoto(f))}</p>
        </div>
        <button type="button" class="cerrar" data-cerrar-foto aria-label="Cerrar">${ICONOS.cerrar}</button>
      </div>
      <img class="foto-vista__img" src="${url(f)}" alt="${esc(nombrePose(f.pose))} del ${esc(fechaCorta(f.fecha))}">
      <div class="detalle__pie">
        <button type="button" class="boton" data-usar="antes" data-id="${f.id}">Usar como «antes»</button>
        <button type="button" class="boton" data-usar="despues" data-id="${f.id}">Usar como «después»</button>
        <button type="button" class="boton boton--texto boton--peligro" data-borrar-foto="${f.id}">Borrar</button>
      </div>`;
    dialogoFoto.showModal();
  }

  // ---------- Copia de seguridad ----------
  const aDataURL = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });

  async function exportar() {
    const todas = await leerTodas().catch(() => []);
    return Promise.all(todas.map(async ({ blob, ...resto }) => ({ ...resto, datos: await aDataURL(blob) })));
  }

  async function importar(lista) {
    const validas = lista.filter((f) => f && typeof f.datos === "string" && f.datos.startsWith("data:image/") &&
      POSES.some((p) => p.id === f.pose) && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha));
    await operar("readwrite", (st) => st.clear());
    for (const { datos, ...resto } of validas) {
      const blob = await (await fetch(datos)).blob();
      await guardar({ id: String(resto.id), pose: resto.pose, fecha: resto.fecha, creada: String(resto.creada || new Date().toISOString()), ancho: resto.ancho, alto: resto.alto, blob });
    }
    await recargar();
  }

  // ---------- Eventos ----------
  function iniciar() {
    $("#poses").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-pose]");
      if (!b) return;
      pose = b.dataset.pose;
      almacen.guardar("nm.fotos.pose", pose);
      antesId = despuesId = null;
      pintar();
    });
    $("#tomar-foto").addEventListener("click", abrirCamara);
    $("#subir-foto").addEventListener("change", (ev) => {
      const archivo = ev.target.files[0];
      ev.target.value = "";
      if (archivo) subirArchivo(archivo);
    });
    $("#galeria").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-ver]");
      if (b) verFoto(b.dataset.ver);
    });

    const panel = $("#comparador-panel");
    panel.addEventListener("input", (ev) => {
      if (ev.target.classList.contains("comparador__rango")) {
        ev.target.closest(".comparador").style.setProperty("--corte", `${ev.target.value}%`);
      }
    });
    panel.addEventListener("change", (ev) => {
      const s = ev.target.dataset.comparar;
      if (!s) return;
      if (s === "antes") antesId = ev.target.value; else despuesId = ev.target.value;
      pintar();
    });
    panel.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-modo]");
      if (b) { modoComparar = b.dataset.modo; pintar(); }
    });

    dialogoFoto.addEventListener("click", async (ev) => {
      if (ev.target === dialogoFoto || ev.target.closest("[data-cerrar-foto]")) { dialogoFoto.close(); return; }
      const usar = ev.target.closest("[data-usar]");
      if (usar) {
        if (usar.dataset.usar === "antes") antesId = usar.dataset.id; else despuesId = usar.dataset.id;
        dialogoFoto.close();
        pintar();
        $("#comparador-panel").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const b = ev.target.closest("[data-borrar-foto]");
      if (b && confirm("¿Borrar esta foto? No se puede deshacer.")) {
        await borrar(b.dataset.borrarFoto);
        dialogoFoto.close();
        await recargar();
        aviso("Foto borrada");
      }
    });

    // Cámara
    $("#cam-cerrar").addEventListener("click", () => {
      if (pendiente && !confirm("¿Salir sin guardar la foto?")) return;
      cerrarCamara();
    });
    $("#cam-girar").addEventListener("click", () => {
      frontal = !frontal;
      almacen.guardar("nm.fotos.frontal", frontal);
      pintarControles();
      iniciarFlujo();
    });
    $("#cam-temporizador").addEventListener("click", () => {
      temporizador = temporizador === 0 ? 3 : temporizador === 3 ? 10 : 0;
      almacen.guardar("nm.fotos.temporizador", temporizador);
      pintarControles();
    });
    $("#cam-guias").addEventListener("click", (ev) => {
      const activo = ev.currentTarget.getAttribute("aria-pressed") !== "true";
      ev.currentTarget.setAttribute("aria-pressed", String(activo));
      $(".camara__guias").hidden = !activo;
    });
    $("#cam-opacidad").addEventListener("input", pintarControles);
    $("#cam-disparar").addEventListener("click", iniciarDisparo);
    $("#cam-repetir").addEventListener("click", () => {
      pendiente = null;
      modoRevision(false);
      if (!flujo) iniciarFlujo();
    });
    $("#cam-guardar").addEventListener("click", guardarPendiente);
    window.addEventListener("resize", () => { if (!cam.raiz.hidden) ajustarVisor(); });
    document.addEventListener("keydown", (ev) => {
      if (cam.raiz.hidden) return;
      if (ev.key === "Escape") $("#cam-cerrar").click();
    });
  }

  iniciar();
  window.NM.fotos = {
    mostrar: () => (cargado ? pintar() : recargar()),
    exportar,
    importar,
  };
})();
