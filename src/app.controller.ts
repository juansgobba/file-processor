import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'; // Importar decoradores de Swagger

@ApiTags('Health') // Agrega una etiqueta para agrupar endpoints en Swagger UI
@Controller("health")
export class AppController {

  @Get()
  @ApiOperation({ summary: 'Verifica el estado de salud del servicio' }) // Descripción de la operación
  @ApiResponse({ status: 200, description: 'El servicio está operativo.' }) // Respuesta exitosa
  async healtCheck(): Promise<{ status: string; timeelapsed: Date }> {
    return {
      status: "OK",
      timeelapsed: new Date(),
    }
  }
}
