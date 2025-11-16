import { Controller, Get } from '@nestjs/common';

@Controller("health")
export class AppController {

  @Get()
  async healtCheck(): Promise<{ status: string; timeelapsed: Date }> {
    return {
      status: "OK",
      timeelapsed: new Date(),
    }
  }
}
