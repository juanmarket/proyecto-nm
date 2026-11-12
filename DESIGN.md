# Design

Sistema visual de Proyecto NM. La estrategia y el público están en `PRODUCT.md`; los valores viven en `css/estilos.css` (`:root`).

## Tema

Oscuro, en la línea de Apple Fitness: fondo casi negro, colores intensos reservados para datos y acciones, y vidrio translúcido en lo que flota. Escena de uso: se entrena de noche en casa con el teléfono apoyado en el banco, y anota comidas y peso a una mano durante el día.

Estrategia de color: contenida. Neutros oscuros y un acento; los colores de dato aparecen solo donde hay un dato.

## Color

| Token | Valor | Uso |
|---|---|---|
| `--fondo` | `#0a0b0f` | Fondo de la app |
| `--fondo-solido` | `#15161c` | Equivalente opaco de un panel (bordes de figuras, gráficas) |
| `--sup-1` / `--sup-2` / `--sup-3` | blanco al 5,5 % / 9 % / 14 % | Paneles / campos y elementos anidados / estado activo o al pasar el cursor |
| `--borde` / `--borde-fuerte` | blanco al 10 % / 20 % | Líneas y contornos |
| `--tinta` | `#f4f5f8` | Texto principal |
| `--tenue` | `#a9aebb` | Texto secundario (contraste ≥ 7:1 sobre un panel) |
| `--acento` | `#ff6a3d` | Acción principal, calorías, selección |
| `--sobre-acento` | `#1b0b05` | Texto sobre el acento (nunca blanco: no alcanza 4,5:1) |
| `--acento-texto` | `#ffb39b` | Texto de acento sobre fondo oscuro |
| `--lima` | `#b8ef45` | Proteína |
| `--cian` | `#54d3ff` | Carbohidratos |
| `--ambar` | `#ffc247` | Grasas, avisos y "te pasaste" |
| `--exito` | `#3fe0a0` | Objetivo cumplido, subir peso |
| `--alerta` | `#ff6680` | Borrar, errores |

El fondo lleva tres luces difusas (coral, violeta y verde) en `body::before`. Dan color y profundidad a las superficies translúcidas sin necesidad de desenfoque.

## Vidrio

Solo en lo que flota sobre el contenido: cabecera, barra de navegación del móvil, diálogos, barras de guardar pegadas y avisos. Se compone de fondo oscuro translúcido (`--vidrio`, `--vidrio-denso`), `backdrop-filter: blur(22px) saturate(170%)`, borde claro y un brillo interior arriba (`--vidrio-sombra`).

Los paneles de contenido no usan desenfoque: son superficies translúcidas estables (`--sup-1`) con un brillo fino (`--brillo`). Así se lee bien y el teléfono no sufre.

Con `prefers-reduced-transparency` el vidrio pasa a sólido. Sin soporte de `backdrop-filter`, los fondos suben de opacidad.

## Tipografía

Una sola familia: la del sistema (`system-ui`). Escala fija: h1 2rem / 800, h2 1,1rem / 750, h3 1rem / 700, cuerpo 1rem, secundario 0,8 a 0,92rem. Números con `tabular-nums`. Sin mayúsculas sostenidas ni rótulos espaciados.

## Forma y espacio

Radios: 22px paneles, 14px campos, 999px botones y píldoras, 28px diálogos. Objetivos táctiles de 44px o más; los campos de series miden 50px. En móvil, las acciones principales ocupan todo el ancho.

## Componentes

- **Botón**: secundario translúcido; primario con el acento y texto oscuro; de texto para acciones menores. Una sola acción primaria visible por pantalla.
- **Sesión que toca** (`.siguiente`): primer bloque de Rutina, con la acción primaria.
- **Anillos** (`.anillos`): calorías fuera, proteína dentro; el resto de macros en barras.
- **Control segmentado** (`.pestanas`), **píldoras** (`.etiqueta`, `.chip`, `.objetivo`), **plegables** (`.consejos`).
- **Diálogos**: hojas de vidrio; en móvil suben desde abajo. El registro de sesión ocupa toda la pantalla.

## Movimiento

Transiciones de 170ms con salida suave para estados; 220 a 240ms para entradas de sección y diálogos. Sin rebotes. Todo se desactiva con `prefers-reduced-motion`.
