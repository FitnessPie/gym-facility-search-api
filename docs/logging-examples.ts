import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ExampleService {
  private readonly logger = new Logger(ExampleService.name);

  async processData(userId: string) {
    // ❌ BAD: Logging everything
    this.logger.log(`Starting process for user ${userId}`);
    this.logger.log('Fetching user data');
    this.logger.log('Validating data');
    this.logger.log('Saving to database');
    this.logger.log('Process complete');

    // ✅ GOOD: Log only important events
    this.logger.log(`Processing data for user: ${userId}`);
    
    try {
      const result = await this.saveData(userId);
      // Only log on success if significant
      this.logger.log(`Data processed successfully for user: ${userId}`);
      return result;
    } catch (error) {
      // Always log errors with context
      this.logger.error(
        `Failed to process data for user: ${userId}`,
        error.stack,
      );
      throw error;
    }
  }

  // Use debug for detailed tracing (disabled in production)
  async detailedOperation() {
    this.logger.debug('Step 1: Initializing');
    this.logger.debug('Step 2: Processing');
    this.logger.debug('Step 3: Finalizing');
  }
}
