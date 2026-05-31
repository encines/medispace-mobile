# Medispace Mobile

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Expo](https://img.shields.io/badge/Expo-SDK%2054-3DDC84)](https://expo.dev)

Proyecto móvil de Medispace — aplicación para gestión de citas y registros médicos.

## Capturas

Presentamos una galería con capturas reales de la aplicación. (Se muestran los archivos `screenshot-*.png` en `assets/screenshots/`)

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

## Cómo añadir capturas reales

1. Reemplace los archivos en `assets/screenshots/` con imágenes reales (PNG/JPG/SVG).
2. Use nombres `screenshot-1.png`, `screenshot-2.png`, etc.
3. Para previsualizar en el README local, abra el archivo en VS Code o en GitHub después de commitear.

## Recursos de diseño

- Íconos y splash: reemplace `assets/icon.png`, `assets/splash-icon.png`, y `assets/adaptive-icon.png`.
- Para generar iconos adaptativos use herramientas como https://appicon.co/ o la CLI de `expo`.

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
