#Ticket System
Sistema de gestión de tickets con reportes y comentarios.

📋 Organización del Proyecto
├── backend/          - API REST con Express.js + TypeScript
├── frontend/         - Interfaz con React + Vite + TypeScript
└── database/         - Esquema y datos iniciales PostgreSQL
🛠️ Tecnologías
Frontend
React 18
TypeScript
Vite
Tailwind CSS
Backend
Node.js
Express.js
TypeScript
PostgreSQL
JWT Authentication
🚀 Guía de Instalación y Ejecución
Requisitos Previos
Node.js (v16 o superior)
npm o yarn
PostgreSQL (local o remoto)
Git
1. Clonar el Repositorio
git clone https://github.com/sebastiangonzalez041-a11y/sistek.git
cd sistek
2. Configurar el Backend
a. Instalar dependencias
cd backend
npm install
b. Configurar variables de entorno
Copia el archivo .env.example a .env y configura tus datos:

cp .env.example .env
Edita el archivo .env con tus credenciales:

DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/sistek_db
PORT=4000
NODE_ENV=development
JWT_SECRET=tu_clave_secreta_aqui
JWT_EXPIRES_IN=7d
c. Configurar la base de datos
# Crear la base de datos (si no existe)
createdb sistek_db

# Ejecutar el esquema
psql sistek_db < ../database/schema.sql

# Cargar datos iniciales (opcional)
psql sistek_db < ../database/seeds/initial_data.sql
d. Ejecutar el servidor
npm run dev
El backend estará disponible en http://localhost:4000

3. Configurar el Frontend
a. Instalar dependencias
cd ../frontend
npm install
b. Ejecutar el servidor de desarrollo
npm run dev
El frontend estará disponible en http://localhost:5173

📝 Scripts Disponibles
Backend
npm run dev      # Ejecutar en modo desarrollo
npm run build    # Compilar TypeScript
npm run start    # Ejecutar versión compilada
Frontend
npm run dev      # Servidor de desarrollo
npm run build    # Construir para producción
npm run preview  # Previsualizar build de producción
🔐 Autenticación
El sistema usa JWT (JSON Web Tokens) para autenticación. Los tokens se validan en rutas protegidas mediante el middleware authMiddleware.

📚 Endpoints principales
Usuarios
POST /api/users/register - Registrar nuevo usuario
POST /api/users/login - Iniciar sesión
Tickets
GET /api/tickets - Listar tickets
POST /api/tickets - Crear nuevo ticket
GET /api/tickets/:id - Obtener ticket específico
PUT /api/tickets/:id - Actualizar ticket
DELETE /api/tickets/:id - Eliminar ticket
Comentarios
POST /api/comments - Crear comentario
GET /api/comments/:ticketId - Obtener comentarios de un ticket
Reportes
GET /api/reports - Obtener reportes
POST /api/reports - Crear reporte
Notificaciones
GET /api/notifications - Obtener notificaciones
🐛 Solución de Problemas
Error de conexión a BD
Verifica que PostgreSQL esté corriendo
Comprueba las credenciales en .env
Asegúrate de que la base de datos existe
Puerto ya en uso
Backend: Cambia PORT en .env
Frontend: Vite usa puerto 5173 por defecto
📧 Contacto
Para más información, contacta al equipo de desarrollo.

Configuración de Desarrollo
Base de Datos
Para configurar la base de datos PostgreSQL localmente usando Docker:

Asegúrate de tener Docker instalado (descarga Docker Desktop desde https://www.docker.com/).
En la raíz del proyecto, ejecuta: docker-compose up -d
La base de datos se creará automáticamente con el esquema definido en database/schema.sql.
Conecta usando: Host: localhost, Puerto: 5432, Usuario: dev_user, Contraseña: dev_password, DB: ticket_system_dev.
Para detener: docker-compose down.

Si prefieres PostgreSQL nativo:

Instala PostgreSQL (desde https://www.postgresql.org/).
Crea una base de datos: createdb ticket_system_dev.
Ejecuta el esquema: psql -d ticket_system_dev -f database/schema.sql.
