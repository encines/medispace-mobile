# 🗺️ Guía de Edición de MediSpace

Este documento explica cómo está estructurado el proyecto por dentro, qué hace cada archivo importante y **dónde debes ir para editar** funcionalidades, pantallas o el diseño visual de la aplicación.

---

## 📁 1. Carpetas Principales (El Esqueleto)

El proyecto está dividido en carpetas lógicas. Si sabes qué quieres cambiar, esta es la regla general para saber dónde buscar:

*   **`app/`**: Aquí están **todas las pantallas completas** que ve el usuario (Login, Inicio, Perfil, etc.). Funciona como un sistema de rutas (cada archivo `.tsx` es una pantalla).
*   **`components/`**: Aquí están **pedazos de interfaz reutilizables** (tarjetas, botones, esqueletos de carga). No son pantallas completas, sino "bloques de lego" que se usan dentro de `app/`.
*   **`constants/`**: Aquí están los **estilos globales** (colores, sombras, tamaños de letra).
*   **`hooks/`**: Aquí está la **lógica pesada y llamadas a la base de datos** (como la autenticación o la carga de datos del dashboard).
*   **`lib/`**: Archivos de **configuración de servicios externos** (como la conexión principal a Supabase).

---

## 📱 2. Las Pantallas (`app/`)
Si quieres cambiar **qué se ve en una pantalla entera** o agregar una nueva, debes editar los archivos aquí.

### Pantallas Públicas (Fuera de sesión)
Están en la raíz de la carpeta `app/`:
*   `app/index.tsx`: La pantalla de bienvenida principal (el "Splash" o Landing de la app).
*   `app/login.tsx`: Pantalla para iniciar sesión.
*   `app/register.tsx`: Pantalla de registro para crear una cuenta nueva.
*   `app/forgot-password.tsx`: Pantalla para recuperar contraseña.

### Pantallas Privadas (Dentro de sesión - El Dashboard)
Están dentro de la carpeta `app/(dashboard)/`:
*   `app/(dashboard)/_layout.tsx`: **¡Muy importante!** Aquí se define la **barra de navegación inferior (Tabs)** y qué pestañas ve cada usuario según su rol (Doctor, Paciente, Admin).
*   `app/(dashboard)/home.tsx`: La pantalla de **Inicio principal**. Dependiendo de quién inicie sesión, carga un dashboard diferente.
*   `app/(dashboard)/appointments.tsx`: Pantalla de **Agenda/Citas**.
*   `app/(dashboard)/catalog.tsx`: Catálogo donde los pacientes pueden buscar médicos.
*   `app/(dashboard)/profile.tsx` y `edit-profile.tsx`: Para ver y editar los datos personales del usuario.
*   `app/(dashboard)/records/`: Carpeta con las pantallas de **Expedientes Médicos** (notas de evolución, historial).
*   `app/(dashboard)/assignments.tsx`: Pantalla para que los médicos gestionen sus consultorios y horarios.
*   `app/(dashboard)/user-management.tsx`: Pantalla para que el administrador gestione a los usuarios.

---

## 🧩 3. Componentes Reutilizables (`components/`)
Si quieres editar una tarjeta, un botón o una sección que aparece en varias pantallas, busca aquí:

*   **`components/dashboard/`**: Contiene las "vistas" de inicio para cada rol.
    *   `AdminDashboard.tsx`: Lo que ve el administrador al entrar.
    *   `DoctorDashboard.tsx`: Lo que ve el doctor al entrar (sus citas de hoy, etc.).
    *   `PatientDashboard.tsx`: Lo que ve el paciente al entrar.
    *   `ReceptionistDashboard.tsx`: Lo que ve el recepcionista.
*   **`components/ui/`**: 
    *   `Skeleton.tsx`: Las animaciones de carga (los rectángulos grises que parpadean antes de que carguen los datos).
*   **`components/notifications/`**: Lógica visual para manejar notificaciones.

---

## ⚙️ 4. Lógica y Base de Datos (`hooks/` y `lib/`)
Si quieres cambiar **cómo funciona** algo por debajo (por ejemplo, qué datos se piden a Supabase, o cómo se inicia sesión):

*   **`hooks/useAuth.tsx`**: **El cerebro de la sesión.** Aquí se maneja el login, logout, y se obtienen los *roles* del usuario y su *perfil* desde la base de datos al entrar. Edita esto si quieres agregar nuevos campos al perfil del usuario en toda la app.
*   **`hooks/useDashboardData.ts`**: Lógica para obtener estadísticas y datos rápidos para poblar los dashboards de inicio.
*   **`hooks/useNotifications.ts`**: Lógica para registrar el dispositivo y recibir notificaciones Push.
*   **`lib/supabase.ts`**: La llave maestra. Tiene la URL y la clave secreta para conectarse a tu proyecto de Supabase.

---

## 🎨 5. Diseño Visual y Estilos (`constants/`)
Si quieres cambiar el **color de la aplicación, el tamaño del texto general, o el redondeo de los botones**, NO lo cambies pantalla por pantalla. Hazlo aquí:

*   **`constants/theme.ts`**: Es tu "Libro de Marca". 
    *   Si quieres cambiar el verde médico por un azul, cambia `Colors.secondary`.
    *   Si quieres cambiar los degradados, edita `Gradients`.
    *   Si quieres hacer las sombras más fuertes, edita `Shadows`.
    *   Al cambiar algo aquí, **toda la aplicación se actualizará automáticamente**.

---

### 💡 Ejemplo Práctico: "¿Dónde edito X cosa?"

*   *Quiero agregar un botón nuevo en la pantalla de inicio del paciente:* -> Edita `components/dashboard/PatientDashboard.tsx`.
*   *Quiero ocultar la pestaña de "Sucursales" para los recepcionistas en la barra de abajo:* -> Edita `app/(dashboard)/_layout.tsx`.
*   *Quiero que la app sea de color morado en lugar de oscuro:* -> Edita `Colors.primary` en `constants/theme.ts`.
*   *Quiero pedir el "CURP" al momento de registrarse:* -> Edita `app/register.tsx` (para la interfaz) y probablemente tengas que asegurarte de que Supabase lo guarde.
*   *Quiero cambiar la lógica de cómo un doctor sube la foto de perfil de un paciente:* -> Edita `app/(dashboard)/records/[patientId].tsx` (que maneja el detalle del expediente del paciente).
