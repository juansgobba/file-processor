# Challenge Técnico – Desarrollador Backend (Node.js)

## Descripción de la Solución

Esta solución implementa un microservicio backend en Node.js (NestJS) para procesar un archivo de clientes de gran tamaño (`CLIENTES_IN_0425.dat`) y volcar sus datos en una base de datos SQL Server. Se ha diseñado pensando en la eficiencia de memoria y la escalabilidad, utilizando streams para el procesamiento del archivo y TypeORM para la gestión de la base de datos y migraciones.

**Características principales:**
*   **Procesamiento por Streams:** Lee el archivo línea por línea, sin cargarlo completamente en memoria, lo que permite manejar archivos de gran tamaño con recursos limitados.
*   **Procesamiento por Lotes:** Los registros válidos se agrupan en lotes para optimizar las inserciones masivas en SQL Server, reduciendo la sobrecarga de la base de datos.
*   **Manejo de Errores:** Las líneas corruptas en el archivo son registradas y omitidas, permitiendo que el procesamiento continúe sin interrupciones.
*   **Endpoint `/health`:** Un endpoint de salud (`GET /health`) que responde incluso durante el procesamiento del archivo, asegurando la operatividad del servicio.
*   **Migraciones de TypeORM:** La estructura de la tabla de clientes se gestiona mediante migraciones de TypeORM, facilitando el control de versiones del esquema de la base de datos.
*   **Contenedorización:** La aplicación y la base de datos se ejecutan en contenedores Docker, facilitando el despliegue en entornos como Kubernetes.

## Requisitos Previos

Asegúrate de tener instalado lo siguiente en tu sistema:

*   **Docker Desktop:** Para ejecutar la base de datos SQL Server y la aplicación en contenedores.
*   **Node.js (v18 o superior) y npm:** Necesario si deseas ejecutar la aplicación localmente (fuera de Docker) o para generar el archivo de prueba.

## 🚀 Guía de Inicio Rápido (Usando Docker Compose)

Esta es la forma recomendada para levantar toda la solución (base de datos y aplicación) con un solo comando.

### 1. Configuración del Entorno

Crea un archivo `.env` en la raíz del proyecto (puedes usar `.env.example` como plantilla) y configura las variables de entorno para la conexión a la base de datos.

```bash
cp .env.example .env
# Edita .env con tus credenciales si son diferentes a las predeterminadas
```

### 2. Generar el Archivo de Prueba de Clientes

El proyecto incluye un script para generar el archivo `CLIENTES_IN_0425.dat` con datos aleatorios y errores intencionales.

```bash
npm install # Si no lo has hecho ya
npx ts-node generateFiles.ts # Asegúrate de que el script se llama generateFiles.ts
```
Esto generará el archivo en la raíz del proyecto (`CLIENTES_IN_0425.dat`).

### 3. Levantar la Solución Completa

Utiliza `docker-compose.yml` para construir la imagen de la aplicación, levantar el contenedor de SQL Server, ejecutar las migraciones de TypeORM y finalmente iniciar la aplicación.

```bash
docker-compose up --build -d
```

Espera unos minutos hasta que ambos contenedores estén completamente operativos. Puedes verificar su estado con `docker-compose ps`.

La aplicación estará disponible en `http://localhost:3000`.

## 🛠️ Ejecución en Entorno de Desarrollo (App Local, DB en Docker)

Si prefieres ejecutar la aplicación Node.js directamente en tu máquina local para facilitar el desarrollo y la depuración, puedes seguir estos pasos:

### 1. Levantar la Base de Datos SQL Server (solo DB)

Utiliza el `docker-compose.db.yml` para iniciar únicamente el contenedor de SQL Server. Este script `init.sql` creará el esquema `file_processor`.

```bash
docker-compose -f docker-compose.db.yml up -d
```

Espera unos minutos hasta que el contenedor de SQL Server esté completamente operativo y saludable. Puedes verificar su estado con `docker-compose -f docker-compose.db.yml ps`.

### 2. Configuración del Entorno Local

Asegúrate de tener tu archivo `.env` configurado como se describe en el paso 1 de la "Guía de Inicio Rápido".

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Ejecutar Migraciones de TypeORM

Una vez que la base de datos esté levantada, aplica las migraciones para crear la tabla `Clients`.

```bash
npm run typeorm:migration:run
```

### 5. Generar el Archivo de Prueba de Clientes

```bash
npx ts-node generateFiles.ts # Asegúrate de que el script se llama generateFiles.ts
```
Esto generará el archivo en la raíz del proyecto (`CLIENTES_IN_0425.dat`).

### 6. Iniciar la Aplicación Localmente

```bash
npm run start:dev
```

La aplicación estará disponible en `http://localhost:3000`.

## 📡 Uso de la API

### Endpoint de Salud

Verifica que el servicio esté operativo. Puedes ejecutar este comando en tu terminal:

```bash
curl http://localhost:3000/health
```

Respuesta esperada:
```json
{
  "status": "OK",
  "timeelapsed": "YYYY-MM-DDTHH:MM:SS.sssZ"
}
```

### Endpoint de Procesamiento de Archivos

Inicia el procesamiento del archivo de clientes. Este endpoint responde inmediatamente, y el procesamiento se realiza en segundo plano.

```bash
curl -X POST http://localhost:3000/file/process
```

Respuesta esperada:
```json
{
  "message": "Procesamiento de archivo iniciado en segundo plano."
}
```

Puedes monitorear los logs del contenedor de la aplicación (si la corres con Docker Compose) para ver el progreso del procesamiento:

```bash
docker-compose logs -f app
```
O si la corres localmente, verás los logs en tu terminal.

## 🏗️ Arquitectura y Decisiones Técnicas

El proyecto sigue una arquitectura limpia (Clean Architecture), separando las responsabilidades en capas:
*   `src/file/domain`: Entidades de negocio y contratos (interfaces de repositorio).
*   `src/file/application`: Servicios de aplicación (lógica de procesamiento).
*   `src/file/infrastructure`: Implementaciones concretas (controladores, repositorios SQL Server, esquemas de TypeORM).

**Decisiones clave:**
*   **Procesamiento por Streams:** Para manejar archivos de gran tamaño con eficiencia de memoria, el `FileService` lee el archivo línea por línea utilizando `fs.createReadStream` y `readline`.
*   **Procesamiento por Lotes:** Las inserciones en la base de datos se realizan en lotes para optimizar el rendimiento y reducir la carga en SQL Server.
*   **Manejo de Errores:** Las líneas corruptas son detectadas, logueadas y omitidas, permitiendo que el procesamiento continúe sin interrupciones.
*   **Validación de Datos:** Se realizan validaciones estrictas en el `FileService` para asegurar la integridad de los datos antes de la inserción.
*   **Prevención de Duplicados:** Se verifica la existencia de DNIs duplicados tanto dentro del mismo lote como en la base de datos antes de insertar nuevos registros.
*   **Monitoreo Básico:** Se incluyen logs informativos con métricas de progreso, uso de memoria y CPU para observar el rendimiento del procesamiento.

## 📈 Propuesta Técnica para Escalabilidad (Archivos 5 veces más grandes)

Para manejar archivos de entrada significativamente más grandes (ej. 5 GB), la estrategia actual de procesamiento de un solo archivo en un solo pod puede volverse un cuello de botella, incluso con streaming. Se propone una estrategia de **procesamiento distribuido y paralelizado**:

1.  **Servicio de División de Archivos (File Splitter Service):**
    *   Un nuevo microservicio (o una función serverless) sería responsable de recibir el archivo grande.
    *   Este servicio dividiría el archivo de 5 GB en múltiples archivos más pequeños (ej. 50 archivos de 100 MB cada uno).
    *   Los archivos divididos se almacenarían en un almacenamiento de objetos (ej. AWS S3, Azure Blob Storage) o un volumen compartido accesible por los pods de procesamiento.
    *   Tras la división, este servicio enviaría mensajes a una cola de mensajes (ej. RabbitMQ, Kafka, SQS) para cada archivo pequeño, indicando que está listo para ser procesado.

2.  **Escalamiento Horizontal del Servicio de Procesamiento:**
    *   El microservicio actual (`file-processor`) se configuraría para escuchar mensajes de la cola.
    *   Cada instancia (pod) del `file-processor` tomaría un mensaje de la cola, descargaría el archivo pequeño correspondiente del almacenamiento de objetos y lo procesaría utilizando la lógica de streaming y lotes ya implementada.
    *   En Kubernetes, se podría configurar un Horizontal Pod Autoscaler (HPA) basado en la longitud de la cola de mensajes o en el uso de CPU/memoria, para escalar automáticamente el número de pods de `file-processor` según la carga de trabajo.

3.  **Base de Datos Escalable:**
    *   SQL Server puede escalar verticalmente (más CPU/RAM) o, para cargas extremas, se podría considerar una arquitectura de base de datos distribuida o un servicio gestionado que ofrezca alta disponibilidad y escalabilidad (ej. Azure SQL Database, AWS RDS for SQL Server).
    *   Las inserciones masivas (`BULK INSERT`) ya son eficientes, pero con múltiples pods escribiendo simultáneamente, es crucial que la base de datos pueda manejar la concurrencia.

**Beneficios de esta estrategia:**
*   **Paralelización:** Múltiples pods procesan partes del archivo simultáneamente, reduciendo drásticamente el tiempo total de procesamiento.
*   **Resiliencia:** Si un pod falla, otro puede retomar el procesamiento de los archivos pendientes en la cola.
*   **Desacoplamiento:** Los servicios de división y procesamiento están desacoplados, lo que permite escalar cada componente de forma independiente.
*   **Eficiencia de Recursos:** Cada pod sigue procesando archivos pequeños con los mismos límites de memoria, manteniendo la eficiencia.

## Soporte

Para preguntas o soporte, por favor contacta al equipo de desarrollo.
