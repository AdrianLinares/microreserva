# 🔬 MicroReserva - Sistema de Reserva de Equipamiento

Sistema web de reserva en línea para laboratorios de microscopía. Permite a los usuarios solicitar turnos de uso en microscopios y estereomicroscopios de alta precisión de la Sala de Petrografía.

---

## ✨ Características Principales

- **Selección de Equipamiento**: Visualiza y selecciona entre múltiples microscopios (marcas ZEISS y OLYMPUS)
- **Filtrado Inteligente**: Filtra equipamiento por tipo (Microscopio/Estereomicroscopio) y marca
- **Reserva de Turnos**: Solicita múltiples turnos en una sola solicitud (máximo 6 turnos)
- **Ventana de Reserva Controlada**: Solo permite solicitudes entre lunes 7:00 AM y viernes 12:00 PM
- **Calendario Semanal**: Visualiza disponibilidad de turnos en una vista de calendario intuitiva
- **Panel Administrativo**: 
  - Aprueba o rechaza solicitudes pendientes
  - Bloquea equipamiento por mantenimiento
  - Envía notificaciones por correo
  - Edita y transfiere reservas
- **Validación de Formularios**: Validación en tiempo real de correos electrónicos
- **Interfaz Responsive**: Diseño adaptable para dispositivos de escritorio y móviles

---

## 🛠️ Requisitos Previos

- **Node.js** versión 16.0.0 o superior
- **npm** versión 7.0.0 o superior
- Navegador web moderno (Chrome, Firefox, Safari, Edge)

---

## 📦 Instalación

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd microreserva
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Iniciar servidor de desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173` (o el puerto indicado en consola)

### 4. Compilar para producción

```bash
npm run build
```

El código compilado se generará en la carpeta `dist/`

---

## 🚀 Uso

### Para Usuarios Regulares

1. **Acceder a la aplicación**: Abre tu navegador web
2. **Filtrar equipamiento** (opcional): Usa los filtros de tipo y marca
3. **Seleccionar turnos**: Haz clic en los turnos disponibles que desees reservar
4. **Completar formulario**: Ingresa tu nombre completo, correo electrónico y grupo de trabajo
5. **Enviar solicitud**: Presiona "Solicitar Turno" para enviar tu solicitud
6. **Esperar aprobación**: El administrador revisará tu solicitud

### Para Administradores

1. **Acceder como administrador**: Haz clic en el icono de usuario en la esquina superior derecha
2. **Ingresa credenciales**:
   - Usuario: `admin`
   - Contraseña: `password123`
3. **Gestionar solicitudes**:
   - Revisa solicitudes pendientes
   - Aprueba o rechaza según corresponda
   - Envía notificaciones a los usuarios
4. **Bloquear equipamiento**: Especifica fecha, razón y equipamiento a bloquear por mantenimiento
5. **Editar reservas**: Modifica fechas y equipos asignados desde la lista de reservas

---

## 📊 Horarios de Disponibilidad

- **Lunes a Viernes**: 7:00 AM - 4:00 PM (Turnos disponibles)
- **Ventana de Solicitud**: Lunes 7:00 AM - Viernes 12:00 PM
- **Sábado y Domingo**: Cerrado
- **Viernes después de 12:00 PM**: No se aceptan nuevas solicitudes

**Turnos disponibles:**
- **Turno 1**: 8:00 AM - 12:00 PM
- **Turno 2**: 1:00 PM - 4:00 PM

---

## 🏗️ Estructura del Proyecto

```
microreserva/
├── components/
│   ├── AdminPanel.tsx          # Panel administrativo completo
│   └── BookingModal.tsx        # Modal de formulario de solicitud
├── services/
│   └── db.ts                   # Gestión de datos (localStorage)
├── App.tsx                     # Componente principal
├── types.ts                    # Definiciones de tipos TypeScript
├── constants.ts                # Equipamiento, turnos y configuración
├── vite.config.ts              # Configuración de Vite
├── tsconfig.json               # Configuración de TypeScript
├── index.tsx                   # Punto de entrada
├── index.html                  # HTML base
└── README.md                   # Este archivo
```

### Descripción de Archivos Clave

- **App.tsx**: Gestiona el estado global, lógica de selección de turnos y validaciones
- **BookingModal.tsx**: Componente de formulario para solicitar turnos
- **AdminPanel.tsx**: Interfaz completa para administradores
- **db.ts**: Manejo de almacenamiento local (localStorage)
- **types.ts**: Interfaces de TypeScript: `Equipment`, `TimeSlot`, `Booking`, etc.
- **constants.ts**: Lista de equipamiento, horarios y credenciales

---

## 💻 Tecnologías Utilizadas

- **React 19**: Biblioteca de interfaz de usuario
- **React DOM 19**: Renderización en el DOM
- **TypeScript**: Tipado estático
- **Vite 6**: Herramienta de compilación rápida
- **Tailwind CSS**: Estilos (incluido mediante clases)
- **Lucide React**: Iconografía
- **localStorage**: Almacenamiento de datos persistente

---

## 🔐 Autenticación y Seguridad

**Nota Importante**: Este sistema usa autenticación básica de demostración. Para producción:

1. Implementa autenticación segura (OAuth, JWT)
2. Usa credenciales en variables de entorno
3. Establece bases de datos en el backend
4. Implementa validación en servidor

---

## 📝 Notas sobre el Almacenamiento

- Los datos se almacenan en **localStorage** del navegador
- Los datos no se sincronizan entre dispositivos
- Si se limpian los datos del navegador, se pierden todas las reservas
- Para producción, migra a una base de datos backend (MySQL, PostgreSQL, Firebase, etc.)

---

## 🐛 Solución de Problemas

### El aplicativo no carga
- Verifica que esté ejecutándose con `npm run dev`
- Limpia el caché del navegador (Ctrl+Shift+Del)
- Verifica la consola del navegador (F12) para errores

### Las solicitudes no se guardan
- Verifica que localStorage esté habilitado en tu navegador
- Intenta en modo incógnito (puede haber restricciones de extensiones)

### No puedo acceder al panel admin
- Contraseña predeterminada: `password123`
- Usuario predeterminado: `admin`

---

## 📞 Contacto e Información

**Institución**: Dirección de Geociencias Básicas - Sala de Petrografía

Para reportar problemas o sugerencias, contacta al administrador del sistema.

---

## 📄 Licencia

Proyecto desarrollado para uso interno de la institución.

---

**Versión**: 0.0.0  
**Última actualización**: Febrero 2026
