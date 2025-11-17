# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npm run build

# Stage 2: Run the application
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY .env.example ./.env.example # Copiar el .env.example para referencia
COPY ormconfig.ts ./ormconfig.ts # Necesario para TypeORM CLI si se ejecuta dentro del contenedor

# Crear el directorio de entrada para el archivo de clientes
RUN mkdir -p challenge/input

EXPOSE 3000

CMD ["node", "dist/main"]
