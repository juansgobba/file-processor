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

## Estructura del Proyecto

El proyecto sigue una arquitectura limpia, separando las responsabilidades en capas:
*   `src/file/domain`: Entidades de negocio y contratos (interfaces de repositorio).
*   `src/file/application`: Servicios de aplicación (lógica de procesamiento).
*   `src/file/infrastructure`: Implementaciones concretas (controladores, repositorios SQL Server, esquemas de TypeORM).
*   `src/migrations`: Archivos de migración de TypeORM.

## Requisitos

*   Docker y Docker Compose instalados.
*   Node.js y npm instalados (para desarrollo local y generación del archivo de prueba).

## Pasos para Levantar la Solución Localmente

Sigue estos pasos para poner en marcha la aplicación y la base de datos:

### 1. Configuración del Entorno

Crea un archivo `.env` en la raíz del proyecto (puedes usar `.env.example` como plantilla) y configura las variables de entorno para la conexión a la base de datos.

```bash
cp .env.example .env
# Edita .env con tus credenciales si son diferentes a las predeterminadas
```

### 2. Levantar la Base de Datos SQL Server

Utiliza el `docker-compose.db.yml` para iniciar el contenedor de SQL Server. Este script `init.sql` creará el esquema `file_processor`.

```bash
docker-compose -f docker-compose.db.yml up -d
```

Espera unos minutos hasta que el contenedor de SQL Server esté completamente operativo y saludable. Puedes verificar su estado con `docker-compose -f docker-compose.db.yml ps`.

### 3. Generar el Archivo de Prueba de Clientes

El proyecto incluye un script para generar el archivo `CLIENTES_IN_0425.dat` con datos aleatorios y errores intencionales.

**Nota:** El script `generateFile.ts` no se encuentra en el proyecto base. Si lo tienes, colócalo en la raíz del proyecto. Si no, deberás crearlo o usar un archivo de prueba manual.

Asumiendo que el script `generateFile.ts` está en la raíz del proyecto:

```bash
npm install # Si no lo has hecho ya
npx ts-node generateFile.ts
```
Esto generará el archivo en `challenge/input/CLIENTES_IN_0425.dat`. Asegúrate de que el directorio `challenge/input` exista.

### 4. Ejecutar Migraciones de TypeORM

Una vez que la base de datos esté levantada, aplica las migraciones para crear la tabla `Clients`.

```bash
npm run typeorm:migration:run
```

### 5. Construir y Levantar la Aplicación

Ahora puedes construir la imagen Docker de la aplicación y levantar el servicio junto con la base de datos (si no la levantaste en el paso 2, este `docker-compose` la levantará también).

```bash
docker-compose up --build -d
```

La aplicación estará disponible en `http://localhost:3000`.

## Uso de la API

### Endpoint de Salud

Verifica que el servicio esté operativo:

```bash
GET http://localhost:3000/health
```

Respuesta esperada:
```json
{
  "status": "OK",
  "timeelapsed": "2023-10-27T10:00:00.000Z"
}
```

### Endpoint de Procesamiento de Archivos

Inicia el procesamiento del archivo de clientes. Este endpoint responde inmediatamente, y el procesamiento se realiza en segundo plano.

```bash
POST http://localhost:3000/file/process
```

Respuesta esperada:
```json
{
  "message": "Procesamiento de archivo iniciado en segundo plano."
}
```

Puedes monitorear los logs del contenedor de la aplicación para ver el progreso del procesamiento:

```bash
docker-compose logs -f app
```

## Propuesta Técnica para Escalabilidad (Archivos 5 veces más grandes)

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
