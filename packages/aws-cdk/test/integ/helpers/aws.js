"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outputFromStack = exports.sleep = exports.retry = exports.isBucketMissingError = exports.isStackMissingError = exports.AwsClients = void 0;
const AWS = require("aws-sdk");
class AwsClients {
    constructor(region, output) {
        this.region = region;
        this.output = output;
        this.config = {
            credentials: chainableCredentials(this.region),
            region: this.region,
            maxRetries: 8,
            retryDelayOptions: { base: 500 },
            stsRegionalEndpoints: 'regional',
        };
        this.cloudFormation = makeAwsCaller(AWS.CloudFormation, this.config);
        this.s3 = makeAwsCaller(AWS.S3, this.config);
        this.ecr = makeAwsCaller(AWS.ECR, this.config);
        this.sns = makeAwsCaller(AWS.SNS, this.config);
        this.iam = makeAwsCaller(AWS.IAM, this.config);
        this.lambda = makeAwsCaller(AWS.Lambda, this.config);
        this.sts = makeAwsCaller(AWS.STS, this.config);
    }
    static async default(output) {
        var _a, _b;
        const region = (_b = (_a = process.env.AWS_REGION) !== null && _a !== void 0 ? _a : process.env.AWS_DEFAULT_REGION) !== null && _b !== void 0 ? _b : 'us-east-1';
        return AwsClients.forRegion(region, output);
    }
    static async forRegion(region, output) {
        return new AwsClients(region, output);
    }
    async account() {
        // Reduce # of retries, we use this as a circuit breaker for detecting no-config
        return (await new AWS.STS({ ...this.config, maxRetries: 1 }).getCallerIdentity().promise()).Account;
    }
    async deleteStacks(...stackNames) {
        if (stackNames.length === 0) {
            return;
        }
        for (const stackName of stackNames) {
            await this.cloudFormation('updateTerminationProtection', {
                EnableTerminationProtection: false,
                StackName: stackName,
            });
            await this.cloudFormation('deleteStack', {
                StackName: stackName,
            });
        }
        await retry(this.output, `Deleting ${stackNames}`, retry.forSeconds(600), async () => {
            for (const stackName of stackNames) {
                const status = await this.stackStatus(stackName);
                if (status !== undefined && status.endsWith('_FAILED')) {
                    throw retry.abort(new Error(`'${stackName}' is in state '${status}'`));
                }
                if (status !== undefined) {
                    throw new Error(`Delete of '${stackName}' not complete yet`);
                }
            }
        });
    }
    async stackStatus(stackName) {
        var _a;
        try {
            return (_a = (await this.cloudFormation('describeStacks', { StackName: stackName })).Stacks) === null || _a === void 0 ? void 0 : _a[0].StackStatus;
        }
        catch (e) {
            if (isStackMissingError(e)) {
                return undefined;
            }
            throw e;
        }
    }
    async emptyBucket(bucketName) {
        const objects = await this.s3('listObjects', { Bucket: bucketName });
        const deletes = (objects.Contents || []).map(obj => obj.Key || '').filter(d => !!d);
        if (deletes.length === 0) {
            return Promise.resolve();
        }
        return this.s3('deleteObjects', {
            Bucket: bucketName,
            Delete: {
                Objects: deletes.map(d => ({ Key: d })),
                Quiet: false,
            },
        });
    }
    async deleteImageRepository(repositoryName) {
        await this.ecr('deleteRepository', { repositoryName, force: true });
    }
    async deleteBucket(bucketName) {
        try {
            await this.emptyBucket(bucketName);
            await this.s3('deleteBucket', {
                Bucket: bucketName,
            });
        }
        catch (e) {
            if (isBucketMissingError(e)) {
                return;
            }
            throw e;
        }
    }
}
exports.AwsClients = AwsClients;
/**
 * Perform an AWS call from nothing
 *
 * Create the correct client, do the call and resole the promise().
 */
async function awsCall(ctor, config, call, request) {
    const cfn = new ctor(config);
    const response = cfn[call](request);
    try {
        return response.promise();
    }
    catch (e) {
        const newErr = new Error(`${call}(${JSON.stringify(request)}): ${e.message}`);
        newErr.code = e.code;
        throw newErr;
    }
}
/**
 * Factory function to invoke 'awsCall' for specific services.
 *
 * Not strictly necessary but calling this replaces a whole bunch of annoying generics you otherwise have to type:
 *
 * ```ts
 * export function cloudFormation<
 *   C extends keyof ServiceCalls<AWS.CloudFormation>,
 * >(call: C, request: First<ServiceCalls<AWS.CloudFormation>[C]>): Promise<Second<ServiceCalls<AWS.CloudFormation>[C]>> {
 *   return awsCall(AWS.CloudFormation, call, request);
 * }
 * ```
 */
function makeAwsCaller(ctor, config) {
    return (call, request) => {
        return awsCall(ctor, config, call, request);
    };
}
function isStackMissingError(e) {
    return e.message.indexOf('does not exist') > -1;
}
exports.isStackMissingError = isStackMissingError;
function isBucketMissingError(e) {
    return e.message.indexOf('does not exist') > -1;
}
exports.isBucketMissingError = isBucketMissingError;
/**
 * Retry an async operation until a deadline is hit.
 *
 * Use `retry.forSeconds()` to construct a deadline relative to right now.
 *
 * Exceptions will cause the operation to retry. Use `retry.abort` to annotate an exception
 * to stop the retry and end in a failure.
 */
async function retry(output, operation, deadline, block) {
    let i = 0;
    output.write(`💈 ${operation}\n`);
    while (true) {
        try {
            i++;
            const ret = await block();
            output.write(`💈 ${operation}: succeeded after ${i} attempts\n`);
            return ret;
        }
        catch (e) {
            if (e.abort || Date.now() > deadline.getTime()) {
                throw new Error(`${operation}: did not succeed after ${i} attempts: ${e}`);
            }
            output.write(`⏳ ${operation} (${e.message})\n`);
            await sleep(5000);
        }
    }
}
exports.retry = retry;
/**
 * Make a deadline for the `retry` function relative to the current time.
 */
retry.forSeconds = (seconds) => {
    return new Date(Date.now() + seconds * 1000);
};
/**
 * Annotate an error to stop the retrying
 */
retry.abort = (e) => {
    e.abort = true;
    return e;
};
async function sleep(ms) {
    return new Promise(ok => setTimeout(ok, ms));
}
exports.sleep = sleep;
function outputFromStack(key, stack) {
    var _a, _b;
    return (_b = ((_a = stack.Outputs) !== null && _a !== void 0 ? _a : []).find(o => o.OutputKey === key)) === null || _b === void 0 ? void 0 : _b.OutputValue;
}
exports.outputFromStack = outputFromStack;
function chainableCredentials(region) {
    const profileName = process.env.AWS_PROFILE;
    if (process.env.CODEBUILD_BUILD_ARN && profileName) {
        // in codebuild we must assume the role that the cdk uses
        // otherwise credentials will just be picked up by the normal sdk
        // heuristics and expire after an hour.
        // can't use '~' since the SDK doesn't seem to expand it...?
        const configPath = `${process.env.HOME}/.aws/config`;
        const ini = new AWS.IniLoader().loadFrom({
            filename: configPath,
            isConfig: true,
        });
        const profile = ini[profileName];
        if (!profile) {
            throw new Error(`Profile '${profileName}' does not exist in config file (${configPath})`);
        }
        const arn = profile.role_arn;
        const externalId = profile.external_id;
        if (!arn) {
            throw new Error(`role_arn does not exist in profile ${profileName}`);
        }
        if (!externalId) {
            throw new Error(`external_id does not exist in profile ${externalId}`);
        }
        return new AWS.ChainableTemporaryCredentials({
            params: {
                RoleArn: arn,
                ExternalId: externalId,
                RoleSessionName: 'integ-tests',
            },
            stsConfig: {
                region,
            },
            masterCredentials: new AWS.ECSCredentials(),
        });
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXdzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtCQUErQjtBQUUvQixNQUFhLFVBQVU7SUFvQnJCLFlBQTRCLE1BQWMsRUFBbUIsTUFBNkI7UUFBOUQsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUFtQixXQUFNLEdBQU4sTUFBTSxDQUF1QjtRQUN4RixJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osV0FBVyxFQUFFLG9CQUFvQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDOUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1lBQ25CLFVBQVUsRUFBRSxDQUFDO1lBQ2IsaUJBQWlCLEVBQUUsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFO1lBQ2hDLG9CQUFvQixFQUFFLFVBQVU7U0FDakMsQ0FBQztRQUNGLElBQUksQ0FBQyxjQUFjLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JFLElBQUksQ0FBQyxFQUFFLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JELElBQUks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QzNGO1FBRUQsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztRQUM3QixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDO1FBRXZDLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDUixNQUFNLElBQUksS0FBSyxDQUFDLHNDQUFzQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1NBQ3RFO1FBRUQsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLFVBQVUsRUFBRSxDQUFDLENBQUM7U0FDeEU7UUFFRCxPQUFPLElBQUksR0FBRyxDQUFDLDZCQUE2QixDQUFDO1lBQzNDLE1BQU0sRUFBRTtnQkFDTixPQUFPLEVBQUUsR0FBRztnQkFDWixVQUFVLEVBQUUsVUFBVTtnQkFDdEIsZUFBZSxFQUFFLGFBQWE7YUFDL0I7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsTUFBTTthQUNQO1lBQ0QsaUJBQWlCLEVBQUUsSUFBSSxHQUFHLENBQUMsY0FBYyxFQUFFO1NBQzVDLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFFbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEFXUyBmcm9tICdhd3Mtc2RrJztcblxuZXhwb3J0IGNsYXNzIEF3c0NsaWVudHMge1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGRlZmF1bHQob3V0cHV0OiBOb2RlSlMuV3JpdGFibGVTdHJlYW0pIHtcbiAgICBjb25zdCByZWdpb24gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OID8/IHByb2Nlc3MuZW52LkFXU19ERUZBVUxUX1JFR0lPTiA/PyAndXMtZWFzdC0xJztcbiAgICByZXR1cm4gQXdzQ2xpZW50cy5mb3JSZWdpb24ocmVnaW9uLCBvdXRwdXQpO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBmb3JSZWdpb24ocmVnaW9uOiBzdHJpbmcsIG91dHB1dDogTm9kZUpTLldyaXRhYmxlU3RyZWFtKSB7XG4gICAgcmV0dXJuIG5ldyBBd3NDbGllbnRzKHJlZ2lvbiwgb3V0cHV0KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnOiBhbnk7XG5cbiAgcHVibGljIHJlYWRvbmx5IGNsb3VkRm9ybWF0aW9uOiBBd3NDYWxsZXI8QVdTLkNsb3VkRm9ybWF0aW9uPjtcbiAgcHVibGljIHJlYWRvbmx5IHMzOiBBd3NDYWxsZXI8QVdTLlMzPjtcbiAgcHVibGljIHJlYWRvbmx5IGVjcjogQXdzQ2FsbGVyPEFXUy5FQ1I+O1xuICBwdWJsaWMgcmVhZG9ubHkgc25zOiBBd3NDYWxsZXI8QVdTLlNOUz47XG4gIHB1YmxpYyByZWFkb25seSBpYW06IEF3c0NhbGxlcjxBV1MuSUFNPjtcbiAgcHVibGljIHJlYWRvbmx5IGxhbWJkYTogQXdzQ2FsbGVyPEFXUy5MYW1iZGE+O1xuICBwdWJsaWMgcmVhZG9ubHkgc3RzOiBBd3NDYWxsZXI8QVdTLlNUUz47XG5cbiAgY29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IHJlZ2lvbjogc3RyaW5nLCBwcml2YXRlIHJlYWRvbmx5IG91dHB1dDogTm9kZUpTLldyaXRhYmxlU3RyZWFtKSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBjcmVkZW50aWFsczogY2hhaW5hYmxlQ3JlZGVudGlhbHModGhpcy5yZWdpb24pLFxuICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgIG1heFJldHJpZXM6IDgsXG4gICAgICByZXRyeURlbGF5T3B0aW9uczogeyBiYXNlOiA1MDAgfSxcbiAgICAgIHN0c1JlZ2lvbmFsRW5kcG9pbnRzOiAncmVnaW9uYWwnLFxuICAgIH07XG4gICAgdGhpcy5jbG91ZEZvcm1hdGlvbiA9IG1ha2VBd3NDYWxsZXIoQVdTLkNsb3VkRm9ybWF0aW9uLCB0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy5zMyA9IG1ha2VBd3NDYWxsZXIoQVdTLlMzLCB0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy5lY3IgPSBtYWtlQXdzQ2FsbGVyKEFXUy5FQ1IsIHRoaXMuY29uZmlnKTtcbiAgICB0aGlzLnNucyA9IG1ha2VBd3NDYWxsZXIoQVdTLlNOUywgdGhpcy5jb25maWcpO1xuICAgIHRoaXMuaWFtID0gbWFrZUF3c0NhbGxlcihBV1MuSUFNLCB0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy5sYW1iZGEgPSBtYWtlQXdzQ2FsbGVyKEFXUy5MYW1iZGEsIHRoaXMuY29uZmlnKTtcbiAgICB0aGlzLnN0cyA9IG1ha2VBd3NDYWxsZXIoQVdTLlNUUywgdGhpcy5jb25maWcpO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGFjY291bnQoKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAvLyBSZWR1Y2UgIyBvZiByZXRyaWVzLCB3ZSB1c2UgdGhpcyBhcyBhIGNpcmN1aXQgYnJlYWtlciBmb3IgZGV0ZWN0aW5nIG5vLWNvbmZpZ1xuICAgIHJldHVybiAoYXdhaXQgbmV3IEFXUy5TVFMoeyAuLi50aGlzLmNvbmZpZywgbWF4UmV0cmllczogMSB9KS5nZXRDYWxsZXJJZGVudGl0eSgpLnByb21pc2UoKSkuQWNjb3VudCE7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGVsZXRlU3RhY2tzKC4uLnN0YWNrTmFtZXM6IHN0cmluZ1tdKSB7XG4gICAgaWYgKHN0YWNrTmFtZXMubGVuZ3RoID09PSAwKSB7IHJldHVybjsgfVxuXG4gICAgZm9yIChjb25zdCBzdGFja05hbWUgb2Ygc3RhY2tOYW1lcykge1xuICAgICAgYXdhaXQgdGhpcy5jbG91ZEZvcm1hdGlvbigndXBkYXRlVGVybWluYXRpb25Qcm90ZWN0aW9uJywge1xuICAgICAgICBFbmFibGVUZXJtaW5hdGlvblByb3RlY3Rpb246IGZhbHNlLFxuICAgICAgICBTdGFja05hbWU6IHN0YWNrTmFtZSxcbiAgICAgIH0pO1xuICAgICAgYXdhaXQgdGhpcy5jbG91ZEZvcm1hdGlvbignZGVsZXRlU3RhY2snLCB7XG4gICAgICAgIFN0YWNrTmFtZTogc3RhY2tOYW1lLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgYXdhaXQgcmV0cnkodGhpcy5vdXRwdXQsIGBEZWxldGluZyAke3N0YWNrTmFtZXN9YCwgcmV0cnkuZm9yU2Vjb25kcyg2MDApLCBhc3luYyAoKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IHN0YWNrTmFtZSBvZiBzdGFja05hbWVzKSB7XG4gICAgICAgIGNvbnN0IHN0YXR1cyA9IGF3YWl0IHRoaXMuc3RhY2tTdGF0dXMoc3RhY2tOYW1lKTtcbiAgICAgICAgaWYgKHN0YXR1cyAhPT0gdW5kZWZpbmVkICYmIHN0YXR1cy5lbmRzV2l0aCgnX0ZBSUxFRCcpKSB7XG4gICAgICAgICAgdGhyb3cgcmV0cnkuYWJvcnQobmV3IEVycm9yKGAnJHtzdGFja05hbWV9JyBpcyBpbiBzdGF0ZSAnJHtzdGF0dXN9J2ApKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYERlbGV0ZSBvZiAnJHtzdGFja05hbWV9JyBub3QgY29tcGxldGUgeWV0YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBzdGFja1N0YXR1cyhzdGFja05hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiAoYXdhaXQgdGhpcy5jbG91ZEZvcm1hdGlvbignZGVzY3JpYmVTdGFja3MnLCB7IFN0YWNrTmFtZTogc3RhY2tOYW1lIH0pKS5TdGFja3M/LlswXS5TdGFja1N0YXR1cztcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoaXNTdGFja01pc3NpbmdFcnJvcihlKSkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBlbXB0eUJ1Y2tldChidWNrZXROYW1lOiBzdHJpbmcpIHtcbiAgICBjb25zdCBvYmplY3RzID0gYXdhaXQgdGhpcy5zMygnbGlzdE9iamVjdHMnLCB7IEJ1Y2tldDogYnVja2V0TmFtZSB9KTtcbiAgICBjb25zdCBkZWxldGVzID0gKG9iamVjdHMuQ29udGVudHMgfHwgW10pLm1hcChvYmogPT4gb2JqLktleSB8fCAnJykuZmlsdGVyKGQgPT4gISFkKTtcbiAgICBpZiAoZGVsZXRlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuczMoJ2RlbGV0ZU9iamVjdHMnLCB7XG4gICAgICBCdWNrZXQ6IGJ1Y2tldE5hbWUsXG4gICAgICBEZWxldGU6IHtcbiAgICAgICAgT2JqZWN0czogZGVsZXRlcy5tYXAoZCA9PiAoeyBLZXk6IGQgfSkpLFxuICAgICAgICBRdWlldDogZmFsc2UsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGRlbGV0ZUltYWdlUmVwb3NpdG9yeShyZXBvc2l0b3J5TmFtZTogc3RyaW5nKSB7XG4gICAgYXdhaXQgdGhpcy5lY3IoJ2RlbGV0ZVJlcG9zaXRvcnknLCB7IHJlcG9zaXRvcnlOYW1lLCBmb3JjZTogdHJ1ZSB9KTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZWxldGVCdWNrZXQoYnVja2V0TmFtZTogc3RyaW5nKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuZW1wdHlCdWNrZXQoYnVja2V0TmFtZSk7XG4gICAgICBhd2FpdCB0aGlzLnMzKCdkZWxldGVCdWNrZXQnLCB7XG4gICAgICAgIEJ1Y2tldDogYnVja2V0TmFtZSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChpc0J1Y2tldE1pc3NpbmdFcnJvcihlKSkgeyByZXR1cm47IH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUGVyZm9ybSBhbiBBV1MgY2FsbCBmcm9tIG5vdGhpbmdcbiAqXG4gKiBDcmVhdGUgdGhlIGNvcnJlY3QgY2xpZW50LCBkbyB0aGUgY2FsbCBhbmQgcmVzb2xlIHRoZSBwcm9taXNlKCkuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGF3c0NhbGw8XG4gIEEgZXh0ZW5kcyBBV1MuU2VydmljZSxcbiAgQiBleHRlbmRzIGtleW9mIFNlcnZpY2VDYWxsczxBPixcbj4oY3RvcjogbmV3IChjb25maWc6IGFueSkgPT4gQSwgY29uZmlnOiBhbnksIGNhbGw6IEIsIHJlcXVlc3Q6IEZpcnN0PFNlcnZpY2VDYWxsczxBPltCXT4pOiBQcm9taXNlPFNlY29uZDxTZXJ2aWNlQ2FsbHM8QT5bQl0+PiB7XG4gIGNvbnN0IGNmbiA9IG5ldyBjdG9yKGNvbmZpZyk7XG4gIGNvbnN0IHJlc3BvbnNlID0gY2ZuW2NhbGxdKHJlcXVlc3QpO1xuICB0cnkge1xuICAgIHJldHVybiByZXNwb25zZS5wcm9taXNlKCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zdCBuZXdFcnIgPSBuZXcgRXJyb3IoYCR7Y2FsbH0oJHtKU09OLnN0cmluZ2lmeShyZXF1ZXN0KX0pOiAke2UubWVzc2FnZX1gKTtcbiAgICAobmV3RXJyIGFzIGFueSkuY29kZSA9IGUuY29kZTtcbiAgICB0aHJvdyBuZXdFcnI7XG4gIH1cbn1cblxudHlwZSBBd3NDYWxsZXI8QT4gPSA8QiBleHRlbmRzIGtleW9mIFNlcnZpY2VDYWxsczxBPj4oY2FsbDogQiwgcmVxdWVzdDogRmlyc3Q8U2VydmljZUNhbGxzPEE+W0JdPikgPT4gUHJvbWlzZTxTZWNvbmQ8U2VydmljZUNhbGxzPEE+W0JdPj47XG5cbi8qKlxuICogRmFjdG9yeSBmdW5jdGlvbiB0byBpbnZva2UgJ2F3c0NhbGwnIGZvciBzcGVjaWZpYyBzZXJ2aWNlcy5cbiAqXG4gKiBOb3Qgc3RyaWN0bHkgbmVjZXNzYXJ5IGJ1dCBjYWxsaW5nIHRoaXMgcmVwbGFjZXMgYSB3aG9sZSBidW5jaCBvZiBhbm5veWluZyBnZW5lcmljcyB5b3Ugb3RoZXJ3aXNlIGhhdmUgdG8gdHlwZTpcbiAqXG4gKiBgYGB0c1xuICogZXhwb3J0IGZ1bmN0aW9uIGNsb3VkRm9ybWF0aW9uPFxuICogICBDIGV4dGVuZHMga2V5b2YgU2VydmljZUNhbGxzPEFXUy5DbG91ZEZvcm1hdGlvbj4sXG4gKiA+KGNhbGw6IEMsIHJlcXVlc3Q6IEZpcnN0PFNlcnZpY2VDYWxsczxBV1MuQ2xvdWRGb3JtYXRpb24+W0NdPik6IFByb21pc2U8U2Vjb25kPFNlcnZpY2VDYWxsczxBV1MuQ2xvdWRGb3JtYXRpb24+W0NdPj4ge1xuICogICByZXR1cm4gYXdzQ2FsbChBV1MuQ2xvdWRGb3JtYXRpb24sIGNhbGwsIHJlcXVlc3QpO1xuICogfVxuICogYGBgXG4gKi9cbmZ1bmN0aW9uIG1ha2VBd3NDYWxsZXI8QSBleHRlbmRzIEFXUy5TZXJ2aWNlPihjdG9yOiBuZXcgKGNvbmZpZzogYW55KSA9PiBBLCBjb25maWc6IGFueSk6IEF3c0NhbGxlcjxBPiB7XG4gIHJldHVybiA8QiBleHRlbmRzIGtleW9mIFNlcnZpY2VDYWxsczxBPj4oY2FsbDogQiwgcmVxdWVzdDogRmlyc3Q8U2VydmljZUNhbGxzPEE+W0JdPik6IFByb21pc2U8U2Vjb25kPFNlcnZpY2VDYWxsczxBPltCXT4+ID0+IHtcbiAgICByZXR1cm4gYXdzQ2FsbChjdG9yLCBjb25maWcsIGNhbGwsIHJlcXVlc3QpO1xuICB9O1xufVxuXG50eXBlIFNlcnZpY2VDYWxsczxUPiA9IE5vTmF5TmV2ZXI8U2ltcGxpZmllZFNlcnZpY2U8VD4+O1xuLy8gTWFwIGV2ZXIgbWVtYmVyIGluIHRoZSB0eXBlIHRvIHRoZSBpbXBvcnRhbnQgQVdTIGNhbGwgb3ZlcmxvYWQsIG9yIHRvICduZXZlcidcbnR5cGUgU2ltcGxpZmllZFNlcnZpY2U8VD4gPSB7W2sgaW4ga2V5b2YgVF06IEF3c0NhbGxJTzxUW2tdPn07XG4vLyBSZW1vdmUgYWxsICduZXZlcicgdHlwZXMgZnJvbSBhbiBvYmplY3QgdHlwZVxudHlwZSBOb05heU5ldmVyPFQ+ID0gUGljazxULCB7W2sgaW4ga2V5b2YgVF06IFRba10gZXh0ZW5kcyBuZXZlciA/IG5ldmVyIDogayB9W2tleW9mIFRdPjtcblxuLy8gQmVjYXVzZSBvZiB0aGUgb3ZlcmxvYWRzIGFuIEFXUyBoYW5kbGVyIHR5cGUgbG9va3MgbGlrZSB0aGlzOlxuLy9cbi8vICAge1xuLy8gICAgICAocGFyYW1zOiBJTlBVVFNUUlVDVCwgY2FsbGJhY2s/OiAoKGVycjogQVdTRXJyb3IsIGRhdGE6IHt9KSA9PiB2b2lkKSB8IHVuZGVmaW5lZCk6IFJlcXVlc3Q8T1VUUFVULCAuLi4+O1xuLy8gICAgICAoY2FsbGJhY2s/OiAoKGVycjogQVdTLkFXU0Vycm9yLCBkYXRhOiB7fSkgPT4gdm9pZCkgfCB1bmRlZmluZWQpOiBBV1MuUmVxdWVzdDwuLi4+O1xuLy8gICB9XG4vL1xuLy8gR2V0IHRoZSBmaXJzdCBvdmVybG9hZCBhbmQgZXh0cmFjdCB0aGUgaW5wdXQgYW5kIG91dHB1dCBzdHJ1Y3QgdHlwZXNcbnR5cGUgQXdzQ2FsbElPPFQ+ID1cbiAgVCBleHRlbmRzIHtcbiAgICAoYXJnczogaW5mZXIgSU5QVVQsIGNhbGxiYWNrPzogKChlcnI6IEFXUy5BV1NFcnJvciwgZGF0YTogYW55KSA9PiB2b2lkKSB8IHVuZGVmaW5lZCk6IEFXUy5SZXF1ZXN0PGluZmVyIE9VVFBVVCwgQVdTLkFXU0Vycm9yPjtcbiAgICAoY2FsbGJhY2s/OiAoKGVycjogQVdTLkFXU0Vycm9yLCBkYXRhOiB7fSkgPT4gdm9pZCkgfCB1bmRlZmluZWQpOiBBV1MuUmVxdWVzdDxhbnksIGFueT47XG4gIH0gPyBbSU5QVVQsIE9VVFBVVF0gOiBuZXZlcjtcblxudHlwZSBGaXJzdDxUPiA9IFQgZXh0ZW5kcyBbYW55LCBhbnldID8gVFswXSA6IG5ldmVyO1xudHlwZSBTZWNvbmQ8VD4gPSBUIGV4dGVuZHMgW2FueSwgYW55XSA/IFRbMV0gOiBuZXZlcjtcblxuXG5leHBvcnQgZnVuY3Rpb24gaXNTdGFja01pc3NpbmdFcnJvcihlOiBFcnJvcikge1xuICByZXR1cm4gZS5tZXNzYWdlLmluZGV4T2YoJ2RvZXMgbm90IGV4aXN0JykgPiAtMTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQnVja2V0TWlzc2luZ0Vycm9yKGU6IEVycm9yKSB7XG4gIHJldHVybiBlLm1lc3NhZ2UuaW5kZXhPZignZG9lcyBub3QgZXhpc3QnKSA+IC0xO1xufVxuXG4vKipcbiAqIFJldHJ5IGFuIGFzeW5jIG9wZXJhdGlvbiB1bnRpbCBhIGRlYWRsaW5lIGlzIGhpdC5cbiAqXG4gKiBVc2UgYHJldHJ5LmZvclNlY29uZHMoKWAgdG8gY29uc3RydWN0IGEgZGVhZGxpbmUgcmVsYXRpdmUgdG8gcmlnaHQgbm93LlxuICpcbiAqIEV4Y2VwdGlvbnMgd2lsbCBjYXVzZSB0aGUgb3BlcmF0aW9uIHRvIHJldHJ5LiBVc2UgYHJldHJ5LmFib3J0YCB0byBhbm5vdGF0ZSBhbiBleGNlcHRpb25cbiAqIHRvIHN0b3AgdGhlIHJldHJ5IGFuZCBlbmQgaW4gYSBmYWlsdXJlLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmV0cnk8QT4ob3V0cHV0OiBOb2RlSlMuV3JpdGFibGVTdHJlYW0sIG9wZXJhdGlvbjogc3RyaW5nLCBkZWFkbGluZTogRGF0ZSwgYmxvY2s6ICgpID0+IFByb21pc2U8QT4pOiBQcm9taXNlPEE+IHtcbiAgbGV0IGkgPSAwO1xuICBvdXRwdXQud3JpdGUoYPCfkoggJHtvcGVyYXRpb259XFxuYCk7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGkrKztcbiAgICAgIGNvbnN0IHJldCA9IGF3YWl0IGJsb2NrKCk7XG4gICAgICBvdXRwdXQud3JpdGUoYPCfkoggJHtvcGVyYXRpb259OiBzdWNjZWVkZWQgYWZ0ZXIgJHtpfSBhdHRlbXB0c1xcbmApO1xuICAgICAgcmV0dXJuIHJldDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5hYm9ydCB8fCBEYXRlLm5vdygpID4gZGVhZGxpbmUuZ2V0VGltZSggKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7b3BlcmF0aW9ufTogZGlkIG5vdCBzdWNjZWVkIGFmdGVyICR7aX0gYXR0ZW1wdHM6ICR7ZX1gKTtcbiAgICAgIH1cbiAgICAgIG91dHB1dC53cml0ZShg4o+zICR7b3BlcmF0aW9ufSAoJHtlLm1lc3NhZ2V9KVxcbmApO1xuICAgICAgYXdhaXQgc2xlZXAoNTAwMCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTWFrZSBhIGRlYWRsaW5lIGZvciB0aGUgYHJldHJ5YCBmdW5jdGlvbiByZWxhdGl2ZSB0byB0aGUgY3VycmVudCB0aW1lLlxuICovXG5yZXRyeS5mb3JTZWNvbmRzID0gKHNlY29uZHM6IG51bWJlcik6IERhdGUgPT4ge1xuICByZXR1cm4gbmV3IERhdGUoRGF0ZS5ub3coKSArIHNlY29uZHMgKiAxMDAwKTtcbn07XG5cbi8qKlxuICogQW5ub3RhdGUgYW4gZXJyb3IgdG8gc3RvcCB0aGUgcmV0cnlpbmdcbiAqL1xucmV0cnkuYWJvcnQgPSAoZTogRXJyb3IpOiBFcnJvciA9PiB7XG4gIChlIGFzIGFueSkuYWJvcnQgPSB0cnVlO1xuICByZXR1cm4gZTtcbn07XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzbGVlcChtczogbnVtYmVyKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShvayA9PiBzZXRUaW1lb3V0KG9rLCBtcykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gb3V0cHV0RnJvbVN0YWNrKGtleTogc3RyaW5nLCBzdGFjazogQVdTLkNsb3VkRm9ybWF0aW9uLlN0YWNrKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIChzdGFjay5PdXRwdXRzID8/IFtdKS5maW5kKG8gPT4gby5PdXRwdXRLZXkgPT09IGtleSk/Lk91dHB1dFZhbHVlO1xufVxuXG5mdW5jdGlvbiBjaGFpbmFibGVDcmVkZW50aWFscyhyZWdpb246IHN0cmluZyk6IEFXUy5DcmVkZW50aWFscyB8IHVuZGVmaW5lZCB7XG5cbiAgY29uc3QgcHJvZmlsZU5hbWUgPSBwcm9jZXNzLmVudi5BV1NfUFJPRklMRTtcbiAgaWYgKHByb2Nlc3MuZW52LkNPREVCVUlMRF9CVUlMRF9BUk4gJiYgcHJvZmlsZU5hbWUpIHtcblxuICAgIC8vIGluIGNvZGVidWlsZCB3ZSBtdXN0IGFzc3VtZSB0aGUgcm9sZSB0aGF0IHRoZSBjZGsgdXNlc1xuICAgIC8vIG90aGVyd2lzZSBjcmVkZW50aWFscyB3aWxsIGp1c3QgYmUgcGlja2VkIHVwIGJ5IHRoZSBub3JtYWwgc2RrXG4gICAgLy8gaGV1cmlzdGljcyBhbmQgZXhwaXJlIGFmdGVyIGFuIGhvdXIuXG5cbiAgICAvLyBjYW4ndCB1c2UgJ34nIHNpbmNlIHRoZSBTREsgZG9lc24ndCBzZWVtIHRvIGV4cGFuZCBpdC4uLj9cbiAgICBjb25zdCBjb25maWdQYXRoID0gYCR7cHJvY2Vzcy5lbnYuSE9NRX0vLmF3cy9jb25maWdgO1xuICAgIGNvbnN0IGluaSA9IG5ldyBBV1MuSW5pTG9hZGVyKCkubG9hZEZyb20oe1xuICAgICAgZmlsZW5hbWU6IGNvbmZpZ1BhdGgsXG4gICAgICBpc0NvbmZpZzogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHByb2ZpbGUgPSBpbmlbcHJvZmlsZU5hbWVdO1xuXG4gICAgaWYgKCFwcm9maWxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb2ZpbGUgJyR7cHJvZmlsZU5hbWV9JyBkb2VzIG5vdCBleGlzdCBpbiBjb25maWcgZmlsZSAoJHtjb25maWdQYXRofSlgKTtcbiAgICB9XG5cbiAgICBjb25zdCBhcm4gPSBwcm9maWxlLnJvbGVfYXJuO1xuICAgIGNvbnN0IGV4dGVybmFsSWQgPSBwcm9maWxlLmV4dGVybmFsX2lkO1xuXG4gICAgaWYgKCFhcm4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgcm9sZV9hcm4gZG9lcyBub3QgZXhpc3QgaW4gcHJvZmlsZSAke3Byb2ZpbGVOYW1lfWApO1xuICAgIH1cblxuICAgIGlmICghZXh0ZXJuYWxJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBleHRlcm5hbF9pZCBkb2VzIG5vdCBleGlzdCBpbiBwcm9maWxlICR7ZXh0ZXJuYWxJZH1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFXUy5DaGFpbmFibGVUZW1wb3JhcnlDcmVkZW50aWFscyh7XG4gICAgICBwYXJhbXM6IHtcbiAgICAgICAgUm9sZUFybjogYXJuLFxuICAgICAgICBFeHRlcm5hbElkOiBleHRlcm5hbElkLFxuICAgICAgICBSb2xlU2Vzc2lvbk5hbWU6ICdpbnRlZy10ZXN0cycsXG4gICAgICB9LFxuICAgICAgc3RzQ29uZmlnOiB7XG4gICAgICAgIHJlZ2lvbixcbiAgICAgIH0sXG4gICAgICBtYXN0ZXJDcmVkZW50aWFsczogbmV3IEFXUy5FQ1NDcmVkZW50aWFscygpLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcblxufVxuIl19