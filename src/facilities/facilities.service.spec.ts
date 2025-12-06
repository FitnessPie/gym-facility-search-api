import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { FacilitiesService } from './facilities.service';
import { Facility } from './schemas/facility.schema';
import { NotFoundException } from '@nestjs/common';

describe('FacilitiesService', () => {
  let service: FacilitiesService;
  let mockFacilityModel: any;
  let mockCacheManager: any;

  const mockFacilities = [
    {
      id: 'facility-001',
      name: 'City Fitness Central',
      address: '123 Market St, Sydney, NSW 2000',
      location: { latitude: -33.8703, longitude: 151.208 },
      facilities: ['Pool', 'Sauna', '24/7 Access', 'Yoga Classes'],
    },
    {
      id: 'facility-002',
      name: 'City Health Club',
      address: '456 George St, Sydney, NSW 2000',
      location: { latitude: -33.8688, longitude: 151.2093 },
      facilities: ['Pool', 'Gym', 'Personal Training'],
    },
  ];

  beforeEach(async () => {
    mockFacilityModel = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      countDocuments: jest.fn(),
      distinct: jest.fn(),
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacilitiesService,
        {
          provide: getModelToken(Facility.name),
          useValue: mockFacilityModel,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                DEFAULT_PAGE_SIZE: 20,
                MAX_PAGE_SIZE: 100,
              };
              return config[key] ?? 20;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FacilitiesService>(FacilitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFacilities', () => {
    it('should return cached results if available', async () => {
      const cachedData = {
        data: mockFacilities,
        meta: { 
          total: 2, 
          page: 1, 
          limit: 20, 
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockCacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getFacilities({ name: 'City' });

      expect(result).toEqual(cachedData);
      expect(mockCacheManager.get).toHaveBeenCalled();
      expect(mockFacilityModel.find).not.toHaveBeenCalled();
    });

    it('should get facilities by name with partial matching', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockFacilityModel.exec.mockResolvedValue(mockFacilities);
      mockFacilityModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      const result = await service.getFacilities({ name: 'City' });

      expect(mockFacilityModel.find).toHaveBeenCalledWith({
        name: { $regex: 'City', $options: 'i' },
      });
      expect(result.data).toEqual(mockFacilities);
      expect(result.meta.total).toBe(2);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should filter by amenities when provided', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockFacilityModel.exec.mockResolvedValue([mockFacilities[0]]);
      mockFacilityModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      await service.getFacilities({
        name: 'City',
        amenities: ['Pool', 'Sauna'],
      });

      expect(mockFacilityModel.find).toHaveBeenCalledWith({
        name: { $regex: 'City', $options: 'i' },
        facilities: { $all: ['Pool', 'Sauna'] },
      });
    });

    it('should handle pagination correctly', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockFacilityModel.exec.mockResolvedValue([mockFacilities[1]]);
      mockFacilityModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      const result = await service.getFacilities({
        name: 'City',
        page: 2,
        limit: 1,
      });

      expect(mockFacilityModel.skip).toHaveBeenCalledWith(1);
      expect(mockFacilityModel.limit).toHaveBeenCalledWith(1);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should return all facilities when no name filter provided', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockFacilityModel.exec.mockResolvedValue(mockFacilities);
      mockFacilityModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      const result = await service.getFacilities({});

      expect(mockFacilityModel.find).toHaveBeenCalledWith({});
      expect(result.data).toEqual(mockFacilities);
    });
  });

  describe('getFacilityById', () => {
    it('should return cached facility if available', async () => {
      mockCacheManager.get.mockResolvedValue(mockFacilities[0]);

      const result = await service.getFacilityById('facility-001');

      expect(result).toEqual(mockFacilities[0]);
      expect(mockCacheManager.get).toHaveBeenCalled();
      expect(mockFacilityModel.findOne).not.toHaveBeenCalled();
    });

    it('should fetch facility from database and cache it', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockFacilityModel.exec.mockResolvedValue(mockFacilities[0]);

      const result = await service.getFacilityById('facility-001');

      expect(mockFacilityModel.findOne).toHaveBeenCalledWith({ id: 'facility-001' });
      expect(result).toEqual(mockFacilities[0]);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException if facility not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockFacilityModel.exec.mockResolvedValue(null);

      await expect(service.getFacilityById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
