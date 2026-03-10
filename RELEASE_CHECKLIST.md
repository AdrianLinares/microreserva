# Release Checklist

Usa este checklist antes de publicar cambios a produccion.

## 1. Pre-check tecnico

- [ ] npm install ejecutado sin errores.
- [ ] npm run build compila correctamente.
- [ ] No hay errores TypeScript relevantes.
- [ ] Variables de entorno locales configuradas.

## 2. Validacion funcional minima

- [ ] Usuario puede solicitar turno en ventana habilitada.
- [ ] Usuario no puede solicitar fuera de ventana.
- [ ] Limite de proxima semana se respeta.
- [ ] Admin puede aprobar una solicitud.
- [ ] Admin puede liberar/rechazar una solicitud.
- [ ] Admin puede mover una reserva a otro slot.
- [ ] Admin puede intercambiar dos reservas.
- [ ] Admin puede aplicar bloqueo simple/rango/indefinido.
- [ ] Vista admin muestra cambios en la grilla.

## 3. Seguridad y backend

- [ ] Endpoint admin rechaza requests sin Authorization.
- [ ] ADMIN_USERS tiene JSON valido.
- [ ] DATABASE_URL apunta a la base correcta.
- [ ] CORS en produccion tiene ALLOWED_ORIGIN correcto.

## 4. Datos y observabilidad

- [ ] schema.sql aplicado (si hubo cambios de base).
- [ ] Logs de Netlify Functions sin errores inesperados.
- [ ] No hay errores 500 en flujo basico.

## 5. Documentacion obligatoria

- [ ] README actualizado si cambio flujo o variables.
- [ ] ESTRUCTURA actualizado si cambio arquitectura.
- [ ] CHANGELOG actualizado con cambios visibles.
- [ ] Comentarios de codigo nuevos claros y consistentes.

## 6. Publicacion

1. Confirmar rama y estado de git.
2. Crear commit con mensaje claro.
3. Push al repositorio remoto.
4. Verificar build en Netlify.
5. Ejecutar smoke test en URL publicada.

## 7. Smoke test post-deploy

- [ ] Carga inicial sin pantalla en blanco.
- [ ] Lista de reservas visible.
- [ ] Login admin funciona.
- [ ] Crear/aprobar/rechazar reserva funciona.
- [ ] No hay errores CORS en consola.

## Variables de entorno minimas (produccion)

```env
DATABASE_URL=postgresql://...
ADMIN_USERS=[{"username":"admin","passwordHash":"..."}]
ALLOWED_ORIGIN=https://tu-dominio.netlify.app
```
