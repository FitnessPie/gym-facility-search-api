import { IsString, IsOptional, IsNumber, Min, Max, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum SortField {
  NAME = 'name',
  ID = 'id',
}

export enum AmenityMatchMode {
  ALL = 'all',      // Facility must have all specified amenities
  ANY = 'any',      // Facility must have at least one amenity
  EXACT = 'exact',  // Facility must have exactly these amenities (no more, no less)
}

export class GetFacilitiesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Filter by amenities (case-insensitive). Can be a single value or multiple values',
    example: ['Pool', 'Gym']
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    enum: AmenityMatchMode,
    default: AmenityMatchMode.ALL,
    description: 'How to match amenities: "all" (must have all), "any" (at least one), "exact" (exactly these)',
  })
  @IsOptional()
  @IsEnum(AmenityMatchMode)
  amenityMatchMode?: AmenityMatchMode = AmenityMatchMode.ALL;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: SortField, default: SortField.NAME })
  @IsOptional()
  @IsEnum(SortField)
  sortBy?: SortField = SortField.NAME;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;
}

export class FacilityResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  location: {
    latitude: number;
    longitude: number;
  };

  @ApiProperty()
  facilities: string[];
}

export class PaginatedFacilitiesResponseDto {
  @ApiProperty({ type: [FacilityResponseDto] })
  data: FacilityResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
