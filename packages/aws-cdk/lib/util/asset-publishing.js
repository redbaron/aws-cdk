"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishAssets = void 0;
const cxapi = require("@aws-cdk/cx-api");
const cdk_assets = require("cdk-assets");
const api_1 = require("../api");
const logging_1 = require("../logging");
/**
 * Use cdk-assets to publish all assets in the given manifest.
 */
async function publishAssets(manifest, sdk, targetEnv) {
    // This shouldn't really happen (it's a programming error), but we don't have
    // the types here to guide us. Do an runtime validation to be super super sure.
    if (targetEnv.account === undefined || targetEnv.account === cxapi.UNKNOWN_ACCOUNT
        || targetEnv.region === undefined || targetEnv.account === cxapi.UNKNOWN_REGION) {
        throw new Error(`Asset publishing requires resolved account and region, got ${JSON.stringify(targetEnv)}`);
    }
    const publisher = new cdk_assets.AssetPublishing(manifest, {
        aws: new PublishingAws(sdk, targetEnv),
        progressListener: new PublishingProgressListener(),
        throwOnError: false,
    });
    await publisher.publish();
    if (publisher.hasFailures) {
        throw new Error('Failed to publish one or more assets. See the error messages above for more information.');
    }
}
exports.publishAssets = publishAssets;
class PublishingAws {
    constructor(
    /**
     * The base SDK to work with
     */
    aws, 
    /**
     * Environment where the stack we're deploying is going
     */
    targetEnv) {
        this.aws = aws;
        this.targetEnv = targetEnv;
    }
    async discoverDefaultRegion() {
        return this.targetEnv.region;
    }
    async discoverCurrentAccount() {
        return (await this.sdk({})).currentAccount();
    }
    async s3Client(options) {
        return (await this.sdk(options)).s3();
    }
    async ecrClient(options) {
        return (await this.sdk(options)).ecr();
    }
    /**
     * Get an SDK appropriate for the given client options
     */
    sdk(options) {
        var _a;
        const env = {
            ...this.targetEnv,
            region: (_a = options.region) !== null && _a !== void 0 ? _a : this.targetEnv.region,
        };
        return this.aws.forEnvironment(env, api_1.Mode.ForWriting, {
            assumeRoleArn: options.assumeRoleArn,
            assumeRoleExternalId: options.assumeRoleExternalId,
        });
    }
}
const EVENT_TO_LOGGER = {
    build: logging_1.debug,
    cached: logging_1.debug,
    check: logging_1.debug,
    debug: logging_1.debug,
    fail: logging_1.error,
    found: logging_1.debug,
    start: logging_1.print,
    success: logging_1.print,
    upload: logging_1.debug,
};
class PublishingProgressListener {
    onPublishEvent(type, event) {
        EVENT_TO_LOGGER[type](`[${event.percentComplete}%] ${type}: ${event.message}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtcHVibGlzaGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFzc2V0LXB1Ymxpc2hpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUNBQXlDO0FBRXpDLHlDQUF5QztBQUN6QyxnQ0FBaUQ7QUFDakQsd0NBQWlEO0FBRWpEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGFBQWEsQ0FBQyxRQUFrQyxFQUFFLEdBQWdCLEVBQUUsU0FBNEI7SUFDcEgsNkVBQTZFO0lBQzdFLCtFQUErRTtJQUMvRSxJQUFJLFNBQVMsQ0FBQyxPQUFPLEtBQUssU0FBUyxJQUFJLFNBQVMsQ0FBQyxPQUFPLEtBQUssS0FBSyxDQUFDLGVBQWU7V0FDN0UsU0FBUyxDQUFDLE1BQU0sS0FBSyxTQUFTLElBQUksU0FBUyxDQUFDLE9BQU8sS0FBSyxLQUFLLENBQUMsY0FBYyxFQUFFO1FBQ2pGLE1BQU0sSUFBSSxLQUFLLENBQUMsOERBQThELElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQzVHO0lBRUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRTtRQUN6RCxHQUFHLEVBQUUsSUFBSSxhQUFhLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQztRQUN0QyxnQkFBZ0IsRUFBRSxJQUFJLDBCQUEwQixFQUFFO1FBQ2xELFlBQVksRUFBRSxLQUFLO0tBQ3BCLENBQUMsQ0FBQztJQUNILE1BQU0sU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzFCLElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRTtRQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLDBGQUEwRixDQUFDLENBQUM7S0FDN0c7QUFDSCxDQUFDO0FBakJELHNDQWlCQztBQUVELE1BQU0sYUFBYTtJQUNqQjtJQUNFOztPQUVHO0lBQ2MsR0FBZ0I7SUFFakM7O09BRUc7SUFDYyxTQUE0QjtRQUw1QixRQUFHLEdBQUgsR0FBRyxDQUFhO1FBS2hCLGNBQVMsR0FBVCxTQUFTLENBQW1CO0lBQy9DLENBQUM7SUFFTSxLQUFLLENBQUMscUJBQXFCO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFDL0IsQ0FBQztJQUVNLEtBQUssQ0FBQyxzQkFBc0I7UUFDakMsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO0lBQy9DLENBQUM7SUFFTSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQWlDO1FBQ3JELE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0lBRU0sS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFpQztRQUN0RCxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssR0FBRyxDQUFDLE9BQWlDOztRQUMzQyxNQUFNLEdBQUcsR0FBRztZQUNWLEdBQUcsSUFBSSxDQUFDLFNBQVM7WUFDakIsTUFBTSxRQUFFLE9BQU8sQ0FBQyxNQUFNLG1DQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTTtTQUNoRCxDQUFDO1FBRUYsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsVUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNuRCxhQUFhLEVBQUUsT0FBTyxDQUFDLGFBQWE7WUFDcEMsb0JBQW9CLEVBQUUsT0FBTyxDQUFDLG9CQUFvQjtTQUNuRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLGVBQWUsR0FBc0Q7SUFDekUsS0FBSyxFQUFFLGVBQUs7SUFDWixNQUFNLEVBQUUsZUFBSztJQUNiLEtBQUssRUFBRSxlQUFLO0lBQ1osS0FBSyxFQUFMLGVBQUs7SUFDTCxJQUFJLEVBQUUsZUFBSztJQUNYLEtBQUssRUFBRSxlQUFLO0lBQ1osS0FBSyxFQUFFLGVBQUs7SUFDWixPQUFPLEVBQUUsZUFBSztJQUNkLE1BQU0sRUFBRSxlQUFLO0NBQ2QsQ0FBQztBQUVGLE1BQU0sMEJBQTBCO0lBQ3ZCLGNBQWMsQ0FBQyxJQUEwQixFQUFFLEtBQWtDO1FBQ2xGLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxlQUFlLE1BQU0sSUFBSSxLQUFLLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGN4YXBpIGZyb20gJ0Bhd3MtY2RrL2N4LWFwaSc7XG5pbXBvcnQgKiBhcyBBV1MgZnJvbSAnYXdzLXNkayc7XG5pbXBvcnQgKiBhcyBjZGtfYXNzZXRzIGZyb20gJ2Nkay1hc3NldHMnO1xuaW1wb3J0IHsgSVNESywgTW9kZSwgU2RrUHJvdmlkZXIgfSBmcm9tICcuLi9hcGknO1xuaW1wb3J0IHsgZGVidWcsIGVycm9yLCBwcmludCB9IGZyb20gJy4uL2xvZ2dpbmcnO1xuXG4vKipcbiAqIFVzZSBjZGstYXNzZXRzIHRvIHB1Ymxpc2ggYWxsIGFzc2V0cyBpbiB0aGUgZ2l2ZW4gbWFuaWZlc3QuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwdWJsaXNoQXNzZXRzKG1hbmlmZXN0OiBjZGtfYXNzZXRzLkFzc2V0TWFuaWZlc3QsIHNkazogU2RrUHJvdmlkZXIsIHRhcmdldEVudjogY3hhcGkuRW52aXJvbm1lbnQpIHtcbiAgLy8gVGhpcyBzaG91bGRuJ3QgcmVhbGx5IGhhcHBlbiAoaXQncyBhIHByb2dyYW1taW5nIGVycm9yKSwgYnV0IHdlIGRvbid0IGhhdmVcbiAgLy8gdGhlIHR5cGVzIGhlcmUgdG8gZ3VpZGUgdXMuIERvIGFuIHJ1bnRpbWUgdmFsaWRhdGlvbiB0byBiZSBzdXBlciBzdXBlciBzdXJlLlxuICBpZiAodGFyZ2V0RW52LmFjY291bnQgPT09IHVuZGVmaW5lZCB8fCB0YXJnZXRFbnYuYWNjb3VudCA9PT0gY3hhcGkuVU5LTk9XTl9BQ0NPVU5UXG4gICAgfHwgdGFyZ2V0RW52LnJlZ2lvbiA9PT0gdW5kZWZpbmVkIHx8IHRhcmdldEVudi5hY2NvdW50ID09PSBjeGFwaS5VTktOT1dOX1JFR0lPTikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXQgcHVibGlzaGluZyByZXF1aXJlcyByZXNvbHZlZCBhY2NvdW50IGFuZCByZWdpb24sIGdvdCAke0pTT04uc3RyaW5naWZ5KHRhcmdldEVudil9YCk7XG4gIH1cblxuICBjb25zdCBwdWJsaXNoZXIgPSBuZXcgY2RrX2Fzc2V0cy5Bc3NldFB1Ymxpc2hpbmcobWFuaWZlc3QsIHtcbiAgICBhd3M6IG5ldyBQdWJsaXNoaW5nQXdzKHNkaywgdGFyZ2V0RW52KSxcbiAgICBwcm9ncmVzc0xpc3RlbmVyOiBuZXcgUHVibGlzaGluZ1Byb2dyZXNzTGlzdGVuZXIoKSxcbiAgICB0aHJvd09uRXJyb3I6IGZhbHNlLFxuICB9KTtcbiAgYXdhaXQgcHVibGlzaGVyLnB1Ymxpc2goKTtcbiAgaWYgKHB1Ymxpc2hlci5oYXNGYWlsdXJlcykge1xuICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHB1Ymxpc2ggb25lIG9yIG1vcmUgYXNzZXRzLiBTZWUgdGhlIGVycm9yIG1lc3NhZ2VzIGFib3ZlIGZvciBtb3JlIGluZm9ybWF0aW9uLicpO1xuICB9XG59XG5cbmNsYXNzIFB1Ymxpc2hpbmdBd3MgaW1wbGVtZW50cyBjZGtfYXNzZXRzLklBd3Mge1xuICBjb25zdHJ1Y3RvcihcbiAgICAvKipcbiAgICAgKiBUaGUgYmFzZSBTREsgdG8gd29yayB3aXRoXG4gICAgICovXG4gICAgcHJpdmF0ZSByZWFkb25seSBhd3M6IFNka1Byb3ZpZGVyLFxuXG4gICAgLyoqXG4gICAgICogRW52aXJvbm1lbnQgd2hlcmUgdGhlIHN0YWNrIHdlJ3JlIGRlcGxveWluZyBpcyBnb2luZ1xuICAgICAqL1xuICAgIHByaXZhdGUgcmVhZG9ubHkgdGFyZ2V0RW52OiBjeGFwaS5FbnZpcm9ubWVudCkge1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGRpc2NvdmVyRGVmYXVsdFJlZ2lvbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiB0aGlzLnRhcmdldEVudi5yZWdpb247XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGlzY292ZXJDdXJyZW50QWNjb3VudCgpOiBQcm9taXNlPGNka19hc3NldHMuQWNjb3VudD4ge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5zZGsoe30pKS5jdXJyZW50QWNjb3VudCgpO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHMzQ2xpZW50KG9wdGlvbnM6IGNka19hc3NldHMuQ2xpZW50T3B0aW9ucyk6IFByb21pc2U8QVdTLlMzPiB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLnNkayhvcHRpb25zKSkuczMoKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBlY3JDbGllbnQob3B0aW9uczogY2RrX2Fzc2V0cy5DbGllbnRPcHRpb25zKTogUHJvbWlzZTxBV1MuRUNSPiB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLnNkayhvcHRpb25zKSkuZWNyKCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFuIFNESyBhcHByb3ByaWF0ZSBmb3IgdGhlIGdpdmVuIGNsaWVudCBvcHRpb25zXG4gICAqL1xuICBwcml2YXRlIHNkayhvcHRpb25zOiBjZGtfYXNzZXRzLkNsaWVudE9wdGlvbnMpOiBQcm9taXNlPElTREs+IHtcbiAgICBjb25zdCBlbnYgPSB7XG4gICAgICAuLi50aGlzLnRhcmdldEVudixcbiAgICAgIHJlZ2lvbjogb3B0aW9ucy5yZWdpb24gPz8gdGhpcy50YXJnZXRFbnYucmVnaW9uLCAvLyBEZWZhdWx0OiBzYW1lIHJlZ2lvbiBhcyB0aGUgc3RhY2tcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMuYXdzLmZvckVudmlyb25tZW50KGVudiwgTW9kZS5Gb3JXcml0aW5nLCB7XG4gICAgICBhc3N1bWVSb2xlQXJuOiBvcHRpb25zLmFzc3VtZVJvbGVBcm4sXG4gICAgICBhc3N1bWVSb2xlRXh0ZXJuYWxJZDogb3B0aW9ucy5hc3N1bWVSb2xlRXh0ZXJuYWxJZCxcbiAgICB9KTtcbiAgfVxufVxuXG5jb25zdCBFVkVOVF9UT19MT0dHRVI6IFJlY29yZDxjZGtfYXNzZXRzLkV2ZW50VHlwZSwgKHg6IHN0cmluZykgPT4gdm9pZD4gPSB7XG4gIGJ1aWxkOiBkZWJ1ZyxcbiAgY2FjaGVkOiBkZWJ1ZyxcbiAgY2hlY2s6IGRlYnVnLFxuICBkZWJ1ZyxcbiAgZmFpbDogZXJyb3IsXG4gIGZvdW5kOiBkZWJ1ZyxcbiAgc3RhcnQ6IHByaW50LFxuICBzdWNjZXNzOiBwcmludCxcbiAgdXBsb2FkOiBkZWJ1Zyxcbn07XG5cbmNsYXNzIFB1Ymxpc2hpbmdQcm9ncmVzc0xpc3RlbmVyIGltcGxlbWVudHMgY2RrX2Fzc2V0cy5JUHVibGlzaFByb2dyZXNzTGlzdGVuZXIge1xuICBwdWJsaWMgb25QdWJsaXNoRXZlbnQodHlwZTogY2RrX2Fzc2V0cy5FdmVudFR5cGUsIGV2ZW50OiBjZGtfYXNzZXRzLklQdWJsaXNoUHJvZ3Jlc3MpOiB2b2lkIHtcbiAgICBFVkVOVF9UT19MT0dHRVJbdHlwZV0oYFske2V2ZW50LnBlcmNlbnRDb21wbGV0ZX0lXSAke3R5cGV9OiAke2V2ZW50Lm1lc3NhZ2V9YCk7XG4gIH1cbn1cbiJdfQ==