# Proyecto NM · Transformación física

App personal para seguir mi transformación: rutina, dieta, fotos de progreso, pesos y cargas.

## Cómo abrirla

- **Publicada:** https://juanmarket.github.io/proyecto-nm/ (GitHub Pages, repositorio público `juanmarket/proyecto-nm`). Es la que se usa en el celular; por ser `https`, la cámara funciona.
- **En el computador, sin internet:** doble clic en `index.html`. Ahí la cámara en vivo no está disponible; usa «Subir foto».
- **Cargar un plan con un enlace:** `https://juanmarket.github.io/proyecto-nm/?plan=planes/ARCHIVO.json` importa ese archivo de la carpeta `planes/`.

Para publicar cambios: `git push` a la rama `main`; GitHub Pages se actualiza solo en uno o dos minutos.

Todo se guarda solo en el navegador donde la uses. Cada dispositivo tiene sus propios datos. Usa **Progreso → Descargar copia** de vez en cuando.

## Secciones

- **Rutina:** el plan de entrenamiento. Se edita con «Editar rutina» y se carga con «Importar plan». Cada día tiene «Registrar sesión» para anotar kg y repeticiones, con borrador automático.
- **Sobrecarga progresiva:** a partir de la última sesión, cada ejercicio muestra el objetivo de hoy (mismo peso con una repetición más, subir peso al completar el rango, bajar si no se llega al mínimo, aviso de estancamiento). El salto de peso y el peso máximo se ajustan en la sección Rutina. La lógica está en `sugerencia()` de `js/sesiones.js`.
- **Dieta:** objetivos diarios (kcal y macros) y comidas con sus alimentos. Se edita con «Editar dieta».
- **Fotos:** frente, perfil y espalda. La cámara muestra la foto anterior de la misma pose en transparencia (opacidad ajustable), con guías y temporizador. Comparador antes/después deslizable o lado a lado.
- **Progreso:**
  - Peso: se registra a diario o varias veces por semana y se compara el **promedio de cada semana** (lunes a domingo). Muestra cambio frente a la semana anterior, ritmo en kg/semana y cambio total.
  - Medidas opcionales en cm: cintura, cadera, pecho, brazo y muslo.
  - Estadísticas: sesiones de la semana frente a los días de la rutina, promedio de sesiones, racha de semanas entrenando y tabla semana a semana.
  - Cargas por ejercicio, sesiones y copia de seguridad (incluye plan, sesiones y fotos).
- **Ejercicios:** 1.324 ejercicios en español con mapa muscular.

## El plan (rutina + dieta)

El plan se arma en el chat con Claude y se entrega como un archivo `.json` que se carga con **Rutina → Importar plan**. Para pedir cambios, usa **Exportar plan** y comparte el archivo. Formato: ver el comentario al inicio de `js/plan.js`.

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html`, `css/` | La web |
| `js/util.js` | Utilidades comunes |
| `js/app.js` | Navegación, biblioteca, progreso y copia de seguridad |
| `js/plan.js` | Rutina, dieta, editores y registro de sesiones |
| `js/fotos.js` | Cámara con foto anterior, galería y comparador |
| `js/sesiones.js` | Historial de cargas y aviso de subir peso |
| `js/mapa.js` | Mapa muscular en SVG |
| `data/ejercicios.js` | Datos generados; no editar a mano |
| `scripts/construir_datos.py` | Regenera `data/ejercicios.js` |
| `scripts/nombres_es.json` | Nombres de ejercicios en español (editable) |
| `planes/` | Archivos de rutina y dieta para importar (pueden traer solo una de las dos partes) |
| `fuentes/` | Dataset original y su licencia |

Para regenerar los datos tras corregir una traducción:

```bash
python scripts/construir_datos.py
```

## Licencias

- Datos e instrucciones: [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), MIT, © 2026 Hasan Emir Yıldırım.
- **No** se incluyen las imágenes ni los GIFs del dataset: son © Gym visual y requieren licencia propia.
