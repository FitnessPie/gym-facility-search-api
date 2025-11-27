import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { Facility, FacilityDocument } from './schemas/facility.schema';
import {
  GetFacilitiesDto,
  FacilityResponseDto,
  PaginatedFacilitiesResponseDto,
} from './dto/facilities.dto';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class FacilitiesService {
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;

  constructor(
    @InjectModel(Facility.name) private facilityModel: Model<FacilityDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.defaultPageSize = this.configService.get('DEFAULT_PAGE_SIZE') || DEFAULT_PAGE_SIZE;
    this.maxPageSize = this.configService.get('MAX_PAGE_SIZE') || MAX_PAGE_SIZE;
  }

  /**
   * Get facilities, with optional name and amenity filtering/pagination
   */
  async getFacilities(queryDto: GetFacilitiesDto): Promise<PaginatedFacilitiesResponseDto> {
    const { name, amenities, page = 1, limit: requestedLimit = this.defaultPageSize } = queryDto;
    const limit = Math.min(requestedLimit, this.maxPageSize);

    /** Caching queries for facilities that are frequently accessed */
    const cacheKey = this.generateCacheKey('facilities', { name, amenities, page, limit });
    const cachedResult = await this.cacheManager.get<PaginatedFacilitiesResponseDto>(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const mongoFilter = this.buildMongoFilter(name, amenities);
    const offsetForPagination = this.calculateOffset(page, limit);

    const [facilities, totalCount] = await Promise.all([
      this.facilityModel
        .find(mongoFilter)
        .select(this.publicFieldsOnly())
        .skip(offsetForPagination)
        .limit(limit)
        .lean()
        .exec(),
      this.facilityModel.countDocuments(mongoFilter).exec(),
    ]);

    const paginatedResult: PaginatedFacilitiesResponseDto = {
      data: facilities as FacilityResponseDto[],
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };

    await this.cacheManager.set(cacheKey, paginatedResult);

    return paginatedResult;
  }

  private calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  private buildMongoFilter(name?: string, amenities?: string[]): any {
    const filter: any = {};

    if (name) {
      filter.name = this.createCaseInsensitiveRegex(name);
    }

    if (amenities && amenities.length > 0) {
      filter.facilities = { $all: amenities };
    }

    return filter;
  }

  private createCaseInsensitiveRegex(searchTerm: string) {
    return { $regex: searchTerm, $options: 'i' };
  }

  private publicFieldsOnly() {
    return '-_id -__v -createdAt -updatedAt';
  }

  async getFacilityById(id: string): Promise<FacilityResponseDto> {
    const cacheKey = this.generateCacheKey('facility', { id });
    const cachedFacility = await this.cacheManager.get<FacilityResponseDto>(cacheKey);

    if (cachedFacility) {
      return cachedFacility;
    }

    const facility = await this.facilityModel
      .findOne({ id })
      .select(this.publicFieldsOnly())
      .lean()
      .exec();

    if (!facility) {
      throw new NotFoundException(`Facility with ID "${id}" not found`);
    }

    const facilityDto = facility as FacilityResponseDto;
    await this.cacheManager.set(cacheKey, facilityDto);

    return facilityDto;
  }

  private generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }
}
