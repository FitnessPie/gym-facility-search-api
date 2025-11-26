import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type FacilityDocument = Facility & Document;

class Location {
  @ApiProperty()
  @Prop({ required: true })
  latitude: number;

  @ApiProperty()
  @Prop({ required: true })
  longitude: number;
}

@Schema({ timestamps: true, collection: 'facilities' })
export class Facility {
  @ApiProperty()
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @ApiProperty()
  @Prop({ required: true, index: 'text' })
  name: string;

  @ApiProperty()
  @Prop({ required: true })
  address: string;

  @ApiProperty()
  @Prop({ type: Location, required: true, index: '2dsphere' })
  location: Location;

  @ApiProperty()
  @Prop({ type: [String], required: true, index: true })
  facilities: string[];
}

export const FacilitySchema = SchemaFactory.createForClass(Facility);

FacilitySchema.index({ name: 'text' });
FacilitySchema.index({ facilities: 1, name: 1 });
