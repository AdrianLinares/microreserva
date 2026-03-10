# Estructura del Proyecto

Este documento te ayuda a ubicar rapidamente donde vive cada responsabilidad del sistema.

## Mapa general

```text
microreserva/
├── index.html
├── package.json
├── netlify.toml
├── schema.sql
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── constants.ts
│   ├── types.ts
│   ├── components/
│   │   ├── BookingModal.tsx
│   │   ├── AdminPanel.tsx
│   │   └── AdminBookingModal.tsx
│   └── services/
│       └── api.ts
├── netlify/
│   └── functions/
│       ├── bookings.ts
│       ├── booking.ts
│       ├── bookings-swap.ts
│       ├── settings.ts
│       └── lib/
│           └── auth.ts
└── scripts/
    └── generate-hash.mjs
```

## Que hace cada carpeta

- src:
  - Todo lo que corre en navegador (React).

- src/components:
  - Componentes de interfaz reutilizables.

- src/services:
  - Capa de acceso a API. Aqui no hay JSX, solo requests y helpers.

- netlify/functions:
  - Backend serverless. Cada archivo exporta un handler HTTP.

- netlify/functions/lib:
  - Utilidades compartidas del backend (auth, etc.).

- scripts:
  - Herramientas manuales para soporte operativo.

## Flujo tecnico de una reserva

1. Usuario hace clic en un slot en src/App.tsx.
2. Al enviar, se llama api.addBooking en src/services/api.ts.
3. request llega a netlify/functions/bookings.ts.
4. bookings.ts valida permisos, limites y conflictos.
5. Si todo es valido, se guarda en PostgreSQL.

## Donde editar segun necesidad

Cambiar regla de negocio (ej. limite, validaciones):
- netlify/functions/bookings.ts
- netlify/functions/settings.ts

Cambiar visual de grilla usuario:
- src/App.tsx

Cambiar operaciones admin:
- src/components/AdminPanel.tsx
- netlify/functions/booking.ts
- netlify/functions/bookings-swap.ts

Cambiar login admin:
- src/services/api.ts
- netlify/functions/lib/auth.ts

## Convenciones recomendadas para nuevos aportes

- Primero valida reglas en backend, luego replica validacion en frontend para UX.
- Mantener comentarios en espanol tecnico claro.
- Preferir nombres de funciones explicitos (verbos de accion).
- Evitar logica de negocio compleja dentro de JSX; mover a helpers.
