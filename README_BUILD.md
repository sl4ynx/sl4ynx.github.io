# Empaquetado para EXE y APK

## EXE para Windows

Instala PyInstaller:

```bash
python -m pip install pyinstaller
python build_exe.py
```

El ejecutable se generará en la carpeta `dist`.

## APK para Android

Instala buildozer y el SDK/NDK de Android, luego ejecuta:

```bash
pip install buildozer cython virtualenv
buildozer init
buildozer android debug
```

Asegúrate de que el archivo `buildozer.spec` esté en la raíz del proyecto y que `mobile_app.py` sea el punto de entrada principal.

## Nota

La APK real requiere Android SDK, NDK, JDK y entorno Linux/macOS para compilar. En Windows es más complejo, pero la estructura base ya está preparada.
