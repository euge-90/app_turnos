# Iconos PWA para Turnify

## Iconos Requeridos

Para que la PWA funcione correctamente, necesitas generar los siguientes iconos:

- **icon-192x192.png**: 192x192 píxeles
- **icon-512x512.png**: 512x512 píxeles

## Cómo Generar los Iconos

### Opción 1: Usar un generador online

1. Visita https://www.pwabuilder.com/imageGenerator
2. Sube tu logo (recomendado: 512x512px con fondo transparente)
3. Descarga el paquete de iconos
4. Coloca los archivos en esta carpeta (`public/images/`)

### Opción 2: Usar Figma/Photoshop/GIMP

1. Crea un diseño cuadrado de 512x512 píxeles
2. Diseño sugerido:
   - Fondo: Blanco o #ff6b6b (color principal de Turnify)
   - Icono: ✂️ o logo personalizado
   - Texto: "Turnify" (opcional)
   - Padding: 10-15% alrededor del contenido
3. Exporta como PNG en dos tamaños: 192x192 y 512x512

### Opción 3: Usar herramienta CLI

```bash
npm install -g pwa-asset-generator
pwa-asset-generator logo.svg public/images
```

## Colores de Marca

- **Color Principal**: #ff6b6b
- **Color Secundario**: #4ecdc4
- **Color Oscuro**: #2c3e50
- **Fondo Claro**: #ffffff

## Iconos Temporales

Si necesitas probar la PWA inmediatamente sin iconos personalizados:

1. Usa un generador de placeholder: https://via.placeholder.com/512x512/ff6b6b/ffffff?text=T
2. Descarga y renombra como `icon-192x192.png` y `icon-512x512.png`

## Verificación

Una vez agregados los iconos:

1. Ejecuta `firebase serve` o `firebase deploy`
2. Abre Chrome DevTools
3. Ve a Application > Manifest
4. Verifica que los iconos aparezcan correctamente
