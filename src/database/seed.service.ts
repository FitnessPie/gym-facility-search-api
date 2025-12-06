import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Facility } from '../facilities/schemas/facility.schema';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Facility.name) private facilityModel: Model<Facility>,
  ) {}

  async seed(): Promise<void> {
    const deletedCount = await this.clearExistingFacilities();
    const facilities = this.loadFacilitiesFromFile();
    await this.insertFacilitiesInBatches(facilities);
    
    this.logger.log(`Seeded ${facilities.length} facilities (cleared ${deletedCount} existing)`);
  }

  private async clearExistingFacilities(): Promise<number> {
    const deleteResult = await this.facilityModel.deleteMany({});
    return deleteResult.deletedCount;
  }

  private loadFacilitiesFromFile(): any[] {
    const facilitiesPath = path.join(__dirname, '../../assets/facilities.json');
    const fileContent = fs.readFileSync(facilitiesPath, 'utf8');
    return JSON.parse(fileContent);
  }

  private async insertFacilitiesInBatches(facilities: any[]): Promise<void> {
    const batchSize = 1000;

    for (let i = 0; i < facilities.length; i += batchSize) {
      const batch = facilities.slice(i, i + batchSize);
      await this.facilityModel.insertMany(batch);
    }
  }
}
