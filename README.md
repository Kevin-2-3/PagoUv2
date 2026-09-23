# PagoUv2

Sistema  punto de venta, inventario y empleados para una tienda de conveniencia ficticia.

## Funcionalidades actuales

- Inicio de sesión, sesiones persistentes y contraseñas con bcrypt.
- Roles `GERENTE`, `ADMINISTRADOR` y `CAJERO`, protegidos en el servidor.
- Catálogo con búsqueda, categorías, precio, stock y estado.
- Punto de venta : búsqueda por código/nombre, cantidades y ticket.
- Venta transaccional con validación de stock y folio único.
- Historial y detalle de ventas.
- Cancelación con usuario y PIN de gerente.
- Administración de empleados, roles y cuentas activas.

## Tecnologías

Node.js 20+, Express 5, EJS, SQLite , express-session, bcryptjs, HTML, CSS y JavaScript.

## Instalación y ejecución

```bash
npm install
cp .env.example .env
npm run setup
npm run dev
```

Abrir `http://localhost:3000`

## Cuentas de demostración

| Rol           | Usuario   | Contraseña    | PIN de autorización |
| ------------- | --------- | ------------- | ------------------- |
| Gerente       | `gerente` | `Gerente123!` | `2468`              |
| Administrador | `admin`   | `Admin123!`   | —                   |
| Cajero        | `cajero`  | `Cajero123!`  | —                   |

El PIN está almacenado como hash.

## Scripts

- `npm start`: servidor normal.
- `npm run dev`: servidor con recarga automática.
- `npm run setup`: inicializa base con datos para demostración.
- `npm test`: ejecuta pruebas de integración.

## Estructura

```text
src/config       configuración
src/controllers  controladores HTTP
src/database     conexión, esquema y semillas
src/middleware   autenticación, autorización y mensajes
src/routes       definición de rutas
src/services     reglas de negocio y transacciones
src/utils        errores y formatos
src/views        plantillas EJS
public           CSS y JavaScript del navegador
tests            pruebas de integración
docs             documentación del proyecto
```

## Permisos

- **Gerente:** panel, ventas, detalle/cancelación, empleados y consulta de productos.
- **Administrador:** panel, punto de venta, ventas y administración completa de productos.
- **Cajero:** panel, punto de venta, sus propias ventas y solicitud de cancelación autorizada.

