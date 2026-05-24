# 🧱 Clase Piedras Vivas

Una aplicación web interactiva y moderna (PWA) diseñada para el **registro de asistencia, participación, lectura bíblica, versículos memorizados y puntos** en escuelas dominicales u otros grupos educativos. El sistema calcula las calificaciones y puntajes acumulados de forma automática, permitiendo un control amigable gracias a un diseño visual optimizado, persistencia local segura y capacidades fuera de línea (offline).

---

## 🚀 Características Clave

- **📍 Registro de Asistencia Ágil:** Dos modos de visualización (modo individual por alumno o planilla en tabla de toda la clase) para pasar la lista del día de forma cómoda.
- **🏆 Tabla de Posiciones (Ranking):** Posicionamiento interactivo en tiempo real con podios visuales para motivar la constancia y participación.
- **📅 Gestión de Periodos Académicos:** Permite crear, editar, y organizar los bimestres o periodos con rangos de fechas específicos.
- **🎒 Alumnos y Cumpleaños:** Registro completo de alumnos, incluyendo su género, fecha de nacimiento, foto de perfil y puntos acumulados históricos (migración de registros anteriores).
- **📶 Modo PWA (Progressive Web App):** ¡Instálala como una aplicación nativa en tu teléfono Android, iPhone o escritorio! Funciona sin conexión a internet y tiene tiempos de carga ultrarrápidos gracias a su *Service Worker* integrado.
- **🔄 Sincronización y Persistencia:** Guardado local seguro y soporte para sincronización bidireccional mediante un código de clase activo.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Empaquetador/Servidor Dev:** [Vite 6](https://vitejs.dev/)
- **Estilos:** [Tailwind CSS 4](https://tailwindcss.com/) (diseño responsivo, limpio, moderno y con modo oscuro integrado en componentes clave)
- **Animaciones:** [Motion](https://motion.dev/) (para transiciones fluidas de pestañas y modales)
- **Iconos:** [Lucide React](https://lucide.dev/)

---

## 📦 Requisitos Previos

Asegúrate de tener instalado en tu sistema:
- **Node.js** (Versión 18 o superior recomendada)
- **npm** (Viene incluido por defecto con Node.js)

---

## ⚙️ Instrucciones de Instalación y Uso

Sigue estos sencillos pasos para descargar y ejecutar el proyecto en tu máquina local:

### 1. Clonar el repositorio
Si has subido el proyecto a GitHub, puedes clonarlo usando:
```bash
git clone https://github.com/TU_CONEXION/clase-piedras-vivas.git
cd clase-piedras-vivas
```

### 2. Instalar dependencias
Instala todos los paquetes requeridos definidos en el `package.json`:
```bash
npm install
```

### 3. Ejecutar en entorno de desarrollo
Inicia el servidor local de desarrollo de Vite:
```bash
npm run dev
```
La aplicación estará disponible por defecto en: [http://localhost:3000](http://localhost:3000) o [http://127.0.0.1:3000](http://127.0.0.1:3000).

### 4. Compilar para producción
Genera el paquete optimizado y listo para desplegar en la carpeta `/dist`:
```bash
npm run build
```
*(Los archivos estáticos generados en `dist/` se pueden subir directamente de manera gratuita a servicios como GitHub Pages, Netlify, Vercel o Firebase Hosting).*

---

## 📱 ¿Cómo instalar la App en tu móvil o PC? (PWA)

Al contener un archivo `manifest.json` y un controlador de eventos `sw.js` (Service Worker), la aplicación cumple con los estándares de Progressive Web App. Esto significa que puedes instalarla directamente:

- **En Android (Chrome):** Abre el enlace del sitio en Chrome, verás un cartel emergente diciendo *"Agregar a la pantalla de inicio"* o puedes tocar los tres puntos del menú de Chrome y seleccionar **"Instalar aplicación"**.
- **En iOS (Safari):** Abre el sitio en Safari, presiona el botón **Compartir** (icono de la caja con flecha arriba) y selecciona **"Agregar a pantalla de inicio"**.
- **En Computadora (Chrome/Edge):** Verás un icono de instalación en la barra de direcciones (frente a la URL) para instalarla como una aplicación de escritorio independiente.

---

## 📂 Organización de Archivos Clave

- `/index.html` - Punto de entrada HTML. Configura encabezados móviles de pantalla completa e inicializa el Service Worker.
- `/public/manifest.json` - Define los iconos, colores de tema y comportamientos para que sea instalable como App nativa.
- `/public/sw.js` - Controlador del Service Worker para el soporte fuera de línea (offline caching).
- `/src/main.tsx` - Montaje inicial de la aplicación React.
- `/src/App.tsx` - **Componente principal de la Aplicación.** Alberga toda la lógica de control, gestión de pestañas, persistencia local, modals para alumnos, periodos académicos y la tabla de posiciones con un diseño premium y adaptado a móviles.
- `/src/index.css` - Estilos globales utilizando las directivas de importación de Tailwind CSS.
