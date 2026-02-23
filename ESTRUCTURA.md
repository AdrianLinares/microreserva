# Estructura del Proyecto - Sala de Petrografía

## 📁 Nueva Estructura Organizada

```
microreserva/
├── index.html                 # Punto de entrada HTML (Vite)
├── package.json              # Dependencias del proyecto
├── tsconfig.json             # Configuración TypeScript
├── vite.config.ts            # Configuración Vite
├── netlify.toml              # Configuración Netlify
├── README.md                 
├── schema.sql                # Esquema de base de datos
├── metadata.json             
│
├── src/                      # 🎯 Todo el código del frontend
│   ├── main.tsx             # Punto de entrada de la aplicación
│   ├── App.tsx              # Componente principal
│   ├── types.ts             # Definiciones de tipos TypeScript
│   ├── constants.ts         # Constantes de la aplicación
│   │
│   ├── components/          # Componentes React
│   │   ├── AdminPanel.tsx   # Panel de administración
│   │   └── BookingModal.tsx # Modal de reservas
│   │
│   └── services/            # Servicios del cliente
│       └── api.ts           # Cliente API para comunicación con backend
│
├── netlify/                 # 🔧 Funciones serverless (Backend)
│   └── functions/
│       ├── booking.ts       # CRUD individual de reservas
│       ├── bookings.ts      # Listar/crear múltiples reservas
│       ├── bookings-swap.ts # Intercambiar reservas
│       ├── settings.ts      # Configuración admin
│       └── lib/
│           ├── auth.ts      # Autenticación
│           └── db.ts        # Utilidades de base de datos
│
└── scripts/                 # Scripts auxiliares
    └── generate-hash.mjs    # Generador de hashes
```

## 🎨 Mejoras Implementadas

### Antes (❌ Problemas)
- Archivos mezclados en la raíz: `App.tsx`, `types.ts`, `constants.ts`, `index.tsx`
- Duplicación confusa: `services/` y `src/services/`
- Componentes en `components/` pero archivos principales en raíz
- Sin separación clara entre frontend y backend

### Después (✅ Mejoras)
1. **Separación Clara**:
   - Todo el código del frontend en `src/`
   - Funciones serverless en `netlify/functions/`
   - Configuración en la raíz

2. **Estructura Modular**:
   - `src/components/` para componentes React
   - `src/services/` para servicios del cliente
   - `netlify/functions/lib/` para utilidades del backend

3. **Rutas de Importación Simplificadas**:
   - Alias `@` apunta a `src/` en vite.config.ts
   - Importaciones relativas claras y consistentes

4. **Mantenibilidad**:
   - Fácil encontrar cualquier archivo
   - Separación de responsabilidades clara
   - Escalable para futuras funcionalidades

## 🔄 Cambios en Archivos de Configuración

### `index.html`
```html
<!-- Antes -->
<script type="module" src="/index.tsx"></script>

<!-- Después -->
<script type="module" src="/src/main.tsx"></script>
```

### `vite.config.ts`
```typescript
// Antes
resolve: {
  alias: {
    '@': path.resolve(__dirname, '.'),
  }
}

// Después
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  }
}
```

## 📦 Patrones de Importación

### En componentes de `src/`:
```typescript
// Tipos y constantes
import { Booking, BookingStatus } from './types';
import { EQUIPMENT_LIST, TIME_SLOTS } from './constants';

// Servicios
import { getBookings, addBooking } from './services/api';

// Componentes
import BookingModal from './components/BookingModal';
import AdminPanel from './components/AdminPanel';
```

### En funciones de Netlify:
```typescript
// Utilidades de backend
import { verifyAdminAuth } from './lib/auth';
// Base de datos directa via Neon
import { neon } from '@neondatabase/serverless';
```

## 🚀 Scripts de Desarrollo

```bash
# Desarrollo (con Netlify Dev)
npm run dev

# Build de producción
npm run build

# Preview de producción
npm run preview

# Generar hash de contraseña
npm run generate-hash
```

## 📝 Beneficios de la Nueva Estructura

1. **Claridad**: Es obvio dónde encontrar cada tipo de código
2. **Escalabilidad**: Fácil agregar nuevos componentes, servicios o funciones
3. **Mantenimiento**: Cambios localizados, menos búsqueda de archivos
4. **Estándares**: Sigue las mejores prácticas de React/Vite
5. **Colaboración**: Otros desarrolladores entenderán la estructura rápidamente

## 🔍 Guía Rápida de Navegación

**¿Dónde está...?**
- **Componente nuevo?** → `src/components/`
- **Lógica de API?** → `src/services/api.ts`
- **Nueva función serverless?** → `netlify/functions/`
- **Tipos TypeScript?** → `src/types.ts`
- **Constantes?** → `src/constants.ts`
- **Autenticación backend?** → `netlify/functions/lib/auth.ts`
