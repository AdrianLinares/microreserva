# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.0.0] - 2026-03-02

### ✨ Nuevo

- **Sistema de límite configurable de turnos por semana**: Permite al administrador definir el límite máximo de turnos que pueden solicitar los usuarios para la próxima semana, sin contar turnos de la semana actual.
- **Captura limpia de correos**: La lista de correos registrados se actualiza automáticamente cada semana, mostrando solo solicitantes de la próxima semana.
- **Refresco automático de datos**: La aplicación mantiene los datos en sincronización en tiempo real:
  - Polling cada 15 segundos mientras la pestaña está visible
  - Auto-sincronización al restaurar la pestaña desde bookmark o focus
  - Lectura fresca de datos sin caché para cambios multiusuario
- **Gestión mejorada de turnos en admin**:
  - "Liberar turno" en lugar de eliminar (mantiene registro limpio)
  - "Desbloquear" para bloqueos administrativos
  - Confirmaciones claras de acciones

### 🔧 Cambios

- Optimización de TypeScript: instalació de `@types/react`, `@types/react-dom`, `@types/node`
- Eliminación de `MAX_SLOTS_PER_PERSON` global (reemplazado por límite configurable por semana)
- Eliminación de mock console.log de notificaciones
- Mejorado header info para mostrar límite de próxima semana
- Correos de lista de admin ahora filtrados solo a próxima semana

### 🐛 Arreglos

- **Autenticación en solicitudes API**: Se corrigió el manejo de headers para no perder autenticación cuando se pasan headers personalizados
- **Rechazo/liberación de turnos**: Ahora funciona correctamente usando `status = 'available'` con validación en backend
- **Caché en GET requests**: Agregado `cache: 'no-store'` y query busting para evitar datos stale en panel admin

### 📊 Estado de seguridad

- 0 vulnerabilidades en dependencias de producción
- Auth mejorada con validación de admin_users desde env
- Headers CORS configurables por origen
- Validaciones estrictas en backend de Netlify/serverless

### 📝 Notas de desarrollo

- Build exitoso sin errores
- TypeScript con settings balanceados para mantenibilidad
- Polling adaptativo (respeta visibilidad de pestaña)
- Ready para producción con Netlify Functions
