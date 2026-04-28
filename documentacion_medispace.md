# 🏥 MediSpace: Plataforma de Salud Digital
**Guía de Funcionamiento y Arquitectura**

## 1. Introducción
MediSpace es una aplicación móvil nativa diseñada para centralizar la atención médica, facilitando la interacción entre pacientes, doctores y personal administrativo. La app permite gestionar expedientes clínicos, agendar citas y realizar seguimientos médicos en tiempo real.

---

## 2. Tecnologías Core (Tech Stack)
Para garantizar velocidad y escalabilidad, la app utiliza:
*   **Frontend:** React Native con **Expo** (Framework robusto para apps nativas).
*   **Navegación:** **Expo Router** (Sistema basado en archivos similar a Next.js).
*   **Backend:** **Supabase** (Base de datos PostgreSQL, Autenticación y Almacenamiento de archivos).
*   **Estado y Datos:** **TanStack Query (React Query)** para manejo de caché y sincronización de datos.
*   **Estilos:** Sistema de temas personalizado con soporte para gradientes y micro-animaciones.

---

## 3. Arquitectura del Proyecto
La estructura está organizada para ser mantenible y escalable:
*   `app/`: Contiene todas las pantallas y la lógica de rutas.
*   `components/`: Piezas reutilizables de la interfaz (Botones, Inputs, Dashboards).
*   `hooks/`: Lógica compartida para interactuar con la base de datos (Auth, Datos del perfil).
*   `lib/`: Configuración de servicios externos como Supabase.
*   `constants/`: Tokens de diseño (Colores, Espaciados, Sombras).

---

## 4. Roles de Usuario
La aplicación adapta su interfaz según el rol del usuario autenticado:

1.  **Paciente:**
    *   Visualiza sus próximas citas.
    *   Acceso a su expediente de evolución.
    *   Agendamiento en el catálogo médico.
2.  **Doctor:**
    *   Gestión de su agenda diaria.
    *   **Expediente Clínico Digital:** Edición de historia clínica y notas de evolución (NOM-004).
    *   Generación de recetas/resúmenes en PDF por consulta.
3.  **Administrador / Recepcionista:**
    *   Control de sucursales y personal.
    *   Gestión global de citas.

---

## 5. Flujos Principales (User Flows)

### A. Autenticación y Seguridad
*   Registro con validación de datos.
*   Acceso protegido por **AuthGate** (nadie entra sin login).
*   **Recuperación de contraseña:** Flujo completo mediante correo electrónico.

### B. Consulta Médica (Flujo del Doctor)
1.  El doctor ve su lista de citas del día.
2.  Accede al expediente del paciente.
3.  Revisa la **Ficha de Identificación** simplificada.
4.  Crea una **Nota de Evolución** con signos vitales.
5.  Genera un **PDF individual** de la nota para el paciente.

---

## 6. Mejoras de Calidad Recientes (UX/UI)
*   **Navegación Inteligente:** Corrección de errores en el historial de navegación (evita cierres inesperados).
*   **Diseño Premium:** Uso de gradientes, sombras suaves y skeletons de carga para una sensación fluida.
*   **Seguridad de Datos (RLS):** Implementación de políticas en la base de datos para que solo el personal autorizado acceda a información sensible.
---

## 7. Próximos Pasos (Roadmap)
*   Integración de notificaciones push para recordatorios de citas.
*   Módulo de pagos integrados.
*   Telemedicina (Videollamadas dentro de la app).

---
**MediSpace: Conectando la salud con tecnología de vanguardia.**

"La base de datos está normalizada en PostgreSQL. Utilizamos un modelo relacional que separa la identidad del usuario (Auth) de su información clínica (Profiles). Implementamos un sistema de asignación de médicos por consultorio y día de la semana, además de un mecanismo de bloqueo de slots para prevenir duplicidad de citas."

Para esta primera etapa del proyecto, implementamos una arquitectura de Tabla Plana (Single Table) en Supabase. Tomamos esta decisión de forma estratégica para acelerar el desarrollo del MVP (Producto Mínimo Viable) y reducir la latencia de las consultas en la red móvil. Sin embargo, como pueden ver en nuestro diagrama de arquitectura planeada (DrawSQL), ya tenemos diseñado el modelo de Herencia de Tablas, el cual será nuestra siguiente fase de migración para escalar el sistema a miles de usuarios sin perder integridad.

Porque en una startup o proyecto ágil, es vital validar la funcionalidad primero. Una estructura demasiado rígida al principio puede frenar cambios necesarios en la lógica de negocio. Ahora que la lógica es sólida, la migración a la arquitectura final es un paso natural.