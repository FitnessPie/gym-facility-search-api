import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
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
const CACHE_TTL_FACILITY_BY_ID = 3600;
const CACHE_TTL_LIST_NO_FILTER = 1800;
const CACHE_TTL_LIST_WITH_FILTER = 600;

@Injectable()
export class FacilitiesService {
  private readonly logger = new Logger(FacilitiesService.name);
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;

  constructor(
    @InjectModel(Facility.name) private facilityModel: Model<FacilityDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.defaultPageSize = this.configService.get('DEFAULT_PAGE_SIZE') || DEFAULT_PAGE_SIZE;
    this.maxPageSize = this.configService.get('MAX_PAGE_SIZE') || MAX_PAGE_SIZE;
    this.logger.log('FacilitiesService initialized');
  }

  /**
   * Get facilities, with optional name and amenity filtering and pagination
   */
  async getFacilities(queryDto: GetFacilitiesDto): Promise<PaginatedFacilitiesResponseDto> {
    const {
      name,
      amenities,
      amenityMatchMode = 'all',
      page = 1,
      limit: requestedLimit = this.defaultPageSize,
      sortBy = 'name',
      sortOrder = 'asc',
    } = queryDto;
    const limit = Math.min(requestedLimit, this.maxPageSize);

    const shouldCache = this.shouldCacheQuery(name, amenities, page);

    if (shouldCache) {
      const cacheKey = this.generateCacheKey('facilities', {
        name,
        amenities,
        amenityMatchMode,
        page,
        limit,
        sortBy,
        sortOrder
      });
      const cachedResult = await this.cacheManager.get<PaginatedFacilitiesResponseDto>(cacheKey);

      if (cachedResult) {
        this.logger.debug(`Cache hit for query: ${cacheKey}`);
        return cachedResult;
      }
    }

    const mongoFilter = this.buildMongoFilter(name, amenities, amenityMatchMode);
    const offsetForPagination = this.calculateOffset(page, limit);
    const sortOptions = this.buildSortOptions(sortBy, sortOrder);

    const [facilities, totalCount] = await Promise.all([
      this.facilityModel
        .find(mongoFilter)
        .select(this.publicFieldsOnly())
        .sort(sortOptions)
        .skip(offsetForPagination)
        .limit(limit)
        .lean() // Get plain JS objects to increase performance when we have large datasets
        .exec(),
      this.facilityModel.countDocuments(mongoFilter).exec(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const paginatedResult: PaginatedFacilitiesResponseDto = {
      data: facilities as FacilityResponseDto[],
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };

    if (shouldCache) {
      const cacheKey = this.generateCacheKey('facilities', {
        name,
        amenities,
        page,
        limit,
        sortBy,
        sortOrder
      });
      const cacheTTL = this.getCacheTTL(name, amenities);
      await this.cacheManager.set(cacheKey, paginatedResult, cacheTTL);
      this.logger.debug(`Cached query result: ${cacheKey}, TTL: ${cacheTTL}s`);
    }

    this.logger.log(`Retrieved ${facilities.length} facilities (page ${page}/${totalPages})`);
    return paginatedResult;
  }

  private calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  private buildMongoFilter(name?: string, amenities?: string[], amenityMatchMode: string = 'all'): any {
    const filter: any = {};

    if (name) {
      filter.name = this.createCaseInsensitiveRegex(name);
    }

    if (amenities && amenities.length > 0) {
      // Case-insensitive amenity matching
      const amenityRegexes = amenities.map((amenity) => new RegExp(`^${amenity}$`, 'i'));

      switch (amenityMatchMode) {
        case 'all':
          // Must have all specified amenities (case-insensitive)
          filter.facilities = { $all: amenityRegexes };
          break;
        case 'any':
          // Must have at least one of the specified amenities
          filter.facilities = { $in: amenityRegexes };
          break;
        case 'exact':
          // Must have exactly these amenities (no more, no less)
          filter.$and = [
            { facilities: { $all: amenityRegexes } },
            { facilities: { $size: amenities.length } }
          ];
          break;
      }
    }

    return filter;
  }

  private buildSortOptions(sortBy: string, sortOrder: string): Record<string, 1 | -1> {
    return { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  }

  private createCaseInsensitiveRegex(searchTerm: string) {
    const sanitized = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { $regex: sanitized, $options: 'i' };
  }

  private publicFieldsOnly() {
    return '-_id -__v -createdAt -updatedAt';
  }

  async getFacilityById(id: string): Promise<FacilityResponseDto> {
    const cacheKey = this.generateCacheKey('facility', { id });
    const cachedFacility = await this.cacheManager.get<FacilityResponseDto>(cacheKey);

    if (cachedFacility) {
      this.logger.debug(`Cache hit for facility: ${id}`);
      return cachedFacility;
    }

    const facility = await this.facilityModel
      .findOne({ id })
      .select(this.publicFieldsOnly())
      .lean() // https://bsky.app/profile/pierrehenry.dev/post/3m7jpisawbe2i
      .exec();

    if (!facility) {
      this.logger.warn(`Facility not found: ${id}`);
      throw new NotFoundException(`Facility with ID "${id}" not found`);
    }

    const facilityDto = facility as FacilityResponseDto;
    await this.cacheManager.set(cacheKey, facilityDto, CACHE_TTL_FACILITY_BY_ID);
    this.logger.debug(`Cached facility: ${id}`);

    return facilityDto;
  }

  private generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  private getCacheTTL(name?: string, amenities?: string[]): number {
    if (name || (amenities && amenities.length > 0)) {
      return CACHE_TTL_LIST_WITH_FILTER;
    }
    return CACHE_TTL_LIST_NO_FILTER;
  }

  private shouldCacheQuery(name?: string, amenities?: string[], page: number = 1): boolean {
    if (!name && (!amenities || amenities.length === 0) && page <= 3) {
      return true;
    }

    if ((name || amenities) && page <= 2) {
      return true;
    }

    return false;
  }
}
