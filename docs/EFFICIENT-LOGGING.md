# Efficient Logging Implementation Guide

## 🎯 Logging Best Practices

### **1. Log Levels Hierarchy**

```typescript
logger.error()   // ❗ Critical errors that need immediate attention
logger.warn()    // ⚠️  Warning conditions that might become errors
logger.log()     // ℹ️  Important business events
logger.debug()   // 🔍 Detailed diagnostic information
logger.verbose() // 📝 Most detailed tracing
```

### **2. What to Log at Each Level**

#### **ERROR** - Production Critical
```typescript
// ✅ Database connection failures
// ✅ Third-party API failures
// ✅ Unexpected exceptions
// ✅ Data corruption issues

try {
  await this.saveToDatabase(data);
} catch (error) {
  this.logger.error(`Failed to save data: ${error.message}`, error.stack);
  throw error;
}
```

#### **WARN** - Potential Issues
```typescript
// ✅ Invalid user input (caught by validation)
// ✅ Rate limit approaching
// ✅ Deprecated API usage
// ✅ Cache miss on expected hit

if (!cachedData) {
  this.logger.warn(`Cache miss for key: ${key}`);
}

if (password.length < MIN_LENGTH) {
  this.logger.warn('Login attempt with invalid password length');
}
```

#### **LOG** - Business Events
```typescript
// ✅ User authentication
// ✅ Important CRUD operations
// ✅ Service initialization
// ✅ Significant state changes

this.logger.log(`User logged in: ${email}`);
this.logger.log(`Retrieved ${count} facilities (page ${page}/${totalPages})`);
this.logger.log('FacilitiesService initialized');
```

#### **DEBUG** - Development Details
```typescript
// ✅ Cache operations
// ✅ Query performance
// ✅ Internal state transitions
// ✅ Detailed flow tracing

this.logger.debug(`Cache hit for query: ${cacheKey}`);
this.logger.debug(`MongoDB query took ${duration}ms`);
this.logger.debug(`Cached facility: ${id}`);
```

---

## 🚀 Performance Optimization

### **1. Conditional Logging**

```typescript
// ❌ BAD: Always creates string even if debug is disabled
this.logger.debug(`Expensive operation: ${JSON.stringify(largeObject)}`);

// ✅ GOOD: Check if level is enabled first (future optimization)
if (process.env.LOG_LEVEL === 'debug') {
  this.logger.debug(`Expensive operation: ${JSON.stringify(largeObject)}`);
}
```

### **2. Log Level Configuration**

```typescript
// main.ts - Environment-based configuration
const app = await NestFactory.create(AppModule, {
  logger: process.env.NODE_ENV === 'production' 
    ? ['error', 'warn', 'log']           // Production: Essential only
    : ['error', 'warn', 'log', 'debug'], // Development: Include debug
});
```

### **3. Avoid Logging in Loops**

```typescript
// ❌ BAD: Logs every iteration (spam!)
facilities.forEach(facility => {
  this.logger.log(`Processing facility: ${facility.id}`);
  this.process(facility);
});

// ✅ GOOD: Log summary
this.logger.log(`Processing ${facilities.length} facilities`);
facilities.forEach(facility => this.process(facility));
this.logger.log(`Processed ${facilities.length} facilities successfully`);
```

---

## 📊 Real-World Examples

### **Example 1: FacilitiesService**

```typescript
@Injectable()
export class FacilitiesService {
  private readonly logger = new Logger(FacilitiesService.name);

  constructor(/* ... */) {
    // Log service initialization
    this.logger.log('FacilitiesService initialized');
  }

  async getFacilities(queryDto: GetFacilitiesDto) {
    // Debug: Cache hits (only in development)
    if (cachedResult) {
      this.logger.debug(`Cache hit for query: ${cacheKey}`);
      return cachedResult;
    }

    // Execute query...
    const [facilities, totalCount] = await Promise.all([...]);

    // Log: Important business metric
    this.logger.log(`Retrieved ${facilities.length} facilities (page ${page}/${totalPages})`);

    // Debug: Cache operations
    if (shouldCache) {
      this.logger.debug(`Cached query result: ${cacheKey}, TTL: ${cacheTTL}s`);
    }

    return paginatedResult;
  }

  async getFacilityById(id: string) {
    // Debug: Cache hit
    if (cachedFacility) {
      this.logger.debug(`Cache hit for facility: ${id}`);
      return cachedFacility;
    }

    const facility = await this.facilityModel.findOne({ id }).exec();

    // Warn: Resource not found (not error - expected behavior)
    if (!facility) {
      this.logger.warn(`Facility not found: ${id}`);
      throw new NotFoundException(`Facility with ID "${id}" not found`);
    }

    return facilityDto;
  }
}
```

### **Example 2: AuthService**

```typescript
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async login(loginDto: LoginDto) {
    this.validateCredentials(password);
    const user = this.createMockUser(email);
    const token = this.generateJwtToken(user);

    // Log: Successful authentication (important business event)
    this.logger.log(`User logged in: ${email}`);
    
    return { token, user };
  }

  private validateCredentials(password: string) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      // Warn: Invalid attempt (security monitoring)
      this.logger.warn('Login attempt with invalid password length');
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      // Warn: Invalid token (might be attack, might be expired)
      this.logger.warn('Invalid token verification attempt');
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

---

## 🎯 Production Configuration

### **environment-based logging**

```typescript
// .env.development
LOG_LEVEL=debug
NODE_ENV=development

// .env.production
LOG_LEVEL=log
NODE_ENV=production
```

```typescript
// main.ts
const logLevels = {
  production: ['error', 'warn', 'log'],
  development: ['error', 'warn', 'log', 'debug', 'verbose'],
  test: ['error', 'warn'],
};

const app = await NestFactory.create(AppModule, {
  logger: logLevels[process.env.NODE_ENV] || logLevels.development,
});
```

---

## 📈 Monitoring Integration

### **Structured Context**

```typescript
// Add context to logs for better filtering
this.logger.log(`User logged in`, {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
  ip: req.ip,
});
```

### **Performance Tracking**

```typescript
async getFacilities(queryDto: GetFacilitiesDto) {
  const startTime = Date.now();
  
  try {
    const result = await this.executeLongQuery();
    const duration = Date.now() - startTime;
    
    // Log slow queries
    if (duration > 1000) {
      this.logger.warn(`Slow query detected: ${duration}ms for ${queryDto.name}`);
    } else {
      this.logger.debug(`Query completed in ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    this.logger.error(`Query failed after ${duration}ms`, error.stack);
    throw error;
  }
}
```

---

## ✅ Quick Reference

### **What NOT to Log**

```typescript
// ❌ DON'T log passwords
this.logger.log(`Login: ${email} with password ${password}`);

// ❌ DON'T log sensitive data
this.logger.log(`Credit card: ${creditCard}`);

// ❌ DON'T log PII without anonymization
this.logger.log(`User details: ${JSON.stringify(user)}`);

// ❌ DON'T log in hot paths (high-frequency loops)
for (let i = 0; i < 1000000; i++) {
  this.logger.log(`Processing item ${i}`);
}
```

### **What TO Log**

```typescript
// ✅ DO log business events
this.logger.log(`Order placed: ${orderId} by user: ${userId}`);

// ✅ DO log errors with context
this.logger.error(`Payment failed for order ${orderId}`, error.stack);

// ✅ DO log security events
this.logger.warn(`Failed login attempt for email: ${email}`);

// ✅ DO log performance issues
this.logger.warn(`Slow query: ${queryTime}ms for ${endpoint}`);
```

---

## 🎤 Interview Talking Points

> "I use NestJS Logger with context-based logging - every log shows its source like [FacilitiesService] or [AuthService]. I follow a clear hierarchy: error for critical issues, warn for potential problems like 404s or failed auth, log for important business events, and debug for development tracing. In production, I disable debug/verbose to reduce noise and improve performance. For high-traffic systems, I'd add structured logging with Pino for machine-readable JSON that integrates with CloudWatch or Datadog."

**This demonstrates:**
- ✅ Production mindset
- ✅ Performance awareness
- ✅ Security considerations  
- ✅ Upgrade path knowledge

---

## 📊 Current Implementation

Your API now has efficient logging:

- ✅ **FacilitiesService**: Logs queries, cache hits/misses, 404s
- ✅ **AuthService**: Logs successful logins, invalid auth attempts
- ✅ **SeedService**: Logs seeding results
- ✅ **Bootstrap**: Logs startup info
- ✅ **Lambda**: Logs serverless initialization

**Test it:**
```bash
# Start API
yarn start:dev

# Watch logs for:
# [Bootstrap] Application is running...
# [FacilitiesService] FacilitiesService initialized
# [AuthService] User logged in: test@example.com
# [FacilitiesService] Retrieved 20 facilities (page 1/5)
```

Your logging is production-ready and follows senior engineer best practices! 🚀
