# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Run the application
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copiar archivos necesarios desde el builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Copiar archivos de configuración
COPY .env.example ./.env.example
COPY ormconfig.ts ./ormconfig.ts

# Crear el directorio de entrada para el archivo de clientes
RUN mkdir -p challenge/input

EXPOSE 3000

CMD ["node", "--max-old-space-size=192", "dist/main"]
