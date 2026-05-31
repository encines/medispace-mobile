# Medispace Mobile

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Expo](https://img.shields.io/badge/Expo-SDK%2054-3DDC84)](https://expo.dev)

Proyecto móvil de Medispace — aplicación para gestión de citas y registros médicos.

## Qué es la app

Medispace Mobile es una aplicación móvil para clínicas y centros de salud diseñada para facilitar la gestión diaria: permite a recepcionistas, personal administrativo, médicos y pacientes interactuar con el sistema de citas, historiales médicos y comunicaciones internas.

## Qué hace

- Gestiona agendamiento de citas: crear, editar y cancelar citas con notificaciones.
- Permite ver y actualizar el historial de pacientes y registros clínicos básicos.
- Facilita la comunicación entre pacientes y personal (notificaciones y mensajes básicos).
- Ofrece paneles de control para distintos roles (administración, médicos, recepcionistas, pacientes) con vistas adaptadas.
- Soporta subida de documentos e imágenes asociadas a pacientes y registros.
- Integra autenticación segura y manejo de sesiones a través de `supabase`.

## Capturas

Presentamos una galería con capturas reales de la aplicación.

<p align="center">
	<img src="assets/screenshots/screenshot-1.png" alt="Screenshot 1" width="320" />
	<img src="assets/screenshots/screenshot-2.png" alt="Screenshot 2" width="320" />
	<img src="assets/screenshots/screenshot-3.png" alt="Screenshot 3" width="320" />
</p>

<p align="center">
	<img src="assets/screenshots/screenshot-4.png" alt="Screenshot 4" width="240" />
	<img src="assets/screenshots/screenshot-5.png" alt="Screenshot 5" width="240" />
	<img src="assets/screenshots/screenshot-6.png" alt="Screenshot 6" width="240" />
</p>

## Instalación y ejecución

- Instalar dependencias:

```bash
npm install
```

- Ejecutar en Expo (desarrollo):

```bash
npm start
# o
npx expo start
```

- Abrir en Android/iOS o en simulador

## Desarrollo (scripts útiles)

- **start**: inicia Metro/Expo (modo interactivo)
- **start:lan**: `expo start --lan` (útil en red local)
- **start:tunnel**: `expo start --tunnel` (útil cuando no hay red directa)
- **web**: `expo start --web` (preview en navegador)

Ejemplo:

```bash
npm run start:lan
```

## Contribuir

Ver `CONTRIBUTING.md`.

## Licencia

Proyecto con licencia MIT. Ver `LICENSE`.
