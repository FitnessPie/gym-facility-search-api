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

type AmenityMatchMode = 'all' | 'any' | 'exact';

const ALLOWED_SORT_FIELDS = ['name', 'city', 'rating'];

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
    this.defaultPageSize =
      this.configService.get<number>('DEFAULT_PAGE_SIZE') ?? DEFAULT_PAGE_SIZE;
    this.maxPageSize =
      this.configService.get<number>('MAX_PAGE_SIZE') ?? MAX_PAGE_SIZE;

    this.logger.log('FacilitiesService initialised');
  }

  /**
   * Get facilities with optional filtering, sorting, and pagination
   */
  async getFacilities(
    queryDto: GetFacilitiesDto,
  ): Promise<PaginatedFacilitiesResponseDto> {
    const {
      name,
      amenities,
      amenityMatchMode = 'all',
      page = 1,
      limit: requestedLimit = this.defaultPageSize,
      sortBy = 'name',
      sortOrder = 'asc',
    } = queryDto;

    const safePage = Math.max(1, page);
    const limit = Math.min(
      Math.max(1, requestedLimit),
      this.maxPageSize,
    );

    const shouldCache = this.shouldCacheQuery(name, amenities, safePage);

    const cacheParams = {
      name,
      amenities,
      amenityMatchMode,
      page: safePage,
      limit,
      sortBy,
      sortOrder,
    };

    if (shouldCache) {
      const cacheKey = this.generateCacheKey(
        'facilities',
        cacheParams,
      );

      const cached =
        await this.cacheManager.get<PaginatedFacilitiesResponseDto>(
          cacheKey,
        );

      if (cached) {
        this.logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }
    }

    const mongoFilter = this.buildMongoFilter(
      name,
      amenities,
      amenityMatchMode,
    );

    const offset = this.calculateOffset(safePage, limit);
    const sortOptions = this.buildSortOptions(sortBy, sortOrder);

    const [facilities, totalCount] = await Promise.all([
      this.facilityModel
        .find(mongoFilter)
        .select(this.publicFieldsOnly())
        .sort(sortOptions)
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),

      this.facilityModel.countDocuments(mongoFilter).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const result: PaginatedFacilitiesResponseDto = {
      data: facilities as FacilityResponseDto[],
      meta: {
        total: totalCount,
        page: safePage,
        limit,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1,
      },
    };

    if (shouldCache) {
      const cacheKey = this.generateCacheKey(
        'facilities',
        cacheParams,
      );

      const ttl = this.getCacheTTL(name, amenities);
      await this.cacheManager.set(cacheKey, result, ttl);

      this.logger.debug(`Cached: ${cacheKey} (TTL ${ttl}s)`);
    }

    return result;
  }

  async getFacilityById(id: string): Promise<FacilityResponseDto> {
    const cacheKey = this.generateCacheKey('facility', { id });

    const cached =
      await this.cacheManager.get<FacilityResponseDto>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit: facility ${id}`);
      return cached;
    }

    const facility = await this.facilityModel
      .findOne({ id })
      .select(this.publicFieldsOnly())
      .lean()
      .exec();

    if (!facility) {
      this.logger.warn(`Facility not found: ${id}`);
      throw new NotFoundException(
        `Facility with ID "${id}" not found`,
      );
    }

    const dto = facility as FacilityResponseDto;

    await this.cacheManager.set(
      cacheKey,
      dto,
      CACHE_TTL_FACILITY_BY_ID,
    );

    return dto;
  }

  private calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  private buildMongoFilter(
    name?: string,
    amenities?: string[],
    amenityMatchMode: AmenityMatchMode = 'all',
  ): Record<string, any> {
    const filter: Record<string, any> = {};

    if (name) {
      filter.name = this.createCaseInsensitiveRegex(name);
    }

    if (amenities?.length) {
      const amenityRegexes = amenities.map(
        (a) => new RegExp(`^${this.escapeRegex(a)}$`, 'i'),
      );

      switch (amenityMatchMode) {
        case 'all':
          filter.amenities = { $all: amenityRegexes };
          break;

        case 'any':
          filter.amenities = { $in: amenityRegexes };
          break;

        case 'exact':
          filter.$and = [
            { amenities: { $all: amenityRegexes } },
            { amenities: { $size: amenities.length } },
          ];
          break;
      }
    }

    return filter;
  }

  private buildSortOptions(
    sortBy: string,
    sortOrder: string,
  ): Record<string, 1 | -1> {
    const field = ALLOWED_SORT_FIELDS.includes(sortBy)
      ? sortBy
      : 'name';

    return { [field]: sortOrder === 'asc' ? 1 : -1 };
  }

  private createCaseInsensitiveRegex(value: string) {
    return {
      $regex: this.escapeRegex(value),
      $options: 'i',
    };
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private publicFieldsOnly(): string {
    return '-_id -__v -createdAt -updatedAt';
  }

  private generateCacheKey(
    prefix: string,
    params: Record<string, any>,
  ): string {
    const normalised = this.normaliseParams(params);

    const serialized = Object.keys(normalised)
      .sort()
      .map((key) => `${key}:${normalised[key]}`)
      .join('|');

    return `${prefix}:${serialized}`;
  }

  private normaliseParams(
    params: Record<string, any>,
  ): Record<string, any> {
    return Object.fromEntries(
      Object.entries(params).map(([key, value]) => [
        key,
        Array.isArray(value) ? [...value].sort() : value,
      ]),
    );
  }

  private getCacheTTL(
    name?: string,
    amenities?: string[],
  ): number {
    return name || amenities?.length
      ? CACHE_TTL_LIST_WITH_FILTER
      : CACHE_TTL_LIST_NO_FILTER;
  }

  private shouldCacheQuery(
    name?: string,
    amenities?: string[],
    page = 1,
  ): boolean {
    if (!name && !amenities?.length && page <= 3) {
      return true;
    }

    if ((name || amenities?.length) && page <= 2) {
      return true;
    }

    return false;
  }
}
