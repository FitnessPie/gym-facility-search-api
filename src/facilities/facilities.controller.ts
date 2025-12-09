import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FacilitiesService } from './facilities.service';
import {
  GetFacilitiesDto,
  FacilityResponseDto,
  PaginatedFacilitiesResponseDto,
} from './dto/facilities.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('facilities')
@Controller('facilities')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get facilities',
    description:
      'Retrieve facilities with optional filtering by name (partial matching) and amenities. Returns paginated results. Optimized for 100,000+ facilities with caching.',
  })
  @ApiResponse({
    status: 200,
    description: 'Facilities retrieved successfully',
    type: PaginatedFacilitiesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Valid JWT token required',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async getFacilities(
    @Query() queryDto: GetFacilitiesDto, // DTO for query parameters
  ): Promise<PaginatedFacilitiesResponseDto> {
    return this.facilitiesService.getFacilities(queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get facility by ID',
    description:
      'Retrieve a single facility with complete details including name, address, coordinates, and amenities.',
  })
  @ApiResponse({
    status: 200,
    description: 'Facility retrieved successfully',
    type: FacilityResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Valid JWT token required',
  })
  @ApiResponse({
    status: 404,
    description: 'Facility not found',
  })
  async getFacilityById(@Param('id') id: string): Promise<FacilityResponseDto> {
    return this.facilitiesService.getFacilityById(id);
  }
}
