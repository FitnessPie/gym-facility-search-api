import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Facility } from '../facilities/schemas/facility.schema';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const facilityModel = app.get<Model<Facility>>(getModelToken(Facility.name));

  await clearExistingFacilities(facilityModel);
  const facilities = loadFacilitiesFromFile();
  await insertFacilitiesInBatches(facilityModel, facilities);
  displayStatistics(facilities.length);

  await app.close();
}

async function clearExistingFacilities(model: Model<Facility>): Promise<void> {
  const deleteResult = await model.deleteMany({});
  console.log(`Cleared ${deleteResult.deletedCount} existing facilities`);
}

function loadFacilitiesFromFile(): any[] {
  const facilitiesPath = path.join(__dirname, '../../assets/facilities.json');
  const fileContent = fs.readFileSync(facilitiesPath, 'utf8');
  return JSON.parse(fileContent);
}

async function insertFacilitiesInBatches(
  model: Model<Facility>,
  facilities: any[],
): Promise<void> {
  const batchSize = 1000;
  
  for (let i = 0; i < facilities.length; i += batchSize) {
    const batch = facilities.slice(i, i + batchSize);
    await model.insertMany(batch);
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} facilities)`);
  }
}

function displayStatistics(total: number): void {
  console.log('\n✅ Seeding completed successfully!');
  console.log(`📊 Total facilities seeded: ${total}`);
}

bootstrap().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
