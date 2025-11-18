import fs from 'fs';
import path from 'path';
import { faker } from '@faker-js/faker';

const FILE_PATH = path.resolve(__dirname, '../file-processor/CLIENTES_IN_0425.dat');
const RECORDS = 50000;
const ERROR_RATE = 0.2; // 20% de líneas con errores intencionales, puedes modificarlo para tus pruebas.

// Asegurarse de que el directorio exista
const dir = path.dirname(FILE_PATH);
fs.mkdirSync(dir, { recursive: true });

const stream = fs.createWriteStream(FILE_PATH);

for (let i = 0; i < RECORDS; i++) {
  const isCorrupted = Math.random() < ERROR_RATE;

  let nombre = faker.person.firstName();
  let apellido = faker.person.lastName();
  let dni = faker.number.int({ min: 10000000, max: 99999999 });
  let estado = faker.helpers.arrayElement(['Activo', 'Inactivo']);
  let fechaIngreso = '';
  let esPep: string | boolean = faker.datatype.boolean();
  let esSujetoObligado: string | boolean = faker.datatype.boolean();

  if (isCorrupted) {
    const corruptionType = faker.number.int({ min: 1, max: 3 });

    switch (corruptionType) {
      case 1:
        fechaIngreso = faker.helpers.arrayElement(['0000-00-00', '99/99/9999', '']);
        break;
      case 2:
        esPep = '';
        esSujetoObligado = '';
        fechaIngreso = faker.date.past({ years: 10 }).toLocaleDateString('en-US');
        break;
      case 3:
        nombre = faker.lorem.words(50);
        apellido = faker.lorem.words(50);
        fechaIngreso = faker.date.past({ years: 10 }).toLocaleDateString('en-US');
        break;
    }
  } else {
    fechaIngreso = faker.date.past({ years: 10 }).toLocaleDateString('en-US');
  }

  const linea = `${nombre}|${apellido}|${dni}|${estado}|${fechaIngreso}|${esPep}|${esSujetoObligado}\n`;
  stream.write(linea);
}

stream.end(() => {
  console.log(`✅ Archivo generado con ${RECORDS} líneas (con errores intencionales: ~${Math.floor(RECORDS * ERROR_RATE)}) en: ${FILE_PATH}`);
});